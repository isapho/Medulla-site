#!/usr/bin/env node
/*
 * Medulla daily-fact bot for a Telegram channel (Node 18+, no dependencies).
 *
 * Posts today's fact (the same one the website shows) in Uzbek, Russian and
 * English. Run once a day, e.g. by .github/workflows/daily-fact.yml.
 *
 *   node telegram/bot.mjs --dry-run            print today's posts, send nothing
 *   node telegram/bot.mjs --dry-run --date=2027-03-15 --lang=ru
 *   BOT_TOKEN=... CHANNEL_ID=@medulla_mind node telegram/bot.mjs
 *
 * Environment:
 *   BOT_TOKEN      token from @BotFather (keep it secret; never commit it)
 *   CHANNEL_ID     channel for every language, e.g. "@medulla_mind" or "-100123…"
 *   CHANNEL_ID_UZ / CHANNEL_ID_RU / CHANNEL_ID_EN
 *                  optional: one channel per language (overrides CHANNEL_ID)
 *   LANGS          optional, default "uz,ru,en"
 *   SITE_URL       optional, e.g. "https://medulla.uz" → adds a "Read the full fact" button
 *   TZ_NAME        optional, default "Asia/Tashkent": which calendar day counts as "today"
 *   TELEGRAM_API   optional, default "https://api.telegram.org" (tests point it at a mock)
 *
 * The bot must be an administrator of the channel with "Post messages" rights.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import vm from "node:vm";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

/* ------------------------------------------------------------- content */

export function loadContent(root = ROOT) {
  const sandbox = { window: {}, document: { body: null } };
  const run = (file) => vm.runInNewContext(readFileSync(path.join(root, file), "utf8"), sandbox, { filename: file });
  run("js/config.js");
  run("js/i18n.js");
  const I18N = sandbox.window.MEDULLA_I18N;
  I18N.languages.forEach((l) => run("js/lang/" + l.code + ".js"));
  const facts = JSON.parse(readFileSync(path.join(root, "data/facts.json"), "utf8"));
  return { facts, strings: I18N.strings, config: sandbox.window.MEDULLA_CONFIG };
}

/* The website picks facts[dayOfYear % facts.length] using the visitor's local
   calendar day (js/main.js → todayIndex). The bot uses the same rule for the
   calendar day in TZ_NAME, so the channel and the site show the same fact. */
export function dayOfYear(date = new Date(), timeZone = "Asia/Tashkent") {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "numeric", day: "numeric" })
      .formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, Number(p.value)])
  );
  return Math.floor((Date.UTC(parts.year, parts.month - 1, parts.day) - Date.UTC(parts.year, 0, 0)) / 86400000);
}

export function pickFact(facts, date, timeZone) {
  return facts[dayOfYear(date, timeZone) % facts.length];
}

export function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const loc = (v, lang) => (v && typeof v === "object" ? v[lang] || v.en : v);

export function buildMessage(fact, lang, { strings, siteUrl } = {}) {
  const t = (key, vars) => {
    let s = (strings[lang] || {})[key];
    if (s === undefined) s = (strings.en || {})[key];
    if (s === undefined) s = key;
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m)) : s;
  };
  const name = fact.character.charAt(0).toUpperCase() + fact.character.slice(1); // Dendi, Memo, Octa, Syno, Lumi
  const lines = [
    "🧠 <b>" + escapeHtml(t("bot.title")) + "</b> · " + escapeHtml(name),
    "",
    "<b>" + escapeHtml(loc(fact.title, lang)) + "</b>",
    "",
    escapeHtml(loc(fact.simple, lang))
  ];
  if (fact.quiz) {
    const answer = loc(fact.quiz.options[fact.quiz.answer], lang);
    lines.push(
      "",
      "❓ " + escapeHtml(loc(fact.quiz.q, lang)),
      escapeHtml(t("bot.answer")) + " <tg-spoiler>" + escapeHtml(answer) + "</tg-spoiler>"
    );
  }
  if (fact.source && fact.source.url) {
    lines.push("", escapeHtml(t("common.source")) + ' <a href="' + escapeHtml(fact.source.url) + '">' + escapeHtml(fact.source.name.split(" — ")[0]) + "</a>");
  }
  if (!fact.reviewed) lines.push("⏳ <i>" + escapeHtml(t("common.pendingReview")) + "</i>");
  lines.push("", "#Medulla #" + escapeHtml(t("bot.hashtag")));

  const body = { text: lines.join("\n"), parse_mode: "HTML", link_preview_options: { is_disabled: true } };
  if (siteUrl) {
    const url = siteUrl.replace(/\/$/, "") + "/facts/" + fact.id + ".html";
    body.reply_markup = { inline_keyboard: [[{ text: t("bot.more"), url }]] };
  }
  return body;
}

/* ------------------------------------------------------------- sending */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function sendMessage({ api, token, chatId, body, fetchImpl = fetch, maxRetries = 3 }) {
  const url = api.replace(/\/$/, "") + "/bot" + token + "/sendMessage";
  for (let attempt = 0; ; attempt++) {
    let res, data;
    try {
      res = await fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, ...body }) });
      data = await res.json().catch(() => ({}));
    } catch (e) {
      if (attempt >= maxRetries) throw new Error("network error: " + e.message);
      await sleep(1000 * (attempt + 1));
      continue;
    }
    if (data.ok) return data.result;
    const retry = data.parameters && data.parameters.retry_after;
    if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
      await sleep(retry ? retry * 1000 : 1000 * (attempt + 1));
      continue;
    }
    // Never echo the token: the URL is not part of the message.
    throw new Error("Telegram error " + res.status + ": " + (data.description || "unknown"));
  }
}

export function channelsFor(langs, env) {
  return langs.map((lang) => ({ lang, chatId: env["CHANNEL_ID_" + lang.toUpperCase()] || env.CHANNEL_ID || null }));
}

export async function run({ argv = process.argv.slice(2), env = process.env, log = console.log, fetchImpl = fetch, root = ROOT } = {}) {
  const arg = (name) => { const a = argv.find((x) => x.startsWith("--" + name + "=")); return a ? a.split("=").slice(1).join("=") : null; };
  const dryRun = argv.includes("--dry-run");
  const date = arg("date") ? new Date(arg("date") + "T12:00:00Z") : new Date();
  if (isNaN(date)) throw new Error("--date must look like 2027-03-15");
  const langs = (arg("lang") || env.LANGS || "uz,ru,en").split(",").map((s) => s.trim()).filter(Boolean);
  const timeZone = env.TZ_NAME || "Asia/Tashkent";

  const { facts, strings, config } = loadContent(root);
  const siteUrl = env.SITE_URL || config.domain || null;
  const fact = pickFact(facts, date, timeZone);
  const targets = channelsFor(langs, env);

  if (!dryRun) {
    if (!env.BOT_TOKEN) throw new Error("BOT_TOKEN is not set (or use --dry-run)");
    const missing = targets.filter((x) => !x.chatId).map((x) => x.lang);
    if (missing.length) throw new Error("No channel for: " + missing.join(", ") + ". Set CHANNEL_ID or CHANNEL_ID_<LANG>.");
  }

  log("Fact of the day: " + fact.id + " (day " + dayOfYear(date, timeZone) + ", " + timeZone + ")");
  const sent = [];
  for (const { lang, chatId } of targets) {
    const body = buildMessage(fact, lang, { strings, siteUrl });
    if (dryRun) {
      log("\n--- " + lang + " → " + (chatId || "(no channel set)") + " ---\n" + body.text + (body.reply_markup ? "\n[" + body.reply_markup.inline_keyboard[0][0].text + "] " + body.reply_markup.inline_keyboard[0][0].url : ""));
      continue;
    }
    const result = await sendMessage({ api: env.TELEGRAM_API || "https://api.telegram.org", token: env.BOT_TOKEN, chatId, body, fetchImpl });
    sent.push({ lang, chatId, messageId: result && result.message_id });
    log("Posted " + lang + " to " + chatId + " (message " + (result && result.message_id) + ")");
  }
  return { fact: fact.id, sent };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((e) => { console.error("Medulla bot: " + e.message); process.exit(1); });
}
