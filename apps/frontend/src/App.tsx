import { useEffect, useMemo, useRef, useState } from "react";
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";

type AppMode = "broadcast" | "debug";

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
  const mimeTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];

  return mimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? "";
}

function App() {
  const mode = getModeFromLocation();
  const isDebugMode = mode === "debug";
  const autoJoin = shouldAutoJoin();
  const client = useMemo<IAgoraRTCClient>(
    () => AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }),
    []
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
  const [logs, setLogs] = useState<string[]>([]);
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);

  const appendLog = (message: string) => {
    setLogs((currentLogs) => [`${getTimeLabel()}  ${message}`, ...currentLogs].slice(0, 14));
  };

  useEffect(() => {
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

  useEffect(() => {
    return () => {
      recordingUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

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

  const stopRecording = () => {
    if (!recorderRef.current) {
      return;
    }

    recorderRef.current.stop();
    recorderRef.current = null;
    setIsRecording(false);
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
    // Cleanup on unmount only.
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
    } catch (fetchError) {
      appendLog("Backend session endpoint unavailable, falling back to frontend env.");
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
      setConnecting(true);
      setError(null);

      const nextSession = await resolveSession(mode, channelInput.trim() || envChannel);
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
    // Auto-join only once for the debug viewer route.
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
            (currentUrl) => currentUrl !== recording.url
          );
        });

        return nextRecordings.slice(0, 5);
      });
      recordingStream.getTracks().forEach((track) => track.stop());
    };

    recorder.start(1000);
    recorderRef.current = recorder;
    setIsRecording(true);
    appendLog("Started local debug recording.");
  };

  const openDebugViewer = () => {
    const debugUrl = new URL(window.location.href);
    debugUrl.searchParams.set("mode", "debug");
    debugUrl.searchParams.set("channel", channelInput.trim() || envChannel);
    debugUrl.searchParams.set("autojoin", "1");
    window.open(debugUrl.toString(), "_blank", "noopener,noreferrer");
  };

  return (
    <main className="page">
      <section className="hero card">
        <div>
          <p className="eyebrow">Agora MVP Input Capture</p>
          <h1>{isDebugMode ? "Debug Viewer" : "Broadcaster Console"}</h1>
          <p className="summary">
            {isDebugMode
              ? "Subscribe in a separate tab to verify the audio/video feed that the broadcaster is actually sending."
              : "Capture mic + camera, publish to Agora, and keep temporary local debug recordings in the browser."}
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
              {connecting ? "Connecting..." : isDebugMode ? "Join Debug" : "Join & Publish"}
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

          {error ? <p className="error">{error}</p> : null}
        </div>
      </section>

      {!isDebugMode ? (
        <section className="card">
          <div className="section-heading">
            <div>
              <h2>Temporary Local Recording</h2>
              <p>
                Browser-only debug capture of the stream you are publishing. These clips stay local
                to this browser session until you close or refresh.
              </p>
            </div>
            <div className="actions">
              <button onClick={startRecording} disabled={!joined || isRecording}>
                Start Recording
              </button>
              <button onClick={stopRecording} disabled={!isRecording}>
                Stop Recording
              </button>
            </div>
          </div>

          <div className="recording-list">
            {recordings.length === 0 ? (
              <p className="muted">No local debug recordings yet.</p>
            ) : (
              recordings.map((recording) => (
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
                  : "Your current camera preview before any downstream AI step."}
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
            <p>Lightweight event log for channel joins, publishes, subscriptions, and recording actions.</p>
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
