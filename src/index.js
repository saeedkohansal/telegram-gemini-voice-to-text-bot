/**
 * Cloudflare Worker — gilgeekify programming Voice-to-Text Telegram Bot (Gemini)
 *
 * Stateless. No database.
 * Behavior (all user-facing text is English):
 * - User sends a voice/audio message -> bot downloads the file from Telegram,
 *   sends it to Gemini as inline audio data, and replies with the
 *   transcription translated into clear English text.
 * - User sends /start, /help, or plain text -> bot replies with English
 *   usage instructions.
 * - Every Telegram reply carries the Gilgeekify watermark.
 *
 * Secrets (via `npx wrangler secret put`):
 *   BOT_TOKEN, GEMINI_API_KEY
 *   WEBHOOK_SECRET (optional but recommended: Telegram webhook secret_token.
 *     When set, POST /webhook requests must carry the matching
 *     `X-Telegram-Bot-Api-Secret-Token` header or they are rejected with 401.
 *     Register it via setWebhook: .../setWebhook?url=...&secret_token=...)
 * Var (from wrangler.toml):
 *   GEMINI_MODEL
 */

const TELEGRAM_LIMIT = 4096;
const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_DURATION_SEC = 300; // 5 minutes

const WATERMARK = "Designed by gilgeekify programming\nhttps://www.youtube.com/@gilgeekify";

const TRANSCRIBE_PROMPT =
  "You are an expert transcription engine. Listen to the attached audio and output ONLY the transcription translated into clear, natural English text. " +
  "Rules: " +
  "1. If the speech is already English, transcribe it verbatim with proper punctuation. " +
  "2. If the speech is in another language, translate it into fluent English. " +
  "3. Output only the transcript text — no commentary, no timestamps, no speaker labels, no markdown formatting, no asterisks. " +
  "4. Keep paragraph breaks where natural.";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return new Response("gilgeekify programming Voice-to-Text Telegram Bot is running. POST /webhook for Telegram.", { status: 200 });
    }

    if (url.pathname === "/webhook" && request.method === "POST") {
      // Optional webhook authentication: when WEBHOOK_SECRET is configured,
      // only accept updates carrying the matching secret header that Telegram
      // sends (see setWebhook `secret_token`). Rejects forged POSTs with 401.
      if (env.WEBHOOK_SECRET) {
        const got = request.headers.get("x-telegram-bot-api-secret-token") || "";
        if (!timingSafeEqual(got, env.WEBHOOK_SECRET)) {
          return new Response("Unauthorized", { status: 401 });
        }
      }
      try {
        const update = await request.json();
        ctx.waitUntil(handleUpdate(update, env));
      } catch (e) {
        console.error("webhook json parse error:", e);
      }
      return new Response("OK", { status: 200 });
    }

    if (url.pathname === "/setWebhook" && request.method === "GET") {
      const webhookUrl = url.searchParams.get("url");
      if (!webhookUrl) return new Response("?url=https://.../webhook required", { status: 400 });
      // Optional: &secret_token=... registers a webhook secret with Telegram.
      // Telegram then sends it back as the X-Telegram-Bot-Api-Secret-Token
      // header on every update; it must match the WEBHOOK_SECRET worker secret.
      const secretToken = url.searchParams.get("secret_token");
      const target =
        `https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}` +
        (secretToken ? `&secret_token=${encodeURIComponent(secretToken)}` : "");
      const res = await fetch(target);
      const data = await res.json();
      return new Response(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json" } });
    }

    // Quick text-path check: GET /test-gemini?text=hello
    if (url.pathname === "/test-gemini" && request.method === "GET") {
      const text = url.searchParams.get("text") || "Say OK in English.";
      try {
        const reply = await callGeminiText([{ role: "user", parts: [{ text }] }], env);
        return new Response(reply, { status: 200 });
      } catch (e) {
        return new Response(`Gemini error: ${e.message}`, { status: 500 });
      }
    }

    return new Response("Not found", { status: 404 });
  },
};

/** Constant-time string comparison to avoid leaking the secret via timing. */
function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function handleUpdate(update, env) {
  const message = update.message;
  if (!message) return;

  const chatId = message.chat?.id;
  if (!chatId) return;

  const text = message.text?.trim();

  // Commands
  if (text === "/start") {
    await sendMessage(
      env,
      chatId,
      "Hi! I am your English voice-to-text assistant powered by Gemini.\n\n" +
        "Send me a voice message and I will automatically listen to it and reply with the English text.\n\n" +
        "Commands:\n" +
        "/start - show this intro\n" +
        "/help - show help"
    );
    return;
  }

  if (text === "/help") {
    await sendMessage(
      env,
      chatId,
      "How to use:\n" +
        "1. Record a voice message in any language and send it here.\n" +
        "2. I download the audio and send it to Gemini.\n" +
        "3. I reply with the transcription translated into clear English text.\n\n" +
        "Limits: audio up to 5 minutes and 15 MB. Supported: voice messages, audio files."
    );
    return;
  }

  // Detect audio payload: voice > audio > document-with-audio-mime
  const audioFile = pickAudioFile(message);

  // Plain text (no audio): guide user back to voice
  if (!audioFile) {
    if (text) {
      await sendMessage(
        env,
        chatId,
        "Please send a voice message - I convert voice to English text automatically. Text messages are not transcribed."
      );
      return;
    }
    // Photo, sticker, video, etc.
    await sendMessage(
      env,
      chatId,
      "I only understand voice messages. Please send a voice message and I will reply with the English text."
    );
    return;
  }

  // Audio path
  try {
    if (audioFile.duration && audioFile.duration > MAX_DURATION_SEC) {
      await sendMessage(
        env,
        chatId,
        "This voice message is too long. Please send audio shorter than 5 minutes."
      );
      return;
    }

    await sendChatAction(env, chatId, "typing");
    await sendMessage(env, chatId, "Listening... transcribing your voice to English text.");

    // 1. Resolve Telegram file path
    const fileInfo = await getTelegramFile(env, audioFile.file_id);
    if (!fileInfo.ok) {
      throw new Error(`Could not retrieve audio file from Telegram: ${fileInfo.description}`);
    }
    if (fileInfo.file_size && fileInfo.file_size > MAX_FILE_BYTES) {
      await sendMessage(
        env,
        chatId,
        "This audio file is too large. Please send a file smaller than 15 MB."
      );
      return;
    }

    // 2. Download audio bytes
    const audioBytes = await downloadTelegramFile(env, fileInfo.file_path);
    if (!audioBytes || audioBytes.byteLength === 0) {
      throw new Error("Downloaded audio is empty.");
    }
    if (audioBytes.byteLength > MAX_FILE_BYTES) {
      await sendMessage(
        env,
        chatId,
        "This audio file is too large. Please send a file smaller than 15 MB."
      );
      return;
    }

    // 3. Transcribe via Gemini
    const mimeType = detectMimeType(message, audioFile, fileInfo.file_path);
    const base64Audio = arrayBufferToBase64(audioBytes);
    const transcript = await callGeminiAudio(TRANSCRIBE_PROMPT, mimeType, base64Audio, env);

    if (!transcript || !transcript.trim()) {
      await sendMessage(env, chatId, "I could not hear any speech in this audio. Please try again with a clearer recording.");
      return;
    }

    // 4. Reply (split for Telegram 4096-char limit)
    await sendLongMessage(env, chatId, transcript.trim());
  } catch (err) {
    console.error("voice handleUpdate error:", err);
    await sendMessage(env, chatId, toFriendlyError(err));
  }
}

/** Prefer voice, then audio, then audio-like document. */
function pickAudioFile(message) {
  if (message.voice) {
    return { file_id: message.voice.file_id, duration: message.voice.duration };
  }
  if (message.audio) {
    return { file_id: message.audio.file_id, duration: message.audio.duration, mime_type: message.audio.mime_type };
  }
  const doc = message.document;
  if (doc && doc.mime_type && doc.mime_type.startsWith("audio/")) {
    return { file_id: doc.file_id, duration: null, mime_type: doc.mime_type };
  }
  return null;
}

function detectMimeType(message, audioFile, filePath) {
  if (audioFile.mime_type) return audioFile.mime_type;
  if (message.audio?.mime_type) return message.audio.mime_type;
  if (message.document?.mime_type) return message.document.mime_type;
  const lower = (filePath || "").toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mp3";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".aac")) return "audio/aac";
  if (lower.endsWith(".flac")) return "audio/flac";
  return "audio/ogg"; // Telegram voice messages are OGG/Opus
}

async function getTelegramFile(env, fileId) {
  const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const data = await res.json();
  if (!data.ok) return { ok: false, description: data.description || "getFile failed" };
  return {
    ok: true,
    file_path: data.result.file_path,
    file_size: data.result.file_size,
  };
}

async function downloadTelegramFile(env, filePath) {
  const res = await fetch(`https://api.telegram.org/file/bot${env.BOT_TOKEN}/${filePath}`);
  if (!res.ok) throw new Error(`Audio download failed with status ${res.status}.`);
  return await res.arrayBuffer();
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

async function callGeminiAudio(prompt, mimeType, base64Audio, env) {
  const contents = [
    {
      role: "user",
      parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64Audio } }],
    },
  ];
  const res = await callGeminiWithRetry(contents, env, 3);
  const data = await res.json();
  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n")?.trim() ||
    ""
  );
}

async function callGeminiText(contents, env) {
  const res = await callGeminiWithRetry(contents, env, 2);
  const data = await res.json();
  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
    "Empty response from the model."
  );
}

async function callGeminiWithRetry(contents, env, retries = 3) {
  const model = env.GEMINI_MODEL || "gemini-flash-lite-latest";
  if (!env.GEMINI_API_KEY || env.GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {
    throw new Error("CONFIG_MISSING_GEMINI_API_KEY");
  }
  for (let i = 0; i < retries; i++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify({ contents }),
      }
    );
    if (res.ok) return res;
    const errText = await res.text();
    console.error(`Gemini attempt ${i + 1} failed`, res.status, errText.slice(0, 500));
    if (errText.includes("quota") || errText.includes("Quota exceeded")) {
      throw new Error(`QUOTA_429: ${errText.slice(0, 400)}`);
    }
    if ([500, 502, 503].includes(res.status) && i < retries - 1) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
      continue;
    }
    if (res.status === 429 && i < retries - 1) {
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
      continue;
    }
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 400)}`);
  }
  throw new Error("Gemini request failed after retries.");
}

function toFriendlyError(err) {
  const msg = String(err?.message || err);
  if (msg.includes("CONFIG_MISSING_GEMINI_API_KEY")) {
    return "The transcription service is not configured yet. Please set GEMINI_API_KEY on the server.";
  }
  if (msg.includes("QUOTA_429") || msg.includes("quota") || msg.includes("Quota exceeded")) {
    return (
      "The free Gemini quota is exhausted (429). Please wait 1 minute and try again. " +
        "Check usage: https://ai.dev/rate-limit"
    );
  }
  if (msg.includes("503") || msg.includes("high demand")) {
    return "The Gemini model is busy right now (503). Please try again in 10 seconds.";
  }
  return `Transcription failed: ${msg.slice(0, 300)} Please try again.`;
}

function withWatermark(text) {
  if (text.includes(WATERMARK)) return text;
  return `${text}\n\n${WATERMARK}`;
}

async function sendMessage(env, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: withWatermark(text) }),
  });
  if (!res.ok) {
    console.error("sendMessage failed", await res.text());
  }
}

async function sendChatAction(env, chatId, action) {
  try {
    await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch (e) {
    console.error("sendChatAction failed:", e);
  }
}

async function sendLongMessage(env, chatId, text) {
  const watermarked = withWatermark(text);
  if (watermarked.length <= TELEGRAM_LIMIT) {
    await sendMessage(env, chatId, text);
    return;
  }
  let remaining = watermarked;
  while (remaining.length > 0) {
    let chunk = remaining.slice(0, TELEGRAM_LIMIT);
    if (remaining.length > TELEGRAM_LIMIT) {
      const lastBreak = Math.max(chunk.lastIndexOf("\n"), chunk.lastIndexOf(". "), chunk.lastIndexOf(" "));
      if (lastBreak > TELEGRAM_LIMIT - 500) {
        chunk = chunk.slice(0, lastBreak + 1);
      }
    }
    // Send raw chunk to avoid duplicating the watermark on every part;
    // the watermark is on the final part via the pre-split append above.
    const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: chunk }),
    });
    if (!res.ok) {
      console.error("sendMessage failed", await res.text());
    }
    remaining = remaining.slice(chunk.length);
  }
}
