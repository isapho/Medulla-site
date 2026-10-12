#!/usr/bin/env node
/*
 * Run the interactive Medulla bot with long polling (Node 18+, no packages).
 * Good for trying it on a laptop or running it on any small server.
 *
 *   BOT_TOKEN=123:abc SITE_URL=https://medulla.uz node telegram/poll.mjs
 *   BOT_TOKEN=123:abc node telegram/poll.mjs --setup     set commands, descriptions and menu button, then exit
 *   node telegram/poll.mjs --demo "/word synapse"      print the reply to one message, no token needed
 *
 * Environment:
 *   BOT_TOKEN     from @BotFather (secret; never commit it)
 *   SITE_URL      optional, the public https address of the site (adds "Open Medulla" and links)
 *   TELEGRAM_API  optional, default https://api.telegram.org (tests use a mock)
 *
 * Long polling and a webhook can't run at the same time: this script removes
 * any webhook first. For a free always-on version, use telegram/worker.js.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadContent } from "./bot.mjs";
import { createAssistant, commandList, LANGS } from "./assistant.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

export function loadAll(root = ROOT) {
  const { facts, strings, config } = loadContent(root);
  const glossary = JSON.parse(readFileSync(path.join(root, "data/glossary.json"), "utf8")).terms || [];
  return { facts, strings, config, glossary };
}

export function makeCall({ api = "https://api.telegram.org", token, fetchImpl = fetch }) {
  const base = api.replace(/\/$/, "") + "/bot" + token + "/";
  return async function call(method, params) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetchImpl(base + method, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params || {}) });
      const data = await res.json().catch(() => ({}));
      if (data.ok) return data.result;
      const retry = data.parameters && data.parameters.retry_after;
      if ((res.status === 429 || res.status >= 500) && attempt < 3) { await new Promise((r) => setTimeout(r, (retry || attempt + 1) * 1000)); continue; }
      // The token is in the URL only; never print the URL.
      throw new Error(method + " failed: " + res.status + " " + (data.description || ""));
    }
  };
}

export async function setup({ call, strings, siteUrl }) {
  for (const lang of LANGS) {
    const t = (k) => (strings[lang] || {})[k] || (strings.en || {})[k] || k;
    await call("setMyCommands", { commands: commandList(strings, lang), language_code: lang });
    await call("setMyDescription", { description: t("bot.description").slice(0, 512), language_code: lang });
    await call("setMyShortDescription", { short_description: t("bot.shortDescription").slice(0, 120), language_code: lang });
  }
  await call("setMyCommands", { commands: commandList(strings, "uz") }); // default for every other language
  if (siteUrl && /^https:\/\//.test(siteUrl)) {
    await call("setChatMenuButton", { menu_button: { type: "web_app", text: "Medulla", web_app: { url: siteUrl.replace(/\/$/, "") + "/index.html" } } });
  }
}

export async function poll({ env = process.env, log = console.log, signal } = {}) {
  if (!env.BOT_TOKEN) throw new Error("BOT_TOKEN is not set");
  const { facts, strings, config, glossary } = loadAll();
  const siteUrl = env.SITE_URL || config.domain || null;
  const call = makeCall({ api: env.TELEGRAM_API, token: env.BOT_TOKEN });
  const bot = createAssistant({ facts, glossary, strings, siteUrl, call, canWait: true });
  await call("deleteWebhook", { drop_pending_updates: false });
  const me = await call("getMe", {});
  log("Medulla bot @" + me.username + " is running (long polling). Ctrl+C to stop.");
  let offset = 0;
  while (!(signal && signal.aborted)) {
    let updates = [];
    try {
      updates = await call("getUpdates", { offset, timeout: 30, allowed_updates: ["message", "callback_query", "inline_query"] });
    } catch (e) {
      log("getUpdates: " + e.message + " (retrying in 5 s)");
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    for (const u of updates) {
      offset = u.update_id + 1;
      // Handle each update on its own so one slow breathing minute doesn't block others.
      bot.handleUpdate(u).catch((e) => log("update " + u.update_id + ": " + e.message));
    }
  }
}

async function demo(text, lang = "en") {
  const { facts, strings, config, glossary } = loadAll();
  const sent = [];
  const call = async (method, params) => { sent.push({ method, params }); return { message_id: 1 }; };
  const bot = createAssistant({ facts, glossary, strings, siteUrl: config.domain || "https://example.org", call });
  await bot.handleUpdate({ update_id: 1, message: { message_id: 1, chat: { id: 1, type: "private" }, from: { language_code: lang }, text } });
  for (const s of sent) {
    console.log("→ " + s.method + "\n" + (s.params.text || s.params.question || ""));
    const kb = s.params.reply_markup && s.params.reply_markup.inline_keyboard;
    if (kb) console.log(kb.map((row) => row.map((b) => "[" + b.text + "]").join(" ")).join("\n"));
    if (s.params.options) console.log(s.params.options.map((o, i) => (i === s.params.correct_option_id ? "✓ " : "  ") + o.text).join("\n"));
    console.log("");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const run = async () => {
    if (args[0] === "--demo") return demo(args[1] || "/start", args[2] || "en");
    if (args.includes("--setup")) {
      if (!process.env.BOT_TOKEN) throw new Error("BOT_TOKEN is not set");
      const { strings, config } = loadAll();
      await setup({ call: makeCall({ api: process.env.TELEGRAM_API, token: process.env.BOT_TOKEN }), strings, siteUrl: process.env.SITE_URL || config.domain });
      console.log("Commands, descriptions and menu button are set.");
      return;
    }
    const ac = new AbortController();
    process.on("SIGINT", () => { ac.abort(); console.log("\nStopping…"); setTimeout(() => process.exit(0), 300); });
    return poll({ signal: ac.signal });
  };
  run().catch((e) => { console.error("Medulla bot: " + e.message); process.exit(1); });
}
