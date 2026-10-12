// Tests for the daily-fact bot against a mock Telegram server.
// Run: node --test telegram/
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { run, buildMessage, dayOfYear, pickFact, escapeHtml, loadContent, sendMessage } from "./bot.mjs";

const content = loadContent();
const TOKEN = "123456:TEST-TOKEN";

// A tiny fake of https://api.telegram.org/bot<token>/sendMessage
let server, api, calls = [], behaviour = "ok";
before(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw || "{}");
      calls.push({ url: req.url, body });
      res.setHeader("Content-Type", "application/json");
      if (!req.url.startsWith("/bot" + TOKEN + "/")) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error_code: 401, description: "Unauthorized" })); }
      if (behaviour === "flood" && calls.length === 1) { res.statusCode = 429; return res.end(JSON.stringify({ ok: false, error_code: 429, description: "Too Many Requests: retry after 1", parameters: { retry_after: 1 } })); }
      if (behaviour === "forbidden") { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error_code: 403, description: "Forbidden: bot is not a member of the channel chat" })); }
      res.end(JSON.stringify({ ok: true, result: { message_id: calls.length, chat: { id: body.chat_id } } }));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  api = "http://127.0.0.1:" + server.address().port;
});
after(() => server.close());
const reset = (b = "ok") => { calls = []; behaviour = b; };
const quiet = () => {};

test("picks the same fact as the website for a given day", () => {
  // 2027-03-15 is day 74 of the year; the site uses facts[day % facts.length].
  const date = new Date("2027-03-15T12:00:00Z");
  assert.equal(dayOfYear(date, "Asia/Tashkent"), 74);
  assert.equal(pickFact(content.facts, date, "Asia/Tashkent").id, content.facts[74 % content.facts.length].id);
  // 21:00 UTC on 14 March is already 15 March in Tashkent (UTC+5).
  assert.equal(dayOfYear(new Date("2027-03-14T21:00:00Z"), "Asia/Tashkent"), 74);
  assert.equal(dayOfYear(new Date("2027-03-14T21:00:00Z"), "UTC"), 73);
});

test("builds a message in each language, escaped, labelled pending review", () => {
  const fact = { ...content.facts[0], title: { uz: "A <b> & B", ru: "Р", en: "E" } };
  for (const lang of ["uz", "ru", "en"]) {
    const m = buildMessage(fact, lang, { strings: content.strings, siteUrl: "https://example.org/" });
    assert.equal(m.parse_mode, "HTML");
    assert.ok(m.text.includes(content.strings[lang]["bot.title"]));
    assert.ok(m.text.includes(content.strings[lang]["common.pendingReview"]));
    assert.ok(m.text.includes("<tg-spoiler>"));
    assert.ok(m.text.length < 4096, "Telegram's limit is 4096 characters");
    assert.equal(m.reply_markup.inline_keyboard[0][0].url, "https://example.org/facts/" + fact.id + ".html");
    assert.equal(m.reply_markup.inline_keyboard[0][0].text, content.strings[lang]["bot.more"]);
  }
  const uz = buildMessage(fact, "uz", { strings: content.strings });
  assert.ok(uz.text.includes("A &lt;b&gt; &amp; B"));
  assert.equal(uz.reply_markup, undefined, "no button without SITE_URL");
  assert.equal(escapeHtml("<a&b>"), "&lt;a&amp;b&gt;");
});

test("every fact fits in one Telegram message in every language", () => {
  for (const f of content.facts) for (const lang of ["uz", "ru", "en"]) {
    assert.ok(buildMessage(f, lang, { strings: content.strings }).text.length < 4096, f.id + " " + lang);
  }
});

test("--dry-run prints three posts and sends nothing", async () => {
  reset();
  const out = [];
  await run({ argv: ["--dry-run", "--date=2027-03-15"], env: { TELEGRAM_API: api }, log: (s) => out.push(s) });
  assert.equal(calls.length, 0);
  const text = out.join("\n");
  for (const lang of ["uz", "ru", "en"]) assert.ok(text.includes("--- " + lang), lang);
});

test("posts uz, ru and en to one channel", async () => {
  reset();
  const r = await run({ argv: ["--date=2027-03-15"], env: { BOT_TOKEN: TOKEN, CHANNEL_ID: "@medulla_test", TELEGRAM_API: api, SITE_URL: "https://example.org" }, log: quiet });
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map((c) => c.body.chat_id), ["@medulla_test", "@medulla_test", "@medulla_test"]);
  assert.ok(calls.every((c) => c.url === "/bot" + TOKEN + "/sendMessage"));
  assert.ok(calls[1].body.text.includes(content.strings.ru["bot.title"]));
  assert.equal(r.sent.length, 3);
});

test("per-language channels override CHANNEL_ID", async () => {
  reset();
  await run({ argv: ["--date=2027-03-15"], env: { BOT_TOKEN: TOKEN, CHANNEL_ID: "@all", CHANNEL_ID_RU: "@ru_only", TELEGRAM_API: api }, log: quiet });
  assert.deepEqual(calls.map((c) => c.body.chat_id), ["@all", "@ru_only", "@all"]);
});

test("waits and retries when Telegram says 429 Too Many Requests", async () => {
  reset("flood");
  const started = Date.now();
  await run({ argv: ["--date=2027-03-15", "--lang=en"], env: { BOT_TOKEN: TOKEN, CHANNEL_ID: "@c", TELEGRAM_API: api }, log: quiet });
  assert.equal(calls.length, 2);
  assert.ok(Date.now() - started >= 900, "respects retry_after");
});

test("fails clearly, without leaking the token, when the bot is not a channel admin", async () => {
  reset("forbidden");
  await assert.rejects(
    run({ argv: ["--lang=en"], env: { BOT_TOKEN: TOKEN, CHANNEL_ID: "@c", TELEGRAM_API: api }, log: quiet }),
    (e) => /403/.test(e.message) && /not a member/.test(e.message) && !e.message.includes(TOKEN)
  );
});

test("refuses to run without a token or channel, before any request", async () => {
  reset();
  await assert.rejects(run({ argv: [], env: { CHANNEL_ID: "@c", TELEGRAM_API: api }, log: quiet }), /BOT_TOKEN/);
  await assert.rejects(run({ argv: [], env: { BOT_TOKEN: TOKEN, TELEGRAM_API: api }, log: quiet }), /No channel/);
  assert.equal(calls.length, 0);
});

test("a wrong token is reported as 401", async () => {
  reset();
  await assert.rejects(sendMessage({ api, token: "bad", chatId: "@c", body: { text: "x" }, maxRetries: 0 }), /401/);
});
