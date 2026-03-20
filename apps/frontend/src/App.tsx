import { useEffect, useMemo, useRef, useState } from "react";
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";

const appId = import.meta.env.VITE_AGORA_APP_ID ?? "";
const channelName = import.meta.env.VITE_AGORA_CHANNEL ?? "emotalk";
const token = import.meta.env.VITE_AGORA_TOKEN || null;
const uidRaw = import.meta.env.VITE_AGORA_UID;
const uid = uidRaw ? Number(uidRaw) : null;

function App() {
  const client = useMemo<IAgoraRTCClient>(
    () => AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }),
    []
  );
  const localContainerRef = useRef<HTMLDivElement>(null);
  const remoteContainerRef = useRef<HTMLDivElement>(null);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraTrack, setCameraTrack] = useState<ICameraVideoTrack | null>(null);
  const [micTrack, setMicTrack] = useState<IMicrophoneAudioTrack | null>(null);

  useEffect(() => {
    const handleUserPublished = async (
      user: IAgoraRTCRemoteUser,
      mediaType: "audio" | "video"
    ) => {
      await client.subscribe(user, mediaType);

      if (mediaType === "video" && user.videoTrack && remoteContainerRef.current) {
        let remotePlayer = document.getElementById(`remote-${user.uid}`);
        if (!remotePlayer) {
          remotePlayer = document.createElement("div");
          remotePlayer.id = `remote-${user.uid}`;
          remotePlayer.className = "video-tile";
          remoteContainerRef.current.appendChild(remotePlayer);
        }
        user.videoTrack.play(remotePlayer);
      }

      if (mediaType === "audio" && user.audioTrack) {
        user.audioTrack.play();
      }
    };

    const handleUserUnpublished = (user: IAgoraRTCRemoteUser) => {
      const remotePlayer = document.getElementById(`remote-${user.uid}`);
      if (remotePlayer) {
        remotePlayer.remove();
      }
    };

    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", handleUserUnpublished);
    client.on("user-left", handleUserUnpublished);

    return () => {
      client.off("user-published", handleUserPublished);
      client.off("user-unpublished", handleUserUnpublished);
      client.off("user-left", handleUserUnpublished);
    };
  }, [client]);

  const joinChannel = async () => {
    if (!appId) {
      setError("Missing VITE_AGORA_APP_ID in environment.");
      return;
    }

    try {
      setError(null);
      const [microphoneTrack, camera] = await AgoraRTC.createMicrophoneAndCameraTracks();
      setMicTrack(microphoneTrack);
      setCameraTrack(camera);

      await client.join(appId, channelName, token, uid);
      await client.publish([microphoneTrack, camera]);

      if (localContainerRef.current) {
        localContainerRef.current.innerHTML = "";
        const localPlayer = document.createElement("div");
        localPlayer.className = "video-tile";
        localContainerRef.current.appendChild(localPlayer);
        camera.play(localPlayer);
      }

      setJoined(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to join channel.";
      setError(message);
    }
  };

  const leaveChannel = async () => {
    try {
      if (cameraTrack) {
        cameraTrack.stop();
        cameraTrack.close();
      }
      if (micTrack) {
        micTrack.stop();
        micTrack.close();
      }
      await client.leave();
      setJoined(false);
      setCameraTrack(null);
      setMicTrack(null);
      if (localContainerRef.current) {
        localContainerRef.current.innerHTML = "";
      }
      if (remoteContainerRef.current) {
        remoteContainerRef.current.innerHTML = "";
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to leave channel.";
      setError(message);
    }
  };

  useEffect(() => {
    return () => {
      void leaveChannel();
    };
    // Cleanup on unmount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="page">
      <section className="card">
        <h1>EmoTalk + Agora RTC</h1>
        <p className="config">
          Channel: <strong>{channelName}</strong>
        </p>
        <div className="actions">
          <button onClick={joinChannel} disabled={joined}>
            Join
          </button>
          <button onClick={leaveChannel} disabled={!joined}>
            Leave
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="video-grid">
        <div>
          <h2>Local</h2>
          <div ref={localContainerRef} className="video-stack" />
        </div>
        <div>
          <h2>Remote</h2>
          <div ref={remoteContainerRef} className="video-stack" />
        </div>
      </section>
    </main>
  );
}

export default App;
