import { useEffect, useRef, type CSSProperties } from "react";

import type { SupportedEmotion } from "../lib/emotions";

type EmotionAvatarProps = {
  emotion: SupportedEmotion;
  speaking: boolean;
  speechLevel: number;
};

type AvatarPalette = {
  shell: string;
  shellEdge: string;
  glow: string;
  eye: string;
  accent: string;
  blush: string;
  mouth: string;
  aura: string;
  body: string;
  trim: string;
  particle: string;
};

const PALETTES: Record<SupportedEmotion, AvatarPalette> = {
  joy: {
    shell: "#ffb6d7",
    shellEdge: "#ffd7e9",
    glow: "rgba(255, 151, 203, 0.28)",
    eye: "#4a2458",
    accent: "#ffd55c",
    blush: "rgba(255, 108, 168, 0.28)",
    mouth: "#a12f67",
    aura: "rgba(255, 221, 118, 0.22)",
    body: "#8f60ff",
    trim: "#ffe79f",
    particle: "rgba(255, 238, 166, 0.95)",
  },
  sadness: {
    shell: "#9bbefc",
    shellEdge: "#d8e3ff",
    glow: "rgba(96, 165, 250, 0.28)",
    eye: "#22315f",
    accent: "#7dd3fc",
    blush: "rgba(165, 180, 252, 0.2)",
    mouth: "#304b9f",
    aura: "rgba(125, 211, 252, 0.18)",
    body: "#4363d8",
    trim: "#9fdcfa",
    particle: "rgba(197, 227, 255, 0.9)",
  },
  anger: {
    shell: "#ff9b87",
    shellEdge: "#ffd6b4",
    glow: "rgba(249, 115, 22, 0.32)",
    eye: "#4c1717",
    accent: "#ffda6d",
    blush: "rgba(255, 88, 88, 0.24)",
    mouth: "#85211c",
    aura: "rgba(255, 119, 58, 0.18)",
    body: "#a32929",
    trim: "#ffcb6b",
    particle: "rgba(255, 182, 94, 0.96)",
  },
  fear: {
    shell: "#8eb8ff",
    shellEdge: "#deebff",
    glow: "rgba(56, 189, 248, 0.24)",
    eye: "#132f53",
    accent: "#7ef9e2",
    blush: "rgba(148, 163, 184, 0.18)",
    mouth: "#2d4b87",
    aura: "rgba(126, 249, 226, 0.16)",
    body: "#27498c",
    trim: "#84f4ff",
    particle: "rgba(164, 255, 237, 0.9)",
  },
  disgust: {
    shell: "#addc72",
    shellEdge: "#daf5ae",
    glow: "rgba(132, 204, 22, 0.24)",
    eye: "#1e3b22",
    accent: "#5eead4",
    blush: "rgba(20, 184, 166, 0.18)",
    mouth: "#355c21",
    aura: "rgba(94, 234, 212, 0.14)",
    body: "#496f28",
    trim: "#95f2d6",
    particle: "rgba(188, 255, 179, 0.88)",
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function getEyeState(emotion: SupportedEmotion, blink: number, speaking: boolean) {
  const open = 1 - blink;

  switch (emotion) {
    case "joy":
      return { width: 34, height: clamp(10 * open, 1.5, 10), tilt: -0.18, browLift: -12 };
    case "sadness":
      return { width: 28, height: clamp(13 * open, 1.8, 13), tilt: 0.24, browLift: 6 };
    case "anger":
      return { width: 30, height: clamp(9 * open, 1.4, 9), tilt: speaking ? -0.32 : -0.42, browLift: -18 };
    case "fear":
      return { width: 26, height: clamp(18 * open, 2.5, 18), tilt: 0.12, browLift: 14 };
    case "disgust":
      return { width: 32, height: clamp(8 * open, 1.4, 8), tilt: 0.3, browLift: -6 };
    default:
      return { width: 30, height: clamp(12 * open, 1.5, 12), tilt: 0, browLift: 0 };
  }
}

function getMouthShape(emotion: SupportedEmotion, speechLevel: number, speaking: boolean) {
  const openAmount = clamp((speaking ? 0.24 : 0.08) + speechLevel / 115, 0.08, 0.72);

  switch (emotion) {
    case "joy":
      return { width: 54, height: 16 + openAmount * 42, curve: 1.05 };
    case "sadness":
      return { width: 42, height: 11 + openAmount * 26, curve: -0.58 };
    case "anger":
      return { width: 46, height: 15 + openAmount * 32, curve: 0.22 };
    case "fear":
      return { width: 30, height: 18 + openAmount * 46, curve: 0.1 };
    case "disgust":
      return { width: 48, height: 12 + openAmount * 22, curve: -0.16 };
    default:
      return { width: 44, height: 18, curve: 0 };
  }
}

function getMotionProfile(emotion: SupportedEmotion, energy: number) {
  switch (emotion) {
    case "joy":
      return { headTilt: Math.sin(energy * Math.PI) * 0.08, handLift: 12 + energy * 18, ringBoost: 1.08, sway: 1.12 };
    case "sadness":
      return { headTilt: -0.04, handLift: 4 + energy * 8, ringBoost: 0.92, sway: 0.72 };
    case "anger":
      return { headTilt: -0.08, handLift: 18 + energy * 14, ringBoost: 1.18, sway: 1.18 };
    case "fear":
      return { headTilt: 0.03, handLift: 14 + energy * 12, ringBoost: 1.12, sway: 1.26 };
    case "disgust":
      return { headTilt: 0.11, handLift: 8 + energy * 8, ringBoost: 0.98, sway: 0.88 };
    default:
      return { headTilt: 0, handLift: 8, ringBoost: 1, sway: 1 };
  }
}

function drawEmotionAccent(
  context: CanvasRenderingContext2D,
  emotion: SupportedEmotion,
  palette: AvatarPalette,
  time: number,
  energy: number
) {
  context.save();

  switch (emotion) {
    case "joy":
      for (let index = 0; index < 4; index += 1) {
        const angle = time / 800 + index * (Math.PI / 2);
        const radius = 116 + Math.sin(time / 420 + index) * 12;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * 46 - 88;
        context.fillStyle = palette.particle;
        context.beginPath();
        context.moveTo(x, y - 10);
        context.lineTo(x + 4, y - 2);
        context.lineTo(x + 12, y);
        context.lineTo(x + 4, y + 2);
        context.lineTo(x, y + 10);
        context.lineTo(x - 4, y + 2);
        context.lineTo(x - 12, y);
        context.lineTo(x - 4, y - 2);
        context.closePath();
        context.fill();
      }
      break;
    case "sadness":
      context.fillStyle = "rgba(212, 233, 255, 0.68)";
      context.beginPath();
      context.moveTo(52, 18);
      context.quadraticCurveTo(68, 36 + energy * 18, 50, 66 + energy * 28);
      context.quadraticCurveTo(34, 38, 52, 18);
      context.fill();
      break;
    case "anger":
      context.strokeStyle = palette.accent;
      context.lineWidth = 8;
      context.lineJoin = "round";
      context.beginPath();
      context.moveTo(-18, -164);
      context.lineTo(-2, -138);
      context.lineTo(-22, -138);
      context.lineTo(10, -96);
      context.lineTo(2, -124);
      context.lineTo(22, -124);
      context.stroke();
      break;
    case "fear":
      context.strokeStyle = "rgba(164, 255, 237, 0.5)";
      context.lineWidth = 3;
      for (let index = 0; index < 3; index += 1) {
        const radius = 98 + index * 18 + Math.sin(time / 350 + index) * 4;
        context.beginPath();
        context.ellipse(0, 12, radius, 74 + index * 8, 0, 0, Math.PI * 2);
        context.stroke();
      }
      break;
    case "disgust":
      context.strokeStyle = palette.accent;
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(-84, -92);
      context.bezierCurveTo(-34, -122, 14, -72, 72, -96);
      context.stroke();
      break;
    default:
      break;
  }

  context.restore();
}

function drawAvatarBody(
  context: CanvasRenderingContext2D,
  emotion: SupportedEmotion,
  palette: AvatarPalette,
  energy: number
) {
  context.fillStyle = palette.body;
  context.strokeStyle = palette.trim;
  context.lineWidth = 4;

  context.beginPath();

  switch (emotion) {
    case "joy":
      context.moveTo(-78, 90);
      context.quadraticCurveTo(-114, 132, -84, 204);
      context.quadraticCurveTo(-42, 236, 0, 238);
      context.quadraticCurveTo(42, 236, 84, 204);
      context.quadraticCurveTo(114, 132, 78, 90);
      context.quadraticCurveTo(34, 126, 0, 124);
      context.quadraticCurveTo(-34, 126, -78, 90);
      break;
    case "sadness":
      context.moveTo(-62, 96);
      context.quadraticCurveTo(-92, 126, -104, 222);
      context.quadraticCurveTo(-38, 252, 0, 252);
      context.quadraticCurveTo(38, 252, 104, 222);
      context.quadraticCurveTo(92, 126, 62, 96);
      context.quadraticCurveTo(28, 112, 0, 114);
      context.quadraticCurveTo(-28, 112, -62, 96);
      break;
    case "anger":
      context.moveTo(-92, 96);
      context.lineTo(-126, 156);
      context.lineTo(-88, 218);
      context.quadraticCurveTo(-30, 244, 0, 238);
      context.quadraticCurveTo(30, 244, 88, 218);
      context.lineTo(126, 156);
      context.lineTo(92, 96);
      context.quadraticCurveTo(30, 116, 0, 118);
      context.quadraticCurveTo(-30, 116, -92, 96);
      break;
    case "fear":
      context.moveTo(-58, 92);
      context.quadraticCurveTo(-94, 132, -90, 214);
      context.quadraticCurveTo(-42, 248, -18, 236);
      context.quadraticCurveTo(0, 252, 18, 236);
      context.quadraticCurveTo(42, 248, 90, 214);
      context.quadraticCurveTo(94, 132, 58, 92);
      context.quadraticCurveTo(26, 120, 0, 122);
      context.quadraticCurveTo(-26, 120, -58, 92);
      break;
    case "disgust":
      context.moveTo(-86, 92);
      context.quadraticCurveTo(-118, 128, -102, 214);
      context.quadraticCurveTo(-54, 238, -12, 232);
      context.quadraticCurveTo(34, 244, 86, 214);
      context.quadraticCurveTo(104, 138, 70, 92);
      context.quadraticCurveTo(22, 118, -10, 116);
      context.quadraticCurveTo(-42, 116, -86, 92);
      break;
    default:
      context.moveTo(-72, 92);
      context.quadraticCurveTo(-108, 136, -86, 204);
      context.quadraticCurveTo(-42, 234, 0, 236);
      context.quadraticCurveTo(42, 234, 86, 204);
      context.quadraticCurveTo(108, 136, 72, 92);
      context.quadraticCurveTo(34, 122, 0, 122);
      context.quadraticCurveTo(-34, 122, -72, 92);
      break;
  }

  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = palette.trim;
  context.beginPath();
  switch (emotion) {
    case "anger":
      context.moveTo(-18, 122);
      context.lineTo(0, 164 + energy * 8);
      context.lineTo(18, 122);
      context.lineTo(28, 220);
      context.lineTo(-28, 220);
      break;
    case "fear":
      context.moveTo(-10, 124);
      context.quadraticCurveTo(0, 142 + energy * 14, 10, 124);
      context.lineTo(20, 222);
      context.lineTo(-20, 222);
      break;
    default:
      context.moveTo(-12, 120);
      context.quadraticCurveTo(0, 148 + energy * 10, 12, 120);
      context.lineTo(18, 218);
      context.lineTo(-18, 218);
      break;
  }
  context.closePath();
  context.fill();
}

function drawAvatarHead(
  context: CanvasRenderingContext2D,
  emotion: SupportedEmotion,
  palette: AvatarPalette,
  energy: number
) {
  context.fillStyle = palette.shell;
  context.strokeStyle = palette.shellEdge;
  context.lineWidth = 4;
  context.beginPath();

  switch (emotion) {
    case "joy":
      context.moveTo(-96, 46);
      context.bezierCurveTo(-106, -46, -64, -132, 0, -138);
      context.bezierCurveTo(68, -132, 110, -44, 94, 48);
      context.bezierCurveTo(84, 110, 42, 148, 0, 152);
      context.bezierCurveTo(-42, 148, -84, 106, -96, 46);
      break;
    case "sadness":
      context.moveTo(-82, 42);
      context.bezierCurveTo(-96, -58, -56, -142, 0, -146);
      context.bezierCurveTo(58, -142, 92, -58, 84, 40);
      context.quadraticCurveTo(78, 116, 0, 158);
      context.quadraticCurveTo(-76, 116, -82, 42);
      break;
    case "anger":
      context.moveTo(-88, 38);
      context.lineTo(-70, -82);
      context.lineTo(0, -144 - energy * 6);
      context.lineTo(70, -82);
      context.lineTo(88, 40);
      context.lineTo(48, 132);
      context.lineTo(0, 150);
      context.lineTo(-48, 132);
      break;
    case "fear":
      context.moveTo(-74, 52);
      context.bezierCurveTo(-92, -36, -48, -144, 0, -156);
      context.bezierCurveTo(50, -144, 90, -38, 74, 54);
      context.bezierCurveTo(66, 114, 30, 150, 0, 156);
      context.bezierCurveTo(-30, 150, -68, 114, -74, 52);
      break;
    case "disgust":
      context.moveTo(-98, 42);
      context.bezierCurveTo(-104, -54, -42, -134, 12, -126);
      context.bezierCurveTo(74, -128, 110, -40, 88, 56);
      context.bezierCurveTo(70, 118, 28, 148, -10, 146);
      context.bezierCurveTo(-56, 144, -90, 104, -98, 42);
      break;
    default:
      context.moveTo(-92, 48);
      context.bezierCurveTo(-108, -44, -62, -128, 0, -134);
      context.bezierCurveTo(64, -128, 112, -44, 92, 48);
      context.bezierCurveTo(80, 108, 42, 146, 0, 150);
      context.bezierCurveTo(-42, 146, -82, 106, -92, 48);
      break;
  }

  context.closePath();
  context.fill();
  context.stroke();
}

function drawAvatarAccessory(
  context: CanvasRenderingContext2D,
  emotion: SupportedEmotion,
  palette: AvatarPalette,
  time: number,
  energy: number
) {
  context.save();

  switch (emotion) {
    case "joy":
      context.fillStyle = palette.accent;
      context.beginPath();
      context.moveTo(-38, -118);
      context.quadraticCurveTo(-24, -164 - energy * 8, 0, -136);
      context.quadraticCurveTo(26, -164 - energy * 8, 40, -118);
      context.quadraticCurveTo(16, -122, 0, -104);
      context.quadraticCurveTo(-16, -122, -38, -118);
      context.fill();
      break;
    case "sadness":
      context.strokeStyle = palette.trim;
      context.lineWidth = 12;
      context.beginPath();
      context.arc(0, -6, 110, Math.PI * 1.05, Math.PI * 1.95);
      context.stroke();
      break;
    case "anger":
      context.fillStyle = palette.accent;
      context.beginPath();
      context.moveTo(-70, -88);
      context.lineTo(-94, -142);
      context.lineTo(-50, -110);
      context.closePath();
      context.fill();
      context.beginPath();
      context.moveTo(70, -88);
      context.lineTo(94, -142);
      context.lineTo(50, -110);
      context.closePath();
      context.fill();
      break;
    case "fear":
      context.strokeStyle = palette.trim;
      context.lineWidth = 4;
      for (const side of [-1, 1] as const) {
        context.beginPath();
        context.moveTo(side * 26, -132);
        context.quadraticCurveTo(side * 38, -164 - energy * 10, side * 18, -184);
        context.stroke();
        context.fillStyle = palette.accent;
        context.beginPath();
        context.arc(side * 18, -186, 8 + energy * 2, 0, Math.PI * 2);
        context.fill();
      }
      break;
    case "disgust":
      context.strokeStyle = palette.accent;
      context.lineWidth = 10;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(-84, -26);
      context.quadraticCurveTo(-52, -78, -10, -54);
      context.stroke();
      context.beginPath();
      context.moveTo(12, -52);
      context.quadraticCurveTo(52, -84, 82, -42);
      context.stroke();
      break;
    default:
      break;
  }

  if (emotion === "sadness") {
    context.strokeStyle = "rgba(216, 227, 255, 0.7)";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(60, 14);
    context.quadraticCurveTo(76, 44 + energy * 12, 54, 82 + Math.sin(time / 300) * 4);
    context.stroke();
  }

  context.restore();
}

export function EmotionAvatar({
  emotion,
  speaking,
  speechLevel,
}: EmotionAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ emotion, speaking, speechLevel });
  const palette = PALETTES[emotion];
  const stageStyle = {
    "--avatar-accent": palette.accent,
    "--avatar-glow": palette.glow,
    "--avatar-wash": palette.aura,
    "--avatar-shell": palette.shellEdge,
  } as CSSProperties;

  useEffect(() => {
    stateRef.current = { emotion, speaking, speechLevel };
  }, [emotion, speaking, speechLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    let frameId = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      const width = parent?.clientWidth ?? 420;
      const height = parent?.clientHeight ?? 380;
      const ratio = window.devicePixelRatio || 1;

      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = (time: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const { emotion: currentEmotion, speaking: isSpeaking, speechLevel: currentSpeechLevel } =
        stateRef.current;
      const palette = PALETTES[currentEmotion];
      const energy = clamp(currentSpeechLevel / 100, 0, 1);
      const motion = getMotionProfile(currentEmotion, energy);
      const floating = Math.sin(time / 820) * 10;
      const breathing = 1 + Math.sin(time / 900) * 0.015 + energy * 0.025;
      const bob = Math.sin(time / (600 / motion.sway)) * (2.5 + energy * 3.5);
      const blinkPulse = Math.sin(time / 1900);
      const blink = blinkPulse > 0.94 ? (blinkPulse - 0.94) / 0.06 : 0;
      const eye = getEyeState(currentEmotion, blink, isSpeaking);
      const mouth = getMouthShape(currentEmotion, currentSpeechLevel, isSpeaking);
      const headX = width / 2 + Math.sin(time / 1200) * (8 + energy * 6);
      const headY = height / 2 - 26 + floating;
      const shoulderY = 154 + Math.sin(time / 500) * 2 + motion.handLift * 0.18;

      context.clearRect(0, 0, width, height);

      const backgroundGradient = context.createRadialGradient(
        width * 0.5,
        height * 0.34,
        10,
        width * 0.5,
        height * 0.34,
        width * 0.56
      );
      backgroundGradient.addColorStop(0, palette.aura);
      backgroundGradient.addColorStop(1, "rgba(12, 10, 20, 0)");
      context.fillStyle = backgroundGradient;
      context.fillRect(0, 0, width, height);

      for (let index = 0; index < 7; index += 1) {
        const angle = time / 1700 + index * 1.1;
        const particleX = width * 0.5 + Math.sin(angle) * (110 + index * 14);
        const particleY = height * 0.3 + Math.cos(angle * 1.2) * (44 + index * 12);
        const particleRadius = 3 + ((index % 3) + 1) * (0.8 + energy * 1.2);
        context.fillStyle = palette.particle;
        context.globalAlpha = 0.18 + (index % 3) * 0.08;
        context.beginPath();
        context.arc(particleX, particleY, particleRadius, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;

      context.save();
      context.translate(headX, headY + bob);
      context.rotate(motion.headTilt + Math.sin(time / 1600) * 0.025);
      context.scale(breathing, breathing);

      for (let index = 0; index < 3; index += 1) {
        const scale = 1 + index * 0.11 + energy * 0.08;
        context.strokeStyle = palette.aura;
        context.lineWidth = 6 - index;
        context.beginPath();
        context.ellipse(0, 18, 118 * scale * motion.ringBoost, 132 * scale, 0, 0, Math.PI * 2);
        context.stroke();
      }

      context.fillStyle = "rgba(255, 255, 255, 0.12)";
      context.beginPath();
      context.ellipse(-6, 224, 132, 26, 0, 0, Math.PI * 2);
      context.fill();

      drawAvatarBody(context, currentEmotion, palette, energy);

      context.strokeStyle = palette.trim;
      context.lineWidth = 8;
      context.lineCap = "round";
      const armSwing = Math.sin(time / 420) * (currentEmotion === "anger" ? 18 + energy * 20 : 12 + energy * 16);
      context.beginPath();
      context.moveTo(-58, 122);
      context.quadraticCurveTo(-112, 126 - motion.handLift, currentEmotion === "fear" ? -96 - armSwing : -110 - armSwing, 182);
      context.stroke();
      context.beginPath();
      context.moveTo(58, 122);
      context.quadraticCurveTo(112, 126 - motion.handLift, currentEmotion === "fear" ? 96 + armSwing : 110 + armSwing, 182);
      context.stroke();

      context.fillStyle = palette.glow;
      context.beginPath();
      context.ellipse(0, 18, currentEmotion === "fear" ? 92 : 118, currentEmotion === "anger" ? 118 : 132, 0, 0, Math.PI * 2);
      context.fill();

      drawEmotionAccent(context, currentEmotion, palette, time, energy);
      drawAvatarAccessory(context, currentEmotion, palette, time, energy);
      drawAvatarHead(context, currentEmotion, palette, energy);

      context.fillStyle = palette.accent;
      context.beginPath();
      context.moveTo(-24, currentEmotion === "fear" ? -148 : -134);
      context.quadraticCurveTo(0, -182 - energy * 16, 28, currentEmotion === "anger" ? -136 : -128);
      context.quadraticCurveTo(10, -118, -24, currentEmotion === "fear" ? -148 : -134);
      context.fill();

      context.fillStyle = palette.blush;
      context.beginPath();
      context.ellipse(-54, 34, 18, 10, 0, 0, Math.PI * 2);
      context.ellipse(54, 34, 18, 10, 0, 0, Math.PI * 2);
      context.fill();

      context.strokeStyle = palette.eye;
      context.fillStyle = palette.eye;
      context.lineCap = "round";
      context.lineWidth = 6;

      const drawEye = (side: -1 | 1) => {
        const x = side * 42;
        const y = -8;

        context.save();
        context.translate(x, y);
        context.rotate(eye.tilt * side);
        context.beginPath();
        context.ellipse(0, 0, eye.width / 2, eye.height / 2, 0, 0, Math.PI * 2);
        context.fill();

        if (currentEmotion === "fear" || (currentEmotion === "joy" && isSpeaking)) {
          context.fillStyle = "rgba(255, 255, 255, 0.7)";
          context.beginPath();
          context.arc(-4, -2, 2.5, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = palette.eye;
        }

        context.restore();

        context.beginPath();
        context.moveTo(x - 20, y - 26 - eye.browLift);
        context.quadraticCurveTo(x, y - 34 - eye.browLift, x + 20, y - 22 - eye.browLift);
        context.stroke();
      };

      drawEye(-1);
      drawEye(1);

      context.strokeStyle = palette.mouth;
      context.fillStyle = "rgba(118, 12, 52, 0.35)";
      context.lineWidth = 7;
      context.beginPath();
      context.moveTo(-mouth.width / 2, 70);
      context.quadraticCurveTo(0, 70 + mouth.height * mouth.curve, mouth.width / 2, 70);
      context.stroke();

      if (mouth.height > 12) {
        context.beginPath();
        context.moveTo(-mouth.width * 0.3, 72);
        context.quadraticCurveTo(0, 82 + mouth.height * 0.4, mouth.width * 0.3, 72);
        context.quadraticCurveTo(0, 98 + mouth.height * 0.5, -mouth.width * 0.3, 72);
        context.fill();
      }

      context.fillStyle = palette.trim;
      context.globalAlpha = 0.5;
      context.beginPath();
      context.ellipse(0, shoulderY, 58 + energy * 8, 18 + energy * 4, 0, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;

      context.restore();

      context.fillStyle = "rgba(255, 255, 255, 0.12)";
      context.fillRect(width * 0.14, height - 88, width * 0.72, 1);

      frameId = window.requestAnimationFrame(draw);
    };

    resize();
    frameId = window.requestAnimationFrame(draw);
    window.addEventListener("resize", resize);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="avatar-stage" data-emotion={emotion} style={stageStyle}>
      <div className="avatar-video-backdrop" aria-hidden="true">
        <div className="avatar-video-orb avatar-video-orb-left" />
        <div className="avatar-video-orb avatar-video-orb-right" />
        <div className="avatar-video-scanlines" />
      </div>
      <canvas ref={canvasRef} className="avatar-canvas" aria-hidden="true" />
    </div>
  );
}
