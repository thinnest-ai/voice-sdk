import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteParticipant,
  TranscriptionSegment,
  Participant,
} from 'livekit-client';

import type {
  ThinnestVoiceConfig,
  CallOptions,
  Call,
  CallStatus,
  TranscriptMessage,
  VoiceEventMap,
  VoiceEventName,
  SessionData,
} from './types';

type Listener<T> = (data: T) => void;

/**
 * ThinnestVoice — Voice AI SDK
 *
 * Add voice AI agents to any web app in 3 lines of code.
 *
 * ```ts
 * const voice = new ThinnestVoice({ apiKey: "YOUR_API_KEY" });
 * await voice.start("YOUR_AGENT_ID");
 * // ... agent speaks, user speaks, transcripts flow
 * voice.stop();
 * ```
 */
export class ThinnestVoice {
  private apiKey: string;
  private apiUrl: string;
  private room: Room | null = null;
  private call: Call | null = null;
  private status: CallStatus = 'idle';
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Map<string, Set<Listener<any>>> = new Map();
  private transcripts: Map<string, TranscriptMessage> = new Map();
  private audioElements: HTMLAudioElement[] = [];
  private audioContainer: HTMLDivElement | null = null;

  constructor(config: ThinnestVoiceConfig | string) {
    if (typeof config === 'string') {
      this.apiKey = config;
      this.apiUrl = 'https://api.thinnest.ai';
    } else {
      this.apiKey = config.apiKey;
      this.apiUrl = config.apiUrl?.replace(/\/$/, '') || 'https://api.thinnest.ai';
    }

    if (!this.apiKey) {
      throw new Error('ThinnestVoice: apiKey is required');
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
  async start(agentId: string, options?: CallOptions): Promise<Call> {
    if (this.status !== 'idle' && this.status !== 'ended' && this.status !== 'error') {
      throw new Error(`Cannot start call: current status is "${this.status}". Call stop() first.`);
    }

    this.setStatus('connecting');
    this.transcripts.clear();

    try {
      // Step 1: Create voice session via REST API
      const session = await this.createSession(agentId, options);

      // Step 2: Connect to voice room
      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      this.setupRoomEvents();

      this.setStatus('ringing');

      await this.room.connect(session.url, session.token);

      // Step 3: Enable microphone
      await this.room.localParticipant.setMicrophoneEnabled(true);

      // Step 4: Create call object
      this.call = {
        id: session.sessionId,
        status: 'active',
        agentId,
        startedAt: new Date(),
        duration: 0,
      };

      this.setStatus('active');

      this.emit('call-start', {
        callId: this.call.id,
        agentId,
      });

      return { ...this.call };
    } catch (err) {
      this.setStatus('error');
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.emit('error', { code: 'connection_failed', message });
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
  async stop(): Promise<void> {
    if (!this.call || this.status === 'idle' || this.status === 'ended') {
      return;
    }

    const callId = this.call.id;
    const duration = this.call.duration;

    this.setStatus('ending');
    this.stopTimer();

    // Notify backend
    try {
      await this.endSession(callId);
    } catch {
      // Best effort — room cleanup happens server-side too
    }

    // Disconnect from room
    this.disconnectRoom();

    this.setStatus('ended');

    this.emit('call-end', {
      callId,
      duration,
      reason: 'user_hangup',
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
  async setMuted(muted: boolean): Promise<void> {
    if (!this.room?.localParticipant) {
      throw new Error('No active call');
    }
    await this.room.localParticipant.setMicrophoneEnabled(!muted);
  }

  /** Check if microphone is muted */
  get isMuted(): boolean {
    if (!this.room?.localParticipant) return false;
    return !this.room.localParticipant.isMicrophoneEnabled;
  }

  /** Get the current call object (null if no active call) */
  get activeCall(): Call | null {
    return this.call ? { ...this.call } : null;
  }

  /** Get current call status */
  get callStatus(): CallStatus {
    return this.status;
  }

  /** Get all transcript messages */
  getTranscripts(): TranscriptMessage[] {
    return Array.from(this.transcripts.values())
      .filter((t) => t.isFinal)
      .sort((a, b) => a.timestamp - b.timestamp);
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
  on<E extends VoiceEventName>(event: E, listener: Listener<VoiceEventMap[E]>): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return this;
  }

  /** Remove an event listener */
  off<E extends VoiceEventName>(event: E, listener: Listener<VoiceEventMap[E]>): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  /** Remove all listeners for an event, or all listeners */
  removeAllListeners(event?: VoiceEventName): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }

  // ─── Internal: API Communication ──────────────────────────────────

  private async createSession(agentId: string, options?: CallOptions): Promise<SessionData> {
    const body: Record<string, unknown> = { agent_id: agentId };

    if (options?.language) body.language = options.language;
    if (options?.firstMessage) body.first_message = options.firstMessage;
    if (options?.voiceId) body.tts_voice = options.voiceId;
    if (options?.sttLanguage) body.stt_language = options.sttLanguage;
    if (options?.metadata) body.metadata = options.metadata;

    const res = await fetch(`${this.apiUrl}/v1/voice/session`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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
      sessionId: data.session_id,
    };
  }

  private async endSession(sessionId: string): Promise<void> {
    try {
      await fetch(`${this.apiUrl}/v1/voice/session/${sessionId}/end`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });
    } catch {
      // Best effort — room cleanup happens server-side too
    }
  }

  // ─── Internal: LiveKit Room Management ────────────────────────────

  private setupRoomEvents(): void {
    if (!this.room) return;

    // Transcription (user + agent speech-to-text)
    this.room.on(
      RoomEvent.TranscriptionReceived,
      (segments: TranscriptionSegment[], participant?: Participant) => {
        for (const segment of segments) {
          const isLocal = participant === this.room?.localParticipant;
          const role: 'user' | 'assistant' = isLocal ? 'user' : 'assistant';

          const msg: TranscriptMessage = {
            id: segment.id,
            role,
            text: segment.text,
            isFinal: segment.final,
            timestamp: segment.firstReceivedTime || Date.now(),
          };

          this.transcripts.set(segment.id, msg);
          this.emit('transcript', msg);
        }
      }
    );

    // Agent audio — attach to hidden element for playback
    this.room.on(
      RoomEvent.TrackSubscribed,
      (track: RemoteTrack, _pub: RemoteTrackPublication, _participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Audio) {
          this.attachAudio(track);
          this.emit('speech-start', {});
          // Start timer on first agent audio
          if (!this.timerInterval) {
            this.startTimer();
          }
        }
      }
    );

    // Track unsubscribed — agent stopped
    this.room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio) {
        this.emit('speech-end', {});
      }
    });

    // Room disconnected
    this.room.on(RoomEvent.Disconnected, () => {
      if (this.status === 'active' || this.status === 'ringing') {
        // Unexpected disconnect
        const callId = this.call?.id || '';
        const duration = this.call?.duration || 0;

        this.stopTimer();
        this.cleanupAudio();
        this.setStatus('ended');

        this.emit('call-end', {
          callId,
          duration,
          reason: 'agent_hangup',
        });

        this.call = null;
      }
    });
  }

  private attachAudio(track: RemoteTrack): void {
    // Create hidden container for audio playback
    if (!this.audioContainer) {
      this.audioContainer = document.createElement('div');
      this.audioContainer.style.display = 'none';
      this.audioContainer.setAttribute('data-thinnest-audio', 'true');
      document.body.appendChild(this.audioContainer);
    }

    const el = track.attach() as HTMLAudioElement;
    this.audioElements.push(el);
    this.audioContainer.appendChild(el);
  }

  private disconnectRoom(): void {
    if (this.room) {
      // Stop local tracks
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

  private cleanupAudio(): void {
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

  private startTimer(): void {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      if (this.call) {
        this.call.duration += 1;
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // ─── Internal: Helpers ────────────────────────────────────────────

  private setStatus(status: CallStatus): void {
    const prev = this.status;
    this.status = status;
    if (this.call) {
      this.call.status = status;
    }
    this.emit('status-change', { status, previousStatus: prev });
  }

  private emit<E extends VoiceEventName>(event: E, data: VoiceEventMap[E]): void {
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
}
