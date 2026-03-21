export type AppMode = "broadcast" | "debug";

export type AgoraSession = {
  appId: string;
  channel: string;
  token: string | null;
  uid: number | string | null;
  source: string;
  useStringUid?: boolean;
  expiresInSeconds?: number;
};

export type AgoraAgentSession = {
  agent_id: string;
  create_ts?: number;
  status: string;
  agentUid: string;
  channel: string;
};

export type ChatResponse = {
  sessionId: string;
  emotion: string;
  reply: string;
  toolEvents?: Array<unknown>;
};

export type AvatarVoiceCatalog = {
  configured: {
    default: string | null;
    joy: string | null;
    sadness: string | null;
    anger: string | null;
    fear: string | null;
    disgust: string | null;
  };
  persisted: {
    default: string | null;
    joy: string | null;
    sadness: string | null;
    anger: string | null;
    fear: string | null;
    disgust: string | null;
  };
  fromEnv: {
    default: string | null;
    joy: string | null;
    sadness: string | null;
    anger: string | null;
    fear: string | null;
    disgust: string | null;
  };
  voices: Array<{
    voiceId: string;
    name: string;
    category: string;
  }>;
};

export type AvatarVoiceMapping = AvatarVoiceCatalog["configured"];

async function getErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || `Request failed with status ${response.status}.`;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

export async function fetchAgoraSession(
  backendBaseUrl: string,
  requestedMode: AppMode,
  channelName: string
) {
  const url = new URL("/agora/session", backendBaseUrl);
  url.searchParams.set("channel", channelName);
  url.searchParams.set("role", requestedMode);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as AgoraSession;
}

export async function startAgoraAgent(
  backendBaseUrl: string,
  options: {
    channel: string;
    uid: string;
    emotion: string;
  }
) {
  const url = new URL("/agora/agent/start", backendBaseUrl);
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as AgoraAgentSession;
}

export async function stopAgoraAgent(backendBaseUrl: string, agentId: string) {
  const url = new URL(`/agora/agent/${agentId}/leave`, backendBaseUrl);
  const response = await fetch(url.toString(), {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as { status?: string };
}

export async function sendChatMessage(
  backendBaseUrl: string,
  message: string,
  emotion: string,
  sessionId?: string
) {
  const url = new URL("/chat", backendBaseUrl);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      emotion,
      sessionId,
    }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as ChatResponse;
}

export async function clearChatSession(
  backendBaseUrl: string,
  sessionId: string
) {
  const url = new URL(`/chat/${sessionId}`, backendBaseUrl);

  const response = await fetch(url.toString(), {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
}

export async function requestAvatarSpeech(
  backendBaseUrl: string,
  text: string,
  emotion: string
) {
  const url = new URL("/avatar/speech", backendBaseUrl);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      emotion,
    }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return await response.blob();
}

export async function fetchAvatarVoiceCatalog(backendBaseUrl: string) {
  const url = new URL("/avatar/voices", backendBaseUrl);
  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as AvatarVoiceCatalog;
}

export async function saveAvatarVoiceCatalog(
  backendBaseUrl: string,
  mapping: AvatarVoiceMapping
) {
  const url = new URL("/avatar/voices", backendBaseUrl);
  const response = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mapping }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as {
    saved: AvatarVoiceMapping;
    catalog: AvatarVoiceCatalog;
  };
}
