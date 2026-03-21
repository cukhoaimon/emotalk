const { randomUUID } = require("crypto");

const sessions = new Map();
const MAX_MESSAGES = 20;
const DEFAULT_SESSION_ID = "server-runtime-memory";

function resolveSessionId(sessionId) {
  if (typeof sessionId === "string" && sessionId.trim()) {
    return sessionId.trim();
  }

  return DEFAULT_SESSION_ID;
}

function createSession(sessionId = randomUUID()) {
  const session = {
    sessionId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: []
  };

  sessions.set(sessionId, session);

  return session;
}

function getOrCreateSession(sessionId) {
  const resolvedSessionId = resolveSessionId(sessionId);

  if (sessions.has(resolvedSessionId)) {
    return sessions.get(resolvedSessionId);
  }

  return createSession(resolvedSessionId);
}

function hasSession(sessionId) {
  return sessions.has(resolveSessionId(sessionId));
}

function appendMessages(sessionId, messages) {
  const session = getOrCreateSession(sessionId);

  session.messages.push(...messages);
  session.messages = session.messages.slice(-MAX_MESSAGES);
  session.updatedAt = new Date().toISOString();

  sessions.set(session.sessionId, session);

  return session;
}

function getSession(sessionId) {
  return sessions.get(resolveSessionId(sessionId)) || null;
}

function clearSession(sessionId) {
  return sessions.delete(resolveSessionId(sessionId));
}

module.exports = {
  appendMessages,
  clearSession,
  DEFAULT_SESSION_ID,
  getOrCreateSession,
  hasSession,
  getSession
};
