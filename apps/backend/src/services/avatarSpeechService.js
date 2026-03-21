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
  anger: { stability: 0.22, similarity_boost: 0.76, style: 0.95, speed: 1.05, use_speaker_boost: true },
  fear: { stability: 0.44, similarity_boost: 0.68, style: 0.66, speed: 1, use_speaker_boost: true },
  disgust: { stability: 0.5, similarity_boost: 0.78, style: 0.74, speed: 0.96, use_speaker_boost: true }
};

let cachedFallbackVoiceId = null;
let cachedVoices = null;

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
    anger: process.env.ELEVENLABS_VOICE_ID_ANGER,
    fear: process.env.ELEVENLABS_VOICE_ID_FEAR,
    disgust: process.env.ELEVENLABS_VOICE_ID_DISGUST
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
    modelId: DEFAULT_MODEL_ID
  };
}

module.exports = {
  getAvatarVoiceCatalog,
  updateAvatarVoiceConfig,
  synthesizeEmotionSpeech
};
