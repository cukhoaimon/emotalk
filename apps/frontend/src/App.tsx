import { useEffect, useMemo, useRef, useState } from "react";
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";
import {
  AnalysisResponse,
  AgoraSession,
  AppMode,
  analyzeLiveAudio,
  fetchAgoraSession,
} from "./lib/api";
import { SUPPORTED_EMOTIONS, SupportedEmotion } from "./lib/emotions";

type TranscriptEntry = {
  id: string;
  createdAt: string;
  transcript: string;
  emotions: SupportedEmotion[];
};

const LIVE_CHUNK_DURATION_MS = 6000;
const LIVE_CHUNK_GAP_MS = 350;
const MIN_ANALYSIS_BLOB_SIZE_BYTES = 2048;

const envAppId = import.meta.env.VITE_AGORA_APP_ID ?? "";
const envChannel = import.meta.env.VITE_AGORA_CHANNEL ?? "emotalk";
const envToken = import.meta.env.VITE_AGORA_TOKEN ?? null;
const envUidRaw = import.meta.env.VITE_AGORA_UID;
const backendBaseUrl = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3000";

function parseEnvUid(rawUid: string | undefined) {
  if (!rawUid) {
    return null;
  }

  const numericUid = Number(rawUid);
  return Number.isNaN(numericUid) ? rawUid : numericUid;
}

function getModeFromLocation(): AppMode {
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get("mode") === "debug" ? "debug" : "broadcast";
}

function getChannelFromLocation() {
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get("channel") || envChannel;
}

function shouldAutoJoin() {
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get("autojoin") === "1";
}

function getTimeLabel() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getSupportedLiveAudioMimeType() {
  const mimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return mimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? "";
}

function getLiveAudioExtension(mimeType: string) {
  if (mimeType.includes("mp4")) {
    return "mp4";
  }

  return "webm";
}

function App() {
  const mode = getModeFromLocation();
  const isDebugMode = mode === "debug";
  const autoJoin = shouldAutoJoin();
  const clientState = useMemo<{ client: IAgoraRTCClient | null; clientError: string | null }>(() => {
    try {
      return {
        client: AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }),
        clientError: null,
      };
    } catch (error) {
      return {
        client: null,
        clientError:
          error instanceof Error ? error.message : "Agora RTC failed to initialize.",
      };
    }
  }, []);
  const client = clientState.client;
  const clientError = clientState.clientError;
  const localContainerRef = useRef<HTMLDivElement>(null);
  const remoteContainerRef = useRef<HTMLDivElement>(null);
  const cameraTrackRef = useRef<ICameraVideoTrack | null>(null);
  const micTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const liveRecorderRef = useRef<MediaRecorder | null>(null);
  const liveAudioStreamRef = useRef<MediaStream | null>(null);
  const liveChunkTimeoutRef = useRef<number | null>(null);
  const liveChunkPartsRef = useRef<Blob[]>([]);
  const liveLoopEnabledRef = useRef(false);
  const liveRequestSequenceRef = useRef(0);
  const hasAutoJoinedRef = useRef(false);
  const selectedEmotionsRef = useRef<SupportedEmotion[]>([]);
  const previousEmotionKeyRef = useRef("");
  const joinedRef = useRef(false);
  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [session, setSession] = useState<AgoraSession | null>(null);
  const [channelInput, setChannelInput] = useState(getChannelFromLocation());
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedEmotions, setSelectedEmotions] = useState<SupportedEmotion[]>(["joy"]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isListeningLive, setIsListeningLive] = useState(false);
  const [liveStatus, setLiveStatus] = useState("Join the channel to start live listening.");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);

  const appendLog = (message: string) => {
    setLogs((currentLogs) => [`${getTimeLabel()}  ${message}`, ...currentLogs].slice(0, 18));
  };

  useEffect(() => {
    joinedRef.current = joined;
  }, [joined]);

  useEffect(() => {
    selectedEmotionsRef.current = selectedEmotions;
  }, [selectedEmotions]);

  useEffect(() => {
    if (!client) {
      return;
    }

    const handleUserPublished = async (
      user: IAgoraRTCRemoteUser,
      mediaType: "audio" | "video"
    ) => {
      appendLog(`Remote user ${user.uid} published ${mediaType}.`);
      await client.subscribe(user, mediaType);

      if (mediaType === "video" && user.videoTrack && remoteContainerRef.current) {
        remoteContainerRef.current.querySelector(".empty-state")?.remove();
        let remotePlayer = document.getElementById(`remote-${user.uid}`);
        if (!remotePlayer) {
          remotePlayer = document.createElement("div");
          remotePlayer.id = `remote-${user.uid}`;
          remotePlayer.className = "video-tile";
          remoteContainerRef.current.appendChild(remotePlayer);
        }

        user.videoTrack.play(remotePlayer);
      }

      if (mediaType === "audio" && user.audioTrack) {
        user.audioTrack.play();
      }
    };

    const removeRemoteUser = (user: IAgoraRTCRemoteUser) => {
      appendLog(`Remote user ${user.uid} left or unpublished.`);
      const remotePlayer = document.getElementById(`remote-${user.uid}`);
      if (remotePlayer) {
        remotePlayer.remove();
      }
    };

    const handleConnectionStateChange = (currentState: string, previousState: string) => {
      appendLog(`Connection ${previousState} -> ${currentState}.`);
    };

    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", removeRemoteUser);
    client.on("user-left", removeRemoteUser);
    client.on("connection-state-change", handleConnectionStateChange);

    return () => {
      client.off("user-published", handleUserPublished);
      client.off("user-unpublished", removeRemoteUser);
      client.off("user-left", removeRemoteUser);
      client.off("connection-state-change", handleConnectionStateChange);
    };
  }, [client]);

  const renderEmptyState = (container: HTMLDivElement | null, message: string) => {
    if (!container) {
      return;
    }

    container.innerHTML = "";
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = message;
    container.appendChild(emptyState);
  };

  useEffect(() => {
    if (isDebugMode) {
      renderEmptyState(localContainerRef.current, "Local capture is disabled in debug mode.");
    }

    renderEmptyState(remoteContainerRef.current, "No remote tracks connected yet.");
  }, [isDebugMode]);

  const renderLocalVideo = (track: ICameraVideoTrack) => {
    if (!localContainerRef.current) {
      return;
    }

    localContainerRef.current.innerHTML = "";
    const localPlayer = document.createElement("div");
    localPlayer.className = "video-tile";
    localContainerRef.current.appendChild(localPlayer);
    track.play(localPlayer);
  };

  const clearVideoContainers = () => {
    if (localContainerRef.current) {
      localContainerRef.current.innerHTML = "";
      if (isDebugMode) {
        renderEmptyState(localContainerRef.current, "Local capture is disabled in debug mode.");
      }
    }

    if (remoteContainerRef.current) {
      renderEmptyState(remoteContainerRef.current, "No remote tracks connected yet.");
    }
  };

  const clearLiveAudioStream = () => {
    liveAudioStreamRef.current?.getTracks().forEach((track) => track.stop());
    liveAudioStreamRef.current = null;
  };

  const clearLiveChunkTimeout = () => {
    if (liveChunkTimeoutRef.current !== null) {
      window.clearTimeout(liveChunkTimeoutRef.current);
      liveChunkTimeoutRef.current = null;
    }
  };

  const stopLiveListeningLoop = (statusMessage?: string) => {
    liveLoopEnabledRef.current = false;
    clearLiveChunkTimeout();

    const recorder = liveRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      clearLiveAudioStream();
      liveRecorderRef.current = null;
    }

    liveChunkPartsRef.current = [];
    setIsListeningLive(false);

    if (statusMessage) {
      setLiveStatus(statusMessage);
    }
  };

  const cleanupLocalTracks = () => {
    stopLiveListeningLoop("Live listening stopped.");
    cameraTrackRef.current?.stop();
    cameraTrackRef.current?.close();
    micTrackRef.current?.stop();
    micTrackRef.current?.close();
    cameraTrackRef.current = null;
    micTrackRef.current = null;
  };

  const sendLiveAudioChunk = async (
    audioBlob: Blob,
    mimeType: string,
    emotions: SupportedEmotion[]
  ) => {
    if (emotions.length === 0) {
      stopLiveListeningLoop("Pick at least one emotion to restart live listening.");
      return;
    }

    const chunkId = `${Date.now()}`;
    const requestId = ++liveRequestSequenceRef.current;
    const file = new File([audioBlob], `emotalk-live-${chunkId}.${getLiveAudioExtension(mimeType)}`, {
      type: mimeType,
    });

    try {
      setIsAnalyzing(true);
      setAnalysisError(null);
      setLiveStatus(`Analyzing live speech for ${emotions.join(", ")}.`);

      const result = await analyzeLiveAudio(backendBaseUrl, file, emotions);

      if (requestId !== liveRequestSequenceRef.current) {
        return;
      }

      setAnalysisResult(result);
      setTranscriptEntries((currentEntries) => [
        {
          id: chunkId,
          createdAt: getTimeLabel(),
          transcript: result.transcript,
          emotions,
        },
        ...currentEntries,
      ].slice(0, 6));
      appendLog(`Live response updated for ${emotions.join(", ")}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Live audio analysis failed.";
      setAnalysisError(message);
      appendLog(`Live analysis failed: ${message}`);
    } finally {
      setIsAnalyzing(false);

      if (!liveLoopEnabledRef.current || !joinedRef.current || selectedEmotionsRef.current.length === 0) {
        setIsListeningLive(false);
        return;
      }

      window.setTimeout(() => {
        void startLiveListeningChunk();
      }, LIVE_CHUNK_GAP_MS);
    }
  };

  async function startLiveListeningChunk() {
    if (!liveLoopEnabledRef.current || !joinedRef.current || !micTrackRef.current) {
      return;
    }

    const mimeType = getSupportedLiveAudioMimeType();

    if (!mimeType) {
      setAnalysisError("This browser does not support live audio chunk recording for analysis.");
      stopLiveListeningLoop("Live listening is unavailable in this browser.");
      return;
    }

    const emotions = [...selectedEmotionsRef.current];
    if (emotions.length === 0) {
      stopLiveListeningLoop("Pick at least one emotion to start live listening.");
      return;
    }

    clearLiveAudioStream();
    liveChunkPartsRef.current = [];

    const audioStream = new MediaStream([micTrackRef.current.getMediaStreamTrack().clone()]);
    const recorder = new MediaRecorder(audioStream, { mimeType });

    liveAudioStreamRef.current = audioStream;
    liveRecorderRef.current = recorder;
    setIsListeningLive(true);
    setLiveStatus(`Listening live for ${emotions.join(", ")}.`);

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        liveChunkPartsRef.current.push(event.data);
      }
    };

    recorder.onerror = () => {
      setAnalysisError("MediaRecorder failed during live listening.");
      stopLiveListeningLoop("Live listening stopped after a recorder error.");
    };

    recorder.onstop = () => {
      clearLiveChunkTimeout();

      const parts = liveChunkPartsRef.current;
      liveChunkPartsRef.current = [];
      liveRecorderRef.current = null;
      clearLiveAudioStream();

      if (!liveLoopEnabledRef.current || !joinedRef.current) {
        setIsListeningLive(false);
        return;
      }

      const nextEmotions = [...selectedEmotionsRef.current];
      const audioBlob = new Blob(parts, { type: mimeType });

      if (audioBlob.size < MIN_ANALYSIS_BLOB_SIZE_BYTES) {
        setLiveStatus("Listening for speech...");
        window.setTimeout(() => {
          void startLiveListeningChunk();
        }, LIVE_CHUNK_GAP_MS);
        return;
      }

      void sendLiveAudioChunk(audioBlob, mimeType, nextEmotions);
    };

    recorder.start();
    liveChunkTimeoutRef.current = window.setTimeout(() => {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    }, LIVE_CHUNK_DURATION_MS);
  }

  const leaveChannel = async () => {
    try {
      if (!client) {
        throw new Error(clientError || "Agora RTC client is unavailable.");
      }

      cleanupLocalTracks();
      clearVideoContainers();
      await client.leave();
      setJoined(false);
      setSession(null);
      appendLog("Left the Agora channel.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to leave channel.";
      setConnectionError(message);
    }
  };

  useEffect(() => {
    return () => {
      void leaveChannel();
    };
    // Cleanup on unmount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolveSession = async (requestedMode: AppMode, channelName: string) => {
    try {
      return await fetchAgoraSession(backendBaseUrl, requestedMode, channelName);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Request to backend session endpoint failed.";
      appendLog(`Backend session endpoint failed: ${message}`);
      appendLog("Falling back to frontend Agora env values.");
    }

    if (!envAppId) {
      throw new Error(
        "Missing Agora config. Set AGORA_APP_ID on the backend or VITE_AGORA_APP_ID in the frontend."
      );
    }

    return {
      appId: envAppId,
      channel: channelName,
      token: envToken,
      uid: parseEnvUid(envUidRaw),
      source: "frontend-env",
    } satisfies AgoraSession;
  };

  const joinChannel = async () => {
    if (connecting || joined) {
      return;
    }

    try {
      if (!client) {
        throw new Error(clientError || "Agora RTC client is unavailable.");
      }

      setConnecting(true);
      setConnectionError(null);
      setAnalysisError(null);

      const nextSession = await resolveSession(mode, channelInput.trim() || envChannel);
      appendLog(`Using Agora session from ${nextSession.source}.`);
      const joinedUid = await client.join(
        nextSession.appId,
        nextSession.channel,
        nextSession.token,
        nextSession.uid
      );

      if (isDebugMode) {
        appendLog(`Joined debug viewer for channel ${nextSession.channel} as ${joinedUid}.`);
        setSession({ ...nextSession, uid: joinedUid });
        setJoined(true);
        return;
      }

      const [microphoneTrack, nextCameraTrack] =
        await AgoraRTC.createMicrophoneAndCameraTracks();

      micTrackRef.current = microphoneTrack;
      cameraTrackRef.current = nextCameraTrack;

      await client.publish([microphoneTrack, nextCameraTrack]);
      renderLocalVideo(nextCameraTrack);

      setSession({ ...nextSession, uid: joinedUid });
      setJoined(true);
      setTranscriptEntries([]);
      setAnalysisResult(null);
      appendLog(`Publishing mic + camera to channel ${nextSession.channel} as ${joinedUid}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to join channel.";
      setConnectionError(message);
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (!isDebugMode || !autoJoin || hasAutoJoinedRef.current) {
      return;
    }

    hasAutoJoinedRef.current = true;
    void joinChannel();
    // Auto-join only once for the debug viewer route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoJoin, isDebugMode]);

  useEffect(() => {
    if (isDebugMode) {
      return;
    }

    if (!joined || !micTrackRef.current) {
      setIsListeningLive(false);
      setLiveStatus("Join the channel to start live listening.");
      return;
    }

    if (selectedEmotions.length === 0) {
      stopLiveListeningLoop("Pick at least one emotion to start live listening.");
      return;
    }

    if (liveLoopEnabledRef.current) {
      return;
    }

    liveLoopEnabledRef.current = true;
    setAnalysisError(null);
    setLiveStatus(`Listening live for ${selectedEmotions.join(", ")}.`);
    appendLog(`Live listening started for ${selectedEmotions.join(", ")}.`);
    void startLiveListeningChunk();
  }, [isDebugMode, joined, selectedEmotions.length]);

  useEffect(() => {
    const emotionKey = selectedEmotions.join(",");

    if (emotionKey === previousEmotionKeyRef.current) {
      return;
    }

    previousEmotionKeyRef.current = emotionKey;

    if (isDebugMode) {
      return;
    }

    if (selectedEmotions.length === 0) {
      setLiveStatus(joined ? "Pick at least one emotion to start live listening." : "Join the channel to start live listening.");
      return;
    }

    if (joined) {
      appendLog(`Live emotions updated: ${selectedEmotions.join(", ")}.`);
      setLiveStatus(`Listening live for ${selectedEmotions.join(", ")}.`);
    }
  }, [isDebugMode, joined, selectedEmotions]);

  const openDebugViewer = () => {
    const debugUrl = new URL(window.location.href);
    debugUrl.searchParams.set("mode", "debug");
    debugUrl.searchParams.set("channel", channelInput.trim() || envChannel);
    debugUrl.searchParams.set("autojoin", "1");
    window.open(debugUrl.toString(), "_blank", "noopener,noreferrer");
  };

  const toggleEmotion = (emotion: SupportedEmotion) => {
    setAnalysisError(null);
    setSelectedEmotions((currentEmotions) => {
      if (currentEmotions.includes(emotion)) {
        return currentEmotions.filter((currentEmotion) => currentEmotion !== emotion);
      }

      if (currentEmotions.length >= 3) {
        setAnalysisError("Choose up to 3 emotions at a time.");
        return currentEmotions;
      }

      return [...currentEmotions, emotion];
    });
  };

  return (
    <main className="page">
      <section className="hero card">
        <div>
          <p className="eyebrow">Agora Live Emotion Call</p>
          <h1>{isDebugMode ? "Debug Viewer" : "Live Conversation Console"}</h1>
          <p className="summary">
            {isDebugMode
              ? "Subscribe in a separate tab to verify the audio and video feed that the broadcaster is actually sending."
              : "Join once, keep talking naturally, and let the app continuously transcribe short live mic segments and generate emotion-shaped responses while the call stays active."}
          </p>
        </div>

        <div className="session-panel">
          <label className="field">
            <span>Channel</span>
            <input
              value={channelInput}
              onChange={(event) => setChannelInput(event.target.value)}
              disabled={joined || connecting}
            />
          </label>

          <div className="actions">
            <button onClick={joinChannel} disabled={joined || connecting}>
              {connecting ? "Connecting..." : isDebugMode ? "Join Debug" : "Join Call"}
            </button>
            <button onClick={() => void leaveChannel()} disabled={!joined && !connecting}>
              Leave
            </button>
            {!isDebugMode ? (
              <button onClick={openDebugViewer} className="secondary">
                Open Debug Tab
              </button>
            ) : null}
          </div>

          <dl className="meta-grid">
            <div>
              <dt>Mode</dt>
              <dd>{mode}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{joined ? "joined" : "idle"}</dd>
            </div>
            <div>
              <dt>Session source</dt>
              <dd>{session?.source ?? "not connected yet"}</dd>
            </div>
            <div>
              <dt>UID</dt>
              <dd>{String(session?.uid ?? "-")}</dd>
            </div>
          </dl>

          {connectionError ? <p className="error">{connectionError}</p> : null}
          {clientError ? <p className="error">{clientError}</p> : null}
        </div>
      </section>

      {!isDebugMode ? (
        <section className="card">
          <div className="section-heading">
            <div>
              <h2>Emotion Steering</h2>
              <p>
                Pick up to 3 emotions before joining or while you are already in the call. Changes
                apply automatically to the next live analysis chunk.
              </p>
            </div>
            <div className={`status-pill ${isListeningLive ? "status-pill-live" : ""}`}>
              {isAnalyzing ? "Responding..." : liveStatus}
            </div>
          </div>

          <div className="emotion-grid">
            {SUPPORTED_EMOTIONS.map((emotion) => {
              const isSelected = selectedEmotions.includes(emotion);

              return (
                <button
                  key={emotion}
                  type="button"
                  className={`emotion-chip ${isSelected ? "emotion-chip-selected" : ""}`}
                  onClick={() => toggleEmotion(emotion)}
                >
                  {emotion}
                </button>
              );
            })}
          </div>

          <p className="muted">
            Active emotions: {selectedEmotions.length > 0 ? selectedEmotions.join(", ") : "none"}
          </p>
          {analysisError ? <p className="error">{analysisError}</p> : null}
        </section>
      ) : null}

      {!isDebugMode ? (
        <section className="card">
          <div className="section-heading">
            <div>
              <h2>Live Response Stream</h2>
              <p>
                The backend transcribes short live mic slices and returns emotion-shaped replies
                continuously while you stay on the Agora call.
              </p>
            </div>
          </div>

          {analysisResult ? (
            <div className="analysis-layout">
              <article className="analysis-card analysis-card-wide">
                <p className="eyebrow">Latest Transcript</p>
                <p className="transcript">{analysisResult.transcript}</p>
              </article>

              {analysisResult.responses.map((response) => (
                <article key={response.emotion} className="analysis-card">
                  <p className="eyebrow">{response.emotion}</p>
                  <p className="analysis-response">{response.text}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">No live transcript yet. Join and start speaking.</p>
          )}

          <div className="section-heading section-heading-tight">
            <div>
              <h2>Recent Transcript Chunks</h2>
              <p>Latest spoken segments picked up by the live loop.</p>
            </div>
          </div>

          <div className="timeline-list">
            {transcriptEntries.length === 0 ? (
              <p className="muted">No live chunks processed yet.</p>
            ) : (
              transcriptEntries.map((entry) => (
                <article key={entry.id} className="timeline-card">
                  <div className="timeline-meta">
                    <strong>{entry.createdAt}</strong>
                    <span>{entry.emotions.join(", ")}</span>
                  </div>
                  <p className="timeline-text">{entry.transcript}</p>
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}

      <section className="video-grid">
        <div className="card">
          <div className="section-heading">
            <div>
              <h2>Local Feed</h2>
              <p>
                {isDebugMode
                  ? "Debug viewer does not capture local media."
                  : "Your live camera preview while the Agora call and live analysis loop are running."}
              </p>
            </div>
          </div>
          <div ref={localContainerRef} className="video-stack empty-aware" />
        </div>

        <div className="card">
          <div className="section-heading">
            <div>
              <h2>Remote Feed</h2>
              <p>
                This is the easiest live sanity check for what another client receives from the
                Agora channel.
              </p>
            </div>
          </div>
          <div ref={remoteContainerRef} className="video-stack empty-aware" />
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Debug Log</h2>
            <p>
              Lightweight event log for channel joins, publishes, subscriptions, and live analysis
              activity.
            </p>
          </div>
        </div>
        <div className="log-list">
          {logs.length === 0 ? (
            <p className="muted">No events yet.</p>
          ) : (
            logs.map((entry) => (
              <p key={entry} className="log-entry">
                {entry}
              </p>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

export default App;
