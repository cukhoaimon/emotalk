import { useEffect, useMemo, useRef, useState } from "react";

type EmotionKey = "joy" | "sad" | "angry" | "calm" | "love";

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

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function resolveRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingUrlRef = useRef<string | null>(null);

  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [selectedEmotion, setSelectedEmotion] = useState<EmotionKey>("joy");
  const [statusMessage, setStatusMessage] = useState("Camera and microphone are off.");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingFormat, setRecordingFormat] = useState("Not recorded yet");

  const currentEmotion = useMemo(
    () => EMOTIONS.find((emotion) => emotion.key === selectedEmotion) ?? EMOTIONS[0],
    [selectedEmotion],
  );

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }

    videoRef.current.srcObject = streamRef.current;
  }, [cameraEnabled, micEnabled]);

  useEffect(() => {
    if (!isRecording) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setRecordingTime((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isRecording]);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (recordingUrlRef.current) {
        URL.revokeObjectURL(recordingUrlRef.current);
      }
    };
  }, []);

  async function ensureStream(nextCamera: boolean, nextMic: boolean) {
    if (!nextCamera && !nextMic) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      return null;
    }

    const current = streamRef.current;
    const needsNewStream =
      !current ||
      current.getVideoTracks().length !== (nextCamera ? 1 : 0) ||
      current.getAudioTracks().length !== (nextMic ? 1 : 0);

    if (!needsNewStream) {
      return current;
    }

    current?.getTracks().forEach((track) => track.stop());

    const nextStream = await navigator.mediaDevices.getUserMedia({
      video: nextCamera,
      audio: nextMic,
    });

    streamRef.current = nextStream;
    if (videoRef.current) {
      videoRef.current.srcObject = nextStream;
    }

    return nextStream;
  }

  function stopRecorder() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    recorderRef.current = null;
    setIsRecording(false);
    setRecordingTime(0);
  }

  function startRecorder(stream: MediaStream) {
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) {
      return;
    }

    const mimeType = resolveRecorderMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      if (!chunksRef.current.length) {
        setAudioUrl(null);
        setRecordingFormat("No audio clip available");
        return;
      }

      const type = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });

      if (recordingUrlRef.current) {
        URL.revokeObjectURL(recordingUrlRef.current);
      }

      const nextUrl = URL.createObjectURL(blob);
      recordingUrlRef.current = nextUrl;
      setAudioUrl(nextUrl);
      setRecordingFormat(type);
      chunksRef.current = [];
    };

    recorder.start(1000);
    recorderRef.current = recorder;
    setIsRecording(true);
    setRecordingTime(0);
  }

  async function syncDevices(nextCamera: boolean, nextMic: boolean) {
    try {
      const stream = await ensureStream(nextCamera, nextMic);
      setCameraEnabled(nextCamera);
      setMicEnabled(nextMic);

      if (nextCamera && nextMic && stream) {
        if (recorderRef.current?.state !== "recording") {
          startRecorder(stream);
        }
        setStatusMessage("Live call is active. Audio is being recorded while mic and camera stay on.");
      } else {
        stopRecorder();
        if (nextCamera && !nextMic) {
          setStatusMessage("Camera is on. Enable microphone to start recording.");
        } else if (!nextCamera && nextMic) {
          setStatusMessage("Microphone is on. Enable camera to start recording.");
        } else {
          setStatusMessage("Camera and microphone are off.");
        }
      }
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? `Device access failed: ${error.message}`
          : "Device access failed. Check browser permissions.",
      );
    }
  }

  async function handleToggleCamera() {
    await syncDevices(!cameraEnabled, micEnabled);
  }

  async function handleToggleMic() {
    await syncDevices(cameraEnabled, !micEnabled);
  }

  return (
    <main className="app-shell">
      <section className="hero-bar">
        <div>
          <p className="eyebrow">EmoTalk</p>
          <h1>Unicorn Call Studio</h1>
          <p className="hero-copy">
            A video-call style main screen with two tiles: your live camera on the left and the selected
            emotion scene on the right. Default emotion is <strong>joy</strong>.
          </p>
        </div>

        <div className="call-summary">
          <div className="summary-pill">
            <span>Camera</span>
            <strong>{cameraEnabled ? "On" : "Off"}</strong>
          </div>
          <div className="summary-pill">
            <span>Mic</span>
            <strong>{micEnabled ? "On" : "Off"}</strong>
          </div>
          <div className={`summary-pill ${isRecording ? "recording" : ""}`}>
            <span>Recorder</span>
            <strong>{isRecording ? formatDuration(recordingTime) : "Standby"}</strong>
          </div>
        </div>
      </section>

      <section className="meet-shell">
        <div className="stage-grid">
          <article className="call-tile user-tile">
            <div className="tile-topbar">
              <span className="tile-label">You</span>
              <span className="tile-badge">Face camera</span>
            </div>

            <div className="video-stage">
              <video ref={videoRef} autoPlay muted playsInline />
              {!cameraEnabled ? (
                <div className="video-fallback">
                  <div className="avatar-core">E</div>
                  <p>Camera is off</p>
                </div>
              ) : null}
              <div className="video-overlay">
                <span>{micEnabled ? "Mic live" : "Mic muted"}</span>
                <strong>{isRecording ? "Recording voice" : "Recorder idle"}</strong>
              </div>
            </div>
          </article>

          <article className="call-tile emotion-tile" style={{ ["--emotion-accent" as string]: currentEmotion.accent, ["--emotion-glow" as string]: currentEmotion.glow }}>
            <div className="tile-topbar">
              <span className="tile-label">Emotion View</span>
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
            <div className="panel-header">
              <p className="eyebrow">Controls</p>
              <h2>Meet-style actions</h2>
            </div>

            <div className="control-row">
              <button
                type="button"
                className={cameraEnabled ? "control-chip active" : "control-chip"}
                onClick={handleToggleCamera}
              >
                {cameraEnabled ? "Turn camera off" : "Turn camera on"}
              </button>
              <button
                type="button"
                className={micEnabled ? "control-chip active" : "control-chip"}
                onClick={handleToggleMic}
              >
                {micEnabled ? "Mute microphone" : "Enable microphone"}
              </button>
            </div>

            <div className="status-card">
              <span className="status-dot" />
              <p>{statusMessage}</p>
            </div>
          </section>

          <section className="panel emotion-panel">
            <div className="panel-header">
              <p className="eyebrow">Emotion picker</p>
              <h2>Select visual mood</h2>
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

          <section className="panel recorder-panel">
            <div className="panel-header">
              <p className="eyebrow">Voice capture</p>
              <h2>Local recording preview</h2>
            </div>

            <div className="recorder-meta">
              <div>
                <span>State</span>
                <strong>{isRecording ? `Recording ${formatDuration(recordingTime)}` : "Waiting for mic + camera"}</strong>
              </div>
              <div>
                <span>Format</span>
                <strong>{recordingFormat}</strong>
              </div>
            </div>

            {audioUrl ? (
              <audio controls src={audioUrl} className="audio-player" />
            ) : (
              <div className="recorder-empty">Your latest local clip appears here after recording stops.</div>
            )}
          </section>
        </aside>
      </section>
    </main>
  );
}

export default App;
