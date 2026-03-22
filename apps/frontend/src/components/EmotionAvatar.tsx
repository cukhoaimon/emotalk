import { useEffect, useRef, type CSSProperties } from "react";

import type { AvatarGesturePlan, AvatarSpeechPerformance, AvatarViseme, AvatarVisemeFrame } from "../lib/api";
import type { SupportedEmotion } from "../lib/emotions";

type AvatarSpeechSource = "idle" | "text" | "voice";

type EmotionAvatarProps = {
  emotion: SupportedEmotion;
  speaking: boolean;
  speechLevel: number;
  responseText: string;
  speechSource: AvatarSpeechSource;
  speechStartedAt: number;
  performance: AvatarSpeechPerformance | null;
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

type SpeechCadence = {
  openness: number;
  widthBias: number;
  emphasis: number;
  gesture: number;
  nod: number;
};

type MotionProfile = {
  headTilt: number;
  handLift: number;
  ringBoost: number;
  sway: number;
  reach: number;
};

type GestureRuntime = {
  style: AvatarGesturePlan["style"];
  intensity: number;
  beat: number;
  hold: number;
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
  anxiety: {
    shell: "#d9f0d5",
    shellEdge: "#f5f8dc",
    glow: "rgba(192, 255, 188, 0.26)",
    eye: "#28453e",
    accent: "#f4e7a1",
    blush: "rgba(190, 214, 179, 0.18)",
    mouth: "#45635b",
    aura: "rgba(214, 244, 170, 0.18)",
    body: "#59756b",
    trim: "#eef5c2",
    particle: "rgba(245, 244, 186, 0.88)",
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function inferGestureStyle(emotion: SupportedEmotion, responseText: string): AvatarGesturePlan["style"] {
  const normalizedText = responseText.toLowerCase();
  if (emotion === "joy" || /(great|amazing|love|yes|wonderful|perfect|fantastic)/.test(normalizedText)) {
    return "expansive";
  }
  if (emotion === "sadness" || /(sorry|understand|feel|support|together|safe|gentle)/.test(normalizedText)) {
    return "empathetic";
  }
  if (emotion === "anxiety" || /(careful|risk|warning|avoid|concern|issue|problem)/.test(normalizedText)) {
    return "cautionary";
  }
  if (emotion === "anger" || /(must|need|stop|never|immediately|seriously|definitely)/.test(normalizedText)) {
    return "emphatic";
  }
  return "precise";
}

function inferGesturePlan(emotion: SupportedEmotion, responseText: string, durationMs: number): AvatarGesturePlan {
  const words = responseText.trim().split(/\s+/).filter(Boolean);
  const gap = Math.max(1, Math.round(words.length / 4));
  const beats = words.slice(0, 12).filter((_, index) => index % gap === 0).map((word, index) => ({
    at: clamp(Math.round((index / Math.max(words.length / gap, 1)) * durationMs), 120, Math.max(durationMs - 160, 120)),
    strength: clamp(0.36 + word.length / 20, 0.32, 0.88),
    type: index % 2 === 0 ? "accent" as const : "support" as const,
  }));

  return {
    style: inferGestureStyle(emotion, responseText),
    intensity: clamp(0.52 + beats.length * 0.04, 0.48, 0.9),
    holdRatio: clamp(0.18 + words.length / 40, 0.18, 0.42),
    beats,
  };
}

function getActiveVisemeFrame(
  performance: AvatarSpeechPerformance | null,
  speechStartedAt: number,
  time: number
): AvatarVisemeFrame | null {
  if (!performance || !speechStartedAt || !performance.visemes.length) {
    return null;
  }

  const elapsed = Math.max(0, Math.round(time - speechStartedAt));
  const progress = elapsed % Math.max(performance.durationMs, 1);
  return performance.visemes.find((frame) => progress >= frame.startMs && progress < frame.endMs) ?? performance.visemes[performance.visemes.length - 1] ?? null;
}

function getVisemeBias(viseme: AvatarViseme | null) {
  switch (viseme) {
    case "closed":
      return { openness: 0.06, widthBias: -0.08 };
    case "bite":
      return { openness: 0.22, widthBias: 0 };
    case "round":
      return { openness: 0.56, widthBias: -0.24 };
    case "open":
      return { openness: 0.88, widthBias: -0.08 };
    case "wide":
      return { openness: 0.48, widthBias: 0.24 };
    case "narrow":
      return { openness: 0.24, widthBias: 0.12 };
    case "tongue":
      return { openness: 0.34, widthBias: 0.04 };
    case "soft":
      return { openness: 0.36, widthBias: 0.02 };
    case "rest":
    default:
      return { openness: 0.08, widthBias: 0 };
  }
}

function getGestureRuntime(
  performance: AvatarSpeechPerformance | null,
  responseText: string,
  emotion: SupportedEmotion,
  speechStartedAt: number,
  time: number
): GestureRuntime {
  const fallbackDuration = clamp(responseText.trim().length * 68 + 900, 1500, 7000);
  const gesturePlan = performance?.gesturePlan ?? inferGesturePlan(emotion, responseText, fallbackDuration);
  const elapsed = Math.max(0, time - speechStartedAt);
  let beat = 0;

  for (const gestureBeat of gesturePlan.beats) {
    const delta = Math.abs(elapsed - gestureBeat.at);
    if (delta > 240) {
      continue;
    }
    const influence = (1 - delta / 240) * gestureBeat.strength;
    beat = Math.max(beat, influence);
  }

  const holdStart = (performance?.durationMs ?? fallbackDuration) * gesturePlan.holdRatio;
  const hold = elapsed >= holdStart && elapsed <= holdStart + 420 ? 0.34 : 0;

  return {
    style: gesturePlan.style,
    intensity: gesturePlan.intensity,
    beat: clamp(beat, 0, 1),
    hold,
  };
}

function getEyeState(emotion: SupportedEmotion, blink: number, speaking: boolean, emphasis: number) {
  const open = 1 - blink;

  switch (emotion) {
    case "joy":
      return { width: 34, height: clamp(10 * open + emphasis * 1.8, 1.5, 12), tilt: -0.18, browLift: -12 - emphasis * 6 };
    case "sadness":
      return { width: 28, height: clamp(13 * open + emphasis, 1.8, 14), tilt: 0.24, browLift: 6 - emphasis * 2 };
    case "anger":
      return { width: 26, height: clamp(6 * open + emphasis * 0.8, 1.2, 7), tilt: speaking ? -0.26 : -0.34, browLift: -10 - emphasis * 4 };
    case "anxiety":
      return { width: 24, height: clamp(16 * open + emphasis * 2.2, 2.8, 18), tilt: 0.26, browLift: 12 + emphasis * 5 };
    default:
      return { width: 30, height: clamp(12 * open, 1.5, 12), tilt: 0, browLift: 0 };
  }
}

function getSpeechCadence(
  responseText: string,
  speechStartedAt: number,
  time: number,
  speaking: boolean,
  speechSource: AvatarSpeechSource
): SpeechCadence {
  if (!speaking) {
    return { openness: 0.08, widthBias: 0, emphasis: 0, gesture: 0.08, nod: 0 };
  }

  const trimmed = responseText.trim();
  if (!trimmed || !speechStartedAt) {
    return { openness: 0.28, widthBias: 0, emphasis: 0.16, gesture: 0.24, nod: 0.02 };
  }

  const elapsed = Math.max(0, time - speechStartedAt);
  const duration = clamp(trimmed.length * 68 + 900, 1500, 7000);
  const progress = (elapsed % duration) / duration;
  const index = Math.min(trimmed.length - 1, Math.floor(progress * trimmed.length));
  const activeChar = trimmed[index] ?? " ";
  const nextChar = trimmed[Math.min(index + 1, trimmed.length - 1)] ?? " ";
  const cadenceSpeed = speechSource === "voice" ? 86 : 118;
  const syllablePulse = 0.5 + Math.sin(elapsed / cadenceSpeed + index * 0.55) * 0.5;
  const gestureBeat = 0.5 + Math.sin(elapsed / 240 + index * 0.34) * 0.5;
  const punctuationBoost = /[!?]/.test(activeChar) || /[!?]/.test(nextChar)
    ? 0.34
    : /[,.]/.test(activeChar) || /[,.]/.test(nextChar)
      ? 0.14
      : 0;
  const opennessBase = /[aăâoôơuư]/i.test(activeChar)
    ? 0.82
    : /[eêiiy]/i.test(activeChar)
      ? 0.62
      : /[fvszx]/i.test(activeChar)
        ? 0.38
        : /[bmp]/i.test(activeChar)
          ? 0.16
          : 0.48;
  const widthBias = /[eêiiy]/i.test(activeChar)
    ? 0.18
    : /[oôơuưw]/i.test(activeChar)
      ? -0.14
      : 0;

  return {
    openness: clamp(opennessBase * 0.55 + syllablePulse * 0.42 + punctuationBoost, 0.16, 1),
    widthBias,
    emphasis: clamp(gestureBeat * 0.42 + punctuationBoost, 0, 1),
    gesture: clamp(gestureBeat + punctuationBoost * 0.5, 0, 1),
    nod: Math.sin(elapsed / 320 + index * 0.26) * 0.05 + punctuationBoost * 0.12,
  };
}

function getMouthShape(
  emotion: SupportedEmotion,
  speechLevel: number,
  speaking: boolean,
  cadence: SpeechCadence
) {
  const level = clamp(speechLevel / 100, 0, 1);
  const openAmount = clamp((speaking ? 0.14 : 0.06) + level * 0.5 + cadence.openness * 0.48, 0.08, 1);
  const widthBias = cadence.widthBias * 12;

  switch (emotion) {
    case "joy":
      return { width: 52 + widthBias, height: 14 + openAmount * 40, curve: 1.1, innerLift: 0.74 };
    case "sadness":
      return { width: 42 + widthBias * 0.7, height: 10 + openAmount * 24, curve: -0.54, innerLift: 0.5 };
    case "anger":
      return { width: 44 + widthBias * 0.2, height: 7 + openAmount * 10, curve: -0.58, innerLift: 0.18 };
    case "anxiety":
      return { width: 34 + widthBias * 0.34, height: 14 + openAmount * 34, curve: -0.28, innerLift: 0.66 };
    default:
      return { width: 44, height: 18, curve: 0, innerLift: 0.56 };
  }
}

function getMotionProfile(emotion: SupportedEmotion, energy: number, cadence: SpeechCadence): MotionProfile {
  switch (emotion) {
    case "joy":
      return {
        headTilt: Math.sin(energy * Math.PI) * 0.08 + cadence.nod * 0.8,
        handLift: 12 + energy * 18 + cadence.gesture * 16,
        ringBoost: 1.08 + cadence.emphasis * 0.08,
        sway: 1.14 + cadence.gesture * 0.16,
        reach: 1.08 + cadence.gesture * 0.18,
      };
    case "sadness":
      return {
        headTilt: -0.04 + cadence.nod * 0.4,
        handLift: 4 + energy * 8 + cadence.gesture * 8,
        ringBoost: 0.92 + cadence.emphasis * 0.04,
        sway: 0.72,
        reach: 0.92,
      };
    case "anger":
      return {
        headTilt: -0.08 + cadence.nod,
        handLift: 18 + energy * 14 + cadence.gesture * 18,
        ringBoost: 1.18 + cadence.emphasis * 0.1,
        sway: 1.18 + cadence.gesture * 0.12,
        reach: 1.14 + cadence.gesture * 0.18,
      };
    case "anxiety":
      return {
        headTilt: 0.06 + cadence.nod * 1.2,
        handLift: 16 + energy * 10 + cadence.gesture * 18,
        ringBoost: 1.06 + cadence.emphasis * 0.08,
        sway: 1.42 + cadence.gesture * 0.08,
        reach: 0.96 + cadence.gesture * 0.12,
      };
    default:
      return { headTilt: cadence.nod, handLift: 8, ringBoost: 1, sway: 1, reach: 1 };
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

      context.fillStyle = "rgba(255, 208, 94, 0.95)";
      context.strokeStyle = "#7f1212";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(46, -184);
      context.lineTo(52, -198);
      context.lineTo(62, -190);
      context.lineTo(70, -204);
      context.lineTo(74, -184);
      context.lineTo(86, -180);
      context.lineTo(74, -172);
      context.lineTo(78, -156);
      context.lineTo(64, -162);
      context.lineTo(56, -148);
      context.lineTo(52, -166);
      context.lineTo(40, -170);
      context.closePath();
      context.fill();
      context.stroke();
      break;
    case "anxiety":
      context.strokeStyle = "rgba(239, 244, 182, 0.54)";
      context.lineWidth = 2.5;
      for (let index = 0; index < 3; index += 1) {
        const radius = 96 + index * 16 + Math.sin(time / 130 + index * 2.2) * 6;
        context.beginPath();
        context.ellipse(0, 10, radius, 70 + index * 10, Math.sin(time / 410 + index) * 0.08, 0, Math.PI * 2);
        context.stroke();
      }
      context.strokeStyle = "rgba(109, 132, 123, 0.55)";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(-58, -110);
      context.quadraticCurveTo(-36, -132 + Math.sin(time / 80) * 10, -12, -108);
      context.quadraticCurveTo(4, -94 + Math.cos(time / 72) * 6, 22, -116);
      context.quadraticCurveTo(42, -136 + Math.sin(time / 88) * 8, 60, -116);
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
    case "anxiety":
      context.moveTo(-58, 92);
      context.quadraticCurveTo(-94, 132, -90, 214);
      context.quadraticCurveTo(-42, 248, -18, 236);
      context.quadraticCurveTo(0, 252, 18, 236);
      context.quadraticCurveTo(42, 248, 90, 214);
      context.quadraticCurveTo(94, 132, 58, 92);
      context.quadraticCurveTo(26, 120, 0, 122);
      context.quadraticCurveTo(-26, 120, -58, 92);
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
    case "anxiety":
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
    case "anxiety":
      context.moveTo(-74, 52);
      context.bezierCurveTo(-92, -36, -48, -144, 0, -156);
      context.bezierCurveTo(50, -144, 90, -38, 74, 54);
      context.bezierCurveTo(66, 114, 30, 150, 0, 156);
      context.bezierCurveTo(-30, 150, -68, 114, -74, 52);
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

function drawAvatarHeadwear(
  context: CanvasRenderingContext2D,
  emotion: SupportedEmotion,
  palette: AvatarPalette,
  time: number,
  energy: number
) {
  context.save();
  context.lineJoin = "round";

  switch (emotion) {
    case "joy":
      context.fillStyle = "#6f43d6";
      context.strokeStyle = "#f9d8ff";
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(-98, 34);
      context.quadraticCurveTo(-112, -34, -80, -106);
      context.quadraticCurveTo(-36, -160 - energy * 6, 0, -154);
      context.quadraticCurveTo(34, -160 - energy * 6, 82, -108);
      context.quadraticCurveTo(110, -38, 98, 38);
      context.quadraticCurveTo(76, 8, 56, -10);
      context.quadraticCurveTo(16, -34, 0, -18);
      context.quadraticCurveTo(-22, -38, -62, -8);
      context.quadraticCurveTo(-78, 8, -98, 34);
      context.closePath();
      context.fill();
      context.stroke();
      break;
    case "sadness":
      context.fillStyle = "#5267b8";
      context.strokeStyle = "#dce7ff";
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(-96, 28);
      context.quadraticCurveTo(-118, -30, -92, -104);
      context.quadraticCurveTo(-44, -158, 0, -166);
      context.quadraticCurveTo(40, -160, 90, -106);
      context.quadraticCurveTo(118, -34, 94, 30);
      context.quadraticCurveTo(80, 4, 70, -34);
      context.quadraticCurveTo(32, -68, 0, -66);
      context.quadraticCurveTo(-30, -68, -70, -34);
      context.quadraticCurveTo(-82, 2, -96, 28);
      context.closePath();
      context.fill();
      context.stroke();
      break;
    case "anger":
      context.fillStyle = "#671414";
      context.strokeStyle = "#ffcf78";
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(-92, 38);
      context.lineTo(-78, -82);
      context.lineTo(-42, -126);
      context.lineTo(-16, -112);
      context.lineTo(0, -168 - energy * 8);
      context.lineTo(18, -112);
      context.lineTo(46, -130);
      context.lineTo(80, -84);
      context.lineTo(92, 40);
      context.quadraticCurveTo(72, 8, 54, -6);
      context.quadraticCurveTo(22, -34, 0, -20);
      context.quadraticCurveTo(-22, -34, -54, -6);
      context.quadraticCurveTo(-72, 8, -92, 38);
      context.closePath();
      context.fill();
      context.stroke();
      break;
    case "anxiety":
      context.fillStyle = "#5c7167";
      context.strokeStyle = "#eef5c2";
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(-88, 40);
      context.quadraticCurveTo(-106, -24, -82, -100);
      context.quadraticCurveTo(-46, -154, 0, -172);
      context.quadraticCurveTo(44, -154, 82, -102);
      context.quadraticCurveTo(104, -26, 88, 42);
      context.quadraticCurveTo(68, 20, 58, -8 + Math.sin(time / 50) * 2);
      context.quadraticCurveTo(24, -46, 0, -38);
      context.quadraticCurveTo(-26, -48, -60, -10 + Math.cos(time / 56) * 2);
      context.quadraticCurveTo(-72, 16, -88, 40);
      context.closePath();
      context.fill();
      context.stroke();

      context.strokeStyle = "rgba(238, 245, 194, 0.55)";
      context.lineWidth = 2.5;
      context.beginPath();
      context.moveTo(-36, -126);
      context.quadraticCurveTo(-18, -142 + Math.sin(time / 48) * 4, -4, -120);
      context.quadraticCurveTo(10, -136 + Math.cos(time / 42) * 4, 34, -122);
      context.stroke();
      break;
    default:
      break;
  }

  context.restore();
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
    case "anxiety":
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
      context.strokeStyle = "rgba(91, 117, 107, 0.65)";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(54, 12);
      context.quadraticCurveTo(68, 40 + energy * 16, 50, 74 + Math.sin(time / 120) * 6);
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

function drawAvatarArms(
  context: CanvasRenderingContext2D,
  emotion: SupportedEmotion,
  palette: AvatarPalette,
  time: number,
  energy: number,
  motion: MotionProfile,
  cadence: SpeechCadence,
  gestureRuntime: GestureRuntime
) {
  let reachBoost = 0;
  let liftBoost = 0;
  let elbowBias = 0;
  let palmBias = 0;
  let asymmetry = 0;

  switch (gestureRuntime.style) {
    case "expansive":
      reachBoost = 24;
      liftBoost = 8;
      palmBias = 10;
      break;
    case "empathetic":
      reachBoost = 8;
      liftBoost = 4;
      elbowBias = -8;
      palmBias = -12;
      break;
    case "precise":
      reachBoost = 10;
      liftBoost = 10;
      elbowBias = 8;
      break;
    case "cautionary":
      reachBoost = 14;
      liftBoost = 18;
      asymmetry = 16;
      break;
    case "emphatic":
      reachBoost = 20;
      liftBoost = 12;
      asymmetry = 10;
      break;
    case "skeptical":
      reachBoost = 12;
      elbowBias = 12;
      palmBias = -4;
      asymmetry = -14;
      break;
    default:
      break;
  }

  const gestureLift = motion.handLift + liftBoost + gestureRuntime.beat * 18;
  const gestureReach = motion.reach + reachBoost / 100 + gestureRuntime.intensity * 0.12;
  const swingLeft = Math.sin(time / 260) * (12 + cadence.gesture * 18 + energy * 14 + gestureRuntime.beat * 20);
  const swingRight = Math.cos(time / 290) * (10 + cadence.gesture * 16 + energy * 12 + gestureRuntime.beat * 16);

  const drawArm = (side: -1 | 1, swing: number) => {
    const tremor = emotion === "anxiety"
      ? (Math.sin(time / 38 + side * 1.4) + Math.cos(time / 24 + side * 0.8)) * (2.8 + cadence.emphasis * 2.2)
      : 0;
    const shoulderX = side * 58;
    const shoulderY = 122;
    const elbowX = side * (84 + gestureReach * 18 + cadence.emphasis * 12 + elbowBias) + (side === 1 ? asymmetry : -asymmetry) * 0.25 + tremor * 0.55;
    const elbowY = 138 - gestureLift * 0.55 + Math.abs(swing) * 0.18 - gestureRuntime.hold * 18 + Math.abs(tremor) * 0.3;
    const palmX = side * (108 + gestureReach * 22 + cadence.gesture * 14 + palmBias) + (side === 1 ? asymmetry : -asymmetry) + tremor;
    const palmY = emotion === "anxiety"
      ? 186 - swing * 0.24 + Math.sin(time / 28 + side) * (4 + cadence.emphasis * 2.5)
      : 174 - swing - (gestureRuntime.style === "cautionary" && side === 1 ? 14 : 0);

    context.strokeStyle = palette.trim;
    context.lineWidth = 10;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(shoulderX, shoulderY);
    context.quadraticCurveTo(side * (76 + cadence.gesture * 8), 124 - gestureLift * 0.45, elbowX, elbowY);
    context.quadraticCurveTo(side * (96 + gestureReach * 10), elbowY + 26, palmX, palmY);
    context.stroke();

    context.strokeStyle = palette.glow;
    context.lineWidth = 16;
    context.globalAlpha = 0.4 + cadence.emphasis * 0.12;
    context.beginPath();
    context.moveTo(side * 74, 136);
    context.quadraticCurveTo(elbowX, elbowY + 6, palmX, palmY);
    context.stroke();
    context.globalAlpha = 1;

    context.fillStyle = palette.accent;
    context.beginPath();
    context.ellipse(palmX, palmY, 10 + cadence.emphasis * 3, 14 + cadence.gesture * 4, side * 0.4, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = palette.trim;
    context.beginPath();
    context.arc(palmX - side * 1.5, palmY - 3, 3.5, 0, Math.PI * 2);
    context.fill();
  };

  drawArm(-1, swingLeft);
  drawArm(1, swingRight);
}

export function EmotionAvatar({
  emotion,
  speaking,
  speechLevel,
  responseText,
  speechSource,
  speechStartedAt,
  performance,
}: EmotionAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ emotion, speaking, speechLevel, responseText, speechSource, speechStartedAt, performance });
  const palette = PALETTES[emotion];
  const stageStyle = {
    "--avatar-accent": palette.accent,
    "--avatar-glow": palette.glow,
    "--avatar-wash": palette.aura,
    "--avatar-shell": palette.shellEdge,
  } as CSSProperties;

  useEffect(() => {
    stateRef.current = { emotion, speaking, speechLevel, responseText, speechSource, speechStartedAt, performance };
  }, [emotion, speaking, speechLevel, responseText, speechSource, speechStartedAt, performance]);

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
      const {
        emotion: currentEmotion,
        speaking: isSpeaking,
        speechLevel: currentSpeechLevel,
        responseText: currentResponseText,
        speechSource: currentSpeechSource,
        speechStartedAt: currentSpeechStartedAt,
        performance: currentPerformance,
      } = stateRef.current;
      const activePalette = PALETTES[currentEmotion];
      const rawCadence = getSpeechCadence(currentResponseText, currentSpeechStartedAt, time, isSpeaking, currentSpeechSource);
      const activeViseme = getActiveVisemeFrame(currentPerformance, currentSpeechStartedAt, time);
      const visemeBias = getVisemeBias(activeViseme?.viseme ?? null);
      const gestureRuntime = getGestureRuntime(currentPerformance, currentResponseText, currentEmotion, currentSpeechStartedAt, time);
      const cadence = {
        openness: clamp(rawCadence.openness * 0.34 + visemeBias.openness * 0.66 + (activeViseme?.emphasis ?? 0) * 0.12, 0.08, 1),
        widthBias: clamp(rawCadence.widthBias * 0.42 + visemeBias.widthBias * 0.58, -0.3, 0.3),
        emphasis: clamp(rawCadence.emphasis + gestureRuntime.beat * 0.44 + gestureRuntime.hold + (activeViseme?.emphasis ?? 0) * 0.18, 0, 1),
        gesture: clamp(rawCadence.gesture * 0.7 + gestureRuntime.beat * 0.3 + gestureRuntime.intensity * 0.1, 0, 1),
        nod: rawCadence.nod + gestureRuntime.beat * 0.08,
      } satisfies SpeechCadence;
      const energy = clamp(currentSpeechLevel / 100 + cadence.openness * 0.4, 0, 1);
      const motion = getMotionProfile(currentEmotion, energy, cadence);
      const anxietyTremor = currentEmotion === "anxiety"
        ? (0.8 + cadence.emphasis * 1.4 + energy * 0.8)
        : 0;
      const floating = Math.sin(time / 820) * 10;
      const breathing = 1 + Math.sin(time / 900) * 0.015 + energy * 0.03;
      const bob = Math.sin(time / (600 / motion.sway)) * (2.5 + energy * 3.5);
      const blinkPulse = Math.sin(time / 1900);
      const blink = blinkPulse > 0.94 ? (blinkPulse - 0.94) / 0.06 : 0;
      const eye = getEyeState(currentEmotion, blink, isSpeaking, cadence.emphasis);
      const mouth = getMouthShape(currentEmotion, currentSpeechLevel, isSpeaking, cadence);
      const headX = width / 2 + Math.sin(time / 1200) * (8 + energy * 6) + Math.sin(time / 34) * anxietyTremor * 1.6;
      const headY = height / 2 - 26 + floating + Math.cos(time / 46) * anxietyTremor * 0.9;
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
      backgroundGradient.addColorStop(0, activePalette.aura);
      backgroundGradient.addColorStop(1, "rgba(12, 10, 20, 0)");
      context.fillStyle = backgroundGradient;
      context.fillRect(0, 0, width, height);

      for (let index = 0; index < 7; index += 1) {
        const angle = time / 1700 + index * 1.1;
        const particleX = width * 0.5 + Math.sin(angle) * (110 + index * 14);
        const particleY = height * 0.3 + Math.cos(angle * 1.2) * (44 + index * 12);
        const particleRadius = 3 + ((index % 3) + 1) * (0.8 + energy * 1.2);
        context.fillStyle = activePalette.particle;
        context.globalAlpha = 0.18 + (index % 3) * 0.08 + cadence.emphasis * 0.08;
        context.beginPath();
        context.arc(particleX, particleY, particleRadius, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;

      context.save();
      context.translate(headX, headY + bob);
      context.rotate(motion.headTilt + cadence.nod + Math.sin(time / 1600) * 0.025 + Math.sin(time / 44) * anxietyTremor * 0.008);
      context.scale(breathing, breathing);

      for (let index = 0; index < 3; index += 1) {
        const scale = 1 + index * 0.11 + energy * 0.08;
        context.strokeStyle = activePalette.aura;
        context.lineWidth = 6 - index;
        context.globalAlpha = 0.55 + cadence.emphasis * 0.14;
        context.beginPath();
        context.ellipse(0, 18, 118 * scale * motion.ringBoost, 132 * scale, 0, 0, Math.PI * 2);
        context.stroke();
      }
      context.globalAlpha = 1;

      context.fillStyle = "rgba(255, 255, 255, 0.12)";
      context.beginPath();
      context.ellipse(-6, 224, 132, 26, 0, 0, Math.PI * 2);
      context.fill();

      drawAvatarBody(context, currentEmotion, activePalette, energy);
      drawAvatarArms(context, currentEmotion, activePalette, time, energy, motion, cadence, gestureRuntime);

      context.fillStyle = activePalette.glow;
      context.beginPath();
      context.ellipse(0, 18, currentEmotion === "anxiety" ? 92 : 118, currentEmotion === "anger" ? 118 : 132, 0, 0, Math.PI * 2);
      context.fill();

      drawEmotionAccent(context, currentEmotion, activePalette, time, energy);
      drawAvatarHeadwear(context, currentEmotion, activePalette, time, energy);
      drawAvatarAccessory(context, currentEmotion, activePalette, time, energy);
      drawAvatarHead(context, currentEmotion, activePalette, energy);

      context.fillStyle = activePalette.accent;
      context.beginPath();
      context.moveTo(-24, currentEmotion === "anxiety" ? -148 : -134);
      context.quadraticCurveTo(0, -182 - energy * 16 - cadence.emphasis * 12, 28, currentEmotion === "anger" ? -136 : -128);
      context.quadraticCurveTo(10, -118, -24, currentEmotion === "anxiety" ? -148 : -134);
      context.fill();

      context.fillStyle = activePalette.blush;
      context.beginPath();
      context.ellipse(-54, 34, 18 + cadence.emphasis * 2, 10, 0, 0, Math.PI * 2);
      context.ellipse(54, 34, 18 + cadence.emphasis * 2, 10, 0, 0, Math.PI * 2);
      context.fill();

      context.strokeStyle = activePalette.eye;
      context.fillStyle = activePalette.eye;
      context.lineCap = "round";
      context.lineWidth = 6;

      const drawEye = (side: -1 | 1) => {
        const x = side * 42;
        const y = currentEmotion === "anxiety" ? -4 : currentEmotion === "anger" ? -2 : -8;
        const eyeShake = currentEmotion === "anxiety" ? Math.sin(time / 42 + side) * (1.1 + cadence.emphasis) : 0;

        context.save();
        context.translate(x + eyeShake, y);
        context.rotate(eye.tilt * side);
        context.beginPath();
        context.ellipse(0, 0, eye.width / 2, eye.height / 2, 0, 0, Math.PI * 2);
        context.fill();

        if (currentEmotion === "anxiety" || (currentEmotion === "joy" && isSpeaking)) {
          context.fillStyle = "rgba(255, 255, 255, 0.7)";
          context.beginPath();
          context.arc(-4, -2, 2.5, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = activePalette.eye;
        }

        context.restore();

        if (currentEmotion === "anger") {
          context.beginPath();
          context.moveTo(x - 18, y - 18);
          context.quadraticCurveTo(x - 4, y - 28 - cadence.emphasis * 2, x + 8, y - 16);
          context.quadraticCurveTo(x + 16, y - 10 - cadence.emphasis, x + 20, y - 12);
          context.stroke();
        } else {
          context.beginPath();
          context.moveTo(x - 20, y - 26 - eye.browLift);
          context.quadraticCurveTo(x, y - 34 - eye.browLift - cadence.emphasis * 4, x + 20, y - 22 - eye.browLift);
          context.stroke();
        }

        if (currentEmotion === "anxiety") {
          context.strokeStyle = "rgba(82, 108, 97, 0.52)";
          context.lineWidth = 2.5;
          context.beginPath();
          context.moveTo(x - 12, y + 18);
          context.quadraticCurveTo(x, y + 24 + Math.sin(time / 70 + side) * 2, x + 12, y + 18);
          context.stroke();
          context.strokeStyle = activePalette.eye;
          context.lineWidth = 6;
        }
      };

      drawEye(-1);
      drawEye(1);

      context.fillStyle = activePalette.mouth;
      context.beginPath();
      context.ellipse(0, 70 + mouth.height * 0.16, mouth.width * 0.54, mouth.height * 0.58, 0, 0, Math.PI * 2);
      context.fill();

      context.strokeStyle = activePalette.mouth;
      context.lineWidth = 7;
      context.beginPath();
      context.moveTo(-mouth.width / 2, 70);
      context.quadraticCurveTo(0, 70 + mouth.height * mouth.curve, mouth.width / 2, 70);
      context.stroke();

      if (currentEmotion === "anger") {
        context.strokeStyle = "rgba(108, 20, 20, 0.82)";
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(-mouth.width * 0.42, 68);
        context.lineTo(-mouth.width * 0.24, 74);
        context.lineTo(-mouth.width * 0.1, 70);
        context.moveTo(mouth.width * 0.1, 70);
        context.lineTo(mouth.width * 0.24, 74);
        context.lineTo(mouth.width * 0.42, 68);
        context.stroke();
      }

      if (mouth.height > 12) {
        context.fillStyle = "rgba(255, 222, 230, 0.72)";
        context.beginPath();
        context.moveTo(-mouth.width * 0.2, 70);
        context.quadraticCurveTo(0, 74 + mouth.height * 0.08, mouth.width * 0.2, 70);
        context.quadraticCurveTo(0, 79 + mouth.height * 0.12, -mouth.width * 0.2, 70);
        context.fill();

        context.fillStyle = "rgba(118, 12, 52, 0.35)";
        context.beginPath();
        context.moveTo(-mouth.width * 0.3, 72);
        context.quadraticCurveTo(0, 82 + mouth.height * mouth.innerLift, mouth.width * 0.3, 72);
        context.quadraticCurveTo(0, 98 + mouth.height * 0.46, -mouth.width * 0.3, 72);
        context.fill();
      }

      context.fillStyle = activePalette.trim;
      context.globalAlpha = 0.5;
      context.beginPath();
      context.ellipse(0, shoulderY, 58 + energy * 8 + cadence.gesture * 6, 18 + energy * 4, 0, 0, Math.PI * 2);
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

    const resizeObserver = new ResizeObserver(resize);
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      className="avatar-stage"
      data-emotion={emotion}
      data-speaking={speaking ? "true" : "false"}
      data-source={speechSource}
      style={stageStyle}
    >
      <div className="avatar-video-backdrop" aria-hidden="true">
        <div className="avatar-video-orb avatar-video-orb-left" />
        <div className="avatar-video-orb avatar-video-orb-right" />
        <div className="avatar-video-scanlines" />
      </div>
      <canvas ref={canvasRef} className="avatar-canvas" aria-hidden="true" />
    </div>
  );
}
