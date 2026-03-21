const { runConversationTurn } = require("./chatService");
const { createHttpError } = require("../utils/httpError");

async function generateEmotionReply(emotion, transcript, options = {}) {
  try {
    const result = await runConversationTurn({
      sessionId: options.sessionId,
      userMessage: transcript,
      emotion,
      systemInstruction:
        "You are a voice conversation assistant. Reply in English using 2 to 4 sentences. Sound natural when read aloud and stay clearly consistent with the selected emotion.",
      persist: options.persist,
      allowWebSearch: false,
      requireExistingSession: options.requireExistingSession
    });

    return {
      emotion,
      text: result.reply,
      sessionId: result.sessionId,
      toolEvents: result.toolEvents
    };
  } catch (error) {
    throw createHttpError(
      502,
      `OpenAI chat generation failed for "${emotion}": ${error.message || "Unknown generation error."}`
    );
  }
}

module.exports = {
  generateEmotionReply
};
