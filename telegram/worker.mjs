/*
 * Medulla bot as a Cloudflare Worker (free plan is enough): Telegram sends
 * each update to this URL (a webhook), the Worker answers and forgets it.
 *
 * Deploy (see telegram/BOT.md for every click):
 *   cd telegram && npx wrangler deploy
 *   npx wrangler secret put BOT_TOKEN
 *   npx wrangler secret put WEBHOOK_SECRET      (any long random string)
 *   SITE_URL is a plain variable in telegram/wrangler.toml
 * Then register the webhook once:
 *   https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://medulla-bot.<you>.workers.dev/&secret_token=<WEBHOOK_SECRET>&allowed_updates=["message","callback_query","inline_query"]
 *
 * The Worker reads the facts, the glossary and the bot texts from DATA_URL
 * (data/…), so publishing the site also updates the bot. Nothing is logged.
 *
 * Website sign-in and sync (telegram/auth.mjs): /auth/telegram, /auth/telegram-webapp,
 * /auth/google and /sync/*. Needs the AUTH_SECRET secret (any long random string);
 * Google also needs GOOGLE_CLIENT_ID in wrangler.toml. Progress is kept in the same
 * KV namespace (SUBS) under "p:<hash of the sync code>".
 *
 * Daily fact (optional): with a KV namespace bound as SUBS, people can turn on
 * /daily. A cron trigger runs every 5 minutes; in each delivery hour (08, 13,
 * 18 Tashkent time) each run sends today's fact to one twelfth of that hour's
 * subscribers, so a run stays under the free plan's 50 outgoing requests.
 */
import { createAssistant } from "./assistant.mjs";
import { kvStore, clock, DAILY_HOURS, SLOTS } from "./subscribers.mjs";
import { handleApi, issueLoginCode } from "./auth.mjs";

let cache = null; // { at, facts, glossary, strings }

async function content(dataUrl) {
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) return cache;
  const base = dataUrl.replace(/\/$/, "");
  const get = (p) => fetch(base + p, { cf: { cacheTtl: 600 } }).then((r) => { if (!r.ok) throw new Error(p + " " + r.status); return r.json(); });
  const [facts, glossary, strings] = await Promise.all([get("/data/facts.json"), get("/data/glossary.json"), get("/data/bot-strings.json")]);
  cache = { at: Date.now(), facts, glossary: glossary.terms || [], strings };
  return cache;
}

function callFor(env) {
  const api = (env.TELEGRAM_API || "https://api.telegram.org") + "/bot" + env.BOT_TOKEN + "/";
  return async (method, params) => {
    const res = await fetch(api + method, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params || {}) });
    const data = await res.json().catch(() => ({}));
    if (data.ok) return data.result;
    // The token is only in the URL, never in the error.
    const err = new Error(method + " " + res.status + " " + (data.description || ""));
    err.code = data.error_code || res.status;
    throw err;
  };
}

async function assistantFor(env) {
  // Content comes from DATA_URL (default: the site). Links and the Mini App
  // button use SITE_URL; leave it empty while the site is offline. Character
  // pictures come from SITE_URL, or else from DATA_URL (the public repository).
  const dataUrl = env.DATA_URL || env.SITE_URL;
  const c = await content(dataUrl);
  return createAssistant({
    facts: c.facts, glossary: c.glossary, strings: c.strings,
    siteUrl: env.SITE_URL || null, assetBase: env.SITE_URL || dataUrl,
    subs: env.SUBS ? kvStore(env.SUBS) : null,
    login: env.SUBS && env.AUTH_SECRET ? { issue: (userId, lang) => issueLoginCode(env.SUBS, userId, lang) } : null,
    call: callFor(env), canWait: false
  });
}

/* One cron run: the batch for this hour and five-minute slot. */
export async function deliverBatch(env, date = new Date()) {
  if (!env.SUBS || !env.BOT_TOKEN) return { sent: 0, gone: 0 };
  const { hour, minute } = clock(date);
  if (!DAILY_HOURS.includes(hour)) return { sent: 0, gone: 0 };
  const store = kvStore(env.SUBS);
  // 3 requests for the content + one per message must stay under 50 (free plan).
  const { list } = await store.due(hour, Math.floor(minute / 5) % SLOTS, Number(env.MAX_PER_RUN) || 45);
  if (!list.length) return { sent: 0, gone: 0 };
  const bot = await assistantFor(env);
  let sent = 0, gone = 0;
  for (const s of list) {
    try { (await bot.sendDaily(s.chatId, s.lang)) === "gone" ? gone++ : sent++; } catch (e) { /* try again tomorrow */ }
  }
  return { sent, gone };
}

export default {
  async fetch(request, env, ctx) {
    // Sign in with Telegram / Google and cloud sync for the website (telegram/auth.mjs).
    const path = new URL(request.url).pathname;
    if (path.startsWith("/auth/") || path.startsWith("/sync/")) {
      // After a Telegram sign-in the bot confirms it in the person's chat.
      const notify = env.BOT_TOKEN ? async (userId, lang) => {
        const c = await content(env.DATA_URL || env.SITE_URL);
        const l = ["uz", "ru", "en"].includes(String(lang).slice(0, 2)) ? String(lang).slice(0, 2) : "uz";
        const text = (c.strings[l] || {})["bot.loginDone"] || c.strings.en["bot.loginDone"];
        if (text) await callFor(env)("sendMessage", { chat_id: userId, text });
      } : null;
      return handleApi(request, env, path, { notify, after: (p) => ctx.waitUntil(p) });
    }
    if (request.method !== "POST") return new Response("Medulla bot is running.", { status: 200 });
    // Only Telegram knows the secret (set with setWebhook … &secret_token=).
    if (!env.WEBHOOK_SECRET || request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) {
      return new Response("forbidden", { status: 403 });
    }
    let update;
    try { update = await request.json(); } catch (e) { return new Response("bad request", { status: 400 }); }
    ctx.waitUntil((async () => {
      try {
        const bot = await assistantFor(env);
        await bot.handleUpdate(update);
      } catch (e) { /* nothing is logged on purpose: no user data leaves the request */ }
    })());
    return new Response("ok");
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(deliverBatch(env, new Date(event.scheduledTime)).catch(() => {}));
  }
};
