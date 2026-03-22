const {
  getAvatarVoiceCatalog,
  synthesizeEmotionSpeech,
  updateAvatarVoiceConfig
} = require("../services/avatarSpeechService");
const { parseEmotion } = require("../utils/parseEmotions");
const { createHttpError } = require("../utils/httpError");

async function speakAvatar(req, res, next) {
  try {
    const emotion = parseEmotion(req.body.emotion);
    const { text } = req.body;

    const result = await synthesizeEmotionSpeech({
      text,
      emotion
    });

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Avatar-Voice-Id", result.voiceId);
    res.setHeader("X-Avatar-Model-Id", result.modelId);
    res.setHeader("X-Avatar-Duration-Ms", String(result.performance.durationMs));
    res.setHeader(
      "X-Avatar-Performance",
      Buffer.from(JSON.stringify(result.performance), "utf8").toString("base64url")
    );
    res.status(200).send(result.audioBuffer);
  } catch (error) {
    next(error);
  }
}

async function getAvatarVoices(req, res, next) {
  try {
    const catalog = await getAvatarVoiceCatalog();
    res.status(200).json(catalog);
  } catch (error) {
    next(error);
  }
}

async function saveAvatarVoices(req, res, next) {
  try {
    const { mapping } = req.body;

    if (!mapping || typeof mapping !== "object") {
      throw createHttpError(400, "The mapping object is required.");
    }

    const persisted = updateAvatarVoiceConfig(mapping);
    const catalog = await getAvatarVoiceCatalog();

    res.status(200).json({
      saved: persisted,
      catalog
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAvatarVoices,
  saveAvatarVoices,
  speakAvatar
};
