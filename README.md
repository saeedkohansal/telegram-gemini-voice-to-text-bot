# Telegram Voice-to-Text Bot with Gemini AI on Cloudflare Workers

[![Serverless](https://img.shields.io/badge/Serverless-Cloudflare_Workers-orange)](https://workers.cloudflare.com/)
[![AI](https://img.shields.io/badge/AI-Google_Gemini-blue)](https://aistudio.google.com/)
[![Telegram](https://img.shields.io/badge/Telegram-Bot_API-229ED9)](https://core.telegram.org/bots/api)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](./LICENSE)

A **free, serverless Telegram voice-to-text bot** that converts **voice messages in any language into English text** using the **Google Gemini AI API**, running on **Cloudflare Workers** with **zero hosting cost and no database**.

Send a voice message → get an accurate English transcription in seconds. No VPS, no server maintenance, no database setup.

## 🚀 One-Click Install with an AI Agent

[![OpenCode](https://img.shields.io/badge/OpenCode-Compatible-black)](./PROMPT.md)
[![Codex](https://img.shields.io/badge/Codex-Compatible-black)](./PROMPT.md)
[![Claude Code](https://img.shields.io/badge/Claude_Code-Compatible-black)](./PROMPT.md)
[![Cursor](https://img.shields.io/badge/Cursor-Compatible-black)](./PROMPT.md)

> **Zero coding. 3 tokens. 5 minutes.** Open this repo in your AI agent,
> copy the prompt below, paste it in — the agent installs, deploys, and
> verifies everything and only asks you for the 3 tokens.

**How:**

1. Open this repo in OpenCode / Codex / Claude Code / Cursor.
2. Copy the prompt block and paste it into the agent chat.
3. Hand over the 3 tokens when asked → bot goes live.

```text
I want to install the Telegram voice-to-text bot from this repo:
https://github.com/saeedkohansal/telegram-gemini-voice-to-text-bot

Follow these steps exactly:
1. Read AGENTS.md and README.md in this repo and follow them — AGENTS.md
   is the authority if they ever disagree.
2. STEP 0 is mandatory and blocking: first ask me for the 3 required tokens
   (BOT_TOKEN, GEMINI_API_KEY, CLOUDFLARE_API_TOKEN), including the
   how-to-get instructions from AGENTS.md. Do NOT run any install, deploy,
   secret, or webhook command until I have provided all three.
3. After I provide the tokens: npm install, npx wrangler deploy, store both
   secrets with wrangler secret put, set the Telegram webhook to the new
   Worker /webhook URL, and run all three verify steps (Worker health page,
   getWebhookInfo with pending_update_count 0, /test-gemini returning OK —
   retry once after 10 seconds if it returns 500).
4. Rules: everything stays in English, the "Designed by gilgeekify
   programming" watermark stays intact on all bot replies, no database is
   ever added, and no secret is ever written into a project file.
5. At the end report: the Worker URL, the webhook URL + status, the
   /test-gemini result, and how to test the bot on Telegram (/start +
   a voice message).
```

<details>
<summary><b>Agent skipped STEP 0?</b></summary>

Reply with: <code>Follow STEP 0 in AGENTS.md first.</code>

</details>

<p align="center"><i>Canonical version of this prompt: <a href="./PROMPT.md">PROMPT.md</a> · Agent rules: <a href="./AGENTS.md">AGENTS.md</a></i></p>

---

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

### Deploy in 5 Steps (manual alternative to the AI prompt above)

```bash
# 1. Install dependencies
npm install

# 2. Deploy the Worker
npx wrangler deploy

# 3. Store secrets (never commit them)
echo "<BOT_TOKEN>" | npx wrangler secret put BOT_TOKEN
echo "<GEMINI_API_KEY>" | npx wrangler secret put GEMINI_API_KEY

# 3b. Optional but recommended: webhook secret (see "Webhook security" below)
echo "<RANDOM_SECRET>" | npx wrangler secret put WEBHOOK_SECRET

# 4. Point Telegram at your Worker (append &secret_token=<RANDOM_SECRET> if you did 3b)
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<your-worker>.<subdomain>.workers.dev/webhook&secret_token=<RANDOM_SECRET>"

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

## Webhook security (secret_token)

By default Telegram accepts any `setWebhook` URL, which means anyone who knows
your Worker URL could POST forged updates to `/webhook` and burn your free
Gemini quota. To prevent that:

1. Pick a random string (32+ characters), e.g. `openssl rand -hex 32`.
2. Store it as a Worker secret: `echo "<RANDOM_SECRET>" | npx wrangler secret put WEBHOOK_SECRET`.
3. Register it with Telegram: `setWebhook?url=.../webhook&secret_token=<RANDOM_SECRET>`.

Telegram then sends the secret back in the
`X-Telegram-Bot-Api-Secret-Token` header on every update, and the Worker
rejects requests with a missing or wrong header (`401 Unauthorized`).
The check is skipped only when `WEBHOOK_SECRET` is not configured, so existing
installs keep working. Rotate the secret anytime by repeating steps 1–3.

## Limits

- Audio up to **5 minutes** and **15 MB** per message
- Gemini free tier: **500 requests/day** on `gemini-flash-lite-latest`
- Telegram message limit **4096 characters** (long transcripts are auto-split)

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `/test-gemini` returns **500** right after deploy | Secret propagation delay after `wrangler secret put` | Wait 10 seconds and retry once — it resolves on its own |
| Bot replies **free Gemini quota is exhausted (429)** | `gemini-flash-lite-latest` free tier (500 requests/day) used up | Wait, then check usage at https://ai.dev/rate-limit |
| Bot replies **model is busy (503)** | Temporary Gemini overload | Automatic retries already run; ask the user to try again in 10 seconds |
| `This audio file is too large` | Audio over 15 MB | Send a shorter recording or compress the audio |
| `This voice message is too long` | Audio over 5 minutes | Split into shorter voice messages |
| `pending_update_count` keeps growing in `getWebhookInfo` | Worker crashing or webhook pointing at an old deployment | Redeploy, re-run `setWebhook` to the current `.../webhook` URL, verify `/` health endpoint |
| `The transcription service is not configured yet` | `GEMINI_API_KEY` secret missing | Run `wrangler secret put GEMINI_API_KEY` again |

## Keywords

telegram bot, telegram voice to text, speech to text, voice transcription, audio transcription, translate voice to english, gemini ai, google gemini api, gemini flash lite, cloudflare workers, serverless telegram bot, wrangler, free telegram bot hosting, ai chatbot, speech recognition, transcription bot

## Credits

Designed by gilgeekify programming

🎬 YouTube: https://www.youtube.com/@gilgeekify

## License

[MIT](./LICENSE)
