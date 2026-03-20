/** Configuration for initializing the SDK */
export interface ThinnestVoiceConfig {
  /** Your API key (from Agent Studio → Deploy → API) */
  apiKey: string;
  /** API base URL (default: https://api.thinnest.ai) */
  apiUrl?: string;
}

/** Options for starting a voice call */
export interface CallOptions {
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
export type CallStatus =
  | 'idle'
  | 'connecting'
  | 'ringing'
  | 'active'
  | 'ending'
  | 'ended'
  | 'error';

/** Active call information */
export interface Call {
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
export interface TranscriptMessage {
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
export interface VoiceEventMap {
  /** Call connected and agent is ready */
  'call-start': { callId: string; agentId: string };
  /** Call ended */
  'call-end': { callId: string; duration: number; reason: string };
  /** Agent started speaking */
  'speech-start': {};
  /** Agent stopped speaking */
  'speech-end': {};
  /** New or updated transcript */
  'transcript': TranscriptMessage;
  /** Volume level update (0-1) */
  'volume': { level: number; role: 'user' | 'assistant' };
  /** Error occurred */
  'error': { code: string; message: string };
  /** Connection state changed */
  'status-change': { status: CallStatus; previousStatus: CallStatus };
}

export type VoiceEventName = keyof VoiceEventMap;

/** Internal session data from the API */
export interface SessionData {
  token: string;
  url: string;
  roomName: string;
  sessionId: string;
}
