import React, { useState } from "react";
import { EMOTIONS } from "../data/emotions";
import EmotionCard from "./EmotionCard";

export default function EmotionShowcase() {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const active = EMOTIONS.find(e => e.key === activeKey);

  return (
    <section id="emotions" style={{ padding: "clamp(4rem, 8vw, 7rem) clamp(1rem, 5vw, 3rem)" }}>
      {/* Section header */}
      <div style={{ textAlign: "center", marginBottom: "clamp(2.5rem, 5vw, 4rem)" }}>
        <p
          style={{
            fontSize: "0.8rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--uc-lavender)",
            marginBottom: "0.75rem",
          }}
        >
          Four Personas
        </p>
        <h2
          style={{
            fontFamily: '"Quicksand", sans-serif',
            fontWeight: 700,
            fontSize: "clamp(1.8rem, 4vw, 3rem)",
            lineHeight: 1.2,
            color: "var(--gm-text)",
            marginBottom: "1rem",
          }}
        >
          Meet your emotional AI companions
        </h2>
        <p
          style={{
            fontSize: "1rem",
            color: "var(--gm-text-secondary)",
            maxWidth: 560,
            margin: "0 auto",
            lineHeight: 1.7,
          }}
        >
          Each persona is tuned to its emotional frequency — choose one or let EmoTalk pick based on your tone.
        </p>
      </div>

      {/* 2×2 Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: "clamp(1rem, 2vw, 1.5rem)",
          maxWidth: 800,
          margin: "0 auto",
        }}
      >
        {EMOTIONS.map(emotion => (
          <EmotionCard
            key={emotion.key}
            emotion={emotion}
            isActive={activeKey === emotion.key}
            onClick={() => setActiveKey(prev => (prev === emotion.key ? null : emotion.key))}
          />
        ))}
      </div>

      {/* Active emotion detail strip */}
      {active && (
        <div
          style={{
            maxWidth: 800,
            margin: "1.5rem auto 0",
            padding: "1rem 1.5rem",
            borderRadius: "var(--gm-radius-md)",
            background: "var(--gm-surface)",
            border: `1px solid ${active.glow}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
            animation: "fadeInUp 0.3s ease both",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: active.accent,
              animation: "pulse-glow 1.5s ease-in-out infinite",
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: "0.9rem", color: "var(--gm-text-secondary)" }}>
            <strong style={{ color: "var(--gm-text)" }}>{active.title}</strong> is active —{" "}
            {active.description}
          </span>
        </div>
      )}
    </section>
  );
}
