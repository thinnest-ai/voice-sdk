/** Configuration for initializing the SDK */
interface ThinnestVoiceConfig {
    /** Your API key (from Agent Studio → Deploy → API) */
    apiKey: string;
    /** API base URL (default: https://api.thinnest.ai) */
    apiUrl?: string;
}
/** Options for starting a voice call */
interface CallOptions {
    /** Override the agent's default language */
    language?: string;
    /** Override the agent's first message / greeting */
    firstMessage?: string;
    /** Override the TTS voice ID */
    voiceId?: string;
    /** Override the STT language */
    sttLanguage?: string;
    /** Custom metadata to pass to the agent */
    metadata?: Record<string, unknown>;
}
/** Call status */
type CallStatus = 'idle' | 'connecting' | 'ringing' | 'active' | 'ending' | 'ended' | 'error';
/** Active call information */
interface Call {
    /** Unique call identifier */
    id: string;
    /** Current call status */
    status: CallStatus;
    /** Agent ID for this call */
    agentId: string;
    /** Call start time */
    startedAt: Date;
    /** Call duration in seconds (updates every second) */
    duration: number;
}
/** Transcript message from user or agent */
interface TranscriptMessage {
    /** Unique message ID */
    id: string;
    /** Who spoke: 'user' or 'assistant' */
    role: 'user' | 'assistant';
    /** The spoken text */
    text: string;
    /** Whether this transcript is still being refined (interim) */
    isFinal: boolean;
    /** Timestamp */
    timestamp: number;
}
/** SDK event map */
interface VoiceEventMap {
    /** Call connected and agent is ready */
    'call-start': {
        callId: string;
        agentId: string;
    };
    /** Call ended */
    'call-end': {
        callId: string;
        duration: number;
        reason: string;
    };
    /** Agent started speaking */
    'speech-start': {};
    /** Agent stopped speaking */
    'speech-end': {};
    /** New or updated transcript */
    'transcript': TranscriptMessage;
    /** Volume level update (0-1) */
    'volume': {
        level: number;
        role: 'user' | 'assistant';
    };
    /** Error occurred */
    'error': {
        code: string;
        message: string;
    };
    /** Connection state changed */
    'status-change': {
        status: CallStatus;
        previousStatus: CallStatus;
    };
}
type VoiceEventName = keyof VoiceEventMap;

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
declare class ThinnestVoice {
    private apiKey;
    private apiUrl;
    private room;
    private call;
    private status;
    private timerInterval;
    private listeners;
    private transcripts;
    private audioElements;
    private audioContainer;
    constructor(config: ThinnestVoiceConfig | string);
    /**
     * Start a voice call with an agent.
     *
     * ```ts
     * await voice.start("ag_abc123");
     * ```
     */
    start(agentId: string, options?: CallOptions): Promise<Call>;
    /**
     * End the current voice call.
     *
     * ```ts
     * voice.stop();
     * ```
     */
    stop(): Promise<void>;
    /**
     * Mute or unmute the microphone.
     *
     * ```ts
     * voice.setMuted(true);  // mute
     * voice.setMuted(false); // unmute
     * ```
     */
    setMuted(muted: boolean): Promise<void>;
    /** Check if microphone is muted */
    get isMuted(): boolean;
    /** Get the current call object (null if no active call) */
    get activeCall(): Call | null;
    /** Get current call status */
    get callStatus(): CallStatus;
    /** Get all transcript messages */
    getTranscripts(): TranscriptMessage[];
    /**
     * Listen for events.
     *
     * ```ts
     * voice.on('transcript', (msg) => {
     *   console.log(`${msg.role}: ${msg.text}`);
     * });
     * ```
     */
    on<E extends VoiceEventName>(event: E, listener: Listener<VoiceEventMap[E]>): this;
    /** Remove an event listener */
    off<E extends VoiceEventName>(event: E, listener: Listener<VoiceEventMap[E]>): this;
    /** Remove all listeners for an event, or all listeners */
    removeAllListeners(event?: VoiceEventName): this;
    private createSession;
    private endSession;
    private setupRoomEvents;
    private attachAudio;
    private disconnectRoom;
    private cleanupAudio;
    private startTimer;
    private stopTimer;
    private setStatus;
    private emit;
}

export { type Call, type CallOptions, type CallStatus, ThinnestVoice, type ThinnestVoiceConfig, type TranscriptMessage, type VoiceEventMap, type VoiceEventName };
