export type AppMode = "broadcast" | "debug";

export type AgoraSession = {
  appId: string;
  channel: string;
  token: string | null;
  uid: number | string | null;
  source: string;
  expiresInSeconds?: number;
};

export type AnalysisResponse = {
  sessionId?: string;
  transcript: string;
  emotion: string;
  reply: string;
  toolEvents?: Array<unknown>;
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

export async function analyzeAudioRecording(
  backendBaseUrl: string,
  file: File,
  emotion: string,
  sessionId?: string
) {
  const url = new URL("/analyze-audio", backendBaseUrl);
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

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as AnalysisResponse;
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

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as AnalysisResponse;
}
