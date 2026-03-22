export interface LandingEmotionConfig {
  key: string;
  title: string;
  mood: string;
  emoji: string;
  accent: string;
  glow: string;
  description: string;
  imageSrc: string;
}

export const EMOTIONS: LandingEmotionConfig[] = [
  {
    key: "joy",
    title: "Joy",
    mood: "Bright Lift",
    emoji: "^_^",
    accent: "linear-gradient(135deg, #ff9ccf 0%, #8b5cf6 48%, #60a5fa 100%)",
    glow: "rgba(244, 114, 182, 0.4)",
    description: "Warm, optimistic energy for upbeat conversations and supportive responses.",
    imageSrc: "/emotions/happy.png",
  },
  {
    key: "sadness",
    title: "Sadness",
    mood: "Soft Rain",
    emoji: "T_T",
    accent: "linear-gradient(135deg, #60a5fa 0%, #4f46e5 52%, #8b5cf6 100%)",
    glow: "rgba(96, 165, 250, 0.36)",
    description: "Cool, reflective visuals suited to slower and more empathetic tones.",
    imageSrc: "/emotions/sadness.png",
  },
  {
    key: "anxiety",
    title: "Anxiety",
    mood: "Nerve Current",
    emoji: "o_o",
    accent: "linear-gradient(135deg, #67e8f9 0%, #3b82f6 52%, #7c3aed 100%)",
    glow: "rgba(59, 130, 246, 0.34)",
    description: "Alert, restless visuals tuned for uneasy, high-attention moments and risk-aware replies.",
    imageSrc: "/emotions/anxiety.png",
  },
  {
    key: "anger",
    title: "Anger",
    mood: "Heat Pulse",
    emoji: ">:(",
    accent: "linear-gradient(135deg, #fb7185 0%, #f97316 55%, #facc15 100%)",
    glow: "rgba(249, 115, 22, 0.34)",
    description: "Sharper contrast and hotter highlights for tense moments that need attention.",
    imageSrc: "/emotions/anger.png",
  },
];
