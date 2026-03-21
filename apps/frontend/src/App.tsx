import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";

type AppMode = "broadcast" | "debug";
type EmotionKey = "joy" | "sad" | "angry" | "calm" | "love";

type AgoraSession = {
  appId: string;
  channel: string;
  token: string | null;
  uid: number | string | null;
  source: string;
  expiresInSeconds?: number;
};

type RecordingItem = {
  id: string;
  createdAt: string;
  durationSeconds: number;
  sizeLabel: string;
  url: string;
};

type EmotionConfig = {
  key: EmotionKey;
  title: string;
  mood: string;
  emoji: string;
  accent: string;
  glow: string;
  description: string;
};

const EMOTIONS: EmotionConfig[] = [
  {
    key: "joy",
    title: "Joy",
    mood: "Shimmer mode",
    emoji: "^_^",
    accent: "linear-gradient(135deg, #ff8fd8 0%, #c084fc 45%, #60a5fa 100%)",
    glow: "rgba(244, 114, 182, 0.42)",
    description: "Bright, playful energy with a light celebratory pulse.",
  },
  {
    key: "love",
    title: "Love",
    mood: "Soft bloom",
    emoji: "<3",
    accent: "linear-gradient(135deg, #fb7185 0%, #f472b6 55%, #f9a8d4 100%)",
    glow: "rgba(251, 113, 133, 0.4)",
    description: "Warm, affectionate visuals with a dreamy floating rhythm.",
  },
  {
    key: "calm",
    title: "Calm",
    mood: "Cloud drift",
    emoji: "-_-",
    accent: "linear-gradient(135deg, #7dd3fc 0%, #818cf8 52%, #c4b5fd 100%)",
    glow: "rgba(125, 211, 252, 0.34)",
    description: "Steady ambient gradients for a composed and clear state.",
  },
  {
    key: "sad",
    title: "Sad",
    mood: "Rain glass",
    emoji: "T_T",
    accent: "linear-gradient(135deg, #60a5fa 0%, #6366f1 50%, #8b5cf6 100%)",
    glow: "rgba(96, 165, 250, 0.35)",
    description: "Cool, reflective colors with a gentler low-energy atmosphere.",
  },
  {
    key: "angry",
    title: "Angry",
    mood: "Hot spark",
    emoji: ">:(",
    accent: "linear-gradient(135deg, #fb7185 0%, #f97316 55%, #facc15 100%)",
    glow: "rgba(249, 115, 22, 0.38)",
    description: "High-contrast heat and sharp highlights for intense tension.",
  },
];

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

function getSupportedRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  const mimeTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];

  return mimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? "";
}

function formatDuration(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");

  return `${mins}:${secs}`;
}

function App() {
  const mode = getModeFromLocation();
  const isDebugMode = mode === "debug";
  const autoJoin = shouldAutoJoin();
  const client = useMemo<IAgoraRTCClient>(
    () => AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }),
    [],
  );
  const localContainerRef = useRef<HTMLDivElement>(null);
  const remoteContainerRef = useRef<HTMLDivElement>(null);
  const cameraTrackRef = useRef<ICameraVideoTrack | null>(null);
  const micTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderStartTimeRef = useRef<number | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingUrlsRef = useRef<string[]>([]);
  const hasAutoJoinedRef = useRef(false);
  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<AgoraSession | null>(null);
  const [channelInput, setChannelInput] = useState(getChannelFromLocation());
  const [cameraTrack, setCameraTrack] = useState<ICameraVideoTrack | null>(null);
  const [micTrack, setMicTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [selectedEmotion, setSelectedEmotion] = useState<EmotionKey>("joy");

  const currentEmotion = useMemo(
    () => EMOTIONS.find((emotion) => emotion.key === selectedEmotion) ?? EMOTIONS[0],
    [selectedEmotion],
  );

  const appendLog = (message: string) => {
    setLogs((currentLogs) => [`${getTimeLabel()}  ${message}`, ...currentLogs].slice(0, 14));
  };

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
      renderEmptyState(
        localContainerRef.current,
        isDebugMode ? "Debug viewer does not capture local media." : "Join to start your local camera preview.",
      );
    }

    if (remoteContainerRef.current) {
      renderEmptyState(remoteContainerRef.current, "No remote tracks connected yet.");
    }
  };

  useEffect(() => {
    const handleUserPublished = async (
      user: IAgoraRTCRemoteUser,
      mediaType: "audio" | "video",
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

      if (remoteContainerRef.current && !remoteContainerRef.current.querySelector(".video-tile")) {
        renderEmptyState(remoteContainerRef.current, "No remote tracks connected yet.");
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

  useEffect(() => {
    clearVideoContainers();
  }, [isDebugMode]);

  useEffect(() => {
    if (!isRecording) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setRecordingSeconds((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      recordingUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const stopRecording = () => {
    if (!recorderRef.current) {
      return;
    }

    recorderRef.current.stop();
    recorderRef.current = null;
    setIsRecording(false);
    setRecordingSeconds(0);
    appendLog("Stopped local debug recording.");
  };

  const cleanupLocalTracks = () => {
    cameraTrackRef.current?.stop();
    cameraTrackRef.current?.close();
    micTrackRef.current?.stop();
    micTrackRef.current?.close();
    cameraTrackRef.current = null;
    micTrackRef.current = null;
    setCameraTrack(null);
    setMicTrack(null);
  };

  const leaveChannel = async () => {
    try {
      stopRecording();
      cleanupLocalTracks();
      clearVideoContainers();
      await client.leave();
      setJoined(false);
      setSession(null);
      appendLog("Left the Agora channel.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to leave channel.";
      setError(message);
    }
  };

  useEffect(() => {
    return () => {
      void leaveChannel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolveSession = async (requestedMode: AppMode, channelName: string) => {
    const url = new URL("/agora/session", backendBaseUrl);
    url.searchParams.set("channel", channelName);
    url.searchParams.set("role", requestedMode);

    try {
      const response = await fetch(url.toString());

      if (response.ok) {
        const payload = (await response.json()) as AgoraSession;
        return payload;
      }
    } catch {
      appendLog("Backend session endpoint unavailable, falling back to frontend env.");
    }

    if (!envAppId) {
      throw new Error(
        "Missing Agora config. Set AGORA_APP_ID on the backend or VITE_AGORA_APP_ID in the frontend.",
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
      setConnecting(true);
      setError(null);

      const nextSession = await resolveSession(mode, channelInput.trim() || envChannel);
      const joinedUid = await client.join(
        nextSession.appId,
        nextSession.channel,
        nextSession.token,
        nextSession.uid,
      );

      if (isDebugMode) {
        appendLog(`Joined debug viewer for channel ${nextSession.channel} as ${joinedUid}.`);
        setSession({ ...nextSession, uid: joinedUid });
        setJoined(true);
        return;
      }

      const [microphoneTrack, nextCameraTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();

      micTrackRef.current = microphoneTrack;
      cameraTrackRef.current = nextCameraTrack;
      setMicTrack(microphoneTrack);
      setCameraTrack(nextCameraTrack);

      await client.publish([microphoneTrack, nextCameraTrack]);
      renderLocalVideo(nextCameraTrack);

      setSession({ ...nextSession, uid: joinedUid });
      setJoined(true);
      appendLog(`Publishing mic + camera to channel ${nextSession.channel} as ${joinedUid}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to join channel.";
      setError(message);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoJoin, isDebugMode]);

  const startRecording = () => {
    if (!cameraTrackRef.current || !micTrackRef.current) {
      setError("Join and publish before starting a local recording.");
      return;
    }

    const mimeType = getSupportedRecordingMimeType();
    if (!mimeType) {
      setError("This browser does not support WebM recording for the debug capture.");
      return;
    }

    const recordingStream = new MediaStream([
      cameraTrackRef.current.getMediaStreamTrack().clone(),
      micTrackRef.current.getMediaStreamTrack().clone(),
    ]);

    recordingChunksRef.current = [];
    recorderStartTimeRef.current = Date.now();

    const recorder = new MediaRecorder(recordingStream, { mimeType });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordingChunksRef.current.push(event.data);
      }
    };
    recorder.onstop = () => {
      const recordingBlob = new Blob(recordingChunksRef.current, { type: mimeType });
      const durationMs = Math.max(Date.now() - (recorderStartTimeRef.current ?? Date.now()), 0);
      const url = URL.createObjectURL(recordingBlob);
      const nextRecording: RecordingItem = {
        id: `${Date.now()}`,
        createdAt: new Date().toLocaleString(),
        durationSeconds: Number((durationMs / 1000).toFixed(1)),
        sizeLabel: `${(recordingBlob.size / (1024 * 1024)).toFixed(2)} MB`,
        url,
      };

      recordingUrlsRef.current = [url, ...recordingUrlsRef.current];
      setRecordings((currentRecordings) => {
        const nextRecordings = [nextRecording, ...currentRecordings];
        const overflow = nextRecordings.slice(5);

        overflow.forEach((recording) => {
          URL.revokeObjectURL(recording.url);
          recordingUrlsRef.current = recordingUrlsRef.current.filter(
            (currentUrl) => currentUrl !== recording.url,
          );
        });

        return nextRecordings.slice(0, 5);
      });
      recordingStream.getTracks().forEach((track) => track.stop());
      setRecordingSeconds(0);
    };

    recorder.start(1000);
    recorderRef.current = recorder;
    setIsRecording(true);
    setRecordingSeconds(0);
    appendLog("Started local debug recording.");
  };

  const openDebugViewer = () => {
    const debugUrl = new URL(window.location.href);
    debugUrl.searchParams.set("mode", "debug");
    debugUrl.searchParams.set("channel", channelInput.trim() || envChannel);
    debugUrl.searchParams.set("autojoin", "1");
    window.open(debugUrl.toString(), "_blank", "noopener,noreferrer");
  };

  const localStateLabel = cameraTrack ? "Live" : joined ? "Ready" : "Idle";
  const emotionStyle: CSSProperties = {
    ["--emotion-accent" as string]: currentEmotion.accent,
    ["--emotion-glow" as string]: currentEmotion.glow,
  };

  return (
    <main className="app-shell">
      <section className="hero-bar">
        <div className="hero-copy-block">
          <p className="eyebrow">EmoTalk</p>
          <h1>{isDebugMode ? "Emotion Debug Viewer" : "Unicorn Call Studio"}</h1>
          <p className="hero-copy">
            {isDebugMode
              ? "Monitor the Agora channel in a separate viewer while preserving the PR's emotion-driven stage design."
              : "Publish mic and camera to Agora, keep local debug recordings, and drive the right stage with the selected emotion mood."}
          </p>
        </div>

        <div className="call-summary four-up">
          <div className="summary-pill">
            <span>Mode</span>
            <strong>{mode}</strong>
          </div>
          <div className="summary-pill">
            <span>Status</span>
            <strong>{joined ? "Joined" : connecting ? "Connecting" : "Idle"}</strong>
          </div>
          <div className="summary-pill">
            <span>Camera</span>
            <strong>{localStateLabel}</strong>
          </div>
          <div className={`summary-pill ${isRecording ? "recording" : ""}`}>
            <span>Recorder</span>
            <strong>{isRecording ? formatDuration(recordingSeconds) : "Standby"}</strong>
          </div>
        </div>
      </section>

      <section className="meet-shell">
        <div className="stage-grid">
          <article className="call-tile user-tile">
            <div className="tile-topbar">
              <span className="tile-label">{isDebugMode ? "Remote feed" : "You"}</span>
              <span className="tile-badge">{isDebugMode ? "Agora viewer" : "Face camera"}</span>
            </div>

            <div className="video-stage">
              <div
                ref={isDebugMode ? remoteContainerRef : localContainerRef}
                className="video-stack embedded-stack empty-aware"
              />
              {!joined ? (
                <div className="video-fallback overlay-fallback">
                  <div className="avatar-core">E</div>
                  <p>{isDebugMode ? "Join to watch the remote feed" : "Join and publish to start camera preview"}</p>
                </div>
              ) : null}
              <div className="video-overlay">
                <span>{isDebugMode ? `Channel ${channelInput || envChannel}` : `Mic ${micTrack ? "live" : "muted"}`}</span>
                <strong>{isDebugMode ? "Remote monitor" : cameraTrack ? "Camera live" : "Camera offline"}</strong>
              </div>
            </div>
          </article>

          <article className="call-tile emotion-tile" style={emotionStyle}>
            <div className="tile-topbar">
              <span className="tile-label">Emotion view</span>
              <span className="tile-badge active">{currentEmotion.title}</span>
            </div>

            <div className="emotion-stage">
              <div className="emotion-orb orb-one" />
              <div className="emotion-orb orb-two" />
              <div className="emotion-orb orb-three" />
              <div className="emotion-card">
                <span className="emotion-mode">{currentEmotion.mood}</span>
                <strong>{currentEmotion.title}</strong>
                <div className="emotion-face">{currentEmotion.emoji}</div>
                <p>{currentEmotion.description}</p>
              </div>
            </div>
          </article>
        </div>

        <aside className="control-rail">
          <section className="panel controls-panel">
            <div className="panel-header stacked-header">
              <div>
                <p className="eyebrow">Session</p>
                <h2>Agora controls</h2>
              </div>
              <span className="tile-badge active">{session?.source ?? "not connected"}</span>
            </div>

            <label className="field">
              <span>Channel</span>
              <input
                value={channelInput}
                onChange={(event) => setChannelInput(event.target.value)}
                disabled={joined || connecting}
              />
            </label>

            <div className="control-row split-actions">
              <button type="button" className="control-chip active" onClick={joinChannel} disabled={joined || connecting}>
                {connecting ? "Connecting..." : isDebugMode ? "Join debug" : "Join & publish"}
              </button>
              <button type="button" className="control-chip" onClick={() => void leaveChannel()} disabled={!joined && !connecting}>
                Leave channel
              </button>
              {!isDebugMode ? (
                <button type="button" className="control-chip" onClick={openDebugViewer}>
                  Open debug tab
                </button>
              ) : null}
            </div>

            <div className="status-card">
              <span className="status-dot" />
              <p>
                {error
                  ? error
                  : joined
                    ? `Connected to ${session?.channel ?? channelInput} as ${String(session?.uid ?? "-")}.`
                    : "Ready to request an Agora session and join the selected channel."}
              </p>
            </div>
          </section>

          <section className="panel emotion-panel">
            <div className="panel-header stacked-header">
              <div>
                <p className="eyebrow">Emotion picker</p>
                <h2>Select visual mood</h2>
              </div>
            </div>

            <div className="emotion-picker-grid">
              {EMOTIONS.map((emotion) => (
                <button
                  key={emotion.key}
                  type="button"
                  className={selectedEmotion === emotion.key ? "emotion-option selected" : "emotion-option"}
                  onClick={() => setSelectedEmotion(emotion.key)}
                >
                  <span>{emotion.title}</span>
                  <small>{emotion.mood}</small>
                </button>
              ))}
            </div>
          </section>

          {!isDebugMode ? (
            <section className="panel recorder-panel">
              <div className="panel-header stacked-header">
                <div>
                  <p className="eyebrow">Voice capture</p>
                  <h2>Local recording preview</h2>
                </div>
              </div>

              <div className="control-row split-actions compact-actions">
                <button type="button" className="control-chip active" onClick={startRecording} disabled={!joined || isRecording}>
                  Start recording
                </button>
                <button type="button" className="control-chip" onClick={stopRecording} disabled={!isRecording}>
                  Stop recording
                </button>
              </div>

              {recordings.length > 0 ? (
                <div className="recording-list compact-list">
                  {recordings.map((recording) => (
                    <article key={recording.id} className="recording-card">
                      <div className="recording-meta">
                        <strong>{recording.createdAt}</strong>
                        <span>
                          {recording.durationSeconds}s · {recording.sizeLabel}
                        </span>
                      </div>
                      <video controls src={recording.url} className="recording-preview" />
                      <a href={recording.url} download={`emotalk-debug-${recording.id}.webm`}>
                        Download clip
                      </a>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="recorder-empty">Browser-only debug captures will appear here after you stop a recording.</div>
              )}
            </section>
          ) : (
            <section className="panel recorder-panel">
              <div className="panel-header stacked-header">
                <div>
                  <p className="eyebrow">Debug mode</p>
                  <h2>Viewer notes</h2>
                </div>
              </div>
              <div className="recorder-empty">The main stage is already subscribed to the remote Agora feed. Use the event log below to verify joins, publishes, and connection changes.</div>
            </section>
          )}

          <section className="panel log-panel">
            <div className="panel-header stacked-header">
              <div>
                <p className="eyebrow">Debug log</p>
                <h2>Recent events</h2>
              </div>
            </div>
            <div className="log-list compact-list">
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
        </aside>
      </section>
    </main>
  );
}

export default App;

