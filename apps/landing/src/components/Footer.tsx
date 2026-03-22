import React from "react";

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--gm-border)",
        padding: "2rem clamp(1rem, 5vw, 3rem)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "1rem",
      }}
    >
      {/* Logo */}
      <div
        style={{
          fontFamily: '"Quicksand", sans-serif',
          fontWeight: 700,
          fontSize: "1rem",
          background: "linear-gradient(90deg, #f472b6, #c084fc, #67e8f9)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        🌈 EmoTalk
      </div>

      {/* Links */}
      <nav
        style={{
          display: "flex",
          gap: "clamp(1rem, 2vw, 1.5rem)",
          flexWrap: "wrap",
        }}
      >
        {["Privacy", "Terms", "GitHub"].map(label => (
          <a
            key={label}
            href="#"
            style={{
              fontSize: "0.85rem",
              color: "var(--gm-text-secondary)",
              transition: "color 0.2s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--gm-text)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--gm-text-secondary)")}
          >
            {label}
          </a>
        ))}
      </nav>

      {/* Copyright */}
      <p
        style={{
          fontSize: "0.8rem",
          color: "var(--gm-text-secondary)",
          opacity: 0.5,
        }}
      >
        © {new Date().getFullYear()} EmoTalk. All rights reserved.
      </p>
    </footer>
  );
}
