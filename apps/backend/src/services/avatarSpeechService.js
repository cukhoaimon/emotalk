const { createHttpError } = require("../utils/httpError");
const {
  getEmptyConfig,
  readPersistedVoiceConfig,
  sanitizeVoiceConfig,
  writePersistedVoiceConfig
} = require("./avatarVoiceConfigStore");

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io";
const DEFAULT_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5";
const DEFAULT_OUTPUT_FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128";

const EMOTION_VOICE_SETTINGS = {
  joy: { stability: 0.34, similarity_boost: 0.72, style: 0.82, speed: 1.08, use_speaker_boost: true },
  sadness: { stability: 0.62, similarity_boost: 0.7, style: 0.28, speed: 0.92, use_speaker_boost: true },
  anxiety: { stability: 0.4, similarity_boost: 0.7, style: 0.72, speed: 1.02, use_speaker_boost: true },
  anger: { stability: 0.22, similarity_boost: 0.76, style: 0.95, speed: 1.05, use_speaker_boost: true }
};

const GESTURE_KEYWORDS = {
  expansive: ["great", "amazing", "love", "excited", "wonderful", "yes", "absolutely", "perfect"],
  empathetic: ["sorry", "understand", "feel", "gentle", "care", "support", "safe", "together"],
  precise: ["first", "second", "then", "because", "means", "step", "detail", "explain"],
  cautionary: ["careful", "risk", "warning", "avoid", "watch", "concern", "issue", "problem"],
  emphatic: ["must", "need", "stop", "seriously", "definitely", "immediately", "clearly", "never"],
  skeptical: ["actually", "however", "but", "wrong", "doubt", "question", "skeptical", "hmm"]
};

let cachedFallbackVoiceId = null;
let cachedVoices = null;

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function mapCharToVisemeKey(character) {
  if (!character || /\s/.test(character)) {
    return "rest";
  }

  if (/[bmp]/i.test(character)) {
    return "closed";
  }

  if (/[fv]/i.test(character)) {
    return "bite";
  }

  if (/[oôơuưwq]/i.test(character)) {
    return "round";
  }

  if (/[aăâ]/i.test(character)) {
    return "open";
  }

  if (/[eêiiy]/i.test(character)) {
    return "wide";
  }

  if (/[szxçj]/i.test(character)) {
    return "narrow";
  }

  if (/[lrtdn]/i.test(character)) {
    return "tongue";
  }

  return "soft";
}

function getCharDuration(character, speed) {
  if (!character) {
    return 60;
  }

  if (/[,.!?;:]/.test(character)) {
    return 180 / speed;
  }

  if (/\s/.test(character)) {
    return 36 / speed;
  }

  if (/[aăâeêiiyoôơuư]/i.test(character)) {
    return 92 / speed;
  }

  if (/[bmpfv]/i.test(character)) {
    return 70 / speed;
  }

  return 62 / speed;
}

function tokenizeSpeech(text) {
  return String(text || "")
    .match(/[A-Za-zÀ-ỹ0-9']+|[,.!?;:]/g) || [];
}

function getGestureStyle(emotion, normalizedText) {
  const scores = {
    expansive: emotion === "joy" ? 1.2 : 0.2,
    empathetic: emotion === "sadness" ? 1 : 0.2,
    precise: 0.28,
    cautionary: emotion === "anxiety" ? 1.05 : 0.24,
    emphatic: emotion === "anger" ? 1.05 : 0.2,
    skeptical: 0.2
  };

  for (const [style, keywords] of Object.entries(GESTURE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedText.includes(keyword)) {
        scores[style] += 0.34;
      }
    }
  }

  if (normalizedText.includes("?")) {
    scores.precise += 0.15;
    scores.skeptical += 0.12;
  }

  if (normalizedText.includes("!")) {
    scores.emphatic += 0.2;
    scores.expansive += 0.16;
  }

  return Object.entries(scores).sort((left, right) => right[1] - left[1])[0][0];
}

function buildGesturePlan(text, emotion, durationMs) {
  const normalizedText = String(text || "").toLowerCase();
  const tokens = tokenizeSpeech(text).filter((token) => /[A-Za-zÀ-ỹ0-9']/.test(token));
  const style = getGestureStyle(emotion, normalizedText);
  const punctuationCount = (normalizedText.match(/[!?]/g) || []).length;
  const beats = [];
  const beatGap = Math.max(1, Math.round(tokens.length / 4));

  for (let index = 0; index < tokens.length; index += beatGap) {
    const token = tokens[index];
    const emphasis = clamp(token.length / 10 + (/[A-Z]/.test(token[0]) ? 0.1 : 0), 0.22, 0.92);
    const at = clamp(Math.round((index / Math.max(tokens.length, 1)) * durationMs), 120, Math.max(durationMs - 180, 120));
    beats.push({
      at,
      strength: Number((emphasis + punctuationCount * 0.04).toFixed(3)),
      type: index % (beatGap * 2) === 0 ? "accent" : "support"
    });
  }

  return {
    style,
    intensity: Number(clamp(0.48 + punctuationCount * 0.06 + beats.length * 0.03, 0.42, 0.94).toFixed(3)),
    holdRatio: Number(clamp(0.18 + durationMs / 18000, 0.18, 0.42).toFixed(3)),
    beats
  };
}

function buildVisemeTimeline(text, speed) {
  const timeline = [];
  const tokens = tokenizeSpeech(text);
  let cursor = 0;

  for (const token of tokens) {
    if (/[,.!?;:]/.test(token)) {
      const pauseMs = Math.round(getCharDuration(token, speed));
      timeline.push({
        startMs: cursor,
        endMs: cursor + pauseMs,
        viseme: "rest",
        emphasis: Number((/[!?]/.test(token) ? 0.5 : 0.18).toFixed(3))
      });
      cursor += pauseMs;
      continue;
    }

    for (const character of token) {
      const durationMs = Math.round(getCharDuration(character, speed));
      const viseme = mapCharToVisemeKey(character);
      const emphasis = /[aăâeêiiyoôơuư]/i.test(character) ? 0.44 : /[bmp]/i.test(character) ? 0.2 : 0.28;
      timeline.push({
        startMs: cursor,
        endMs: cursor + durationMs,
        viseme,
        emphasis: Number(emphasis.toFixed(3))
      });
      cursor += durationMs;
    }

    timeline.push({
      startMs: cursor,
      endMs: cursor + Math.round(36 / speed),
      viseme: "rest",
      emphasis: 0.12
    });
    cursor += Math.round(36 / speed);
  }

  if (!timeline.length) {
    timeline.push({
      startMs: 0,
      endMs: 800,
      viseme: "rest",
      emphasis: 0
    });
    cursor = 800;
  }

  return {
    durationMs: cursor,
    visemes: timeline
  };
}

function buildSpeechPerformance(text, emotion, voiceSettings) {
  const speed = clamp(Number(voiceSettings?.speed) || 1, 0.72, 1.2);
  const visemeTimeline = buildVisemeTimeline(text, speed);
  const gesturePlan = buildGesturePlan(text, emotion, visemeTimeline.durationMs);

  return {
    durationMs: visemeTimeline.durationMs,
    visemes: visemeTimeline.visemes,
    gesturePlan
  };
}

function getApiKey() {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();

  if (!apiKey) {
    throw createHttpError(500, "Missing ELEVENLABS_API_KEY for avatar speech.");
  }

  return apiKey;
}

function getEmotionVoiceId(emotion) {
  const persisted = readPersistedVoiceConfig();
  const persistedVoiceId = persisted[emotion];

  if (persistedVoiceId) {
    return persistedVoiceId;
  }

  const directVoiceId = process.env[`ELEVENLABS_VOICE_ID_${emotion.toUpperCase()}`]?.trim();

  if (directVoiceId) {
    return directVoiceId;
  }

  return persisted.default || process.env.ELEVENLABS_VOICE_ID_DEFAULT?.trim() || null;
}

function getEnvVoiceConfig() {
  return sanitizeVoiceConfig({
    default: process.env.ELEVENLABS_VOICE_ID_DEFAULT,
    joy: process.env.ELEVENLABS_VOICE_ID_JOY,
    sadness: process.env.ELEVENLABS_VOICE_ID_SADNESS,
    anxiety: process.env.ELEVENLABS_VOICE_ID_ANXIETY,
    anger: process.env.ELEVENLABS_VOICE_ID_ANGER,
  });
}

async function fetchVoices() {
  if (cachedVoices) {
    return cachedVoices;
  }

  const response = await fetch(`${ELEVENLABS_BASE_URL}/v2/voices?page_size=10`, {
    headers: {
      "xi-api-key": getApiKey()
    }
  });

  if (!response.ok) {
    throw createHttpError(
      502,
      `ElevenLabs voices lookup failed with status ${response.status}.`
    );
  }

  const payload = await response.json();
  cachedVoices = Array.isArray(payload?.voices) ? payload.voices : [];
  return cachedVoices;
}

async function fetchFallbackVoiceId() {
  if (cachedFallbackVoiceId) {
    return cachedFallbackVoiceId;
  }

  const voices = await fetchVoices();
  const voiceId = voices[0]?.voice_id;

  if (!voiceId) {
    throw createHttpError(
      502,
      "ElevenLabs did not return any voices. Set ELEVENLABS_VOICE_ID_DEFAULT or add a voice to the account."
    );
  }

  cachedFallbackVoiceId = voiceId;
  return voiceId;
}

async function resolveVoiceId(emotion) {
  return getEmotionVoiceId(emotion) || fetchFallbackVoiceId();
}

async function getAvatarVoiceCatalog() {
  const voices = await fetchVoices();
  const persisted = readPersistedVoiceConfig();
  const fromEnv = getEnvVoiceConfig();
  const resolved = getEmptyConfig();

  for (const key of Object.keys(resolved)) {
    resolved[key] = persisted[key] || fromEnv[key] || null;
  }

  return {
    persisted,
    fromEnv,
    configured: {
      ...resolved
    },
    voices: voices.map((voice) => ({
      voiceId: voice.voice_id,
      name: voice.name,
      category: voice.category || voice.voice_type || "unknown"
    }))
  };
}

function updateAvatarVoiceConfig(input) {
  return writePersistedVoiceConfig(input);
}

async function synthesizeEmotionSpeech({ text, emotion }) {
  const trimmedText = String(text || "").trim();

  if (!trimmedText) {
    throw createHttpError(400, "The text field is required for avatar speech.");
  }

  const voiceId = await resolveVoiceId(emotion);
  const voiceSettings = EMOTION_VOICE_SETTINGS[emotion];
  const performance = buildSpeechPerformance(trimmedText, emotion, voiceSettings);
  const requestUrl =
    `${ELEVENLABS_BASE_URL}/v1/text-to-speech/${voiceId}` +
    `?output_format=${encodeURIComponent(DEFAULT_OUTPUT_FORMAT)}`;

  const response = await fetch(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
      "xi-api-key": getApiKey()
    },
    body: JSON.stringify({
      text: trimmedText,
      model_id: DEFAULT_MODEL_ID,
      voice_settings: voiceSettings
    })
  });

  if (!response.ok) {
    let details = `ElevenLabs TTS failed with status ${response.status}.`;

    try {
      const payload = await response.json();
      if (payload?.detail?.message) {
        details = `ElevenLabs TTS failed: ${payload.detail.message}`;
      } else if (payload?.message) {
        details = `ElevenLabs TTS failed: ${payload.message}`;
      }
    } catch {
      // Ignore non-JSON responses and keep the status-based message.
    }

    throw createHttpError(502, details);
  }

  const arrayBuffer = await response.arrayBuffer();

  return {
    audioBuffer: Buffer.from(arrayBuffer),
    contentType: response.headers.get("content-type") || "audio/mpeg",
    voiceId,
    modelId: DEFAULT_MODEL_ID,
    performance
  };
}

module.exports = {
  getAvatarVoiceCatalog,
  updateAvatarVoiceConfig,
  synthesizeEmotionSpeech
};
