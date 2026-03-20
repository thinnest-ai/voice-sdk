"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ThinnestVoice from "@thinnest-ai/voice-sdk";

// ── Replace with your credentials ──
const API_KEY = "YOUR_API_KEY";
const AGENT_ID = "YOUR_AGENT_ID";

interface Transcript {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export default function VoiceAgentPage() {
  const voiceRef = useRef<ThinnestVoice | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("idle");
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);

  useEffect(() => {
    voiceRef.current = new ThinnestVoice(API_KEY);
    voiceRef.current.on("status-change", ({ status }) => setStatus(status));
    voiceRef.current.on("transcript", (msg) => {
      if (msg.isFinal) {
        setTranscripts((prev) => [...prev, { id: msg.id, role: msg.role as "user" | "assistant", text: msg.text }]);
      }
    });
    voiceRef.current.on("call-end", () => setStatus("ended"));
    return () => { voiceRef.current?.stop(); };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  useEffect(() => {
    if (status !== "active") return;
    setDuration(0);
    const iv = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(iv);
  }, [status]);

  const start = useCallback(async () => {
    setTranscripts([]);
    setMuted(false);
    try {
      await voiceRef.current?.start(AGENT_ID);
    } catch (e: any) {
      console.error("Failed to start call:", e.message);
    }
  }, []);

  const stop = useCallback(async () => {
    await voiceRef.current?.stop();
  }, []);

  const toggleMute = useCallback(async () => {
    const next = !muted;
    await voiceRef.current?.setMuted(next);
    setMuted(next);
  }, [muted]);

  const active = status === "active" || status === "connecting" || status === "ringing";
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui", color: "#e5e5e5" }}>
      <div style={{ width: "100%", maxWidth: 440, padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, textAlign: "center", marginBottom: 4 }}>
          Voice Agent
        </h1>
        <p style={{ fontSize: 13, color: "#888", textAlign: "center", marginBottom: 28 }}>
          Next.js + <a href="https://www.npmjs.com/package/@thinnest-ai/voice-sdk" style={{ color: "#f97316", textDecoration: "none" }}>@thinnest-ai/voice-sdk</a>
        </p>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #222", padding: "10px 0", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: status === "active" ? "#22c55e" : "#555" }} />
            <span>{status}</span>
          </div>
          <span style={{ fontFamily: "monospace", color: "#888" }}>{fmt(duration)}</span>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {!active ? (
            <button onClick={start} style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
              Start Call
            </button>
          ) : (
            <>
              <button onClick={stop} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ef4444", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 14 }}>
                End Call
              </button>
              <button onClick={toggleMute} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #333", background: "#1a1a1a", color: "#e5e5e5", cursor: "pointer", fontSize: 14 }}>
                {muted ? "Unmute" : "Mute"}
              </button>
            </>
          )}
        </div>

        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 8, padding: 12, minHeight: 200, maxHeight: 340, overflowY: "auto", fontSize: 13, lineHeight: 1.6 }}>
          {transcripts.length === 0 && <p style={{ color: "#555" }}>Transcripts will appear here...</p>}
          {transcripts.map((t) => (
            <div key={t.id} style={{ marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 11, textTransform: "uppercase", marginRight: 6, color: t.role === "user" ? "#3b82f6" : "#f97316" }}>
                {t.role}
              </span>
              {t.text}
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </div>
    </div>
  );
}
