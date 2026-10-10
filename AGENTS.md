# AGENTS.md

Orientation for AI coding agents (and humans) working in this repo.
Keep it short and true. The user-facing product language is **English only**.

## What this project is

A **stateless, serverless Telegram voice-to-text bot**: a user sends a voice
message in any language, a Cloudflare Worker downloads the audio, sends it to
the Google Gemini API as inline audio data, and replies with an English
transcription. No server, no database, no hosting cost.

| Path                 | What it is                                                    |
|----------------------|---------------------------------------------------------------|
| `src/index.js`       | The entire Worker: webhook, audio pipeline, Gemini client     |
| `wrangler.toml`      | Worker name, `nodejs_compat`, `GEMINI_MODEL` var (no D1)      |
| `package.json`       | Wrangler devDependency and scripts                            |
| `.dev.vars.example`  | Local secret template (placeholders only, never real tokens)  |

## STEP 0 — Collect tokens FIRST (mandatory, blocking)

**Do not run any deploy, secret, or webhook command until the user has
provided all three tokens.** Ask for the tokens one by one in order, waiting
for the user's reply each time before asking the next one. Include the
how-to-get instruction for each token when you ask for it. Confirm receipt
without echoing the full token, then ask for the next one. Never invent,
guess, or reuse tokens from another project without confirmation.

Order:
1. First ask for **`BOT_TOKEN`**, wait for reply, confirm receipt.
2. Then ask for **`GEMINI_API_KEY`**, wait for reply, confirm receipt.
3. Finally ask for **`CLOUDFLARE_API_TOKEN`**, wait for reply, confirm receipt.
Only after all three are received, continue with deploy.

1. **`BOT_TOKEN`** — Telegram bot token.
   How to get: chat with [@BotFather](https://t.me/BotFather) → `/newbot` →
   follow the prompts → copy the `123456:ABC-DEF...` token.
2. **`GEMINI_API_KEY`** — Google Gemini API key (free tier).
   How to get: sign in at [Google AI Studio](https://aistudio.google.com/app/apikey)
   → Create API key → copy it.
3. **`CLOUDFLARE_API_TOKEN`** — Cloudflare API token (deploy only, never stored
   in this repo).
   How to get: [dash.cloudflare.com](https://dash.cloudflare.com) → account
   avatar → Manage Account → API Tokens → create a token with Workers deploy
   permission. The user must also have a `workers.dev` subdomain set under
   Workers.
   Token scope note: a User API Token can list accounts, an Account-scoped
   API Token cannot. If `wrangler deploy` fails on `/memberships` with
   `400 code 9106`, the token is Account-scoped — run `npx wrangler whoami`
   to get the Account ID (also shown on the Workers dashboard sidebar) and
   set `CLOUDFLARE_ACCOUNT_ID` before deploying.

## Deploy & verify workflow

```bash
npm install
# Detect token scope first (Account-scoped tokens cannot list accounts):
npx wrangler whoami
# If whoami reports an Account API Token, set its Account ID, then deploy:
# export CLOUDFLARE_ACCOUNT_ID=<account-id-from-whoami>
npx wrangler deploy
echo "<BOT_TOKEN>" | npx wrangler secret put BOT_TOKEN
echo "<GEMINI_API_KEY>" | npx wrangler secret put GEMINI_API_KEY
# Optional but recommended: webhook authentication (see README "Webhook security").
# Generate with: openssl rand -hex 32
echo "<WEBHOOK_SECRET>" | npx wrangler secret put WEBHOOK_SECRET
# Point Telegram at the Worker (append &secret_token=<WEBHOOK_SECRET> when set):
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<worker>.<subdomain>.workers.dev/webhook&secret_token=<WEBHOOK_SECRET>"
# Verify (all three must pass):
curl "https://<worker>.<subdomain>.workers.dev/"
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"   # pending_update_count must be 0
curl "https://<worker>.<subdomain>.workers.dev/test-gemini?text=Say%20OK"   # must return OK
```

Known gotcha: the first `/test-gemini` call right after `secret put` may return
**500** (secret propagation delay). Wait 10 seconds and retry once before
diagnosing anything else.

## Rules that bite

- **All user-facing text is English.** Never add non-English strings.
- **Watermark:** every Telegram reply must end with the `WATERMARK` constant
  (`src/index.js`) via `withWatermark()`. Current form:
  `Designed by gilgeekify programming` + `https://www.youtube.com/@gilgeekify`.
- **Brand spelling:** always lowercase `gilgeekify programming` (the leading
  `Designed by` keeps its capital D).
- **Stateless — never add a database.** No D1, KV, or external storage. The
  transcription path (download → Gemini → reply) must work with zero storage.
- **Never commit secrets.** Real tokens live only as encrypted Worker secrets
  (Cloudflare dashboard → Worker → Settings → Variables and Secrets).
  `.dev.vars` is gitignored; only `.dev.vars.example` (placeholders) is committed.
- **Limits (do not raise without asking):** 15 MB / 5 min per audio message,
  Telegram 4096 chars per message (auto-split in `sendLongMessage`).
- After changing `src/index.js` or `wrangler.toml`: `node --check`, redeploy,
  re-run all three verify steps.
