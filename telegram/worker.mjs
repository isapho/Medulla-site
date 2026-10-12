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
 * The Worker reads the facts, the glossary and the bot texts from the public
 * site (SITE_URL/data/…), so publishing the site also updates the bot.
 * Nothing is stored and nothing is logged.
 */
import { createAssistant } from "./assistant.mjs";

let cache = null; // { at, facts, glossary, strings }

async function content(siteUrl) {
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) return cache;
  const base = siteUrl.replace(/\/$/, "");
  const get = (p) => fetch(base + p, { cf: { cacheTtl: 600 } }).then((r) => { if (!r.ok) throw new Error(p + " " + r.status); return r.json(); });
  const [facts, glossary, strings] = await Promise.all([get("/data/facts.json"), get("/data/glossary.json"), get("/data/bot-strings.json")]);
  cache = { at: Date.now(), facts, glossary: glossary.terms || [], strings };
  return cache;
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") return new Response("Medulla bot is running.", { status: 200 });
    // Only Telegram knows the secret (set with setWebhook … &secret_token=).
    if (!env.WEBHOOK_SECRET || request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) {
      return new Response("forbidden", { status: 403 });
    }
    let update;
    try { update = await request.json(); } catch (e) { return new Response("bad request", { status: 400 }); }
    const api = (env.TELEGRAM_API || "https://api.telegram.org") + "/bot" + env.BOT_TOKEN + "/";
    const call = async (method, params) => {
      const res = await fetch(api + method, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params || {}) });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) throw new Error(method + " " + res.status);
      return data.result;
    };
    ctx.waitUntil((async () => {
      try {
        const c = await content(env.SITE_URL);
        const bot = createAssistant({ facts: c.facts, glossary: c.glossary, strings: c.strings, siteUrl: env.SITE_URL, call, canWait: false });
        await bot.handleUpdate(update);
      } catch (e) { /* nothing is logged on purpose: no user data leaves the request */ }
    })());
    return new Response("ok");
  }
};
