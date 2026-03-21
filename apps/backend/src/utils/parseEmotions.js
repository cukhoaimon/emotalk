const { EMOTION_PROMPTS } = require("../config/emotions");
const { createHttpError } = require("./httpError");

function normalizeEmotion(rawEmotion) {
  return String(rawEmotion || "")
    .trim()
    .toLowerCase();
}

function getSupportedEmotionsText() {
  return Object.keys(EMOTION_PROMPTS).join(", ");
}

function parseEmotion(rawEmotion) {
  const emotion = normalizeEmotion(rawEmotion);

  if (!emotion) {
    throw createHttpError(400, "The emotion field is required.");
  }

  if (!EMOTION_PROMPTS[emotion]) {
    throw createHttpError(400, `Unsupported emotion "${emotion}". Supported emotions: ${getSupportedEmotionsText()}.`);
  }

  return emotion;
}

module.exports = {
  parseEmotion
};
