export const SUPPORTED_EMOTIONS = ["joy", "sadness", "anxiety", "anger"] as const;

export type SupportedEmotion = (typeof SUPPORTED_EMOTIONS)[number];
