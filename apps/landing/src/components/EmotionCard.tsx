import React, { useState } from "react";
import { LandingEmotionConfig } from "../data/emotions";

interface Props {
  emotion: LandingEmotionConfig;
  isActive: boolean;
  onClick: () => void;
}

export default function EmotionCard({ emotion, isActive, onClick }: Props) {
  const [hovered, setHovered] = useState(false);
  const elevated = isActive || hovered;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        borderRadius: "var(--gm-radius-lg)",
        background: elevated ? "var(--gm-surface-raised)" : "var(--gm-surface)",
        border: `1px solid ${elevated ? "rgba(196,132,252,0.35)" : "var(--gm-border)"}`,
        overflow: "hidden",
        transition: "transform 0.25s, box-shadow 0.25s, border-color 0.25s, background 0.25s",
        transform: elevated ? "translateY(-4px)" : "none",
        boxShadow: elevated ? `0 16px 48px ${emotion.glow}` : "0 4px 16px rgba(0,0,0,0.2)",
        outline: isActive ? `2px solid ${emotion.glow}` : "none",
        outlineOffset: 2,
        textAlign: "left",
        width: "100%",
      }}
    >
      {/* Gradient header strip */}
      <div
        style={{
          height: 6,
          background: emotion.accent,
          borderRadius: "var(--gm-radius-lg) var(--gm-radius-lg) 0 0",
        }}
      />

      {/* Card body */}
      <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Avatar + title row */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: emotion.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              flexShrink: 0,
              boxShadow: elevated ? `0 0 20px ${emotion.glow}` : "none",
              transition: "box-shadow 0.25s",
              animation: isActive ? `pulse-glow 2s ease-in-out infinite` : "none",
            }}
          >
            <img
              src={emotion.imageSrc}
              alt={emotion.title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={e => {
                e.currentTarget.style.display = "none";
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  parent.style.fontSize = "1.75rem";
                  parent.textContent = emotion.emoji;
                }
              }}
            />
          </div>

          <div>
            <div
              style={{
                fontFamily: '"Quicksand", sans-serif',
                fontWeight: 700,
                fontSize: "1.15rem",
                color: "var(--gm-text)",
                lineHeight: 1.2,
              }}
            >
              {emotion.title}
            </div>
            <div
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                background: emotion.accent,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                marginTop: 2,
              }}
            >
              {emotion.mood}
            </div>
          </div>
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: "0.9rem",
            lineHeight: 1.6,
            color: "var(--gm-text-secondary)",
          }}
        >
          {emotion.description}
        </p>

        {/* Emoji badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 12px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            fontSize: "0.8rem",
            fontWeight: 600,
            color: "var(--gm-text-secondary)",
            width: "fit-content",
          }}
        >
          <span style={{ fontFamily: "monospace" }}>{emotion.emoji}</span>
        </div>
      </div>
    </button>
  );
}
