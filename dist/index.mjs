// src/voice.ts
import {
  Room,
  RoomEvent,
  Track
} from "livekit-client";
var ThinnestVoice = class {
  constructor(config) {
    this.room = null;
    this.call = null;
    this.status = "idle";
    this.timerInterval = null;
    this.listeners = /* @__PURE__ */ new Map();
    this.transcripts = /* @__PURE__ */ new Map();
    this.audioElements = [];
    this.audioContainer = null;
    if (typeof config === "string") {
      this.apiKey = config;
      this.apiUrl = "https://api.thinnest.ai";
    } else {
      this.apiKey = config.apiKey;
      this.apiUrl = config.apiUrl?.replace(/\/$/, "") || "https://api.thinnest.ai";
    }
    if (!this.apiKey) {
      throw new Error("ThinnestVoice: apiKey is required");
    }
  }
  // ─── Public API ───────────────────────────────────────────────────
  /**
   * Start a voice call with an agent.
   *
   * ```ts
   * await voice.start("ag_abc123");
   * ```
   */
  async start(agentId, options) {
    if (this.status !== "idle" && this.status !== "ended" && this.status !== "error") {
      throw new Error(`Cannot start call: current status is "${this.status}". Call stop() first.`);
    }
    this.setStatus("connecting");
    this.transcripts.clear();
    try {
      const session = await this.createSession(agentId, options);
      this.room = new Room({
        adaptiveStream: true,
        dynacast: true
      });
      this.setupRoomEvents();
      this.setStatus("ringing");
      await this.room.connect(session.url, session.token);
      await this.room.localParticipant.setMicrophoneEnabled(true);
      this.call = {
        id: session.sessionId,
        status: "active",
        agentId,
        startedAt: /* @__PURE__ */ new Date(),
        duration: 0
      };
      this.setStatus("active");
      this.emit("call-start", {
        callId: this.call.id,
        agentId
      });
      return { ...this.call };
    } catch (err) {
      this.setStatus("error");
      const message = err instanceof Error ? err.message : "Unknown error";
      this.emit("error", { code: "connection_failed", message });
      throw err;
    }
  }
  /**
   * End the current voice call.
   *
   * ```ts
   * voice.stop();
   * ```
   */
  async stop() {
    if (!this.call || this.status === "idle" || this.status === "ended") {
      return;
    }
    const callId = this.call.id;
    const duration = this.call.duration;
    this.setStatus("ending");
    this.stopTimer();
    try {
      await this.endSession(callId);
    } catch {
    }
    this.disconnectRoom();
    this.setStatus("ended");
    this.emit("call-end", {
      callId,
      duration,
      reason: "user_hangup"
    });
    this.call = null;
  }
  /**
   * Mute or unmute the microphone.
   *
   * ```ts
   * voice.setMuted(true);  // mute
   * voice.setMuted(false); // unmute
   * ```
   */
  async setMuted(muted) {
    if (!this.room?.localParticipant) {
      throw new Error("No active call");
    }
    await this.room.localParticipant.setMicrophoneEnabled(!muted);
  }
  /** Check if microphone is muted */
  get isMuted() {
    if (!this.room?.localParticipant) return false;
    return !this.room.localParticipant.isMicrophoneEnabled;
  }
  /** Get the current call object (null if no active call) */
  get activeCall() {
    return this.call ? { ...this.call } : null;
  }
  /** Get current call status */
  get callStatus() {
    return this.status;
  }
  /** Get all transcript messages */
  getTranscripts() {
    return Array.from(this.transcripts.values()).filter((t) => t.isFinal).sort((a, b) => a.timestamp - b.timestamp);
  }
  // ─── Event System ─────────────────────────────────────────────────
  /**
   * Listen for events.
   *
   * ```ts
   * voice.on('transcript', (msg) => {
   *   console.log(`${msg.role}: ${msg.text}`);
   * });
   * ```
   */
  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, /* @__PURE__ */ new Set());
    }
    this.listeners.get(event).add(listener);
    return this;
  }
  /** Remove an event listener */
  off(event, listener) {
    this.listeners.get(event)?.delete(listener);
    return this;
  }
  /** Remove all listeners for an event, or all listeners */
  removeAllListeners(event) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }
  // ─── Internal: API Communication ──────────────────────────────────
  async createSession(agentId, options) {
    const body = { agent_id: agentId };
    if (options?.language) body.language = options.language;
    if (options?.firstMessage) body.first_message = options.firstMessage;
    if (options?.voiceId) body.tts_voice = options.voiceId;
    if (options?.sttLanguage) body.stt_language = options.sttLanguage;
    if (options?.metadata) body.metadata = options.metadata;
    const res = await fetch(`${this.apiUrl}/v1/voice/session`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || `API error: ${res.status}`);
    }
    const data = await res.json();
    return {
      token: data.token,
      url: data.livekit_url,
      roomName: data.room_name,
      sessionId: data.session_id
    };
  }
  async endSession(sessionId) {
    try {
      await fetch(`${this.apiUrl}/v1/voice/session/${sessionId}/end`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        }
      });
    } catch {
    }
  }
  // ─── Internal: LiveKit Room Management ────────────────────────────
  setupRoomEvents() {
    if (!this.room) return;
    this.room.on(
      RoomEvent.TranscriptionReceived,
      (segments, participant) => {
        for (const segment of segments) {
          const isLocal = participant === this.room?.localParticipant;
          const role = isLocal ? "user" : "assistant";
          const msg = {
            id: segment.id,
            role,
            text: segment.text,
            isFinal: segment.final,
            timestamp: segment.firstReceivedTime || Date.now()
          };
          this.transcripts.set(segment.id, msg);
          this.emit("transcript", msg);
        }
      }
    );
    this.room.on(
      RoomEvent.TrackSubscribed,
      (track, _pub, _participant) => {
        if (track.kind === Track.Kind.Audio) {
          this.attachAudio(track);
          this.emit("speech-start", {});
          if (!this.timerInterval) {
            this.startTimer();
          }
        }
      }
    );
    this.room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        this.emit("speech-end", {});
      }
    });
    this.room.on(RoomEvent.Disconnected, () => {
      if (this.status === "active" || this.status === "ringing") {
        const callId = this.call?.id || "";
        const duration = this.call?.duration || 0;
        this.stopTimer();
        this.cleanupAudio();
        this.setStatus("ended");
        this.emit("call-end", {
          callId,
          duration,
          reason: "agent_hangup"
        });
        this.call = null;
      }
    });
  }
  attachAudio(track) {
    if (!this.audioContainer) {
      this.audioContainer = document.createElement("div");
      this.audioContainer.style.display = "none";
      this.audioContainer.setAttribute("data-thinnest-audio", "true");
      document.body.appendChild(this.audioContainer);
    }
    const el = track.attach();
    this.audioElements.push(el);
    this.audioContainer.appendChild(el);
  }
  disconnectRoom() {
    if (this.room) {
      this.room.localParticipant?.trackPublications.forEach((pub) => {
        if (pub.track) {
          pub.track.stop();
        }
      });
      this.room.disconnect();
      this.room = null;
    }
    this.cleanupAudio();
  }
  cleanupAudio() {
    for (const el of this.audioElements) {
      el.pause();
      el.srcObject = null;
      el.remove();
    }
    this.audioElements = [];
    if (this.audioContainer) {
      this.audioContainer.remove();
      this.audioContainer = null;
    }
  }
  // ─── Internal: Timer ──────────────────────────────────────────────
  startTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      if (this.call) {
        this.call.duration += 1;
      }
    }, 1e3);
  }
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
  // ─── Internal: Helpers ────────────────────────────────────────────
  setStatus(status) {
    const prev = this.status;
    this.status = status;
    if (this.call) {
      this.call.status = status;
    }
    this.emit("status-change", { status, previousStatus: prev });
  }
  emit(event, data) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(data);
        } catch (err) {
          console.error(`[ThinnestVoice] Error in "${event}" listener:`, err);
        }
      }
    }
  }
};
export {
  ThinnestVoice
};
