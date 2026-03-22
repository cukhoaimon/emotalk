const fs = require("fs");
const path = require("path");

const CONFIG_DIRECTORY = path.resolve(__dirname, "..", "..", "data");
const CONFIG_PATH = path.join(CONFIG_DIRECTORY, "avatar-voice-config.json");
const EMOTIONS = ["joy", "sadness", "anxiety", "anger"];

function ensureConfigDirectory() {
  fs.mkdirSync(CONFIG_DIRECTORY, { recursive: true });
}

function getEmptyConfig() {
  return {
    default: null,
    joy: null,
    sadness: null,
    anxiety: null,
    anger: null,
  };
}

function normalizeVoiceId(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
}

function sanitizeVoiceConfig(input) {
  const base = getEmptyConfig();

  if (!input || typeof input !== "object") {
    return base;
  }

  for (const key of ["default", ...EMOTIONS]) {
    base[key] = normalizeVoiceId(input[key]);
  }

  return base;
}

function readPersistedVoiceConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return getEmptyConfig();
    }

    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    return sanitizeVoiceConfig(JSON.parse(raw));
  } catch {
    return getEmptyConfig();
  }
}

function writePersistedVoiceConfig(config) {
  ensureConfigDirectory();
  const sanitized = sanitizeVoiceConfig(config);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(sanitized, null, 2));
  return sanitized;
}

module.exports = {
  getEmptyConfig,
  readPersistedVoiceConfig,
  sanitizeVoiceConfig,
  writePersistedVoiceConfig
};
