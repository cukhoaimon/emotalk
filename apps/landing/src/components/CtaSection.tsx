import React from "react";

export default function CtaSection() {
  return (
    <section
      id="cta"
      style={{
        padding: "clamp(4rem, 8vw, 7rem) clamp(1rem, 5vw, 3rem)",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Glowing backdrop */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at 50% 50%, rgba(196,132,252,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            display: "inline-block",
            padding: "clamp(2rem, 5vw, 4rem) clamp(2rem, 6vw, 5rem)",
            borderRadius: "var(--gm-radius-xl)",
            background: "var(--gm-surface)",
            border: "1px solid rgba(196,132,252,0.25)",
            maxWidth: 680,
          }}
        >
          <div
            style={{
              fontSize: "clamp(2rem, 5vw, 3.5rem)",
              marginBottom: "1rem",
            }}
          >
            🌈
          </div>

          <h2
            style={{
              fontFamily: '"Quicksand", sans-serif',
              fontWeight: 700,
              fontSize: "clamp(1.8rem, 4vw, 2.75rem)",
              lineHeight: 1.2,
              color: "var(--gm-text)",
              marginBottom: "1rem",
            }}
          >
            Ready to talk to an AI that{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #f472b6, #c084fc, #67e8f9)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              understands?
            </span>
          </h2>

          <p
            style={{
              fontSize: "1rem",
              color: "var(--gm-text-secondary)",
              lineHeight: 1.7,
              marginBottom: "2rem",
            }}
          >
            No credit card. No download. Just open the app and start a conversation
            that feels real.
          </p>

          <div
            style={{
              display: "flex",
              gap: 16,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <a
              href="#"
              style={{
                padding: "14px 36px",
                borderRadius: 999,
                background: "linear-gradient(135deg, #f472b6, #c084fc)",
                color: "#fff",
                fontWeight: 700,
                fontSize: "1rem",
                transition: "transform 0.2s, box-shadow 0.2s",
                boxShadow: "0 4px 24px rgba(244,114,182,0.35)",
                display: "inline-block",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 8px 36px rgba(244,114,182,0.5)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 24px rgba(244,114,182,0.35)";
              }}
            >
              Get Started Free
            </a>
            <a
              href="#"
              style={{
                padding: "14px 36px",
                borderRadius: 999,
                background: "transparent",
                border: "1px solid rgba(196,132,252,0.35)",
                color: "var(--gm-text-secondary)",
                fontWeight: 700,
                fontSize: "1rem",
                transition: "border-color 0.2s, color 0.2s",
                display: "inline-block",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = "rgba(196,132,252,0.6)";
                e.currentTarget.style.color = "var(--gm-text)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "rgba(196,132,252,0.35)";
                e.currentTarget.style.color = "var(--gm-text-secondary)";
              }}
            >
              Watch Demo
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
