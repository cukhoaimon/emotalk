const fs = require("fs/promises");
const path = require("path");

const { getOpenAI } = require("../config/openai");
const { createHttpError } = require("../utils/httpError");

const TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const TTS_FORMAT = process.env.OPENAI_TTS_FORMAT || "mp3";
const DEFAULT_VOICE = process.env.OPENAI_TTS_VOICE || "alloy";

const speechOutputDir = path.join(__dirname, "..", "..", "outputs", "speech");

function buildTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function sanitizeName(value) {
  return String(value || "reply")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "reply";
}

async function synthesizeSpeech({ text, emotion, voice }) {
  if (!text || !String(text).trim()) {
    throw createHttpError(400, "Speech text is required.");
  }

  try {
    const openai = getOpenAI();
    const response = await openai.audio.speech.create({
      model: TTS_MODEL,
      voice: voice || DEFAULT_VOICE,
      input: String(text).trim(),
      response_format: TTS_FORMAT,
      instructions: `Speak naturally in English. Keep the delivery clearly shaped by this emotion: ${emotion || "joy"}.`
    });

    const timestamp = buildTimestamp();
    const safeEmotion = sanitizeName(emotion);
    const filename = `${safeEmotion}-${timestamp}.${TTS_FORMAT}`;
    const absolutePath = path.join(speechOutputDir, filename);

    await fs.mkdir(speechOutputDir, { recursive: true });
    await fs.writeFile(absolutePath, Buffer.from(await response.arrayBuffer()));

    return {
      filename,
      contentType: `audio/${TTS_FORMAT === "mp3" ? "mpeg" : TTS_FORMAT}`,
      path: absolutePath,
      url: `/outputs/speech/${filename}`
    };
  } catch (error) {
    throw createHttpError(
      502,
      `OpenAI speech generation failed: ${error.message || "Unknown speech error."}`
    );
  }
}

module.exports = {
  synthesizeSpeech
};
