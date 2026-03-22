import React, { useEffect, useState } from "react";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 clamp(1rem, 5vw, 3rem)",
        transition: "background 0.3s, backdrop-filter 0.3s, border-color 0.3s",
        background: scrolled ? "rgba(13, 8, 24, 0.80)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(196,132,252,0.18)" : "1px solid transparent",
      }}
    >
      {/* Logo */}
      <a
        href="#"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontFamily: '"Quicksand", sans-serif',
          fontWeight: 700,
          fontSize: "1.25rem",
          background: "linear-gradient(90deg, #f472b6, #c084fc, #67e8f9)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        <span style={{ fontSize: "1.4rem" }}>🌈</span>
        EmoTalk
      </a>

      {/* Nav links */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "clamp(1rem, 3vw, 2rem)",
        }}
      >
        {[
          { label: "Emotions", href: "#emotions" },
          { label: "How it works", href: "#how-it-works" },
          { label: "Features", href: "#features" },
        ].map(({ label, href }) => (
          <a
            key={href}
            href={href}
            style={{
              fontSize: "0.9rem",
              fontWeight: 600,
              color: "var(--gm-text-secondary)",
              transition: "color 0.2s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--gm-text)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--gm-text-secondary)")}
          >
            {label}
          </a>
        ))}
        <a
          href="#cta"
          style={{
            padding: "8px 20px",
            borderRadius: 999,
            background: "linear-gradient(135deg, #f472b6, #c084fc)",
            color: "#fff",
            fontWeight: 700,
            fontSize: "0.875rem",
            transition: "opacity 0.2s, transform 0.2s",
            display: "inline-block",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.opacity = "0.9";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.opacity = "1";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          Try Free
        </a>
      </div>
    </nav>
  );
}
