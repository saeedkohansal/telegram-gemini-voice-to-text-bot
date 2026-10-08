# Telegram Voice-to-Text Bot with Gemini AI on Cloudflare Workers

[![Serverless](https://img.shields.io/badge/Serverless-Cloudflare_Workers-orange)](https://workers.cloudflare.com/)
[![AI](https://img.shields.io/badge/AI-Google_Gemini-blue)](https://aistudio.google.com/)
[![Telegram](https://img.shields.io/badge/Telegram-Bot_API-229ED9)](https://core.telegram.org/bots/api)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](./LICENSE)

A **free, serverless Telegram voice-to-text bot** that converts **voice messages in any language into English text** using the **Google Gemini AI API**, running on **Cloudflare Workers** with **zero hosting cost and no database**.

Send a voice message → get an accurate English transcription in seconds. No VPS, no server maintenance, no database setup.

## Demo

1. Open the bot on Telegram and send `/start`.
2. Record a voice message in any language (Persian, English, Arabic, Turkish, ...) and send it.
3. The bot replies with `Listening... transcribing your voice to English text.` and then the English transcription.

## Features

- 🎙️ **Voice to text transcription** — Telegram voice messages, audio files, and audio documents
- 🌍 **Auto-translate to English** — non-English speech is translated into fluent English; English speech is transcribed verbatim
- ⚡ **Serverless on Cloudflare Workers** — free tier hosting, global edge network, ~10 ms startup
- 🗄️ **No database, fully stateless** — nothing to provision, back up, or pay for
- 🔁 **Automatic retries** — resilient to Gemini 503 overloads with exponential backoff
- 🛡️ **Friendly error messages** — clear English guidance for quota limits, large files, and unclear audio
- ✂️ **Long-message splitting** — transcripts longer than the Telegram 4096-character limit are split cleanly
- 💧 **Watermarked replies** — every answer credits the builder

## How It Works

```text
Telegram voice message
        │
        ▼
Cloudflare Worker (/webhook)
        │  1. getFile → download audio from Telegram
        │  2. size check (15 MB) + duration check (5 min)
        │  3. base64 encode → Gemini generateContent (inline audio data)
        ▼
Google Gemini AI (gemini-flash-lite-latest)
        │  transcribe + translate to English
        ▼
Telegram reply with the English text
```

## Tech Stack

- [Cloudflare Workers](https://workers.cloudflare.com/) — serverless runtime and webhook endpoint
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) — deployment CLI
- [Telegram Bot API](https://core.telegram.org/bots/api) — `getFile`, `sendMessage`, `sendChatAction`, webhooks
- [Google Gemini API](https://aistudio.google.com/) — audio transcription and translation (`gemini-flash-lite-latest`, 500 free requests/day)

## Quick Start

### Prerequisites

1. A Telegram account — create a bot with [@BotFather](https://t.me/BotFather) (`/newbot`) and copy the `BOT_TOKEN`.
2. A Google account — create a free API key at [Google AI Studio](https://aistudio.google.com/app/apikey) and copy the `GEMINI_API_KEY`.
3. A Cloudflare account — set your `workers.dev` subdomain under Workers.
4. Node.js 18+ and the Cloudflare API token (for `wrangler deploy`).

### Deploy in 5 Steps

```bash
# 1. Install dependencies
npm install

# 2. Deploy the Worker
npx wrangler deploy

# 3. Store secrets (never commit them)
echo "<BOT_TOKEN>" | npx wrangler secret put BOT_TOKEN
echo "<GEMINI_API_KEY>" | npx wrangler secret put GEMINI_API_KEY

# 4. Point Telegram at your Worker
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<your-worker>.<subdomain>.workers.dev/webhook"

# 5. Verify
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
curl "https://<your-worker>.<subdomain>.workers.dev/test-gemini?text=Say%20OK"
```

No database step — there is none. The bot is stateless.

### Local Development

```bash
cp .dev.vars.example .dev.vars   # fill in BOT_TOKEN and GEMINI_API_KEY
npx wrangler dev
```

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and usage intro |
| `/help` | Step-by-step usage instructions and limits |
| Voice message | Transcribed and translated to English automatically |
| Text / photo / sticker | English hint asking for a voice message instead |

## Project Structure

```text
telegram-gemini-voice-to-text-bot/
├── src/
│   └── index.js          # Worker: webhook, audio pipeline, Gemini client
├── wrangler.toml         # Worker name, nodejs_compat, GEMINI_MODEL var
├── package.json          # Wrangler devDependency and scripts
└── .dev.vars.example     # Local secret template (placeholders only)
```

## Limits

- Audio up to **5 minutes** and **15 MB** per message
- Gemini free tier: **500 requests/day** on `gemini-flash-lite-latest`
- Telegram message limit **4096 characters** (long transcripts are auto-split)

## Keywords

telegram bot, telegram voice to text, speech to text, voice transcription, audio transcription, translate voice to english, gemini ai, google gemini api, gemini flash lite, cloudflare workers, serverless telegram bot, wrangler, free telegram bot hosting, ai chatbot, speech recognition, transcription bot

## Credits

Designed by gilgeekify programming

🎬 YouTube: https://www.youtube.com/@gilgeekify

## License

[MIT](./LICENSE)
