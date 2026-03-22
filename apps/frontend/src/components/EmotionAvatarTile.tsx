import { AgoraSession } from "../lib/api";
import type { AvatarSpeechPerformance } from "../lib/api";
import { EMOTIONS } from "../lib/constants";
import { SupportedEmotion, SUPPORTED_EMOTIONS } from "../lib/emotions";
import { EmotionConfig } from "../lib/types";
import { AudioMeterCard } from "./AudioMeterCard";
import { EmotionAvatar } from "./EmotionAvatar";

interface EmotionAvatarTileProps {
  currentEmotion: EmotionConfig;
  selectedEmotion: SupportedEmotion;
  avatarSpeaking: boolean;
  avatarStageStatus: string;
  avatarSignalLevel: number;
  avatarMeterSegments: boolean[];
  avatarSpeechSource: "idle" | "text" | "voice";
  avatarResponseText: string;
  avatarSpeechStartedAt: number;
  avatarSpeechPerformance: AvatarSpeechPerformance | null;
  joined: boolean;
  session: AgoraSession | null;
  channelInput: string;
  onSelectEmotion: (emotion: SupportedEmotion) => void;
}

export function EmotionAvatarTile({
  currentEmotion,
  selectedEmotion,
  avatarSpeaking,
  avatarStageStatus,
  avatarSignalLevel,
  avatarMeterSegments,
  avatarSpeechSource,
  avatarResponseText,
  avatarSpeechStartedAt,
  avatarSpeechPerformance,
  joined,
  session,
  channelInput,
  onSelectEmotion,
}: EmotionAvatarTileProps) {
  const liveCue = avatarSpeechSource === "voice"
    ? "Voice-synced"
    : avatarSpeechSource === "text"
      ? "Text-driven"
      : "Standby";
  const responsePreview = avatarResponseText.trim()
    ? avatarResponseText.trim()
    : "The avatar will animate its mouth and gestures from the next response.";
  const responseAge = avatarSpeechStartedAt
    ? Math.max(0, Math.round((Date.now() - avatarSpeechStartedAt) / 1000))
    : 0;
  const gestureLabel = avatarSpeechPerformance?.gesturePlan.style
    ? avatarSpeechPerformance.gesturePlan.style.replace(/^\w/, (char) => char.toUpperCase())
    : "Adaptive";

  return (
    <article className={`meet-tile${avatarSpeaking ? " meet-tile--speaking" : ""}`}>
      <EmotionAvatar
        emotion={currentEmotion.key}
        speaking={avatarSpeaking}
        speechLevel={avatarSignalLevel}
        responseText={avatarResponseText}
        speechSource={avatarSpeechSource}
        speechStartedAt={avatarSpeechStartedAt}
        performance={avatarSpeechPerformance}
      />
      
      {joined && (
        <div className="meet-nameplate">
          <span>Avatar</span>
          <span className="meet-emotion-badge">
            {currentEmotion.emoji} {currentEmotion.title}
          </span>
        </div>
      )}
    </article>
  );
}
