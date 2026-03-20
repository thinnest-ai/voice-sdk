import { useState, useEffect, useRef, useCallback } from "react";
import ThinnestVoice from "@thinnest-ai/voice-sdk";

// Inject pulse keyframes once
if (typeof document !== "undefined" && !document.getElementById("pulse-style")) {
  const style = document.createElement("style");
  style.id = "pulse-style";
  style.textContent = "@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }";
  document.head.appendChild(style);
}

// ── Replace with your credentials ──
const API_KEY = "YOUR_API_KEY";
const AGENT_ID = "YOUR_AGENT_ID";

interface Transcript {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

export default function App() {
  const voiceRef = useRef<ThinnestVoice | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("idle");
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);

  useEffect(() => {
    voiceRef.current = new ThinnestVoice(API_KEY);

    voiceRef.current.on("status-change", ({ status }) => setStatus(status));

    voiceRef.current.on("transcript", (msg) => {
      if (msg.isFinal) {
        setTranscripts((prev) => [
          ...prev,
          { id: msg.id, role: msg.role as "user" | "assistant", text: msg.text, timestamp: msg.timestamp },
        ]);
      }
    });

    voiceRef.current.on("call-end", () => setStatus("ended"));

    voiceRef.current.on("error", ({ message }) => {
      console.error("Voice error:", message);
    });

    return () => {
      voiceRef.current?.stop();
    };
  }, []);

  // Auto-scroll transcripts
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  // Timer
  useEffect(() => {
    if (status !== "active") return;
    setDuration(0);
    const interval = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  const startCall = useCallback(async () => {
    setTranscripts([]);
    setMuted(false);
    try {
      await voiceRef.current?.start(AGENT_ID);
    } catch (e: any) {
      alert("Failed to start call: " + e.message);
    }
  }, []);

  const endCall = useCallback(async () => {
    await voiceRef.current?.stop();
  }, []);

  const toggleMute = useCallback(async () => {
    if (!voiceRef.current) return;
    const next = !muted;
    await voiceRef.current.setMuted(next);
    setMuted(next);
  }, [muted]);

  const isActive = status === "active";
  const isConnecting = status === "connecting" || status === "ringing";
  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Voice Agent</h1>
        <p style={styles.sub}>
          Powered by <a href="https://thinnest.ai" style={styles.link}>thinnest.ai</a>
        </p>

        {/* Status */}
        <div style={styles.statusBar}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                ...styles.dot,
                background: isActive ? "#22c55e" : status === "error" ? "#ef4444" : "#555",
                animation: isActive ? "pulse 1.5s infinite" : "none",
              }}
            />
            <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
          </div>
          <span style={styles.timer}>{formatTime(duration)}</span>
        </div>

        {/* Controls */}
        <div style={styles.controls}>
          {!isActive && !isConnecting ? (
            <button style={{ ...styles.btn, ...styles.btnStart }} onClick={startCall}>
              Start Call
            </button>
          ) : (
            <>
              <button style={{ ...styles.btn, ...styles.btnEnd }} onClick={endCall}>
                End Call
              </button>
              <button style={styles.btn} onClick={toggleMute}>
                {muted ? "Unmute" : "Mute"}
              </button>
            </>
          )}
        </div>

        {/* Transcripts */}
        <div style={styles.transcript}>
          {transcripts.length === 0 && (
            <p style={{ color: "#555", fontSize: 13 }}>Transcripts will appear here...</p>
          )}
          {transcripts.map((t) => (
            <div key={t.id} style={styles.msg}>
              <span
                style={{
                  ...styles.role,
                  color: t.role === "user" ? "#3b82f6" : "#f97316",
                }}
              >
                {t.role}
              </span>
              {t.text}
            </div>
          ))}
          <div ref={transcriptEndRef} />
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0a0a0a",
    color: "#e5e5e5",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  card: { width: "100%", maxWidth: 440, padding: 24 },
  title: { fontSize: 20, fontWeight: 600, textAlign: "center", marginBottom: 4 },
  sub: { fontSize: 13, color: "#888", textAlign: "center", marginBottom: 28 },
  link: { color: "#f97316", textDecoration: "none" },
  statusBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 0",
    marginBottom: 16,
    borderTop: "1px solid #222",
  },
  dot: { width: 8, height: 8, borderRadius: "50%" },
  timer: { fontFamily: "monospace", fontSize: 14, color: "#888" },
  controls: { display: "flex", gap: 8, marginBottom: 16 },
  btn: {
    flex: 1,
    padding: 10,
    border: "1px solid #333",
    borderRadius: 8,
    background: "#1a1a1a",
    color: "#e5e5e5",
    fontSize: 14,
    cursor: "pointer",
  },
  btnStart: { background: "#16a34a", borderColor: "#16a34a", color: "#fff", fontWeight: 600 },
  btnEnd: { borderColor: "#ef4444", color: "#ef4444" },
  transcript: {
    background: "#111",
    border: "1px solid #222",
    borderRadius: 8,
    padding: 12,
    minHeight: 200,
    maxHeight: 340,
    overflowY: "auto",
    fontSize: 13,
    lineHeight: 1.6,
  },
  msg: { marginBottom: 8 },
  role: { fontWeight: 600, fontSize: 11, textTransform: "uppercase", marginRight: 6 },
};
