import { useEffect, useMemo, useRef, useState } from "react";
import AgoraRTC, { IAgoraRTCClient, IAgoraRTCRemoteUser, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import { EmotionAvatar } from "./components/EmotionAvatar";
import { AnalysisResponse, AgoraSession, AppMode, analyzeLiveAudio, fetchAgoraSession } from "./lib/api";
import { SUPPORTED_EMOTIONS, SupportedEmotion } from "./lib/emotions";

type TranscriptEntry = { id: string; createdAt: string; transcript: string; emotion: SupportedEmotion };
type EmotionConfig = { key: SupportedEmotion; title: string; mood: string; emoji: string; accent: string; glow: string; description: string };

const LIVE_CHUNK_DURATION_MS = 6000;
const LIVE_CHUNK_GAP_MS = 350;
const MIN_ANALYSIS_BLOB_SIZE_BYTES = 2048;
const EMOTIONS: EmotionConfig[] = [
  { key: "joy", title: "Joy", mood: "Bright Lift", emoji: "^_^", accent: "linear-gradient(135deg, #ff9ccf 0%, #8b5cf6 48%, #60a5fa 100%)", glow: "rgba(244, 114, 182, 0.4)", description: "Warm, optimistic energy for upbeat conversations and supportive responses." },
  { key: "sadness", title: "Sadness", mood: "Soft Rain", emoji: "T_T", accent: "linear-gradient(135deg, #60a5fa 0%, #4f46e5 52%, #8b5cf6 100%)", glow: "rgba(96, 165, 250, 0.36)", description: "Cool, reflective visuals suited to slower and more empathetic tones." },
  { key: "anger", title: "Anger", mood: "Heat Pulse", emoji: ">:(", accent: "linear-gradient(135deg, #fb7185 0%, #f97316 55%, #facc15 100%)", glow: "rgba(249, 115, 22, 0.34)", description: "Sharper contrast and hotter highlights for tense moments that need attention." },
  { key: "fear", title: "Fear", mood: "Night Echo", emoji: "o_o", accent: "linear-gradient(135deg, #2dd4bf 0%, #3b82f6 55%, #6366f1 100%)", glow: "rgba(59, 130, 246, 0.3)", description: "Nervous, alert atmosphere for uncertain or high-stakes emotional states." },
  { key: "disgust", title: "Disgust", mood: "Acid Drift", emoji: "-_-", accent: "linear-gradient(135deg, #84cc16 0%, #14b8a6 55%, #0ea5e9 100%)", glow: "rgba(20, 184, 166, 0.34)", description: "Tighter, uneasy gradients for moments of discomfort or rejection." },
];
const envAppId = import.meta.env.VITE_AGORA_APP_ID ?? "";
const envChannel = import.meta.env.VITE_AGORA_CHANNEL ?? "emotalk";
const envToken = import.meta.env.VITE_AGORA_TOKEN || null;
const envUidRaw = import.meta.env.VITE_AGORA_UID;
const backendBaseUrl = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3000";

function parseEnvUid(rawUid: string | undefined) { if (!rawUid) return null; const numericUid = Number(rawUid); return Number.isNaN(numericUid) ? rawUid : numericUid; }
function getModeFromLocation(): AppMode { const searchParams = new URLSearchParams(window.location.search); return searchParams.get("mode") === "debug" ? "debug" : "broadcast"; }
function getChannelFromLocation() { const searchParams = new URLSearchParams(window.location.search); return searchParams.get("channel") || envChannel; }
function shouldAutoJoin() { const searchParams = new URLSearchParams(window.location.search); return searchParams.get("autojoin") === "1"; }
function getTimeLabel() { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
function getSupportedLiveAudioMimeType() { const mimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]; return mimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? ""; }
function getLiveAudioExtension(mimeType: string) { return mimeType.includes("mp4") ? "mp4" : "webm"; }
function getAudioMeterSegments(level: number) { const normalizedLevel = Math.max(0, Math.min(level, 100)); return Array.from({ length: 10 }, (_, index) => normalizedLevel >= (index + 1) * 10); }
function normalizeTrackVolume(level: number) { return Math.max(0, Math.min(Math.round(level * 100), 100)); }
function App() {
  const mode = getModeFromLocation();
  const isDebugMode = mode === "debug";
  const autoJoin = shouldAutoJoin();
  const clientState = useMemo<{ client: IAgoraRTCClient | null; clientError: string | null }>(() => {
    try { return { client: AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }), clientError: null }; }
    catch (error) { return { client: null, clientError: error instanceof Error ? error.message : "Agora RTC failed to initialize." }; }
  }, []);
  const client = clientState.client;
  const clientError = clientState.clientError;
  const localContainerRef = useRef<HTMLDivElement>(null);
  const cameraTrackRef = useRef<ICameraVideoTrack | null>(null);
  const micTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const agentSessionRef = useRef<AgoraAgentSession | null>(null);
  const selectedEmotionRef = useRef<SupportedEmotion>("joy");
  const hasAutoJoinedRef = useRef(false);
  const selectedEmotionRef = useRef<SupportedEmotion>("joy");
  const previousEmotionKeyRef = useRef("");
  const joinedRef = useRef(false);
  const selectedEmotionsRef = useRef<SupportedEmotion[]>(["joy"]);
  const liveAudioStreamRef = useRef<MediaStream | null>(null);
  const liveRecorderRef = useRef<MediaRecorder | null>(null);
  const liveChunkPartsRef = useRef<Blob[]>([]);
  const liveChunkTimeoutRef = useRef<number | null>(null);
  const liveLoopEnabledRef = useRef(false);
  const liveRequestSequenceRef = useRef(0);
  const previousEmotionKeyRef = useRef("");
  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [session, setSession] = useState<AgoraSession | null>(null);
  const [channelInput, setChannelInput] = useState(getChannelFromLocation());
  const [cameraTrack, setCameraTrack] = useState<ICameraVideoTrack | null>(null);
  const [micTrack, setMicTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedEmotion, setSelectedEmotion] = useState<SupportedEmotion>("joy");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isListeningLive, setIsListeningLive] = useState(false);
  const [liveStatus, setLiveStatus] = useState("Join the channel to start live listening.");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [conversationSessionId, setConversationSessionId] = useState<string | null>(null);
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [remoteAudioLevel, setRemoteAudioLevel] = useState(0);
  const [audioSignalDetected, setAudioSignalDetected] = useState(false);
  const currentEmotion = EMOTIONS.find((emotion) => emotion.key === selectedEmotion) ?? EMOTIONS[0];
  const localMeterSegments = getAudioMeterSegments(localAudioLevel);
  const avatarSignalLevel = Math.max(localAudioLevel, remoteAudioLevel);
  const avatarMeterSegments = getAudioMeterSegments(avatarSignalLevel);
  const micStatus = !joined ? "offline" : !micEnabled ? "muted" : localAudioLevel > 8 ? "speaking" : "live";
  const avatarStageStatus = !joined ? "idle" : audioSignalDetected ? "live" : isAnalyzing ? "tracking" : "ready";
  const combinedError = connectionError || analysisError || clientError;

  const appendLog = (message: string) => setLogs((currentLogs) => [`${getTimeLabel()}  ${message}`, ...currentLogs].slice(0, 18));
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
  };

  useEffect(() => { clearVideoContainers(); }, [isDebugMode]);
  useEffect(() => { joinedRef.current = joined; }, [joined]);
  useEffect(() => { selectedEmotionRef.current = selectedEmotion; }, [selectedEmotion]);


  useEffect(() => {
    if (!client) return;
    const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
      appendLog(`Remote user ${user.uid} published ${mediaType}.`);
      if (mediaType !== "audio") {
        return;
      }

      await client.subscribe(user, mediaType);
      if (user.audioTrack) user.audioTrack.play();
    };
    const removeRemoteUser = (user: IAgoraRTCRemoteUser) => {
      appendLog(`Remote user ${user.uid} left or unpublished.`);
      setRemoteAudioLevel(0);
    };
    const handleConnectionStateChange = (currentState: string, previousState: string) => appendLog(`Connection ${previousState} -> ${currentState}.`);
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

  const clearLiveAudioStream = () => { liveAudioStreamRef.current?.getTracks().forEach((track) => track.stop()); liveAudioStreamRef.current = null; };
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
    if (recorder && recorder.state !== "inactive") recorder.stop();
    else { clearLiveAudioStream(); liveRecorderRef.current = null; }
    liveChunkPartsRef.current = [];
    setIsListeningLive(false);
    if (statusMessage) setLiveStatus(statusMessage);
  };
  const resetAnalysisState = () => {
    setTranscriptEntries([]);
    setAnalysisResult(null);
    setConversationSessionId(null);
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

  const sendLiveAudioChunk = async (audioBlob: Blob, mimeType: string, emotion: SupportedEmotion) => {
    const chunkId = `${Date.now()}`;
    const requestId = ++liveRequestSequenceRef.current;
    const file = new File([audioBlob], `emotalk-live-${chunkId}.${getLiveAudioExtension(mimeType)}`, { type: mimeType });
    try {
      setIsAnalyzing(true);
      setAnalysisError(null);
      setLiveStatus(`Analyzing live speech for ${emotion}.`);
      const result = await analyzeLiveAudio(backendBaseUrl, file, emotion, conversationSessionId ?? undefined);
      if (requestId !== liveRequestSequenceRef.current) return;
      if (result === null) return;
      setConversationSessionId(result.sessionId ?? null);
      setAnalysisResult(result);
      setTranscriptEntries((currentEntries) => [{ id: chunkId, createdAt: getTimeLabel(), transcript: result.transcript, emotion }, ...currentEntries].slice(0, 6));
      appendLog(`Live response updated for ${emotion}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Live audio analysis failed.";
      setAnalysisError(message);
      appendLog(`Live analysis failed: ${message}`);
    } finally {
      setIsAnalyzing(false);
      if (!liveLoopEnabledRef.current || !joinedRef.current || !selectedEmotionRef.current) {
        setIsListeningLive(false);
        return;
      }
      window.setTimeout(() => { void startLiveListeningChunk(); }, LIVE_CHUNK_GAP_MS);
    }
  };

  async function startLiveListeningChunk() {
    if (!liveLoopEnabledRef.current || !joinedRef.current || !micTrackRef.current) return;
    const mimeType = getSupportedLiveAudioMimeType();
    if (!mimeType) {
      setAnalysisError("This browser does not support live audio chunk recording for analysis.");
      stopLiveListeningLoop("Live listening is unavailable in this browser.");
      return;
    }
    const emotion = selectedEmotionRef.current;
    if (!emotion) {
      stopLiveListeningLoop("Pick one emotion to start live listening.");
      return;
    }
    clearLiveAudioStream();
    liveChunkPartsRef.current = [];
    const audioStream = new MediaStream([micTrackRef.current.getMediaStreamTrack().clone()]);
    const recorder = new MediaRecorder(audioStream, { mimeType });
    liveAudioStreamRef.current = audioStream;
    liveRecorderRef.current = recorder;
    setIsListeningLive(true);
    setLiveStatus(`Listening live for ${emotion}.`);
    recorder.ondataavailable = (event) => { if (event.data.size > 0) liveChunkPartsRef.current.push(event.data); };
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
      const nextEmotion = selectedEmotionRef.current;
      const audioBlob = new Blob(parts, { type: mimeType });
      if (audioBlob.size < MIN_ANALYSIS_BLOB_SIZE_BYTES) {
        setLiveStatus("Listening for speech...");
        window.setTimeout(() => { void startLiveListeningChunk(); }, LIVE_CHUNK_GAP_MS);
        return;
      }
      if (!nextEmotion) {
        stopLiveListeningLoop("Pick one emotion to start live listening.");
        return;
      }
      void sendLiveAudioChunk(audioBlob, mimeType, nextEmotion);
    };
    recorder.start();
    liveChunkTimeoutRef.current = window.setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, LIVE_CHUNK_DURATION_MS);
  }

  const leaveChannel = async () => {
    try {
      if (!client) throw new Error(clientError || "Agora RTC client is unavailable.");
      cleanupLocalTracks();
      clearVideoContainers();
      await client.leave();
      setJoined(false);
      setSession(null);
      resetAnalysisState();
      appendLog("Left the Agora channel.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to leave channel.";
      setConnectionError(message);
    }
  };

  useEffect(() => {
    return () => { void leaveChannel(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolveSession = async (requestedMode: AppMode, channelName: string) => {
    try { return await fetchAgoraSession(backendBaseUrl, requestedMode, channelName); }
    catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Request to backend session endpoint failed.";
      appendLog(`Backend session endpoint failed: ${message}`);
    }
    if (!envAppId) throw new Error("Missing Agora config. Set AGORA_APP_ID on the backend or VITE_AGORA_APP_ID in the frontend.");
    return { appId: envAppId, channel: channelName, token: envToken, uid: parseEnvUid(envUidRaw), source: "frontend-env" } satisfies AgoraSession;
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
      resetAnalysisState();
      appendLog(`Publishing mic + camera to channel ${nextSession.channel} as ${joinedUid}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to join channel.";
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoJoin, isDebugMode]);

  useEffect(() => {
    if (isDebugMode) return;
    if (!joined || !micTrackRef.current) {
      setIsListeningLive(false);
      setLiveStatus("Join the channel to start live listening.");
      return;
    }
    if (liveLoopEnabledRef.current) return;
    liveLoopEnabledRef.current = true;
    setAnalysisError(null);
    setLiveStatus(`Listening live for ${selectedEmotion}.`);
    appendLog(`Live listening started for ${selectedEmotion}.`);
    void startLiveListeningChunk();
  }, [isDebugMode, joined, selectedEmotion]);

  useEffect(() => {
    const emotionKey = selectedEmotion;
    if (emotionKey === previousEmotionKeyRef.current) return;
    previousEmotionKeyRef.current = emotionKey;
    if (isDebugMode) return;
    if (joined) {
      appendLog(`Live emotion updated: ${selectedEmotion}.`);
      setLiveStatus(`Listening live for ${selectedEmotion}.`);
    }
  }, [isDebugMode, joined, selectedEmotion]);

  const toggleCamera = async () => {
    if (!cameraTrackRef.current) {
      setConnectionError("Join the channel before toggling the camera.");
      return;
    }
    const nextEnabled = !cameraTrackRef.current.enabled;
    await cameraTrackRef.current.setEnabled(nextEnabled);
    setCameraEnabled(nextEnabled);
    appendLog(nextEnabled ? "Camera enabled." : "Camera disabled.");
    if (nextEnabled) renderLocalPreview(cameraTrackRef.current);
    else renderEmptyState(localContainerRef.current, "Camera off", "Turn the camera back on to resume the local preview.");
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

  const selectEmotion = (emotion: SupportedEmotion) => {
    setAnalysisError(null);
    setSelectedEmotion(emotion);
  };

  return (
    <main className="app-shell">
      <section className="hero-bar">
        <div className="hero-copy-block">
          <p className="eyebrow">Emotion Call</p>
          <h1>Emotion Call Studio</h1>
          <p className="hero-copy">Join once, keep talking naturally, and let the app continuously transcribe live speech into emotion-shaped replies.</p>
        </div>
      </section>
      <section className="meet-shell">
        <div className="stage-grid">
          <article className="call-tile">
            <div className="tile-topbar">
              <div><span className="tile-label">You</span><strong className="tile-title">Your camera preview</strong></div>
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
              <div><span className="tile-label">Emotion Avatar</span><strong className="tile-title">{currentEmotion.title} avatar is active</strong></div>
              <span className={audioSignalDetected ? "tile-badge active" : "tile-badge"}>{avatarStageStatus}</span>
            </div>
            <EmotionAvatar emotion={currentEmotion.key} speaking={audioSignalDetected} speechLevel={avatarSignalLevel} />
            <div className="avatar-emotion-panel">
              <div className="avatar-emotion-summary">
                <span className="tile-label">Selected Emotion Layer</span>
                <strong>{currentEmotion.title} · {currentEmotion.mood}</strong>
                <p>{currentEmotion.description}</p>
              </div>
              <div className="emotion-picker-grid avatar-emotion-grid">
                {SUPPORTED_EMOTIONS.map((emotion) => {
                  const config = EMOTIONS.find((entry) => entry.key === emotion) ?? EMOTIONS[0];
                  const selected = selectedEmotion === emotion;
                  return <button key={emotion} type="button" className={selected ? "emotion-option selected" : "emotion-option"} onClick={() => selectEmotion(emotion)}><span>{config.title}</span><small>{config.mood}</small></button>;
                })}
              </div>
            </div>
            <div className="video-overlay"><span>{joined ? `The avatar is synced to ${session?.channel ?? channelInput} and switches instantly with the selected emotion layer.` : "Join the call to activate the avatar and switch among the five emotion layers."}</span><strong>{audioSignalDetected ? "Live signal detected" : `${currentEmotion.title} avatar ready`}</strong></div>
            <div className="audio-meter-card">
              <div className="audio-meter-header"><span>Emotion Pulse</span><strong>{avatarStageStatus[0].toUpperCase()}{avatarStageStatus.slice(1)}</strong></div>
              <div className="audio-meter-bars" aria-label={`Emotion avatar signal level ${avatarSignalLevel}`}>{avatarMeterSegments.map((active, index) => <span key={`avatar-meter-${index}`} className={active ? "audio-meter-bar active remote" : "audio-meter-bar"} />)}</div>
            </div>
          </article>
        </div>
        <aside className="control-rail">
          <section className="panel">
            <div className="panel-header"><div><p className="eyebrow">Call Setup</p><h2>Setup your call</h2></div></div>
            <label className="field"><span>Room name</span><input value={channelInput} onChange={(event) => setChannelInput(event.target.value)} disabled={joined || connecting} /></label>
            <div className="control-row">
              <button type="button" className="control-chip selected" onClick={joinChannel} disabled={joined || connecting}>{connecting ? "Connecting..." : "Join call"}</button>
              <button type="button" className="control-chip" onClick={() => void leaveChannel()} disabled={!joined && !connecting}>Leave call</button>
            </div>
            <div className="control-row">
              <button type="button" className={cameraEnabled ? "control-chip active" : "control-chip"} onClick={() => void toggleCamera()} disabled={!cameraTrack}>{cameraEnabled ? "Turn camera off" : "Turn camera on"}</button>
              <button type="button" className={micEnabled ? "control-chip active" : "control-chip"} onClick={() => void toggleMic()} disabled={!micTrack}>{micEnabled ? "Mute microphone" : "Enable microphone"}</button>
            </div><button type="button" className="control-chip" onClick={openDebugViewer}>Open debug tab</button></> : null}
            <dl className="meta-grid">
              <div><dt>Mode</dt><dd>{mode}</dd></div>
              <div><dt>Status</dt><dd>{joined ? "joined" : "idle"}</dd></div>
              <div><dt>Session source</dt><dd>{session?.source ?? "not connected yet"}</dd></div>
              <div><dt>UID</dt><dd>{String(session?.uid ?? "-")}</dd></div>
            </dl>
            <div className="status-card"><span className={`status-dot ${combinedError ? "danger" : ""}`} /><p>{combinedError ? combinedError : joined ? `You are in ${session?.channel}. Live listening is ${isListeningLive ? "running" : "ready"} for ${currentEmotion.title}.` : "Enter a room name, choose one emotion layer, and join when you are ready."}</p></div>
          </section>
          {!isDebugMode ? <>
            <section className="panel">
              <div className="panel-header"><div><p className="eyebrow">Live Response</p><h2>Latest AI output</h2></div><span className="tile-badge active">{isAnalyzing ? "Responding" : liveStatus}</span></div>
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
            </div>
            <div className="emotion-picker-grid emotion-picker-grid-tile">
              {SUPPORTED_EMOTIONS.map((emotion) => {
                const config = EMOTIONS.find((entry) => entry.key === emotion) ?? EMOTIONS[0];
                const selected = selectedEmotions.includes(emotion);
                return <button key={emotion} type="button" className={selected ? "emotion-option selected" : "emotion-option"} onClick={() => toggleEmotion(emotion)}><span>{config.title}</span><small>{config.mood}</small></button>;
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
        </aside>
      </section>
      <div ref={remoteContainerRef} style={{ display: "none" }} aria-hidden="true" />
    </main>
  );
}

export default App;

