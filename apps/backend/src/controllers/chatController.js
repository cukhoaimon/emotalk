const { createHttpError } = require("../utils/httpError");
const { clearSession, getConversation, runConversationTurn } = require("../services/chatService");
const { parseEmotion } = require("../utils/parseEmotions");
const { saveAnalysisResult } = require("../services/outputService");

async function chat(req, res, next) {
  try {
    const { message, sessionId } = req.body;
    const emotion = parseEmotion(req.body.emotion);

    if (!message || !String(message).trim()) {
      throw createHttpError(400, "The message field is required.");
    }

    const result = await runConversationTurn({
      sessionId,
      emotion,
      userMessage: String(message).trim(),
      systemInstruction:
        "You are a helpful conversational assistant. Answer clearly, remember the prior conversation, and keep continuity with the user's earlier details.",
      allowWebSearch: false
    });

    const payload = {
      message: String(message).trim(),
      sessionId: result.sessionId,
      emotion,
      reply: result.reply,
      toolEvents: result.toolEvents
    };

    const output = await saveAnalysisResult(payload);

    res.status(200).json({
      ...payload,
      output
    });
  } catch (error) {
    next(error);
  }
}

function getDefaultSession(req, res) {
  const session = getConversation();

  if (!session) {
    return res.status(404).json({ error: "Session not found." });
  }

  return res.status(200).json(session);
}

function getSession(req, res) {
  const session = getConversation(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found." });
  }

  return res.status(200).json(session);
}

function resetSession(req, res) {
  clearSession(req.params.sessionId);

  return res.status(204).send();
}

module.exports = {
  chat,
  getDefaultSession,
  getSession,
  resetSession
};
