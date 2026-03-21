const fs = require("fs/promises");

const { parseEmotions } = require("../utils/parseEmotions");
const { createHttpError } = require("../utils/httpError");
const { transcribeAudio } = require("../services/speechService");
const { generateEmotionResponses } = require("../services/aiService");
const { saveAnalysisResult } = require("../services/outputService");

async function analyzeAudioRequest(req, persistOutput) {
  if (!req.file) {
    throw createHttpError(400, "Audio file is required.");
  }

  const emotions = parseEmotions(req.body.emotions);
  const transcript = await transcribeAudio(req.file.path);

  if (!transcript) {
    throw createHttpError(422, "The audio was transcribed, but no text was returned.");
  }

  const responses = await generateEmotionResponses(emotions, transcript);
  const result = {
    transcript,
    responses
  };

  if (!persistOutput) {
    return result;
  }

  const output = await saveAnalysisResult(result);

  return {
    ...result,
    output
  };
}

async function analyzeAudio(req, res, next) {
  const uploadedFilePath = req.file?.path;

  try {
    const result = await analyzeAudioRequest(req, true);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  } finally {
    if (uploadedFilePath) {
      await fs.unlink(uploadedFilePath).catch(() => {});
    }
  }
}

async function analyzeLiveAudio(req, res, next) {
  const uploadedFilePath = req.file?.path;

  try {
    const result = await analyzeAudioRequest(req, false);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  } finally {
    if (uploadedFilePath) {
      await fs.unlink(uploadedFilePath).catch(() => {});
    }
  }
}

module.exports = {
  analyzeAudio,
  analyzeLiveAudio
};
