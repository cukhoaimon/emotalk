export const SUPPORTED_EMOTIONS = ["joy", "sadness", "anger", "fear", "disgust"] as const;

export type SupportedEmotion = (typeof SUPPORTED_EMOTIONS)[number];
