import { useEffect, useMemo, useRef, useState } from "react";
import AgoraRTC, { IAgoraRTCClient, IAgoraRTCRemoteUser, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import { EmotionAvatarTile } from "./components/EmotionAvatarTile";
import { CallSetupPanel } from "./components/CallSetupPanel";
import { LiveResponsePanel } from "./components/LiveResponsePanel";
import { LocalCameraPreview } from "./components/LocalCameraPreview";
import { AnalysisResponse, AgoraSession, AgoraAgentSession, AppMode, analyzeLiveAudio, fetchAgoraSession, requestAvatarSpeech, startAgoraAgent, stopAgoraAgent, updateAgoraAgent } from "./lib/api";
import type { AvatarSpeechPerformance, AvatarSpeechResponse } from "./lib/api";
import AgoraRTM from "agora-rtm";
import { ConversationalAIAPI, ETranscriptHelperMode, EConversationalAIAPIEvents, ETurnStatus } from "./lib/conversational-ai-api";
import type { TStateChangeEvent, TModuleError, ITranscriptHelperItem, IUserTranscription, IAgentTranscription } from "./lib/conversational-ai-api";
import { EMOTIONS, LIVE_CHUNK_DURATION_MS, LIVE_CHUNK_GAP_MS, MIN_ANALYSIS_BLOB_SIZE_BYTES } from "./lib/constants";
import { SupportedEmotion, SUPPORTED_EMOTIONS } from "./lib/emotions";
import { TranscriptEntry, CallSummaryData } from "./lib/types";
import { EmotionAvatar } from "./components/EmotionAvatar";
import { CallSummaryScreen } from "./components/CallSummaryScreen";

const envAppId = import.meta.env.VITE_AGORA_APP_ID ?? "";
const envChannel = import.meta.env.VITE_AGORA_CHANNEL ?? "reflexia";
const envToken = import.meta.env.VITE_AGORA_TOKEN || null;
const envUidRaw = import.meta.env.VITE_AGORA_UID;
const backendBaseUrl = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3000";

function parseEnvUid(rawUid: string | undefined) { if (!rawUid) return null; const numericUid = Number(rawUid); return Number.isNaN(numericUid) ? rawUid : numericUid; }
function getModeFromLocation(): AppMode { const searchParams = new URLSearchParams(window.location.search); return searchParams.get("mode") === "debug" ? "debug" : "broadcast"; }
function getChannelFromLocation() { const searchParams = new URLSearchParams(window.location.search); return searchParams.get("channel") || envChannel; }
function shouldAutoJoin() { const searchParams = new URLSearchParams(window.location.search); return searchParams.get("autojoin") === "1"; }
function shouldShowDevTools() { return new URLSearchParams(window.location.search).get("devtools") === "1"; }
function getTimeLabel() { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
function getSupportedLiveAudioMimeType() { const mimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]; return mimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? ""; }
function getLiveAudioExtension(mimeType: string) { return mimeType.includes("mp4") ? "mp4" : "webm"; }
function normalizeTrackVolume(level: number) { return Math.max(0, Math.min(Math.round(level * 100), 100)); }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(value, max)); }
function getAudioMeterSegments(level: number) { const normalizedLevel = Math.max(0, Math.min(level, 100)); return Array.from({ length: 10 }, (_, index) => normalizedLevel >= (index + 1) * 10); }
function getAvatarSpeechDuration(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const punctuationBoost = (trimmed.match(/[,.!?;:]/g) ?? []).length * 120;
  return clamp(trimmed.length * 72 + punctuationBoost + 900, 1600, 7200);
}

type AvatarSpeechSource = "idle" | "text" | "voice";

/* ── SVG Icons ── */
function IconMic() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function IconMicOff() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 7 16 12 23 17z" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function IconCameraOff() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function IconPhoneOff() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.42 19.42 0 0 1 4.69 12" />
      <path d="M6.61 6.61A15.5 15.5 0 0 0 4.69 12" />
      <path d="M4.69 12A19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function IconSidebar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconCC() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
      <path d="M10.5 13.5a2.5 2.5 0 0 1-5 0v-3a2.5 2.5 0 0 1 5 0" />
      <path d="M18.5 13.5a2.5 2.5 0 0 1-5 0v-3a2.5 2.5 0 0 1 5 0" />
    </svg>
  );
}

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
  const rtmClientRef = useRef<InstanceType<typeof AgoraRTM.RTM> | null>(null);
  const hasAutoJoinedRef = useRef(false);
  const selectedEmotionRef = useRef<SupportedEmotion>("joy");
  const joinedRef = useRef(false);
  const micEnabledRef = useRef(false);
  const liveAudioStreamRef = useRef<MediaStream | null>(null);
  const liveRecorderRef = useRef<MediaRecorder | null>(null);
  const liveChunkPartsRef = useRef<Blob[]>([]);
  const liveChunkTimeoutRef = useRef<number | null>(null);
  const liveLoopEnabledRef = useRef(false);
  const liveRequestSequenceRef = useRef(0);
  const previousEmotionKeyRef = useRef("");
  const subtitleClearTimeoutRef = useRef<number | null>(null);
  const finalizedTranscriptIdsRef = useRef<Set<string>>(new Set());
  const avatarSpeechTimeoutRef = useRef<number | null>(null);
  const avatarAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const avatarAudioUrlRef = useRef<string | null>(null);
  const avatarAudioContextRef = useRef<AudioContext | null>(null);
  const avatarAudioAnalyserRef = useRef<AnalyserNode | null>(null);
  const avatarAudioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const avatarAudioMeterIntervalRef = useRef<number | null>(null);
  const avatarResponseTurnIdRef = useRef<number | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const [callSummary, setCallSummary] = useState<CallSummaryData | null>(null);
  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [agentSession, setAgentSession] = useState<AgoraAgentSession | null>(null);
  const [agentState, setAgentState] = useState<string>("idle");
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
  const [liveStatus, setLiveStatus] = useState("Join the call to get started.");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [conversationSessionId, setConversationSessionId] = useState<string | null>(null);
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [remoteAudioLevel, setRemoteAudioLevel] = useState(0);
  const [audioSignalDetected, setAudioSignalDetected] = useState(false);
  const [avatarSpeaking, setAvatarSpeaking] = useState(false);
  const [avatarSpeechLevel, setAvatarSpeechLevel] = useState(0);
  const [avatarSpeechSource, setAvatarSpeechSource] = useState<AvatarSpeechSource>("idle");
  const [avatarResponseText, setAvatarResponseText] = useState("");
  const [avatarSpeechStartedAt, setAvatarSpeechStartedAt] = useState(0);
  const [avatarSpeechPerformance, setAvatarSpeechPerformance] = useState<AvatarSpeechPerformance | null>(null);
  const [isEmotionSwitching, setIsEmotionSwitching] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [liveSubtitleText, setLiveSubtitleText] = useState<string>("");
  const [currentTime, setCurrentTime] = useState(getTimeLabel());
  const currentEmotion = EMOTIONS.find((emotion) => emotion.key === selectedEmotion) ?? EMOTIONS[0];
  const localMeterSegments = getAudioMeterSegments(localAudioLevel);
  const avatarStageSpeaking = avatarSpeaking || remoteAudioLevel > 6 || agentState === "speaking";
  const avatarSignalLevel = Math.max(remoteAudioLevel, avatarSpeechLevel);
  const avatarMeterSegments = getAudioMeterSegments(avatarSignalLevel);
  const avatarStageStatus = !joined
    ? "idle"
    : avatarStageSpeaking
      ? (avatarSpeechSource === "voice" || remoteAudioLevel > 8 ? "speaking" : "responding")
      : isAnalyzing || agentState === "thinking"
        ? "thinking"
        : isListeningLive || agentState === "listening"
          ? "listening"
          : "ready";
  const micStatus = !joined ? "offline" : !micEnabled ? "muted" : localAudioLevel > 8 ? "speaking" : "live";
  const combinedError = connectionError || agentError || analysisError || clientError;

  // Clock tick
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(getTimeLabel()), 1000);
    return () => clearInterval(interval);
  }, []);

  const appendLog = (message: string) => setLogs((currentLogs) => [`${getTimeLabel()}  ${message}`, ...currentLogs].slice(0, 18));
  const renderEmptyState = (container: HTMLDivElement | null, title: string, message: string, accentClass = "") => {
    if (!container) return;
    container.innerHTML = "";
    const emptyState = document.createElement("div");
    emptyState.className = `video-placeholder ${accentClass}`.trim();
    emptyState.innerHTML = `<div class="video-placeholder-icon">📷</div><strong>${title}</strong><p>${message}</p>`;
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
    renderEmptyState(localContainerRef.current, isDebugMode ? "Viewer mode" : "Camera off", isDebugMode ? "This tab subscribes only." : "Your camera will appear here after joining.");
  };

  useEffect(() => { clearVideoContainers(); }, [isDebugMode]);
  useEffect(() => { joinedRef.current = joined; }, [joined]);
  useEffect(() => { micEnabledRef.current = micEnabled; }, [micEnabled]);
  useEffect(() => { selectedEmotionRef.current = selectedEmotion; }, [selectedEmotion]);

  // Render camera preview after the in-call DOM mounts (joined=true).
  // Must run after React commits the new DOM, otherwise the track plays
  // into the pre-join container which is about to be unmounted.
  useEffect(() => {
    if (joined && cameraTrackRef.current) {
      renderLocalPreview(cameraTrackRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined]);

  useEffect(() => {
    if (!client) return;
    const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
      appendLog(`Remote user ${user.uid} published ${mediaType}.`);
      if (mediaType !== "audio") return;
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
    if (!micTrack || !joined || isDebugMode || !micEnabled) {
      setLocalAudioLevel(0);
      return;
    }
    const intervalId = window.setInterval(() => {
      const nextLevel = normalizeTrackVolume(micTrack.getVolumeLevel());
      setLocalAudioLevel(nextLevel);
      setAudioSignalDetected((currentDetected) => currentDetected || nextLevel > 0);
    }, 200);
    return () => window.clearInterval(intervalId);
  }, [isDebugMode, joined, micEnabled, micTrack]);

  useEffect(() => {
    if (!joined) { setAudioSignalDetected(false); return; }
    setAudioSignalDetected(localAudioLevel > 0 || remoteAudioLevel > 0);
  }, [joined, localAudioLevel, remoteAudioLevel]);

  const clearAvatarSpeechTimeout = () => {
    if (avatarSpeechTimeoutRef.current !== null) {
      window.clearTimeout(avatarSpeechTimeoutRef.current);
      avatarSpeechTimeoutRef.current = null;
    }
  };
  const clearAvatarAudioMeter = () => {
    if (avatarAudioMeterIntervalRef.current !== null) {
      window.clearInterval(avatarAudioMeterIntervalRef.current);
      avatarAudioMeterIntervalRef.current = null;
    }
  };
  const stopAvatarAudioPlayback = () => {
    clearAvatarAudioMeter();
    const audio = avatarAudioElementRef.current;
    if (audio) {
      audio.pause();
      audio.src = "";
      avatarAudioElementRef.current = null;
    }
    if (avatarAudioSourceRef.current) {
      avatarAudioSourceRef.current.disconnect();
      avatarAudioSourceRef.current = null;
    }
    avatarAudioAnalyserRef.current = null;
    if (avatarAudioUrlRef.current) {
      URL.revokeObjectURL(avatarAudioUrlRef.current);
      avatarAudioUrlRef.current = null;
    }
  };
  const stopAvatarPerformance = (preserveText = true) => {
    clearAvatarSpeechTimeout();
    clearAvatarAudioMeter();
    setAvatarSpeaking(false);
    setAvatarSpeechLevel(0);
    setAvatarSpeechSource("idle");
    if (!preserveText) {
      setAvatarResponseText("");
      setAvatarSpeechPerformance(null);
      avatarResponseTurnIdRef.current = null;
    }
  };
  const scheduleAvatarSpeechTimeout = (text: string, durationOverride?: number | null) => {
    clearAvatarSpeechTimeout();
    const duration = durationOverride ?? getAvatarSpeechDuration(text);
    if (!duration) return;
    avatarSpeechTimeoutRef.current = window.setTimeout(() => {
      if (avatarAudioElementRef.current) return;
      stopAvatarPerformance(true);
    }, duration);
  };
  const activateAvatarTextResponse = (
    text: string,
    turnId?: number | null,
    restart = true,
    performance?: AvatarSpeechPerformance | null
  ) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const sameTurn = turnId !== undefined && turnId !== null && avatarResponseTurnIdRef.current === turnId;
    setAvatarResponseText(trimmed);
    if (performance !== undefined) {
      setAvatarSpeechPerformance(performance);
    }
    setAvatarSpeaking(true);
    setAvatarSpeechSource((currentSource) => currentSource === "voice" ? currentSource : "text");
    setAvatarSpeechLevel((currentLevel) => currentLevel > 0 ? currentLevel : 16);
    if (restart || !sameTurn) {
      setAvatarSpeechStartedAt(Date.now());
    }
    if (turnId !== undefined && turnId !== null) {
      avatarResponseTurnIdRef.current = turnId;
    }
    if (!avatarAudioElementRef.current) {
      scheduleAvatarSpeechTimeout(trimmed, performance?.durationMs);
    }
  };
  const startAvatarAudioMeter = async (audio: HTMLAudioElement) => {
    try {
      const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      const context = avatarAudioContextRef.current ?? new AudioContextCtor();
      avatarAudioContextRef.current = context;
      if (context.state === "suspended") {
        await context.resume();
      }
      clearAvatarAudioMeter();
      if (avatarAudioSourceRef.current) {
        avatarAudioSourceRef.current.disconnect();
        avatarAudioSourceRef.current = null;
      }
      const analyser = context.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.72;
      const source = context.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(context.destination);
      avatarAudioSourceRef.current = source;
      avatarAudioAnalyserRef.current = analyser;
      const frequencyData = new Uint8Array(analyser.frequencyBinCount);
      avatarAudioMeterIntervalRef.current = window.setInterval(() => {
        analyser.getByteFrequencyData(frequencyData);
        const average = frequencyData.reduce((sum, value) => sum + value, 0) / Math.max(frequencyData.length, 1);
        const peak = frequencyData.reduce((maxPeak, value) => Math.max(maxPeak, value), 0);
        const nextLevel = clamp(Math.round(average * 0.48 + peak * 0.28), 10, 100);
        setAvatarSpeechLevel(nextLevel);
      }, 80);
    } catch {
      setAvatarSpeechLevel(18);
    }
  };
  const playAvatarSpeechResponse = async ({ audioBlob, performance }: AvatarSpeechResponse, responseText: string) => {
    stopAvatarAudioPlayback();
    clearAvatarSpeechTimeout();
    const audioUrl = URL.createObjectURL(audioBlob);
    avatarAudioUrlRef.current = audioUrl;
    const audio = new Audio(audioUrl);
    avatarAudioElementRef.current = audio;
    setAvatarResponseText(responseText.trim());
    setAvatarSpeechPerformance(performance);
    setAvatarSpeaking(true);
    setAvatarSpeechSource("voice");
    setAvatarSpeechStartedAt(Date.now());
    setAvatarSpeechLevel(18);
    audio.onended = () => {
      stopAvatarAudioPlayback();
      stopAvatarPerformance(true);
    };
    audio.onerror = () => {
      stopAvatarAudioPlayback();
      activateAvatarTextResponse(responseText, null, true, performance);
    };
    await startAvatarAudioMeter(audio);
    try {
      await audio.play();
    } catch {
      stopAvatarAudioPlayback();
      activateAvatarTextResponse(responseText, null, true, performance);
    }
  };
  const clearLiveAudioStream = () => { liveAudioStreamRef.current?.getTracks().forEach((track) => track.stop()); liveAudioStreamRef.current = null; };
  const clearLiveChunkTimeout = () => {
    if (liveChunkTimeoutRef.current !== null) { window.clearTimeout(liveChunkTimeoutRef.current); liveChunkTimeoutRef.current = null; }
  };
  const clearSubtitleTimeout = () => {
    if (subtitleClearTimeoutRef.current !== null) {
      window.clearTimeout(subtitleClearTimeoutRef.current);
      subtitleClearTimeoutRef.current = null;
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
    clearSubtitleTimeout();
    finalizedTranscriptIdsRef.current.clear();
    setTranscriptEntries([]);
    setLiveSubtitleText("");
    setAnalysisResult(null);
    setConversationSessionId(null);
    setAvatarResponseText("");
    setAvatarSpeechPerformance(null);
    avatarResponseTurnIdRef.current = null;
    stopAvatarPerformance(false);
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
    stopAvatarAudioPlayback();
    stopAvatarPerformance(false);
  };

  const sendLiveAudioChunk = async (audioBlob: Blob, mimeType: string, emotion: SupportedEmotion) => {
    const chunkId = `${Date.now()}`;
    const requestId = ++liveRequestSequenceRef.current;
    const file = new File([audioBlob], `reflexia-live-${chunkId}.${getLiveAudioExtension(mimeType)}`, { type: mimeType });
    try {
      setIsAnalyzing(true);
      setAnalysisError(null);
      setLiveStatus("Processing…");
      const result = await analyzeLiveAudio(backendBaseUrl, file, emotion, conversationSessionId ?? undefined);
      if (requestId !== liveRequestSequenceRef.current) return;
      if (result === null) return;
      setConversationSessionId(result.sessionId ?? null);
      setAnalysisResult(result);
      setTranscriptEntries((currentEntries) => [{ id: chunkId, createdAt: getTimeLabel(), transcript: result.transcript, emotion }, ...currentEntries].slice(0, 6));
      activateAvatarTextResponse(result.reply, Number(chunkId), true, null);
      appendLog(`Live response updated for ${emotion}.`);
      try {
        const speechResponse = await requestAvatarSpeech(backendBaseUrl, result.reply, emotion);
        await playAvatarSpeechResponse(speechResponse, result.reply);
      } catch (speechErr) {
        appendLog(`Avatar speech failed: ${speechErr instanceof Error ? speechErr.message : "unknown error"}`);
      }
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
    if (!liveLoopEnabledRef.current || !joinedRef.current || !micTrackRef.current || !micEnabledRef.current) return;
    const mimeType = getSupportedLiveAudioMimeType();
    if (!mimeType) {
      setAnalysisError("This browser does not support live audio chunk recording for analysis.");
      stopLiveListeningLoop("Live listening is unavailable in this browser.");
      return;
    }
    const emotion = selectedEmotionRef.current;
    if (!emotion) { stopLiveListeningLoop("Pick one emotion to start live listening."); return; }
    clearLiveAudioStream();
    liveChunkPartsRef.current = [];
    const audioStream = new MediaStream([micTrackRef.current.getMediaStreamTrack().clone()]);
    const recorder = new MediaRecorder(audioStream, { mimeType });
    liveAudioStreamRef.current = audioStream;
    liveRecorderRef.current = recorder;
    setIsListeningLive(true);
    setLiveStatus("Listening…");
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
      if (!liveLoopEnabledRef.current || !joinedRef.current) { setIsListeningLive(false); return; }
      const nextEmotion = selectedEmotionRef.current;
      const audioBlob = new Blob(parts, { type: mimeType });
      if (audioBlob.size < MIN_ANALYSIS_BLOB_SIZE_BYTES) {
        setLiveStatus("Listening…");
        window.setTimeout(() => { void startLiveListeningChunk(); }, LIVE_CHUNK_GAP_MS);
        return;
      }
      if (!nextEmotion) { stopLiveListeningLoop("Pick one emotion to start live listening."); return; }
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

      if (callStartTimeRef.current && transcriptEntries.length > 0) {
        const durationSeconds = Math.round((Date.now() - callStartTimeRef.current) / 1000);
        const emotionBreakdown: Partial<Record<SupportedEmotion, number>> = {};
        transcriptEntries.forEach((entry) => {
          emotionBreakdown[entry.emotion] = (emotionBreakdown[entry.emotion] || 0) + 1;
        });

        const domEmotion = Object.entries(emotionBreakdown).reduce((a, b) => b[1] > a[1] ? b : a, ["", 0]);
        const dominantEmotion = (domEmotion[0] as SupportedEmotion) || selectedEmotionRef.current || "joy";

        setCallSummary({
          durationSeconds,
          entries: [...transcriptEntries],
          dominantEmotion,
          emotionBreakdown
        });
      }
      callStartTimeRef.current = null;

      stopLiveListeningLoop();
      cleanupLocalTracks();
      clearVideoContainers();
      // Unsubscribe from ConvAI events before stopping the agent so that
      // any teardown errors from the Agora/OpenAI Realtime API don't surface in the UI.
      try { const convAI = ConversationalAIAPI.getInstance(); convAI.unsubscribe(); convAI.destroy(); } catch { /* not initialized */ }
      if (agentSessionRef.current) {
        try { await stopAgoraAgent(backendBaseUrl, agentSessionRef.current.agent_id); } catch { /* best-effort */ }
        agentSessionRef.current = null;
        setAgentSession(null);
      }
      if (rtmClientRef.current) {
        try { await rtmClientRef.current.logout(); } catch { /* best-effort */ }
        rtmClientRef.current = null;
      }
      await client.leave();
      setJoined(false);
      setSession(null);
      setAgentError(null);
      setConnectionError(null);
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

  // Stop the backend agent when the user closes/refreshes the tab.
  // fetch with keepalive=true survives page unload; async await is not available here.
  useEffect(() => {
    const handlePageHide = () => {
      if (agentSessionRef.current) {
        const url = new URL(`/agora/agent/${agentSessionRef.current.agent_id}/leave`, backendBaseUrl);
        void fetch(url.toString(), { method: "POST", keepalive: true });
      }
      if (client) void client.leave();
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => {
    clearSubtitleTimeout();
    clearAvatarSpeechTimeout();
    stopAvatarAudioPlayback();
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
      let microphoneTrack = micTrackRef.current;
      let nextCameraTrack = cameraTrackRef.current;
      if (!microphoneTrack || !nextCameraTrack) {
        if (nextCameraTrack) { nextCameraTrack.stop(); nextCameraTrack.close(); cameraTrackRef.current = null; }
        if (microphoneTrack) { microphoneTrack.stop(); microphoneTrack.close(); micTrackRef.current = null; }
        [microphoneTrack, nextCameraTrack] = await AgoraRTC.createMicrophoneAndCameraTracks({ ANS: true, AEC: true, AGC: true });
      }
      micTrackRef.current = microphoneTrack;
      cameraTrackRef.current = nextCameraTrack;
      setMicTrack(microphoneTrack);
      setCameraTrack(nextCameraTrack);
      setMicEnabled(true);
      setCameraEnabled(nextCameraTrack.enabled);
      await client.publish([microphoneTrack, nextCameraTrack]);
      setSession({ ...nextSession, uid: joinedUid });
      setJoined(true);
      if (!isDebugMode) {
        callStartTimeRef.current = Date.now();
      }

      // Start agent + RTM
      try {
        const agentSess = await startAgoraAgent(backendBaseUrl, {
          channel: nextSession.channel,
          uid: String(joinedUid),
          emotion: selectedEmotionRef.current,
        });
        agentSessionRef.current = agentSess;
        setAgentSession(agentSess);
        appendLog(`Agent started as uid ${agentSess.agentUid}.`);

        const rtmClient = new AgoraRTM.RTM(nextSession.appId, String(joinedUid));
        await rtmClient.login({ token: nextSession.token ?? undefined });
        await rtmClient.subscribe(nextSession.channel);
        rtmClientRef.current = rtmClient;

        const convAI = ConversationalAIAPI.init({
          rtcEngine: client,
          rtmEngine: rtmClient,
          renderMode: ETranscriptHelperMode.WORD,
          enableLog: true,
        });
        convAI.on(EConversationalAIAPIEvents.AGENT_STATE_CHANGED, (_uid: string, event: TStateChangeEvent) => {
          setAgentState(event.state);
          if (event.state === "speaking") {
            setAvatarSpeaking(true);
            setAvatarSpeechSource((currentSource) => currentSource === "idle" ? "text" : currentSource);
          } else if (event.state === "thinking" || event.state === "listening" || event.state === "idle") {
            if (!avatarAudioElementRef.current) {
              stopAvatarPerformance(true);
            }
          }
          appendLog(`Agent state: ${event.state}`);
        });
        convAI.on(EConversationalAIAPIEvents.TRANSCRIPT_UPDATED, (history: ITranscriptHelperItem<Partial<IUserTranscription | IAgentTranscription>>[]) => {
          const last = history[history.length - 1];
          if (!last) return;

          // Always update live subtitle (streaming text while turn is in progress)
          clearSubtitleTimeout();
          setLiveSubtitleText(last.text ?? "");

          // Only add to history when the turn is finalized
          const isFinished = last.status === ETurnStatus.END || last.status === ETurnStatus.INTERRUPTED;
          const transcriptId = `${last.turn_id}-${last.uid}`;
          if (isFinished && last.text?.trim()) {
            if (!finalizedTranscriptIdsRef.current.has(transcriptId)) {
              finalizedTranscriptIdsRef.current.add(transcriptId);
              setTranscriptEntries((prev) =>
                [{ id: transcriptId, createdAt: getTimeLabel(), transcript: last.text ?? "", emotion: selectedEmotionRef.current }, ...prev].slice(0, 6)
              );
              if (last.metadata?.object === "assistant.transcription") {
                activateAvatarTextResponse(last.text, last.turn_id, last.turn_id !== avatarResponseTurnIdRef.current, null);
              }
            }
            // Clear live text after a short delay so final text remains briefly visible
            subtitleClearTimeoutRef.current = window.setTimeout(() => {
              setLiveSubtitleText("");
              subtitleClearTimeoutRef.current = null;
            }, 2000);
          }
        });
        convAI.on(EConversationalAIAPIEvents.AGENT_ERROR, (_uid: string, err: TModuleError) => {
          setAgentError(err.message);
          appendLog(`Agent error: ${err.message}`);
        });
        convAI.subscribeMessage(nextSession.channel);
      } catch (agentErr) {
        appendLog(`Agent/RTM init failed (call continues): ${agentErr instanceof Error ? agentErr.message : "unknown error"}`);
      }

      resetAnalysisState();
      appendLog(`Publishing mic + camera to channel ${nextSession.channel} as ${joinedUid}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to join channel.";
      setConnectionError(message);
      appendLog(`Join failed: ${message}`);
      cleanupLocalTracks();
      if (client) { try { await client.leave(); } catch { /* Best-effort cleanup. */ } }
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
      setLiveStatus("Join the call to get started.");
      return;
    }
    if (liveLoopEnabledRef.current) return;
    liveLoopEnabledRef.current = true;
    setAnalysisError(null);
    setLiveStatus("Listening…");
    appendLog(`Live listening started for ${selectedEmotion}.`);
    void startLiveListeningChunk();
  }, [isDebugMode, joined, micEnabled, selectedEmotion]);

  useEffect(() => {
    const emotionKey = selectedEmotion;
    if (emotionKey === previousEmotionKeyRef.current) return;
    previousEmotionKeyRef.current = emotionKey;
    if (isDebugMode) return;
    if (joined) {
      appendLog(`Live emotion updated: ${selectedEmotion}.`);
      setLiveStatus("Listening…");
    }
  }, [isDebugMode, joined, selectedEmotion]);

  const toggleCamera = async () => {
    if (!joined) {
      if (!cameraTrackRef.current) {
        try {
          const track = await AgoraRTC.createCameraVideoTrack();
          cameraTrackRef.current = track;
          setCameraTrack(track);
          setCameraEnabled(true);
          renderLocalPreview(track);
        } catch (err) {
          setConnectionError(err instanceof Error ? err.message : "Camera access denied.");
        }
      } else {
        cameraTrackRef.current.stop();
        cameraTrackRef.current.close();
        cameraTrackRef.current = null;
        setCameraTrack(null);
        setCameraEnabled(false);
        renderEmptyState(localContainerRef.current, "Camera off", "Your camera will appear here after joining.");
      }
      return;
    }
    if (!cameraTrackRef.current) { setConnectionError("Camera unavailable."); return; }
    const nextEnabled = !cameraTrackRef.current.enabled;
    await cameraTrackRef.current.setEnabled(nextEnabled);
    setCameraEnabled(nextEnabled);
    appendLog(nextEnabled ? "Camera enabled." : "Camera disabled.");
    if (nextEnabled) renderLocalPreview(cameraTrackRef.current);
    else renderEmptyState(localContainerRef.current, "Camera off", "Turn the camera back on to resume the local preview.");
  };

  const toggleMic = async () => {
    if (!joined) {
      if (!micTrackRef.current) {
        try {
          const track = await AgoraRTC.createMicrophoneAudioTrack({ ANS: true, AEC: true, AGC: true });
          micTrackRef.current = track;
          setMicTrack(track);
          setMicEnabled(true);
        } catch (err) {
          setConnectionError(err instanceof Error ? err.message : "Microphone access denied.");
        }
      } else {
        micTrackRef.current.stop();
        micTrackRef.current.close();
        micTrackRef.current = null;
        setMicTrack(null);
        setMicEnabled(false);
      }
      return;
    }
    if (!micTrackRef.current) { setConnectionError("Microphone unavailable."); return; }
    const nextEnabled = !micTrackRef.current.enabled;
    await micTrackRef.current.setEnabled(nextEnabled);
    setMicEnabled(nextEnabled);
    setLocalAudioLevel(0);
    appendLog(nextEnabled ? "Microphone enabled." : "Microphone muted.");
  };

  const selectEmotion = async (emotion: SupportedEmotion) => {
    setAnalysisError(null);
    setSelectedEmotion(emotion);

    if (!joined || !agentSessionRef.current) return;

    setIsEmotionSwitching(true);
    try {
      const currentAgentId = agentSessionRef.current.agent_id;
      const channel = session!.channel;
      const uid = String(session!.uid);

      await stopAgoraAgent(backendBaseUrl, currentAgentId);
      agentSessionRef.current = null;
      setAgentSession(null);
      appendLog(`Emotion switch: stopped agent ${currentAgentId}.`);

      const newAgentSess = await startAgoraAgent(backendBaseUrl, { channel, uid, emotion });
      agentSessionRef.current = newAgentSess;
      setAgentSession(newAgentSess);
      appendLog(`Emotion switch: started new agent ${newAgentSess.agent_id} with emotion ${emotion}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to switch emotion.";
      setAgentError(message);
      appendLog(`Emotion switch failed: ${message}`);
    } finally {
      setIsEmotionSwitching(false);
    }
  };

  // Suppress unused variable warnings for vars kept for future use
  void agentSession;
  void agentState;
  void logs;
  void updateAgoraAgent;

  /* ═══════════════════════════════════
     EMOTION PICKER (shared between pre-join and sidebar)
     ═══════════════════════════════════ */
  const emotionPicker = (
    <div className={`emotion-picker-grid${isEmotionSwitching ? " emotion-picker-switching" : ""}`}>
      {SUPPORTED_EMOTIONS.map((emotion) => {
        const config = EMOTIONS.find((e) => e.key === emotion) ?? EMOTIONS[0];
        const isSelected = selectedEmotion === emotion;
        return (
          <button
            key={emotion}
            type="button"
            className={isSelected ? "emotion-option selected" : "emotion-option"}
            onClick={() => { void selectEmotion(emotion); }}
            disabled={isEmotionSwitching}
          >
            <span className="emotion-option-face">{config.emoji}</span>
            <span>{config.title}</span>
            {isEmotionSwitching && isSelected && <span className="emotion-switching-indicator" aria-label="Switching…" />}
          </button>
        );
      })}
    </div>
  );

  /* ═══════════════════════════════════
     SUMMARY SCREEN
     ═══════════════════════════════════ */
  if (callSummary) {
    return (
      <CallSummaryScreen summary={callSummary} onDismiss={() => setCallSummary(null)} />
    );
  }

  /* ═══════════════════════════════════
     PRE-JOIN SCREEN
     ═══════════════════════════════════ */
  if (!joined) {
    return (
      <main className="app-shell">
        <div className="prejoin-screen">
          <div className="prejoin-brand">
            <span className="prejoin-brand-name">Reflexia</span>
            <span className="prejoin-brand-tagline">Emotion-aware video calls, powered by AI</span>
          </div>
          <div className="prejoin-card">
            <div className="prejoin-preview">
              <LocalCameraPreview
                containerRef={localContainerRef}
                joined={false}
                micEnabled={micEnabled}
                micStatus={micStatus}
              />
              <div className="call-toolbar">
                <button
                  className={`toolbar-btn${!micEnabled ? " toolbar-btn--muted" : ""}`}
                  onClick={() => void toggleMic()}
                  aria-label="Mic"
                >
                  {micEnabled ? <IconMic /> : <IconMicOff />}
                </button>
                <button
                  className={`toolbar-btn${!cameraEnabled ? " toolbar-btn--muted" : ""}`}
                  onClick={() => void toggleCamera()}
                  aria-label="Camera"
                >
                  {cameraEnabled ? <IconCamera /> : <IconCameraOff />}
                </button>
              </div>
            </div>
            <div className="prejoin-controls">
              <h1 className="prejoin-title">Ready to join?</h1>
              <p className="prejoin-subtitle">
                Choose an emotion layer to start your Reflexia session.
                You can switch emotions at any time during the call.
              </p>
              <div className="prejoin-emotion-section">
                <span className="prejoin-emotion-label">
                  Emotion: {currentEmotion.emoji} {currentEmotion.title}
                </span>
                {emotionPicker}
              </div>
              <button
                className="prejoin-join-btn"
                onClick={() => void joinChannel()}
                disabled={connecting}
              >
                {connecting ? "Joining…" : "Join now"}
              </button>
              {combinedError && (
                <div className="prejoin-error">{combinedError}</div>
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* ═══════════════════════════════════
     IN-CALL VIEW
     ═══════════════════════════════════ */
  return (
    <main className="app-shell">
      {/* ── Top Bar ── */}
      <header className="topbar">
        <div className="topbar-brand">
          <span className="topbar-logo">Reflexia</span>
          <span className="topbar-divider" />
          <span className="topbar-channel">{session?.channel ?? channelInput}</span>
        </div>
        <span className="topbar-time">{currentTime}</span>
      </header>

      {/* ── Main body: stage + sidebar ── */}
      <div className="meet-body">
        {/* ── Video stage ── */}
        <div className="meet-stage">
          <div className="participants-grid participants-grid--count-2">
            <LocalCameraPreview
              containerRef={localContainerRef}
              joined={joined}
              micEnabled={micEnabled}
              micStatus={micStatus}
            />
            <EmotionAvatarTile
              currentEmotion={currentEmotion}
              selectedEmotion={selectedEmotion}
              avatarSpeaking={avatarSpeaking}
              avatarStageStatus={avatarStageStatus}
              avatarSignalLevel={avatarSignalLevel}
              avatarMeterSegments={avatarMeterSegments}
              avatarSpeechSource={avatarSpeechSource}
              avatarResponseText={avatarResponseText}
              avatarSpeechStartedAt={avatarSpeechStartedAt}
              avatarSpeechPerformance={avatarSpeechPerformance}
              joined={joined}
              session={session}
              channelInput={channelInput}
              onSelectEmotion={selectEmotion}
            />
          </div>

          {/* ── Subtitle Overlay ── */}
          {subtitlesEnabled && liveSubtitleText && (
            <div className="subtitle-overlay">
              <p className="subtitle-text">
                {liveSubtitleText.split(" ").map((word, i) => (
                  <span key={i} className="subtitle-word" style={{ animationDelay: `${i * 0.02}s` }}>
                    {word}{" "}
                  </span>
                ))}
              </p>
            </div>
          )}

          {/* ── Bottom Toolbar ── */}
          <div className="call-toolbar">
            <button
              className={`toolbar-btn${!micEnabled ? " toolbar-btn--muted" : ""}`}
              onClick={() => void toggleMic()}
              disabled={!micTrack}
              aria-label="Mic"
            >
              {micEnabled ? <IconMic /> : <IconMicOff />}
            </button>
            <button
              className={`toolbar-btn${!cameraEnabled ? " toolbar-btn--muted" : ""}`}
              onClick={() => void toggleCamera()}
              disabled={!cameraTrack}
              aria-label="Camera"
            >
              {cameraEnabled ? <IconCamera /> : <IconCameraOff />}
            </button>
            <button
              className={`toolbar-btn toolbar-btn--cc${subtitlesEnabled ? " active" : ""}`}
              onClick={() => setSubtitlesEnabled(!subtitlesEnabled)}
              aria-label="Toggle subtitles"
              aria-pressed={subtitlesEnabled}
            >
              <IconCC />
            </button>
            <button
              className="toolbar-btn toolbar-btn--danger"
              onClick={() => void leaveChannel()}
              aria-label="Leave"
            >
              <IconPhoneOff />
            </button>
            <span className="toolbar-divider" />
            <button
              className={`toolbar-btn toolbar-btn--sidebar${sidebarOpen ? " active" : ""}`}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle sidebar"
            >
              <IconSidebar />
            </button>
          </div>
        </div>

        {/* ── Sidebar ── */}
        {sidebarOpen && (
          <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
        )}
        {sidebarOpen && (
          <aside className="sidebar">
            <div className="sidebar-header">
              <span className="sidebar-title">Controls</span>
              <button
                className="toolbar-btn"
                style={{ width: 32, height: 32 }}
                onClick={() => setSidebarOpen(false)}
                aria-label="Close sidebar"
              >
                <IconClose />
              </button>
            </div>
            <div className="sidebar-section">
              <CallSetupPanel
                channelInput={channelInput}
                joined={joined}
                connecting={connecting}
                isDebugMode={isDebugMode}
                mode={mode}
                session={session}
                isListeningLive={isListeningLive}
                currentEmotion={currentEmotion}
                combinedError={combinedError}
                showDevTools={!isDebugMode && shouldShowDevTools()}
                onChannelInputChange={setChannelInput}
                onJoin={() => void joinChannel()}
                onLeave={() => void leaveChannel()}
                onOpenDebugViewer={() => { }}
              />
            </div>
            {!isDebugMode && (
              <div className="sidebar-section">
                <p className="eyebrow" style={{ marginBottom: 8 }}>Emotion Layer</p>
                <p style={{ fontSize: "0.92rem", fontWeight: 500, marginBottom: 10 }}>
                  {currentEmotion.emoji} {currentEmotion.title}
                </p>
                {emotionPicker}
              </div>
            )}
          </aside>
        )}
      </div>
    </main>
  );
}

export default App;
