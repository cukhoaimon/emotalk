import React from "react";

export default function AuroraBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "-10%",
          left: "-5%",
          width: "60%",
          height: "60%",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(196,132,252,0.18) 0%, transparent 70%)",
          animation: "aurora-drift 20s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "30%",
          right: "-10%",
          width: "55%",
          height: "55%",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(103,232,249,0.13) 0%, transparent 70%)",
          animation: "aurora-drift 25s ease-in-out infinite reverse",
          animationDelay: "-8s",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-5%",
          left: "25%",
          width: "50%",
          height: "50%",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(244,114,182,0.14) 0%, transparent 70%)",
          animation: "aurora-drift 22s ease-in-out infinite",
          animationDelay: "-12s",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "60%",
          left: "60%",
          width: "40%",
          height: "40%",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(110,231,183,0.10) 0%, transparent 70%)",
          animation: "aurora-drift 28s ease-in-out infinite reverse",
          animationDelay: "-5s",
        }}
      />
    </div>
  );
}
