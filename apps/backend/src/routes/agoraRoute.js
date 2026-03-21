const express = require("express");
const { RtcRole, RtcTokenBuilder } = require("agora-token");

const router = express.Router();

const DEFAULT_CHANNEL = "emotalk";
const DEFAULT_TOKEN_EXPIRATION_SECONDS = 60 * 60;
const CHANNEL_PATTERN = /^[A-Za-z0-9 !#$%&()+\-:;<=>.?@[\]^_{|}~,]{1,64}$/;

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

router.get("/agora/session", (req, res) => {
  const appId = process.env.AGORA_APP_ID;

  if (!appId) {
    return res.status(500).json({
      error: "Missing AGORA_APP_ID on the backend."
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

  let token = null;
  let source = "app-id-only";

  if (process.env.AGORA_APP_CERTIFICATE) {
    const privilegeExpiredTs = Math.floor(Date.now() / 1000) + expirationSeconds;
    const rtcRole =
      roleName === "debug" ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;

    token = RtcTokenBuilder.buildTokenWithUserAccount(
      appId,
      process.env.AGORA_APP_CERTIFICATE,
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
