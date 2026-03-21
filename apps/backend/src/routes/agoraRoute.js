const express = require("express");
const { RtcRole, RtcTokenBuilder } = require("agora-token");

const router = express.Router();

const DEFAULT_CHANNEL = "emotalk";
const DEFAULT_TOKEN_EXPIRATION_SECONDS = 60 * 60;
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
  const appCertificate = process.env.AGORA_APP_CERTIFICATE?.trim();
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
  const expirationSeconds = Number(
    process.env.AGORA_TOKEN_EXPIRATION_SECONDS || DEFAULT_TOKEN_EXPIRATION_SECONDS
  );

  if (!appCertificate && !allowAppIdOnly) {
    return res.status(500).json({
      error:
        "Missing AGORA_APP_CERTIFICATE on the backend. This app defaults to token-based Agora auth. Set AGORA_APP_CERTIFICATE or explicitly set AGORA_ALLOW_APP_ID_ONLY=true for testing-mode projects."
    });
  }

  let token = null;
  let source = "app-id-only";

  if (appCertificate) {
    const privilegeExpiredTs = Math.floor(Date.now() / 1000) + expirationSeconds;
    const rtcRole =
      roleName === "debug" ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;

    token = RtcTokenBuilder.buildTokenWithUserAccount(
      appId,
      appCertificate,
      channel,
      uid,
      rtcRole,
      privilegeExpiredTs,
      privilegeExpiredTs
    );
    source = "server-generated-token";
  }

  return res.status(200).json({
    appId,
    channel,
    uid,
    token,
    source,
    expiresInSeconds: expirationSeconds
  });
});

module.exports = router;
