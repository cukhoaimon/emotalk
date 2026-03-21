const { getOpenAI } = require("../config/openai");
const { saveAnalysisResult } = require("./outputService");
const { createHttpError } = require("../utils/httpError");

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

function getCustomLlmApiKey() {
  return process.env.AGORA_CAI_CUSTOM_LLM_API_KEY?.trim() || "";
}

function verifyCustomLlmAuth(req) {
  const expectedKey = getCustomLlmApiKey();

  if (!expectedKey) {
    return;
  }

  const authHeader = req.headers.authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  const headerApiKey = typeof req.headers["x-api-key"] === "string"
    ? req.headers["x-api-key"].trim()
    : "";

  if (bearerToken !== expectedKey && headerApiKey !== expectedKey) {
    throw createHttpError(401, "Unauthorized custom LLM request.");
  }
}

function getMessageTextContent(content) {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((item) => {
      if (!item || typeof item !== "object") {
        return "";
      }

      if (item.type === "text" && typeof item.text === "string") {
        return item.text;
      }

      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw createHttpError(400, "The messages field is required.");
  }

  return messages.map((message) => ({
    role: message.role,
    content: getMessageTextContent(message.content)
  }));
}

function buildTunedMessages(messages) {
  const tunedSystemPrompt = [
    "You are the tuned backend model behind an Agora Conversational AI agent.",
    "Follow the conversation history and the existing system instructions carefully.",
    "Respond naturally in concise spoken English.",
    "Keep continuity across turns and preserve the selected emotional style if the system messages define one.",
    "Return plain assistant text only."
  ].join(" ");

  return [
    {
      role: "system",
      content: tunedSystemPrompt
    },
    ...messages
  ];
}

async function streamCustomChatCompletion(req, res) {
  verifyCustomLlmAuth(req);

  const {
    model,
    messages,
    tools,
    tool_choice,
    response_format,
    stream = true
  } = req.body || {};

  if (!stream) {
    throw createHttpError(400, "chat completions require streaming");
  }

  const normalizedMessages = normalizeMessages(messages);
  const tunedMessages = buildTunedMessages(normalizedMessages);
  const openai = getOpenAI();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const completion = await openai.chat.completions.create({
    model: model || CHAT_MODEL,
    messages: tunedMessages,
    tools: Array.isArray(tools) && tools.length > 0 ? tools : undefined,
    tool_choice: Array.isArray(tools) && tools.length > 0 ? tool_choice || "auto" : undefined,
    response_format,
    stream: true
  });

  let fullText = "";

  try {
    for await (const chunk of completion) {
      const deltaText = chunk.choices?.[0]?.delta?.content || "";

      if (deltaText) {
        fullText += deltaText;
      }

      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    await saveAnalysisResult({
      source: "agora-custom-llm",
      model: model || CHAT_MODEL,
      messages: normalizedMessages,
      reply: fullText.trim()
    });

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    if (!res.headersSent) {
      throw error;
    }

    res.write(`data: ${JSON.stringify({ error: error.message || "Streaming failed." })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
}

module.exports = {
  streamCustomChatCompletion
};
