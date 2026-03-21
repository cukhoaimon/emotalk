import { SupportedEmotion } from "./emotions";

export type TranscriptEntry = {
  id: string;
  createdAt: string;
  transcript: string;
  emotion: SupportedEmotion;
};

export type EmotionConfig = {
  key: SupportedEmotion;
  title: string;
  mood: string;
  emoji: string;
  accent: string;
  glow: string;
  description: string;
  avatarMode?: "canvas" | "image";
  imageSrc?: string;
};

export type CallSummaryData = {
  durationSeconds: number;
  entries: TranscriptEntry[];
  dominantEmotion: SupportedEmotion;
  emotionBreakdown: Partial<Record<SupportedEmotion, number>>;
};
