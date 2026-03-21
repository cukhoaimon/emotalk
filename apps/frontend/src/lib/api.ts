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

export type AnalysisSpeech = {
  filename: string;
  contentType: string;
  path: string;
  url: string;
};

export type AnalysisResponse = {
  transcript: string;
  emotion: string;
  reply: string;
  sessionId?: string | null;
  toolEvents?: Array<{
    tool: string;
    query?: string;
    result?: unknown;
  }>;
  speech?: AnalysisSpeech;
  ignored?: boolean;
  reason?: string;
};

export type ChatResponse = {
  message: string;
  sessionId?: string | null;
  emotion: string;
  reply: string;
  toolEvents?: Array<{
    tool: string;
    query?: string;
    result?: unknown;
  }>;
  output?: {
    directory: string;
    timestampedFilename: string;
    latestFilename: string;
  };
};

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

export async function analyzeLiveAudio(
  backendBaseUrl: string,
  file: File,
  emotion: string,
  sessionId?: string
) {
  const url = new URL("/analyze-audio/live", backendBaseUrl);
  const formData = new FormData();

  formData.append("file", file);
  formData.append("emotion", emotion);

  if (sessionId) {
    formData.append("sessionId", sessionId);
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    body: formData,
  });

  if (response.status === 204) {
    return {
      transcript: "",
      emotion,
      reply: "",
      sessionId: sessionId ?? null,
      ignored: true,
      reason: "empty_transcript",
    } satisfies AnalysisResponse;
  }

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as AnalysisResponse;
}

export async function chatWithBackend(
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
