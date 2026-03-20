# @thinnest-ai/voice-sdk

[![npm](https://img.shields.io/npm/v/@thinnest-ai/voice-sdk)](https://www.npmjs.com/package/@thinnest-ai/voice-sdk)
[![license](https://img.shields.io/npm/l/@thinnest-ai/voice-sdk)](https://opensource.org/licenses/MIT)

Add voice AI agents to any web app in 3 lines of code.

## Examples

| Example | Description | Run |
|---------|-------------|-----|
| [HTML](examples/html/) | Single HTML file, zero build tools | Open `index.html` in browser |
| [React](examples/react/) | Vite + React + TypeScript | `npm install && npm run dev` |
| [Next.js](examples/nextjs/) | Next.js 14 App Router | `npm install && npm run dev` |

## Install

```bash
npm install @thinnest-ai/voice-sdk
```

## Quick Start

```typescript
import ThinnestVoice from "@thinnest-ai/voice-sdk";

const voice = new ThinnestVoice("YOUR_API_KEY");

// Start talking to your agent
await voice.start("YOUR_AGENT_ID");

// Listen for transcripts
voice.on("transcript", (msg) => {
  console.log(`${msg.role}: ${msg.text}`);
});

// End the call
voice.stop();
```

## API

### `new ThinnestVoice(apiKey)`

Initialize the SDK with your API key.

```typescript
const voice = new ThinnestVoice("sk_...");

// Or with options:
const voice = new ThinnestVoice({
  apiKey: "sk_...",
  apiUrl: "https://api.thinnest.ai", // custom endpoint
});
```

### `voice.start(agentId, options?)`

Start a voice call with an agent. Returns a `Call` object.

```typescript
const call = await voice.start("ag_abc123", {
  language: "hi",           // override language
  firstMessage: "Hello!",   // custom greeting
  voiceId: "voice_xyz",     // override TTS voice
});

console.log(call.id);     // "call_abc123"
console.log(call.status); // "active"
```

### `voice.stop()`

End the current call.

```typescript
await voice.stop();
```

### `voice.setMuted(muted)`

Mute or unmute the microphone.

```typescript
await voice.setMuted(true);  // mute
await voice.setMuted(false); // unmute
```

### `voice.isMuted`

Check if microphone is muted.

### `voice.activeCall`

Get the current call object (null if no call).

### `voice.callStatus`

Get current status: `idle`, `connecting`, `ringing`, `active`, `ending`, `ended`, `error`.

### `voice.getTranscripts()`

Get all final transcript messages.

## Events

```typescript
voice.on("call-start", ({ callId, agentId }) => {
  console.log("Call started");
});

voice.on("call-end", ({ callId, duration, reason }) => {
  console.log(`Call ended after ${duration}s: ${reason}`);
});

voice.on("transcript", ({ role, text, isFinal }) => {
  console.log(`${role}: ${text}`);
});

voice.on("speech-start", () => {
  console.log("Agent is speaking");
});

voice.on("speech-end", () => {
  console.log("Agent stopped speaking");
});

voice.on("error", ({ code, message }) => {
  console.error(`Error: ${message}`);
});

voice.on("status-change", ({ status, previousStatus }) => {
  console.log(`${previousStatus} → ${status}`);
});
```

## React Example

```tsx
import { useState, useEffect, useRef } from "react";
import ThinnestVoice from "@thinnest-ai/voice-sdk";

function VoiceAgent({ agentId }: { agentId: string }) {
  const voiceRef = useRef<ThinnestVoice>();
  const [status, setStatus] = useState("idle");
  const [transcripts, setTranscripts] = useState<any[]>([]);

  useEffect(() => {
    voiceRef.current = new ThinnestVoice("YOUR_API_KEY");

    voiceRef.current.on("status-change", ({ status }) => setStatus(status));
    voiceRef.current.on("transcript", (msg) => {
      if (msg.isFinal) {
        setTranscripts((prev) => [...prev, msg]);
      }
    });

    return () => voiceRef.current?.stop();
  }, []);

  const toggle = async () => {
    if (status === "active") {
      await voiceRef.current?.stop();
    } else {
      await voiceRef.current?.start(agentId);
    }
  };

  return (
    <div>
      <button onClick={toggle}>
        {status === "active" ? "End Call" : "Start Call"}
      </button>
      <p>Status: {status}</p>
      {transcripts.map((t) => (
        <p key={t.id}><b>{t.role}:</b> {t.text}</p>
      ))}
    </div>
  );
}
```

## License

MIT
