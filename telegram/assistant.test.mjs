// Tests for the interactive bot (telegram/assistant.mjs), the long-polling
// runner and the Cloudflare Worker. A fake `call` / fake Telegram server is
// used; nothing is sent. Run: node --test telegram/assistant.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";
import { createAssistant, commandList, langFrom, quizOrder, LANGS, dayOfYear } from "./assistant.mjs";
import { loadAll, makeCall, setup } from "./poll.mjs";

const { facts, strings, glossary } = loadAll();
const SITE = "https://medulla.example";

function harness(opts = {}) {
  const calls = [];
  const call = async (method, params) => { calls.push({ method, params }); return { message_id: 7, chat: { id: 1 } }; };
  const bot = createAssistant(Object.assign({ facts, glossary, strings, siteUrl: SITE, call, now: () => new Date("2027-03-15T12:00:00Z"), random: () => 0.42 }, opts));
  return { bot, calls };
}
const msg = (text, extra = {}) => ({ update_id: 1, message: Object.assign({ message_id: 1, chat: { id: 1, type: "private" }, from: { language_code: "en" }, text }, extra) });
const cbq = (data, message) => ({ update_id: 2, callback_query: { id: "q1", from: { language_code: "en" }, data, message: message || { message_id: 5, chat: { id: 1, type: "private" }, text: "old" } } });
function allButtons(markup) { return ((markup && markup.inline_keyboard) || []).flat(); }

test("language comes from Telegram's setting, Uzbek by default", () => {
  assert.equal(langFrom("ru"), "ru");
  assert.equal(langFrom("uz-Latn"), "uz");
  assert.equal(langFrom("en-GB"), "en");
  assert.equal(langFrom("de"), "uz");
  assert.equal(langFrom(undefined), "uz");
});

test("/start greets in the user's language with the menu and a Mini App button", async () => {
  const { bot, calls } = harness();
  await bot.handleUpdate(msg("/start", { from: { language_code: "ru" } }));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "sendMessage");
  assert.match(calls[0].params.text, /Привет/);
  const buttons = allButtons(calls[0].params.reply_markup);
  assert.ok(buttons.some((b) => b.web_app && b.web_app.url.startsWith(SITE)), "web_app button for an https site");
  assert.ok(buttons.length >= 7);
});

test("without an https site there is no Mini App button", async () => {
  const { bot, calls } = harness({ siteUrl: null });
  await bot.handleUpdate(msg("/start"));
  assert.ok(!allButtons(calls[0].params.reply_markup).some((b) => b.web_app || b.url));
});

test("/fact sends the same fact as the website for the day", async () => {
  const { bot, calls } = harness();
  await bot.handleUpdate(msg("/fact"));
  const expected = facts[dayOfYear(new Date("2027-03-15T12:00:00Z")) % facts.length];
  assert.ok(calls[0].params.text.includes(expected.title.en));
  assert.equal(calls[0].params.parse_mode, "HTML");
  assert.ok(calls[0].params.text.includes(expected.source.url));
});

test("every quiz becomes a valid Telegram quiz poll in every language", async () => {
  for (const lang of LANGS) {
    for (const f of facts.filter((x) => x.quiz)) {
      const { bot, calls } = harness();
      await bot.handleUpdate(cbq(lang + ":q:" + f.id));
      const poll = calls.find((c) => c.method === "sendPoll").params;
      assert.equal(poll.type, "quiz");
      assert.equal(poll.is_anonymous, true, "quizzes stay anonymous");
      assert.ok(poll.question.length <= 300);
      assert.ok(poll.explanation.length <= 200);
      assert.equal(poll.options.length, f.quiz.options.length);
      poll.options.forEach((o) => assert.ok(o.text.length >= 1 && o.text.length <= 100));
      // the marked option is the right answer
      assert.equal(poll.options[poll.correct_option_id].text.replace(/…$/, ""), f.quiz.options[f.quiz.answer][lang].slice(0, poll.options[poll.correct_option_id].text.replace(/…$/, "").length));
      assert.deepEqual(quizOrder(f).length, f.quiz.options.length);
    }
  }
});

test("detail/simple toggle edits the same message", async () => {
  const f = facts[0];
  const { bot, calls } = harness();
  await bot.handleUpdate(cbq("en:f:" + f.id + ":d"));
  assert.equal(calls[0].method, "answerCallbackQuery");
  assert.equal(calls[1].method, "editMessageText");
  assert.ok(calls[1].params.text.includes(f.detail.en.slice(0, 40)));
  const back = allButtons(calls[1].params.reply_markup).find((b) => b.callback_data && b.callback_data.endsWith(":s"));
  assert.ok(back, "a button goes back to the simple version");
});

test("callback data always fits Telegram's 64-byte limit", async () => {
  const { bot, calls } = harness();
  for (const f of facts) await bot.handleUpdate(cbq("uz:f:" + f.id + ":d"));
  await bot.handleUpdate(msg("/word"));
  await bot.handleUpdate(msg("/start"));
  for (const c of calls) for (const b of allButtons(c.params.reply_markup)) {
    if (b.callback_data) assert.ok(Buffer.byteLength(b.callback_data) <= 64, b.callback_data);
  }
});

test("hard words: lookup in all three languages, whole-word rules respected", () => {
  const { bot } = harness();
  assert.equal(bot.findTerm("synapse", "en").id, "synapse");
  assert.equal(bot.findTerm("синапс", "ru").id, "synapse");
  assert.equal(bot.findTerm("neyronlar", "uz").id, "neuron");
  assert.equal(bot.findTerm("Мозжечок", "ru").id, "cerebellum");
  assert.equal(bot.findTerm("REM", "en").id, "rem-sleep");
  assert.equal(bot.findTerm("remember", "en"), null, "REM is a whole word");
  assert.equal(bot.findTerm("qwerty", "en"), null);
});

test("/word with an unknown word offers words to pick", async () => {
  const { bot, calls } = harness();
  await bot.handleUpdate(msg("/word zzzz"));
  assert.match(calls[0].params.text, /zzzz/);
  assert.ok(allButtons(calls[0].params.reply_markup).filter((b) => /:w:/.test(b.callback_data || "")).length >= 4);
});

test("plain text in a private chat searches facts; in groups only commands are answered", async () => {
  const { bot, calls } = harness();
  await bot.handleUpdate(msg("sleep"));
  assert.ok(calls.length >= 1);
  const before = calls.length;
  await bot.handleUpdate(msg("sleep", { chat: { id: -100, type: "group" } }));
  assert.equal(calls.length, before, "no reply to ordinary group messages");
  await bot.handleUpdate(msg("/fact@medulla_bot", { chat: { id: -100, type: "group" } }));
  assert.equal(calls.length, before + 1, "commands work in groups");
});

test("inline mode returns up to 10 shareable facts", async () => {
  const { bot, calls } = harness();
  await bot.handleUpdate({ update_id: 3, inline_query: { id: "iq", from: { language_code: "uz" }, query: "uyqu" } });
  const r = calls[0].params;
  assert.equal(calls[0].method, "answerInlineQuery");
  assert.ok(r.results.length >= 1 && r.results.length <= 10);
  r.results.forEach((x) => { assert.equal(x.type, "article"); assert.equal(x.input_message_content.parse_mode, "HTML"); assert.ok(x.id.length <= 64); });
});

test("the guided breathing minute only runs where the process can wait", async () => {
  const noWait = harness();
  await noWait.bot.handleUpdate(msg("/breathe"));
  assert.ok(!allButtons(noWait.calls[0].params.reply_markup).some((b) => /:b:go$/.test(b.callback_data || "")));
  const waits = [];
  const yes = harness({ canWait: true, wait: async (ms) => { waits.push(ms); } });
  await yes.bot.handleUpdate(msg("/breathe"));
  assert.ok(allButtons(yes.calls[0].params.reply_markup).some((b) => /:b:go$/.test(b.callback_data || "")));
  await yes.bot.handleUpdate(cbq("en:b:go"));
  const edits = yes.calls.filter((c) => c.method === "editMessageText");
  assert.equal(edits.length, 13, "6 × (in + out) + done");
  assert.equal(waits.reduce((a, b) => a + b, 0), 60000, "one minute, 5 s in and 5 s out");
});

test("garbage updates are ignored without errors", async () => {
  const { bot, calls } = harness();
  for (const u of [null, {}, { message: {} }, { message: { chat: { id: 1 }, photo: [] } }, cbq("xx:zz")]) await bot.handleUpdate(u);
  assert.ok(calls.every((c) => c.method === "answerCallbackQuery"));
});

test("bot texts exist in every language and fit Telegram's limits", () => {
  const keys = Object.keys(strings.en).filter((k) => k.startsWith("bot."));
  for (const lang of LANGS) {
    for (const k of keys) assert.ok(strings[lang][k], lang + " " + k);
    assert.ok(strings[lang]["bot.shortDescription"].length <= 120, lang + " short description");
    assert.ok(strings[lang]["bot.description"].length <= 512, lang + " description");
    commandList(strings, lang).forEach((c) => { assert.match(c.command, /^[a-z_]{1,32}$/); assert.ok(c.description.length >= 1 && c.description.length <= 256); });
  }
  // the build publishes the same texts for the Worker
  const published = JSON.parse(readFileSync(new URL("../data/bot-strings.json", import.meta.url), "utf8"));
  for (const lang of LANGS) for (const k of keys) assert.equal(published[lang][k], strings[lang][k], "data/bot-strings.json is out of date: run node tools/build.js");
});

/* ------------------------------------------------- runner and Worker */

const TOKEN = "123456:TEST-TOKEN";
let server, api, seen = [];
before(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      seen.push({ url: req.url, body: JSON.parse(raw || "{}") });
      res.setHeader("Content-Type", "application/json");
      if (!req.url.startsWith("/bot" + TOKEN + "/")) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, description: "Unauthorized" })); }
      res.end(JSON.stringify({ ok: true, result: true }));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  api = "http://127.0.0.1:" + server.address().port;
});
after(() => server.close());

test("--setup registers commands and descriptions in uz, ru and en", async () => {
  seen = [];
  await setup({ call: makeCall({ api, token: TOKEN }), strings, siteUrl: SITE });
  const methods = seen.map((s) => s.url.split("/").pop());
  assert.equal(methods.filter((m) => m === "setMyCommands").length, 4);
  assert.deepEqual(seen.filter((s) => s.url.endsWith("setMyCommands") && s.body.language_code).map((s) => s.body.language_code).sort(), ["en", "ru", "uz"]);
  assert.ok(methods.includes("setChatMenuButton"));
});

test("errors never contain the bot token", async () => {
  const call = makeCall({ api, token: "999:WRONG" });
  await assert.rejects(call("getMe", {}), (e) => !e.message.includes("999:WRONG"));
});

test("the Worker rejects requests without the webhook secret and answers real updates", async () => {
  const { default: worker } = await import("./worker.mjs");
  const env = { BOT_TOKEN: TOKEN, WEBHOOK_SECRET: "s3cret", SITE_URL: SITE, TELEGRAM_API: api };
  const pending = [];
  const ctx = { waitUntil: (p) => pending.push(p) };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.startsWith(SITE + "/data/")) {
      const file = u.slice(SITE.length + 1);
      return new Response(readFileSync(new URL("../" + file, import.meta.url)), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return realFetch(url, init);
  };
  try {
    const bad = await worker.fetch(new Request("https://w.example/", { method: "POST", body: "{}" }), env, ctx);
    assert.equal(bad.status, 403);
    seen = [];
    const ok = await worker.fetch(new Request("https://w.example/", {
      method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": "s3cret", "Content-Type": "application/json" },
      body: JSON.stringify(msg("/word neuron").message ? { update_id: 9, message: msg("/word neuron").message } : {})
    }), env, ctx);
    assert.equal(ok.status, 200);
    await Promise.all(pending);
    const sent = seen.find((s) => s.url.endsWith("/sendMessage"));
    assert.ok(sent, "the Worker replied through the Bot API");
    assert.match(sent.body.text, /Neuron/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
