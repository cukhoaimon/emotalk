import React, { useState } from "react";

const FEATURES = [
  {
    icon: "🎭",
    title: "4 Emotional Personas",
    description: "Joy, Sadness, Anxiety, and Anger each bring a distinct visual and conversational style.",
  },
  {
    icon: "⚡",
    title: "Real-Time Detection",
    description: "Emotion shifts are detected mid-conversation — no manual switching needed.",
  },
  {
    icon: "🎨",
    title: "Dynamic Visuals",
    description: "Gradients, glows, and avatars transform instantly to match your emotional state.",
  },
  {
    icon: "🔊",
    title: "Voice & Text",
    description: "Talk or type — EmoTalk works with both modalities for maximum accessibility.",
  },
  {
    icon: "🔒",
    title: "Private by Default",
    description: "Conversations are ephemeral. Nothing is stored without your explicit consent.",
  },
  {
    icon: "🌐",
    title: "Works Anywhere",
    description: "Browser-native, zero install required. Open a tab and start talking.",
  },
];

export default function FeatureGrid() {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <section id="features" style={{ padding: "clamp(4rem, 8vw, 7rem) clamp(1rem, 5vw, 3rem)" }}>
      {/* Section header */}
      <div style={{ textAlign: "center", marginBottom: "clamp(2.5rem, 5vw, 4rem)" }}>
        <p
          style={{
            fontSize: "0.8rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--uc-mint)",
            marginBottom: "0.75rem",
          }}
        >
          Features
        </p>
        <h2
          style={{
            fontFamily: '"Quicksand", sans-serif',
            fontWeight: 700,
            fontSize: "clamp(1.8rem, 4vw, 3rem)",
            lineHeight: 1.2,
            color: "var(--gm-text)",
          }}
        >
          Built for genuine connection
        </h2>
      </div>

      {/* 3×2 grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
          gap: "clamp(1rem, 2vw, 1.25rem)",
          maxWidth: 960,
          margin: "0 auto",
        }}
      >
        {FEATURES.map((feature, i) => (
          <div
            key={feature.title}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            style={{
              padding: "1.5rem",
              borderRadius: "var(--gm-radius-md)",
              background: hoveredIdx === i ? "var(--gm-surface-raised)" : "var(--gm-surface)",
              border: `1px solid ${hoveredIdx === i ? "rgba(196,132,252,0.3)" : "var(--gm-border)"}`,
              transition: "transform 0.25s, box-shadow 0.25s, background 0.25s, border-color 0.25s",
              transform: hoveredIdx === i ? "translateY(-4px)" : "none",
              boxShadow: hoveredIdx === i ? "0 12px 32px rgba(196,132,252,0.15)" : "none",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              cursor: "default",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "var(--gm-radius-sm)",
                background: "linear-gradient(135deg, rgba(196,132,252,0.15), rgba(103,232,249,0.08))",
                border: "1px solid rgba(196,132,252,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.5rem",
              }}
            >
              {feature.icon}
            </div>
            <h3
              style={{
                fontFamily: '"Quicksand", sans-serif',
                fontWeight: 700,
                fontSize: "1rem",
                color: "var(--gm-text)",
              }}
            >
              {feature.title}
            </h3>
            <p
              style={{
                fontSize: "0.875rem",
                lineHeight: 1.6,
                color: "var(--gm-text-secondary)",
              }}
            >
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
