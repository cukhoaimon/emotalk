const express = require("express");
const { RtcRole } = require("agora-token");
const {
  buildRtcRtmToken,
  getAgoraConfig,
  startConversationalAgent,
  stopConversationalAgent,
} = require("../services/conversationalAgentService");

const router = express.Router();

const DEFAULT_CHANNEL = "emotalk";
const CHANNEL_PATTERN = /^[A-Za-z0-9 !#$%&()+\-:;<=>.?@[\]^_{|}~,]{1,64}$/;
const APP_ID_PATTERN = /^[A-Fa-f0-9]{32}$/;

function resolveChannel(rawChannel) {
  if (typeof rawChannel !== "string") {
    return DEFAULT_CHANNEL;
  }

  const channel = rawChannel.trim();

  if (!channel) {
    return DEFAULT_CHANNEL;
  }

  return channel;
}

function createSessionUid(role) {
  return `${role}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function isTruthyEnv(value) {
  return typeof value === "string" && ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

router.get("/agora/session", (req, res) => {
  const appId = process.env.AGORA_APP_ID?.trim();
  const allowAppIdOnly = isTruthyEnv(process.env.AGORA_ALLOW_APP_ID_ONLY);

  if (!appId) {
    return res.status(500).json({
      error: "Missing AGORA_APP_ID on the backend."
    });
  }

  if (!APP_ID_PATTERN.test(appId)) {
    return res.status(500).json({
      error: "Invalid AGORA_APP_ID format on the backend. Expected a 32-character Agora App ID."
    });
  }

  const channel = resolveChannel(req.query.channel);

  if (!CHANNEL_PATTERN.test(channel)) {
    return res.status(400).json({
      error: "Channel name is invalid. Use 1-64 supported RTC characters."
    });
  }

  const roleName = req.query.role === "debug" ? "debug" : "broadcast";
  const uid = createSessionUid(roleName);
  const appCertificate = process.env.AGORA_APP_CERTIFICATE?.trim();
  const expirationSeconds = Number(process.env.AGORA_TOKEN_EXPIRATION_SECONDS || 3600);

  if (!appCertificate && !allowAppIdOnly) {
    return res.status(500).json({
      error:
        "Missing AGORA_APP_CERTIFICATE on the backend. This app defaults to token-based Agora auth. Set AGORA_APP_CERTIFICATE or explicitly set AGORA_ALLOW_APP_ID_ONLY=true for testing-mode projects."
    });
  }

  let token = null;
  let source = "app-id-only";

  if (appCertificate) {
    const rtcRole =
      roleName === "debug" ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;

    token = buildRtcRtmToken({
      appId,
      appCertificate,
      channel,
      uid,
      role: rtcRole,
      expirationSeconds,
    });
    source = "server-generated-token";
  }

  return res.status(200).json({
    appId,
    channel,
    uid,
    token,
    source,
    useStringUid: true,
    expiresInSeconds: expirationSeconds
  });
});

router.post("/agora/agent/start", async (req, res, next) => {
  try {
    const channel = resolveChannel(req.body.channel);
    const remoteUid = typeof req.body.uid === "string" ? req.body.uid.trim() : "";
    const emotion = typeof req.body.emotion === "string" ? req.body.emotion.trim() : "joy";

    if (!CHANNEL_PATTERN.test(channel)) {
      return res.status(400).json({
        error: "Channel name is invalid. Use 1-64 supported RTC characters."
      });
    }

    if (!remoteUid) {
      return res.status(400).json({
        error: "The uid field is required to start an Agora conversational agent."
      });
    }

    const response = await startConversationalAgent({
      channel,
      remoteUid,
      emotion,
    });

    return res.status(200).json(response);
  } catch (error) {
    return next(error);
  }
});

router.post("/agora/agent/:agentId/leave", async (req, res, next) => {
  try {
    if (!req.params.agentId) {
      return res.status(400).json({ error: "Missing agentId." });
    }

    const response = await stopConversationalAgent(req.params.agentId);
    return res.status(200).json(response || { status: "stopped" });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
