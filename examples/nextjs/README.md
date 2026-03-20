# Next.js Example — App Router

A Next.js 14 app with a voice agent page using `@thinnest-ai/voice-sdk`.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Setup

1. Edit `app/page.tsx` — replace `YOUR_API_KEY` and `YOUR_AGENT_ID`
2. Get credentials from [thinnest.ai](https://thinnest.ai) → Agent Studio → Deploy → API tab

## Notes

- Uses `"use client"` directive since the SDK requires browser APIs (microphone, WebRTC)
- Works with App Router (Next.js 14+)
