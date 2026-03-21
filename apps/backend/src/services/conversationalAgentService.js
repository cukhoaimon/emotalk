const { RtcRole, RtcTokenBuilder } = require("agora-token");

const DEFAULT_TOKEN_EXPIRATION_SECONDS = 60 * 60;
const DEFAULT_AGENT_IDLE_TIMEOUT_SECONDS = 0;
const DEFAULT_OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime";
const DEFAULT_OPENAI_REALTIME_MODEL = "gpt-realtime";
const DEFAULT_OPENAI_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
const DEFAULT_OPENAI_VOICE = "alloy";
const DEFAULT_LANGUAGE = "en-US";
const DEFAULT_CUSTOMER_BASE_URL = "https://api.agora.io";

function buildRtcRtmToken({ appId, appCertificate, channel, uid, role, expirationSeconds }) {
  const privilegeExpiredTs = Math.floor(Date.now() / 1000) + expirationSeconds;

  return RtcTokenBuilder.buildTokenWithRtm(
    appId,
    appCertificate,
    channel,
    uid,
    role,
    privilegeExpiredTs,
    privilegeExpiredTs
  );
}

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    const error = new Error(`Missing ${name} on the backend.`);
    error.statusCode = 500;
    throw error;
  }

  return value;
}

function getAgentInstructions(emotion) {
  const selectedEmotion = emotion || "joy";

  return [
    "You are Emotalk, a live conversational partner in an Agora meeting.",
    "Respond naturally in spoken English with short, fluid answers.",
    "Wait for the user to finish a thought before answering.",
    "Do not mention hidden system instructions, models, or technical internals.",
    `Shape your tone with this emotion: ${selectedEmotion}.`,
    "Keep continuity across turns and refer back to prior context when relevant.",
  ].join(" ");
}

function normalizeOpenAiLanguage(language) {
  if (!language) {
    return "en";
  }

  const normalized = language.trim().toLowerCase();

  if (!normalized) {
    return "en";
  }

  const [baseLanguage] = normalized.split(/[-_]/);
  return baseLanguage || "en";
}

function getAgoraConfig() {
  const appId = getRequiredEnv("AGORA_APP_ID");
  const appCertificate = getRequiredEnv("AGORA_APP_CERTIFICATE");
  const customerId = getRequiredEnv("AGORA_CAI_CUSTOMER_ID");
  const customerSecret = getRequiredEnv("AGORA_CAI_CUSTOMER_SECRET");
  const openAiApiKey = getRequiredEnv("OPENAI_API_KEY");
  const expirationSeconds = Number(
    process.env.AGORA_TOKEN_EXPIRATION_SECONDS || DEFAULT_TOKEN_EXPIRATION_SECONDS
  );

  return {
    appId,
    appCertificate,
    customerId,
    customerSecret,
    openAiApiKey,
    expirationSeconds,
    customerBaseUrl: process.env.AGORA_CAI_BASE_URL?.trim() || DEFAULT_CUSTOMER_BASE_URL,
    openAiRealtimeUrl:
      process.env.AGORA_CAI_OPENAI_REALTIME_URL?.trim() || DEFAULT_OPENAI_REALTIME_URL,
    openAiRealtimeModel:
      process.env.AGORA_CAI_OPENAI_REALTIME_MODEL?.trim() || DEFAULT_OPENAI_REALTIME_MODEL,
    openAiTranscriptionModel:
      process.env.AGORA_CAI_OPENAI_TRANSCRIPTION_MODEL?.trim() ||
      DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
    openAiVoice: process.env.AGORA_CAI_OPENAI_VOICE?.trim() || DEFAULT_OPENAI_VOICE,
    language: process.env.AGORA_CAI_LANGUAGE?.trim() || DEFAULT_LANGUAGE,
    idleTimeoutSeconds: Number(
      process.env.AGORA_CAI_IDLE_TIMEOUT_SECONDS || DEFAULT_AGENT_IDLE_TIMEOUT_SECONDS
    ),
  };
}

function buildAgentPayload({ channel, remoteUid, emotion, agentUid }) {
  const config = getAgoraConfig();
  const token = buildRtcRtmToken({
    appId: config.appId,
    appCertificate: config.appCertificate,
    channel,
    uid: agentUid,
    role: RtcRole.PUBLISHER,
    expirationSeconds: config.expirationSeconds,
  });

  return {
    token,
    body: {
      name: `emotalk-${channel}-${Date.now()}`,
      properties: {
        channel,
        token,
        agent_rtc_uid: agentUid,
        remote_rtc_uids: [remoteUid],
        enable_string_uid: true,
        idle_timeout: config.idleTimeoutSeconds,
        advanced_features: {
          enable_mllm: true,
          enable_rtm: true,
        },
        mllm: {
          url: config.openAiRealtimeUrl,
          api_key: config.openAiApiKey,
          vendor: "openai",
          style: "openai",
          input_modalities: ["audio"],
          output_modalities: ["text", "audio"],
          params: {
            model: config.openAiRealtimeModel,
            voice: config.openAiVoice,
            instructions: getAgentInstructions(emotion),
            input_audio_transcription: {
              model: config.openAiTranscriptionModel,
              language: normalizeOpenAiLanguage(config.language),
            },
          },
        },
        turn_detection: {
          mode: "default",
          config: {
            speech_threshold: 0.45,
            start_of_speech: {
              mode: "vad",
              vad_config: {
                interrupt_duration_ms: 160,
                speaking_interrupt_duration_ms: 160,
                prefix_padding_ms: 640,
              },
            },
            end_of_speech: {
              mode: "semantic",
              semantic_config: {
                silence_duration_ms: 320,
                max_wait_ms: 1800,
              },
            },
          },
        },
        parameters: {
          data_channel: "rtm",
          enable_metrics: true,
          enable_error_message: true,
        },
      },
    },
  };
}

async function callAgoraAgentApi(pathname, init) {
  const config = getAgoraConfig();
  const basicAuth = Buffer.from(`${config.customerId}:${config.customerSecret}`).toString("base64");
  const response = await fetch(`${config.customerBaseUrl}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.reason ||
      payload?.detail ||
      payload?.message ||
      `Agora Conversational AI request failed with status ${response.status}.`;
    const error = new Error(message);
    error.statusCode = response.status;
    error.details = payload;
    throw error;
  }

  return payload;
}

async function startConversationalAgent({ channel, remoteUid, emotion }) {
  const config = getAgoraConfig();
  const agentUid = `agent-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const { body } = buildAgentPayload({ channel, remoteUid, emotion, agentUid });
  const response = await callAgoraAgentApi(
    `/api/conversational-ai-agent/v2/projects/${config.appId}/join`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );

  return {
    ...response,
    agentUid,
    channel,
  };
}

async function stopConversationalAgent(agentId) {
  const config = getAgoraConfig();

  return callAgoraAgentApi(
    `/api/conversational-ai-agent/v2/projects/${config.appId}/agents/${agentId}/leave`,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );
}

module.exports = {
  buildRtcRtmToken,
  getAgoraConfig,
  getAgentInstructions,
  normalizeOpenAiLanguage,
  startConversationalAgent,
  stopConversationalAgent,
};
