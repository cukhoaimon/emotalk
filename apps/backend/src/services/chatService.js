const openai = require("../config/openai");
const {
  appendMessages,
  clearSession,
  getOrCreateSession,
  getSession,
  hasSession
} = require("./conversationStore");
const { searchWeb } = require("./tinyfishService");
const { createHttpError } = require("../utils/httpError");
const { EMOTION_PROMPTS } = require("../config/emotions");

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

const WEB_SEARCH_TOOL = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the web for up-to-date or external factual information when the answer depends on recent or missing facts.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The exact web search query to research."
        }
      },
      required: ["query"],
      additionalProperties: false
    }
  }
};

function buildSystemPrompt(systemInstruction, emotion) {
  const emotionPrompt = EMOTION_PROMPTS[emotion];

  if (!emotionPrompt) {
    throw createHttpError(400, `Unsupported emotion "${emotion}".`);
  }

  return [
    systemInstruction,
    emotionPrompt,
    "You are part of a multi-turn conversation. Use the earlier conversation messages to maintain continuity and avoid asking the user to repeat themselves.",
    "Reply as a single assistant speaking in the selected emotion, not as a list of options.",
    "Keep the response concise, natural, and suitable for spoken conversation.",
    "If the user asks for current facts or information you do not already have, call the web_search tool.",
    "When tool results are used, cite the source URLs naturally in the answer."
  ].join(" ");
}

function getTextContent(message) {
  if (typeof message.content === "string") {
    return message.content;
  }

  if (!Array.isArray(message.content)) {
    return "";
  }

  return message.content
    .filter((item) => item.type === "text" && item.text)
    .map((item) => item.text)
    .join("\n");
}

async function createCompletion(messages, allowWebSearch) {
  return openai.getOpenAI().chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.8,
    tools: allowWebSearch && process.env.TINYFISH_API_KEY ? [WEB_SEARCH_TOOL] : undefined,
    tool_choice: allowWebSearch && process.env.TINYFISH_API_KEY ? "auto" : undefined,
    messages
  });
}

async function runConversationTurn({
  sessionId,
  userMessage,
  systemInstruction,
  emotion,
  persist = true,
  allowWebSearch = false,
  requireExistingSession = false
}) {
  if (requireExistingSession && sessionId && !hasSession(sessionId)) {
    throw createHttpError(
      409,
      "Conversation session expired or was not found. Start a new session and continue from there."
    );
  }

  const session = getOrCreateSession(sessionId);
  const baseMessages = [
    {
      role: "system",
      content: buildSystemPrompt(systemInstruction, emotion)
    },
    ...session.messages,
    {
      role: "user",
      content: userMessage
    }
  ];

  const toolEvents = [];
  let workingMessages = [...baseMessages];

  for (let step = 0; step < 4; step += 1) {
    const completion = await createCompletion(workingMessages, allowWebSearch);
    const assistantMessage = completion.choices[0]?.message;

    if (!assistantMessage) {
      throw createHttpError(502, "OpenAI returned an empty assistant message.");
    }

    if (!assistantMessage.tool_calls?.length) {
      const reply = getTextContent(assistantMessage).trim();

      if (!reply) {
        throw createHttpError(502, "OpenAI returned an empty response.");
      }

      if (persist) {
        appendMessages(session.sessionId, [
          {
            role: "user",
            content: userMessage
          },
          {
            role: "assistant",
            content: reply,
            emotion
          }
        ]);
      }

      return {
        sessionId: session.sessionId,
        reply,
        toolEvents
      };
    }

    workingMessages.push({
      role: "assistant",
      content: assistantMessage.content || "",
      tool_calls: assistantMessage.tool_calls
    });

    for (const toolCall of assistantMessage.tool_calls) {
      if (toolCall.function?.name !== "web_search") {
        continue;
      }

      const parsedArgs = JSON.parse(toolCall.function.arguments || "{}");
      const result = await searchWeb(parsedArgs.query);

      toolEvents.push({
        tool: "web_search",
        query: parsedArgs.query,
        result
      });

      workingMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      });
    }
  }

  throw createHttpError(502, "The chat engine exceeded the maximum tool-call depth.");
}

function getConversation(sessionId) {
  return getSession(sessionId);
}

module.exports = {
  clearSession,
  getConversation,
  runConversationTurn
};
