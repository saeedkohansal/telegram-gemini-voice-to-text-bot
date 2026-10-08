# Install with an AI Agent (OpenCode, Codex, Claude Code, Cursor)

Copy the prompt below, paste it into your AI coding agent with this repo open
(cloned or attached), and the agent will install and deploy the bot for you.
You only need to provide 3 tokens when it asks.

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

Do not edit this prompt — it mirrors AGENTS.md. If the agent skips STEP 0,
reply: `Follow STEP 0 in AGENTS.md first.`
