import { AgoraSession, AppMode } from "../lib/api";
import { EmotionConfig } from "../lib/types";

function toFriendlyError(raw: string): string {
  const msg = raw.toLowerCase();
  if (msg.includes("not allowed") || msg.includes("permission") || msg.includes("notallowederror")) {
    return "Microphone or camera access was denied. Please allow access in your browser settings and try again.";
  }
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) {
    return "Could not reach the server. Check your internet connection and try again.";
  }
  if (msg.includes("token") || msg.includes("auth") || msg.includes("unauthorized") || msg.includes("403")) {
    return "Session token expired or invalid. Refresh the page and try again.";
  }
  if (msg.includes("channel") || msg.includes("room")) {
    return "Could not join the room. Check the room name and try again.";
  }
  if (msg.includes("agora")) {
    return "Connection to the call service failed. Please try again.";
  }
  return "Something went wrong. Please try again.";
}

interface CallSetupPanelProps {
  channelInput: string;
  joined: boolean;
  connecting: boolean;
  isDebugMode: boolean;
  mode: AppMode;
  session: AgoraSession | null;
  isListeningLive: boolean;
  currentEmotion: EmotionConfig;
  combinedError: string | null;
  showDevTools: boolean;
  onChannelInputChange: (value: string) => void;
  onJoin: () => void;
  onLeave: () => void;
  onOpenDebugViewer: () => void;
}

export function CallSetupPanel({
  joined,
  mode,
  session,
  isListeningLive,
  currentEmotion,
  combinedError,
  showDevTools,
  onJoin,
}: CallSetupPanelProps) {
  return (
    <div>
      <div className="panel-header">
        <div>
          <p className="eyebrow">Call Info</p>
          <h2 style={{ margin: "4px 0 0", fontSize: "0.95rem", fontWeight: 500 }}>
            {joined ? `In ${session?.channel ?? "call"}` : "Not connected"}
          </h2>
        </div>
      </div>
      {showDevTools && (
        <dl className="meta-grid">
          <div><dt>Mode</dt><dd>{mode}</dd></div>
          <div><dt>Status</dt><dd>{joined ? "joined" : "idle"}</dd></div>
          {session && <div><dt>Source</dt><dd>{session.source}</dd></div>}
          {session && <div><dt>UID</dt><dd>{String(session.uid ?? "-")}</dd></div>}
        </dl>
      )}
      <div className="status-card">
        <span className={`status-dot ${combinedError ? "danger" : ""}`} />
        <div style={{ flex: 1 }}>
          <p>
            {combinedError
              ? toFriendlyError(combinedError)
              : joined
              ? `Live listening is ${isListeningLive ? "active" : "ready"} · ${currentEmotion.emoji} ${currentEmotion.title}`
              : "Join when ready."}
          </p>
          {combinedError && !joined && (
            <button type="button" className="retry-btn" onClick={onJoin}>
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
