const { randomUUID } = require("crypto");

const sessions = new Map();
const MAX_MESSAGES = 20;

function createSession() {
  const sessionId = randomUUID();
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
  if (sessionId && sessions.has(sessionId)) {
    return sessions.get(sessionId);
  }

  return createSession();
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
  return sessions.get(sessionId) || null;
}

function clearSession(sessionId) {
  return sessions.delete(sessionId);
}

module.exports = {
  appendMessages,
  clearSession,
  getOrCreateSession,
  getSession
};
