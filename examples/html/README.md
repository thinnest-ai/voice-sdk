# HTML Example — Zero Build Tools

A single HTML file that connects to a Thinnest AI voice agent. No build step, no bundler, no framework.

## Run

1. Open `index.html` in your browser
2. Enter your API key (`thns_sk_...`) and Agent ID (`ag_...`)
3. Click **Start Call** and speak

## How It Works

The SDK is loaded via CDN:

```html
<script src="https://unpkg.com/@thinnest-ai/voice-sdk@latest/dist/index.global.js"></script>
```

Then used as a global:

```javascript
const voice = new ThinnestVoiceSDK.ThinnestVoice("your-api-key");
await voice.start("your-agent-id");
```

## Get Your Credentials

1. Sign up at [thinnest.ai](https://thinnest.ai)
2. Create an agent in Agent Studio
3. Go to **Deploy** → **API** tab to get your API key
