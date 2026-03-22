import React from "react";
import { EMOTIONS } from "../data/emotions";

export default function HeroSection() {
  return (
    <section
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "clamp(5rem, 10vw, 8rem) clamp(1rem, 5vw, 3rem) clamp(3rem, 6vw, 5rem)",
        position: "relative",
      }}
    >
      {/* Badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 16px",
          borderRadius: 999,
          background: "rgba(196,132,252,0.12)",
          border: "1px solid rgba(196,132,252,0.3)",
          fontSize: "0.8rem",
          fontWeight: 700,
          color: "var(--uc-lavender)",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          marginBottom: "1.5rem",
          animation: "fadeInUp 0.6s ease both",
        }}
      >
        <span>✨</span> Emotion-Driven AI Conversations
      </div>

      {/* Headline */}
      <h1
        style={{
          fontFamily: '"Quicksand", sans-serif',
          fontWeight: 700,
          fontSize: "clamp(2.4rem, 7vw, 5.5rem)",
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          maxWidth: 900,
          marginBottom: "1.5rem",
          animation: "fadeInUp 0.6s 0.1s ease both",
        }}
      >
        Talk to AI that{" "}
        <span
          style={{
            background: "linear-gradient(135deg, #f472b6 0%, #c084fc 50%, #67e8f9 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          feels what you feel
        </span>
      </h1>

      {/* Sub-copy */}
      <p
        style={{
          fontSize: "clamp(1rem, 2vw, 1.25rem)",
          color: "var(--gm-text-secondary)",
          maxWidth: 600,
          lineHeight: 1.7,
          marginBottom: "2.5rem",
          animation: "fadeInUp 0.6s 0.2s ease both",
        }}
      >
        EmoTalk detects your emotional state in real time and switches its AI persona —
        Joy, Sadness, Anxiety, or Anger — to match your moment with empathy and authenticity.
      </p>

      {/* CTAs */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          justifyContent: "center",
          marginBottom: "4rem",
          animation: "fadeInUp 0.6s 0.3s ease both",
        }}
      >
        <a
          href="#cta"
          style={{
            padding: "14px 32px",
            borderRadius: 999,
            background: "linear-gradient(135deg, #f472b6, #c084fc)",
            color: "#fff",
            fontWeight: 700,
            fontSize: "1rem",
            transition: "transform 0.2s, box-shadow 0.2s",
            boxShadow: "0 4px 24px rgba(244,114,182,0.35)",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 8px 32px rgba(244,114,182,0.5)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 4px 24px rgba(244,114,182,0.35)";
          }}
        >
          Start for Free
        </a>
        <a
          href="#how-it-works"
          style={{
            padding: "14px 32px",
            borderRadius: 999,
            background: "rgba(196,132,252,0.12)",
            border: "1px solid rgba(196,132,252,0.3)",
            color: "var(--gm-text)",
            fontWeight: 700,
            fontSize: "1rem",
            transition: "background 0.2s, transform 0.2s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(196,132,252,0.2)";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "rgba(196,132,252,0.12)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          See How It Works
        </a>
      </div>

      {/* Floating emotion avatars */}
      <div
        style={{
          display: "flex",
          gap: "clamp(1rem, 3vw, 2rem)",
          justifyContent: "center",
          flexWrap: "wrap",
          animation: "fadeInUp 0.6s 0.4s ease both",
        }}
      >
        {EMOTIONS.map((emotion, i) => (
          <div
            key={emotion.key}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              animation: `float ${3.5 + i * 0.5}s ease-in-out infinite`,
              animationDelay: `${i * 0.4}s`,
            }}
          >
            <div
              style={{
                width: "clamp(64px, 10vw, 88px)",
                height: "clamp(64px, 10vw, 88px)",
                borderRadius: "50%",
                background: emotion.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                boxShadow: `0 8px 32px ${emotion.glow}`,
                border: "2px solid rgba(255,255,255,0.1)",
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
                    parent.style.fontSize = "2rem";
                    parent.textContent = emotion.emoji;
                  }
                }}
              />
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "var(--gm-text-secondary)",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              {emotion.title}
            </span>
          </div>
        ))}
      </div>

      {/* Scroll indicator */}
      <div
        style={{
          position: "absolute",
          bottom: "2rem",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          color: "var(--gm-text-secondary)",
          opacity: 0.5,
          animation: "bounce 2s ease-in-out infinite",
        }}
      >
        <span style={{ fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Scroll</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M3 9l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </section>
  );
}
