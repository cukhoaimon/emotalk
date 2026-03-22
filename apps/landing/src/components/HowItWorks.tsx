import React from "react";

const STEPS = [
  {
    number: "01",
    icon: "🎙️",
    title: "Start a conversation",
    description: "Speak or type — EmoTalk listens to your words and vocal tone in real time.",
  },
  {
    number: "02",
    icon: "🧠",
    title: "Emotion is detected",
    description: "Our AI analyzes sentiment, prosody, and word choice to identify your emotional state.",
  },
  {
    number: "03",
    icon: "✨",
    title: "Persona adapts",
    description: "The matching emotional persona activates, shifting visuals, tone, and response style instantly.",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      style={{
        padding: "clamp(4rem, 8vw, 7rem) clamp(1rem, 5vw, 3rem)",
        background: "rgba(28, 14, 48, 0.4)",
      }}
    >
      {/* Section header */}
      <div style={{ textAlign: "center", marginBottom: "clamp(2.5rem, 5vw, 4rem)" }}>
        <p
          style={{
            fontSize: "0.8rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--uc-sky)",
            marginBottom: "0.75rem",
          }}
        >
          How It Works
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
          Three steps to emotional resonance
        </h2>
      </div>

      {/* Steps */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "clamp(1rem, 3vw, 2rem)",
          maxWidth: 960,
          margin: "0 auto",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {STEPS.map((step, i) => (
          <div
            key={step.number}
            style={{
              flex: "1 1 240px",
              maxWidth: 320,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: "1rem",
              padding: "2rem 1.5rem",
              borderRadius: "var(--gm-radius-lg)",
              background: "var(--gm-surface)",
              border: "1px solid var(--gm-border)",
              position: "relative",
            }}
          >
            {/* Connecting line for desktop (pseudo-element via inline won't work, use a wrapper trick) */}
            {i < STEPS.length - 1 && (
              <div
                aria-hidden
                style={{
                  display: "none", // shown via CSS below
                  position: "absolute",
                  right: "-1.5rem",
                  top: "2.5rem",
                  width: "3rem",
                  height: 2,
                  background: "linear-gradient(90deg, rgba(196,132,252,0.4), rgba(103,232,249,0.4))",
                }}
                className="step-connector"
              />
            )}

            {/* Number */}
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 800,
                letterSpacing: "0.1em",
                color: "var(--uc-lavender)",
                opacity: 0.6,
              }}
            >
              {step.number}
            </div>

            {/* Icon circle */}
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(196,132,252,0.2), rgba(103,232,249,0.1))",
                border: "1px solid rgba(196,132,252,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2rem",
              }}
            >
              {step.icon}
            </div>

            {/* Title */}
            <h3
              style={{
                fontFamily: '"Quicksand", sans-serif',
                fontWeight: 700,
                fontSize: "1.1rem",
                color: "var(--gm-text)",
              }}
            >
              {step.title}
            </h3>

            {/* Description */}
            <p
              style={{
                fontSize: "0.9rem",
                lineHeight: 1.7,
                color: "var(--gm-text-secondary)",
              }}
            >
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
