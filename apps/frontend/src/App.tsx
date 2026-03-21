import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import AgoraRTC, { type IAgoraRTCClient, type IAgoraRTCRemoteUser, type ICameraVideoTrack, type IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import { type AnalysisResponse, type AgoraSession, type AppMode, chatWithBackend, fetchAgoraSession } from "./lib/api";
import { SUPPORTED_EMOTIONS, type SupportedEmotion } from "./lib/emotions";

type TranscriptEntry = { id: string; createdAt: string; transcript: string; emotion: SupportedEmotion };
type EmotionConfig = { key: SupportedEmotion; title: string; mood: string; emoji: string; accent: string; glow: string; description: string };
type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onstart: null | (() => void);
  onend: null | (() => void);
  onerror: null | ((event: { error?: string }) => void);
  onresult: null | ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void);
};
type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

const EMOTIONS: EmotionConfig[] = [
  { key: "joy", title: "Joy", mood: "Bright Lift", emoji: "^_^", accent: "linear-gradient(135deg, #ff9ccf 0%, #8b5cf6 48%, #60a5fa 100%)", glow: "rgba(244, 114, 182, 0.4)", description: "Warm, optimistic energy for upbeat conversations and supportive responses." },
  { key: "sadness", title: "Sadness", mood: "Soft Rain", emoji: "T_T", accent: "linear-gradient(135deg, #60a5fa 0%, #4f46e5 52%, #8b5cf6 100%)", glow: "rgba(96, 165, 250, 0.36)", description: "Cool, reflective visuals suited to slower and more empathetic tones." },
  { key: "anger", title: "Anger", mood: "Heat Pulse", emoji: ">:(", accent: "linear-gradient(135deg, #fb7185 0%, #f97316 55%, #facc15 100%)", glow: "rgba(249, 115, 22, 0.34)", description: "Sharper contrast and hotter highlights for tense moments that need attention." },
  { key: "fear", title: "Fear", mood: "Night Echo", emoji: "o_o", accent: "linear-gradient(135deg, #2dd4bf 0%, #3b82f6 55%, #6366f1 100%)", glow: "rgba(59, 130, 246, 0.3)", description: "Nervous, alert atmosphere for uncertain or high-stakes emotional states." },
  { key: "disgust", title: "Disgust", mood: "Acid Drift", emoji: "-_-", accent: "linear-gradient(135deg, #84cc16 0%, #14b8a6 55%, #0ea5e9 100%)", glow: "rgba(20, 184, 166, 0.34)", description: "Tighter, uneasy gradients for moments of discomfort or rejection." },
];

const envAppId = import.meta.env.VITE_AGORA_APP_ID ?? "";
const envChannel = import.meta.env.VITE_AGORA_CHANNEL ?? "emotalk";
const envToken = import.meta.env.VITE_AGORA_TOKEN ?? null;
const envUidRaw = import.meta.env.VITE_AGORA_UID;
const backendBaseUrl = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3000";

function parseEnvUid(rawUid: string | undefined) {
  if (!rawUid) return null;
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
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function getAudioMeterSegments(level: number) {
  const normalizedLevel = Math.max(0, Math.min(level, 100));
  return Array.from({ length: 10 }, (_, index) => normalizedLevel >= (index + 1) * 10);
}

function normalizeTrackVolume(level: number) {
  return Math.max(0, Math.min(Math.round(level * 100), 100));
}

function App() {
  const mode = getModeFromLocation();
  const isDebugMode = mode === "debug";
  const autoJoin = shouldAutoJoin();
  const clientState = useMemo<{ client: IAgoraRTCClient | null; clientError: string | null }>(() => {
    try {
      return { client: AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }), clientError: null };
    } catch (error) {
      return { client: null, clientError: error instanceof Error ? error.message : "Agora RTC failed to initialize." };
    }
  }, []);

  const client = clientState.client;
  const clientError = clientState.clientError;
  const localContainerRef = useRef<HTMLDivElement>(null);
  const remoteContainerRef = useRef<HTMLDivElement>(null);
  const cameraTrackRef = useRef<ICameraVideoTrack | null>(null);
  const micTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const recognitionRestartTimeoutRef = useRef<number | null>(null);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const joinedRef = useRef(false);
  const hasAutoJoinedRef = useRef(false);
  const selectedEmotionRef = useRef<SupportedEmotion>("joy");

  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [session, setSession] = useState<AgoraSession | null>(null);
  const [channelInput, setChannelInput] = useState(getChannelFromLocation());
  const [cameraTrack, setCameraTrack] = useState<ICameraVideoTrack | null>(null);
  const [micTrack, setMicTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedEmotion, setSelectedEmotion] = useState<SupportedEmotion>("joy");
  const [isListeningLive, setIsListeningLive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [liveStatus, setLiveStatus] = useState("Join the channel to start live listening.");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [conversationSessionId, setConversationSessionId] = useState<string | null>(null);
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [remoteAudioLevel, setRemoteAudioLevel] = useState(0);
  const [audioSignalDetected, setAudioSignalDetected] = useState(false);

  const currentEmotion = EMOTIONS.find((emotion) => emotion.key === selectedEmotion) ?? EMOTIONS[0];
  const localMeterSegments = getAudioMeterSegments(localAudioLevel);
  const remoteMeterSegments = getAudioMeterSegments(remoteAudioLevel);
  const micStatus = !joined ? "offline" : !micEnabled ? "muted" : localAudioLevel > 8 ? "speaking" : "live";
  const remoteAudioStatus = !joined ? "offline" : remoteAudioLevel > 8 ? "receiving" : "idle";
  const combinedError = connectionError || analysisError || clientError;

  const appendLog = (message: string) => {
    setLogs((currentLogs) => [`${getTimeLabel()}  ${message}`, ...currentLogs].slice(0, 18));
  };

  const getSpeechRecognitionCtor = () => {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };

    return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
  };

  const speakReply = (text: string) => {
    if (!text.trim() || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;
    speechUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const renderEmptyState = (container: HTMLDivElement | null, title: string, message: string, accentClass = "") => {
    if (!container) return;
    container.innerHTML = "";
    const emptyState = document.createElement("div");
    emptyState.className = `video-placeholder ${accentClass}`.trim();
    emptyState.innerHTML = `<strong>${title}</strong><p>${message}</p>`;
    container.appendChild(emptyState);
  };

  const renderLocalPreview = (track: ICameraVideoTrack) => {
    if (!localContainerRef.current) return;
    localContainerRef.current.innerHTML = "";
    const player = document.createElement("div");
    player.className = "agora-player local-player";
    localContainerRef.current.appendChild(player);
    track.play(player);
  };

  const clearVideoContainers = () => {
    renderEmptyState(localContainerRef.current, isDebugMode ? "Viewer mode" : "Local preview", isDebugMode ? "This tab subscribes only. Open the main screen to publish camera and microphone." : "Join the room to preview your own published camera.");
    renderEmptyState(remoteContainerRef.current, "Remote feed", "When another participant publishes to this channel, their stream appears here.", "remote-placeholder");
  };

  const clearRecognitionRestartTimeout = () => {
    if (recognitionRestartTimeoutRef.current !== null) {
      window.clearTimeout(recognitionRestartTimeoutRef.current);
      recognitionRestartTimeoutRef.current = null;
    }
  };

  const stopLiveListeningLoop = (statusMessage?: string) => {
    clearRecognitionRestartTimeout();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListeningLive(false);
    if (statusMessage) {
      setLiveStatus(statusMessage);
    }
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
    setCameraEnabled(false);
    setMicEnabled(false);
    setLocalAudioLevel(0);
    setRemoteAudioLevel(0);
    setAudioSignalDetected(false);
  };

  const sendTranscript = async (transcript: string) => {
    if (!transcript.trim()) return;

    try {
      setIsAnalyzing(true);
      setAnalysisError(null);
      setLiveStatus(`Sending transcript for ${selectedEmotionRef.current}.`);
      appendLog(`Sending transcript to backend: "${transcript}"`);
      const result = await chatWithBackend(backendBaseUrl, transcript, selectedEmotionRef.current, conversationSessionId ?? undefined);
      setConversationSessionId(result.sessionId ?? null);
      setAnalysisResult({
        transcript,
        emotion: result.emotion,
        reply: result.reply,
        sessionId: result.sessionId,
        toolEvents: result.toolEvents,
      });
      setTranscriptEntries((currentEntries) => [
        { id: `${Date.now()}`, createdAt: getTimeLabel(), transcript, emotion: selectedEmotionRef.current },
        ...currentEntries,
      ].slice(0, 6));
      speakReply(result.reply);
      appendLog(`Live response updated for ${selectedEmotionRef.current}.`);
      setLiveStatus(`Listening live for ${selectedEmotionRef.current}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Live transcript analysis failed.";
      setAnalysisError(message);
      appendLog(`Live analysis failed: ${message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startLiveListening = () => {
    if (!joinedRef.current || !micTrackRef.current || !micEnabled || isDebugMode) return;
    if (recognitionRef.current) return;

    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) {
      setAnalysisError("This browser does not support live speech recognition.");
      setLiveStatus("Live text recognition is unavailable in this browser.");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListeningLive(true);
      setLiveStatus(`Listening live for ${selectedEmotionRef.current}.`);
      appendLog("Speech recognition started.");
    };

    recognition.onerror = (event) => {
      const message = event.error || "speech-recognition-error";
      setAnalysisError(`Speech recognition failed: ${message}`);
      appendLog(`Speech recognition failed: ${message}`);
    };

    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result?.isFinal) continue;
        const transcript = result[0]?.transcript?.trim();
        if (!transcript) continue;
        void sendTranscript(transcript);
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      if (!joinedRef.current || !micEnabled || isDebugMode) {
        setIsListeningLive(false);
        return;
      }

      clearRecognitionRestartTimeout();
      recognitionRestartTimeoutRef.current = window.setTimeout(() => {
        startLiveListening();
      }, 250);
    };

    recognition.start();
  };

  useEffect(() => {
    clearVideoContainers();
  }, [isDebugMode]);

  useEffect(() => {
    joinedRef.current = joined;
  }, [joined]);

  useEffect(() => {
    selectedEmotionRef.current = selectedEmotion;
  }, [selectedEmotion]);

  useEffect(() => {
    if (!client) return;

    const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
      appendLog(`Remote user ${user.uid} published ${mediaType}.`);
      await client.subscribe(user, mediaType);
      if (mediaType === "video" && user.videoTrack && remoteContainerRef.current) {
        remoteContainerRef.current.innerHTML = "";
        const remotePlayer = document.createElement("div");
        remotePlayer.id = `remote-${user.uid}`;
        remotePlayer.className = "agora-player";
        remoteContainerRef.current.appendChild(remotePlayer);
        user.videoTrack.play(remotePlayer);
      }
      if (mediaType === "audio" && user.audioTrack) {
        user.audioTrack.play();
      }
    };

    const removeRemoteUser = (user: IAgoraRTCRemoteUser) => {
      appendLog(`Remote user ${user.uid} left or unpublished.`);
      renderEmptyState(remoteContainerRef.current, "Remote feed", "When another participant publishes to this channel, their stream appears here.", "remote-placeholder");
    };

    const handleConnectionStateChange = (currentState: string, previousState: string) => {
      appendLog(`Connection ${previousState} -> ${currentState}.`);
    };

    const handleVolumeIndicator = (volumes: Array<{ uid: number | string; level: number }>) => {
      const ownUid = session?.uid;
      const localEntry = volumes.find((entry) => ownUid !== null && ownUid !== undefined && String(entry.uid) === String(ownUid));
      const remoteLevel = volumes.filter((entry) => ownUid === null || ownUid === undefined || String(entry.uid) !== String(ownUid)).reduce((maxLevel, entry) => Math.max(maxLevel, entry.level), 0);
      setRemoteAudioLevel(remoteLevel);
      setAudioSignalDetected((localEntry?.level ?? 0) > 0 || remoteLevel > 0);
    };

    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", removeRemoteUser);
    client.on("user-left", removeRemoteUser);
    client.on("connection-state-change", handleConnectionStateChange);
    client.on("volume-indicator", handleVolumeIndicator);

    return () => {
      client.off("user-published", handleUserPublished);
      client.off("user-unpublished", removeRemoteUser);
      client.off("user-left", removeRemoteUser);
      client.off("connection-state-change", handleConnectionStateChange);
      client.off("volume-indicator", handleVolumeIndicator);
    };
  }, [client, session?.uid]);

  useEffect(() => {
    if (!micTrack || !joined || isDebugMode) return;
    const intervalId = window.setInterval(() => {
      const nextLevel = normalizeTrackVolume(micTrack.getVolumeLevel());
      setLocalAudioLevel(nextLevel);
      setAudioSignalDetected((currentDetected) => currentDetected || nextLevel > 0);
    }, 200);

    return () => window.clearInterval(intervalId);
  }, [isDebugMode, joined, micTrack]);

  useEffect(() => {
    if (!joined) {
      setAudioSignalDetected(false);
      return;
    }
    setAudioSignalDetected(localAudioLevel > 0 || remoteAudioLevel > 0);
  }, [joined, localAudioLevel, remoteAudioLevel]);

  useEffect(() => {
    if (isDebugMode || !joined || !micTrack || !micEnabled) {
      stopLiveListeningLoop(joined ? "Enable the microphone to continue live listening." : "Join the channel to start live listening.");
      return;
    }

    setAnalysisError(null);
    startLiveListening();
  }, [isDebugMode, joined, micTrack, micEnabled, selectedEmotion]);

  useEffect(() => {
    return () => {
      stopLiveListeningLoop();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const leaveChannel = async () => {
    try {
      if (!client) throw new Error(clientError || "Agora RTC client is unavailable.");
      stopLiveListeningLoop("Join the channel to start live listening.");
      cleanupLocalTracks();
      clearVideoContainers();
      await client.leave();
      setJoined(false);
      setSession(null);
      setAnalysisResult(null);
      setAnalysisError(null);
      setTranscriptEntries([]);
      setConversationSessionId(null);
      setLiveStatus("Join the channel to start live listening.");
      appendLog("Left the Agora channel.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to leave channel.";
      setConnectionError(message);
    }
  };

  const resolveSession = async (requestedMode: AppMode, channelName: string) => {
    try {
      return await fetchAgoraSession(backendBaseUrl, requestedMode, channelName);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Request to backend session endpoint failed.";
      appendLog(`Backend session endpoint failed: ${message}`);
    }

    if (!envAppId) {
      throw new Error("Missing Agora config. Set AGORA_APP_ID on the backend or VITE_AGORA_APP_ID in the frontend.");
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
    if (connecting || joined) return;
    try {
      if (!client) throw new Error(clientError || "Agora RTC client is unavailable.");
      setConnecting(true);
      setConnectionError(null);
      setAnalysisError(null);
      const nextSession = await resolveSession(mode, channelInput.trim() || envChannel);
      appendLog(`Using Agora session from ${nextSession.source}.`);
      client.enableAudioVolumeIndicator();
      const joinedUid = await client.join(nextSession.appId, nextSession.channel, nextSession.token, nextSession.uid);

      if (isDebugMode) {
        setSession({ ...nextSession, uid: joinedUid });
        setJoined(true);
        appendLog(`Joined debug viewer for channel ${nextSession.channel} as ${joinedUid}.`);
        return;
      }

      const [microphoneTrack, nextCameraTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
      micTrackRef.current = microphoneTrack;
      cameraTrackRef.current = nextCameraTrack;
      setMicTrack(microphoneTrack);
      setCameraTrack(nextCameraTrack);
      setMicEnabled(microphoneTrack.enabled);
      setCameraEnabled(nextCameraTrack.enabled);
      await client.publish([microphoneTrack, nextCameraTrack]);
      renderLocalPreview(nextCameraTrack);
      setSession({ ...nextSession, uid: joinedUid });
      setJoined(true);
      appendLog(`Publishing mic + camera to channel ${nextSession.channel} as ${joinedUid}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to join channel.";
      setConnectionError(message);
      appendLog(`Join failed: ${message}`);
      cleanupLocalTracks();
      if (client) {
        try {
          await client.leave();
        } catch {
          // Best-effort cleanup.
        }
      }
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (!isDebugMode || !autoJoin || hasAutoJoinedRef.current) return;
    hasAutoJoinedRef.current = true;
    void joinChannel();
  }, [autoJoin, isDebugMode]);

  const toggleCamera = async () => {
    if (!cameraTrackRef.current) {
      setConnectionError("Join the channel before toggling the camera.");
      return;
    }
    const nextEnabled = !cameraTrackRef.current.enabled;
    await cameraTrackRef.current.setEnabled(nextEnabled);
    setCameraEnabled(nextEnabled);
    appendLog(nextEnabled ? "Camera enabled." : "Camera disabled.");
    if (nextEnabled) {
      renderLocalPreview(cameraTrackRef.current);
    } else {
      renderEmptyState(localContainerRef.current, "Camera off", "Turn the camera back on to resume the local preview.");
    }
  };

  const toggleMic = async () => {
    if (!micTrackRef.current) {
      setConnectionError("Join the channel before toggling the microphone.");
      return;
    }
    const nextEnabled = !micTrackRef.current.enabled;
    await micTrackRef.current.setEnabled(nextEnabled);
    setMicEnabled(nextEnabled);
    appendLog(nextEnabled ? "Microphone enabled." : "Microphone muted.");
  };

  const openDebugViewer = () => {
    const debugUrl = new URL(window.location.href);
    debugUrl.searchParams.set("mode", "debug");
    debugUrl.searchParams.set("channel", channelInput.trim() || envChannel);
    debugUrl.searchParams.set("autojoin", "1");
    window.open(debugUrl.toString(), "_blank", "noopener,noreferrer");
  };

  return (
    <main className="app-shell">
      <section className="hero-bar">
        <div className="hero-copy-block">
          <p className="eyebrow">{isDebugMode ? "Support View" : "Emotion Call"}</p>
          <h1>{isDebugMode ? "Realtime Viewer" : "Emotion Call Studio"}</h1>
          <p className="hero-copy">{isDebugMode ? "Monitor a live Agora session in a clean viewer layout and confirm what another participant is publishing." : "Join once, keep talking naturally, let the browser transcribe your speech live, send the text to the backend, and hear the AI reply spoken back."}</p>
        </div>
      </section>
      <section className="meet-shell">
        <div className="stage-grid">
          <article className="call-tile">
            <div className="tile-topbar">
              <div><span className="tile-label">You</span><strong className="tile-title">{isDebugMode ? "Viewer standby" : "Your camera preview"}</strong></div>
              <span className="tile-badge">{cameraEnabled ? "Camera live" : "Camera idle"}</span>
            </div>
            <div ref={localContainerRef} className="video-stage" />
            <div className="video-overlay"><span>{joined ? "Ready for your call" : "Camera preview will appear here after joining"}</span><strong>{micEnabled ? "Microphone on" : "Microphone off"}</strong></div>
            <div className="audio-meter-card">
              <div className="audio-meter-header"><span>Voice Activity</span><strong>{micStatus === "speaking" ? "Speaking" : micEnabled ? "Listening" : "Muted"}</strong></div>
              <div className="audio-meter-bars" aria-label={`Local microphone level ${localAudioLevel}`}>{localMeterSegments.map((active, index) => <span key={`local-meter-${index}`} className={active ? "audio-meter-bar active" : "audio-meter-bar"} />)}</div>
            </div>
          </article>
          <article className="call-tile">
            <div className="tile-topbar">
              <div><span className="tile-label">Remote Feed</span><strong className="tile-title">What the other side publishes</strong></div>
              <span className={remoteAudioLevel > 8 ? "tile-badge active" : "tile-badge"}>{remoteAudioStatus}</span>
            </div>
            <div ref={remoteContainerRef} className="video-stage remote-stage" />
            <div className="video-overlay"><span>{joined ? "Subscribed to remote participants in this room" : "Join to start receiving remote media"}</span><strong>{audioSignalDetected ? "Signal detected" : "Waiting for signal"}</strong></div>
            <div className="audio-meter-card">
              <div className="audio-meter-header"><span>Remote Audio</span><strong>{remoteAudioStatus === "receiving" ? "Receiving" : "Idle"}</strong></div>
              <div className="audio-meter-bars" aria-label={`Remote audio level ${remoteAudioLevel}`}>{remoteMeterSegments.map((active, index) => <span key={`remote-meter-${index}`} className={active ? "audio-meter-bar active remote" : "audio-meter-bar"} />)}</div>
            </div>
          </article>
        </div>
        <aside className="control-rail">
          <section className="panel">
            <div className="panel-header"><div><p className="eyebrow">Call Setup</p><h2>{isDebugMode ? "Viewer controls" : "Setup your call"}</h2></div></div>
            <label className="field"><span>Room name</span><input value={channelInput} onChange={(event) => setChannelInput(event.target.value)} disabled={joined || connecting} /></label>
            <div className="control-row">
              <button type="button" className="control-chip selected" onClick={joinChannel} disabled={joined || connecting}>{connecting ? "Connecting..." : isDebugMode ? "Join viewer" : "Join call"}</button>
              <button type="button" className="control-chip" onClick={() => void leaveChannel()} disabled={!joined && !connecting}>Leave call</button>
            </div>
            {!isDebugMode ? <><div className="control-row">
              <button type="button" className={cameraEnabled ? "control-chip active" : "control-chip"} onClick={() => void toggleCamera()} disabled={!cameraTrack}>{cameraEnabled ? "Turn camera off" : "Turn camera on"}</button>
              <button type="button" className={micEnabled ? "control-chip active" : "control-chip"} onClick={() => void toggleMic()} disabled={!micTrack}>{micEnabled ? "Mute microphone" : "Enable microphone"}</button>
            </div><button type="button" className="control-chip" onClick={openDebugViewer}>Open debug tab</button></> : null}
            <dl className="meta-grid">
              <div><dt>Mode</dt><dd>{mode}</dd></div>
              <div><dt>Status</dt><dd>{joined ? "joined" : "idle"}</dd></div>
              <div><dt>Session source</dt><dd>{session?.source ?? "not connected yet"}</dd></div>
              <div><dt>UID</dt><dd>{String(session?.uid ?? "-")}</dd></div>
            </dl>
            <div className="status-card"><span className={`status-dot ${combinedError ? "danger" : ""}`} /><p>{combinedError ? combinedError : joined ? `You are in ${session?.channel}. Live listening is ${isListeningLive ? "running" : "ready"} for ${selectedEmotion}.` : "Enter a room name, choose an emotion, and join when you are ready."}</p></div>
          </section>
          {!isDebugMode ? <>
            <section className="panel">
              <div className="panel-header"><div><p className="eyebrow">Emotion Layer</p><h2>{currentEmotion.title}</h2></div><span className="tile-badge active">{isAnalyzing ? "Responding" : liveStatus}</span></div>
              <div className="emotion-preview" style={{ ["--emotion-accent" as string]: currentEmotion.accent, ["--emotion-glow" as string]: currentEmotion.glow } as CSSProperties}>
                <div className="emotion-orb orb-one" />
                <div className="emotion-orb orb-two" />
                <div className="emotion-card">
                  <span className="emotion-mode">{currentEmotion.mood}</span>
                  <strong>{currentEmotion.title}</strong>
                  <div className="emotion-face">{currentEmotion.emoji}</div>
                  <p>{currentEmotion.description}</p>
                </div>
              </div>
              <div className="emotion-picker-grid emotion-picker-grid-tile">
                {SUPPORTED_EMOTIONS.map((emotion) => {
                  const config = EMOTIONS.find((entry) => entry.key === emotion) ?? EMOTIONS[0];
                  const selected = selectedEmotion === emotion;
                  return <button key={emotion} type="button" className={selected ? "emotion-option selected" : "emotion-option"} onClick={() => setSelectedEmotion(emotion)}><span>{config.title}</span><small>{config.mood}</small></button>;
                })}
              </div>
            </section>
            <section className="panel">
              <div className="panel-header"><div><p className="eyebrow">Live Response</p><h2>Latest AI output</h2></div></div>
              {analysisResult ? <div className="stack-panel">
                <article className="analysis-card analysis-card-wide"><p className="eyebrow">Transcript</p><p className="transcript">{analysisResult.transcript}</p></article>
                <article className="analysis-card"><p className="eyebrow">{analysisResult.emotion}</p><p className="analysis-response">{analysisResult.reply}</p></article>
              </div> : <p className="empty-copy">No live transcript yet. Join the room and start speaking.</p>}
            </section>
            <section className="panel">
              <div className="panel-header"><div><p className="eyebrow">Transcript Chunks</p><h2>Recent segments</h2></div></div>
              <div className="timeline-list">
                {transcriptEntries.length === 0 ? <p className="empty-copy">No live chunks processed yet.</p> : transcriptEntries.map((entry) => (
                  <article key={entry.id} className="timeline-card">
                    <div className="timeline-meta"><strong>{entry.createdAt}</strong><span>{entry.emotion}</span></div>
                    <p className="timeline-text">{entry.transcript}</p>
                  </article>
                ))}
              </div>
            </section>
          </> : null}
          <section className="panel">
            <div className="panel-header"><div><p className="eyebrow">Debug Log</p><h2>Session events</h2></div></div>
            <div className="log-list">{logs.length === 0 ? <p className="empty-copy">No events yet.</p> : logs.map((entry) => <p key={entry} className="log-entry">{entry}</p>)}</div>
          </section>
        </aside>
      </section>
    </main>
  );
}

export default App;
