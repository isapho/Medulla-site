// Tests for the interactive bot (telegram/assistant.mjs), the long-polling
// runner and the Cloudflare Worker. A fake `call` / fake Telegram server is
// used; nothing is sent. Run: node --test telegram/assistant.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";
import { createAssistant, commandList, langFrom, quizOrder, LANGS, dayOfYear, AREAS, areaOf } from "./assistant.mjs";
import { loadAll, makeCall, setup, deliverDue } from "./poll.mjs";
import { memoryStore, kvStore, clock, slotOf, DAILY_HOURS } from "./subscribers.mjs";

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

/* ------------------------------------------- brain map and daily fact */

// A fake Workers KV namespace (get / put with metadata / delete / list by prefix).
function fakeKV() {
  const m = new Map();
  return {
    m,
    async get(k) { return m.has(k) ? m.get(k).value : null; },
    async put(k, value, opts) { m.set(k, { value, metadata: opts && opts.metadata }); },
    async delete(k) { m.delete(k); },
    async list({ prefix = "", limit = 1000 }) {
      const all = [...m.keys()].filter((k) => k.startsWith(prefix)).sort();
      return { keys: all.slice(0, limit).map((name) => ({ name, metadata: m.get(name).metadata })), list_complete: all.length <= limit };
    }
  };
}
const texts = (calls) => calls.filter((c) => c.params && c.params.text).map((c) => c.params.text).join("\n---\n");

test("the menu matches the app: brain map and daily fact buttons", async () => {
  const { bot, calls } = harness();
  await bot.handleUpdate(msg("/start"));
  const data = allButtons(calls[0].params.reply_markup).map((b) => b.callback_data);
  assert.ok(data.includes("en:a"), "brain map");
  assert.ok(data.includes("en:s"), "daily fact");
});

test("the brain map has the site's five areas, each with its step and its checked 'why' fact", async () => {
  assert.deepEqual(AREAS.map((a) => a.id), ["learn", "move", "explore", "calm", "sleep"]);
  assert.deepEqual(AREAS.map((a) => a.char), ["memo", "octa", "dendi", "syno", "lumi"]);
  const site = readFileSync(new URL("../js/explore.js", import.meta.url), "utf8");
  for (const a of AREAS) assert.match(site, new RegExp(a.id + ': "' + a.fact + '"'), "same why-fact as js/explore.js");
  for (const lang of LANGS) {
    const { bot, calls } = harness();
    await bot.handleUpdate(msg("/map", { from: { language_code: lang } }));
    assert.equal(allButtons(calls[0].params.reply_markup).filter((b) => /:a:/.test(b.callback_data || "")).length, 5);
    for (const a of AREAS) {
      calls.length = 0;
      await bot.handleUpdate(cbq(lang + ":a:" + a.id));
      const shown = calls.find((c) => c.method === "editMessageText").params;
      assert.ok(shown.text.includes(strings[lang]["map.what." + a.id]), lang + " " + a.id);
      const why = allButtons(shown.reply_markup).find((b) => b.callback_data === lang + ":f:" + a.fact + ":o");
      assert.ok(why && facts.some((f) => f.id === a.fact), "why button for " + a.id);
      for (const b of allButtons(shown.reply_markup)) if (b.callback_data) assert.ok(Buffer.byteLength(b.callback_data) <= 64);
    }
  }
  // "another fact" in an area stays in that area
  const { bot, calls } = harness();
  await bot.handleUpdate(cbq("en:f:a-sleep"));
  const sent = calls.find((c) => c.method === "sendMessage").params.text;
  assert.ok(facts.filter((f) => f.character === "lumi").some((f) => sent.includes(f.title.en)));
});

test("facts name their area and character, and show the character picture", async () => {
  const { bot, calls } = harness({ assetBase: "https://raw.example/repo" });
  const f = facts.find((x) => x.character === "lumi" && x.id !== bot.today().id);
  await bot.handleUpdate(cbq("en:f:" + f.id + ":o"));
  const p = calls.find((c) => c.method === "sendMessage").params;
  assert.match(p.text, /🌙 Sleep · Lumi/);
  assert.ok(!p.text.includes(strings.en["bot.title"]), "only today's fact is called the fact of the day");
  assert.equal(p.link_preview_options.url, "https://raw.example/repo/assets/characters/lumi.png");
  calls.length = 0;
  await bot.handleUpdate(msg("/fact"));
  assert.ok(calls[0].params.text.startsWith("🧠 <b>" + strings.en["bot.title"] + "</b>"));
  assert.equal(areaOf({ character: "memo" }).id, "learn");
});

test("/daily without a store, or in a group, explains instead of subscribing", async () => {
  const off = harness();
  await off.bot.handleUpdate(msg("/daily"));
  assert.equal(off.calls[0].params.text, strings.en["bot.dailyUnavailable"]);
  const subs = memoryStore();
  const grp = harness({ subs });
  await grp.bot.handleUpdate(msg("/daily", { chat: { id: -100, type: "group" } }));
  await grp.bot.handleUpdate(cbq("en:s:8", { message_id: 5, chat: { id: -100, type: "group" }, text: "x" }));
  assert.match(texts(grp.calls), /private chat/);
  assert.deepEqual(subs.data, {}, "groups are never stored");
});

test("/daily: consent screen, pick a time, today's fact at once if the time has passed, /stop deletes", async () => {
  const subs = memoryStore();
  // the harness clock is 12:00 UTC = 17:00 in Tashkent
  const { bot, calls } = harness({ subs });
  await bot.handleUpdate(msg("/daily"));
  const ask = calls[0].params;
  assert.equal(ask.text, strings.en["bot.dailyAsk"]);
  assert.match(ask.text, /under 18/);
  assert.deepEqual(allButtons(ask.reply_markup).filter((b) => /:s:\d+$/.test(b.callback_data)).map((b) => b.callback_data), DAILY_HOURS.map((h) => "en:s:" + h));

  calls.length = 0;
  await bot.handleUpdate(cbq("en:s:8"));
  assert.deepEqual(subs.data[1], { h: 8, l: "en", last: "2027-03-15" });
  assert.match(calls.find((c) => c.method === "editMessageText").params.text, /08:00/);
  const daily = calls.filter((c) => c.method === "sendMessage");
  assert.equal(daily.length, 1, "08:00 has passed, so today's fact comes now");
  assert.ok(daily[0].params.text.includes(bot.today().title.en));
  assert.ok(daily[0].params.text.includes("/stop"));

  calls.length = 0;
  await bot.handleUpdate(cbq("en:s:18"));
  assert.equal(subs.data[1].h, 18);
  assert.equal(calls.filter((c) => c.method === "sendMessage").length, 0, "18:00 hasn't come yet");

  await bot.handleUpdate(cbq("en:s:99"));
  assert.equal(subs.data[1].h, 18, "only the offered hours are accepted");

  await bot.handleUpdate(cbq("ru:m:l")); // picked Russian from the language list
  assert.equal(subs.data[1].l, "ru");

  calls.length = 0;
  await bot.handleUpdate(msg("/daily"));
  assert.match(calls[0].params.text, /18:00/);
  assert.ok(allButtons(calls[0].params.reply_markup).some((b) => b.text.startsWith("✅") && b.callback_data === "en:s:18"));

  calls.length = 0;
  await bot.handleUpdate(msg("/stop"));
  assert.equal(calls[0].params.text, strings.en["bot.dailyOff"]);
  assert.deepEqual(subs.data, {});
  calls.length = 0;
  await bot.handleUpdate(msg("/stop"));
  assert.equal(calls[0].params.text, strings.en["bot.dailyNone"]);
});

test("subscribing inside the delivery hour never doubles today's fact", async () => {
  // chat 13 is in five-minute slot 1 (08:05–08:09)
  for (const [iso, now] of [["2027-03-15T03:02:00Z", false], ["2027-03-15T03:07:00Z", true]]) {
    const subs = memoryStore();
    const { bot, calls } = harness({ subs, now: () => new Date(iso) });
    await bot.handleUpdate(cbq("en:s:8", { message_id: 5, chat: { id: 13, type: "private" }, text: "x" }));
    assert.equal(calls.filter((c) => c.method === "sendMessage").length, now ? 1 : 0, iso);
    assert.equal(subs.data[13].last, now ? "2027-03-15" : null);
  }
});

test("a chat that blocked the bot is removed from the daily list", async () => {
  const subs = memoryStore({ 42: { h: 8, l: "uz", last: null } });
  const call = async () => { const e = new Error("sendMessage failed: 403 Forbidden: bot was blocked by the user"); e.code = 403; throw e; };
  const bot = createAssistant({ facts, glossary, strings, subs, call });
  assert.equal(await bot.sendDaily(42, "uz"), "gone");
  assert.deepEqual(subs.data, {});
  const other = memoryStore({ 7: { h: 8, l: "uz" } });
  const flaky = createAssistant({ facts, glossary, strings, subs: other, call: async () => { const e = new Error("500"); e.code = 500; throw e; } });
  await assert.rejects(flaky.sendDaily(7, "uz"));
  assert.ok(other.data[7], "other errors don't unsubscribe anyone");
});

test("long polling: everyone due today gets the fact once, and a late start catches up", async () => {
  const store = memoryStore({ 1: { h: 8, l: "en", last: null }, 2: { h: 13, l: "ru", last: null }, 3: { h: 18, l: "uz", last: null } });
  const { bot, calls } = harness({ subs: store });
  const at = (iso) => new Date(iso);
  assert.equal(await deliverDue({ bot, store, now: at("2027-03-15T02:30:00Z") }), 0, "07:30: nobody yet");
  assert.equal(await deliverDue({ bot, store, now: at("2027-03-15T09:00:00Z") }), 2, "14:00: the 08:00 and 13:00 people");
  assert.equal(await deliverDue({ bot, store, now: at("2027-03-15T09:01:00Z") }), 0, "never twice a day");
  assert.equal(await deliverDue({ bot, store, now: at("2027-03-15T13:00:00Z") }), 1, "18:00");
  assert.equal(await deliverDue({ bot, store, now: at("2027-03-16T03:00:00Z") }), 1, "next day 08:00");
  assert.equal(calls.filter((c) => c.method === "sendMessage").length, 4);
  assert.deepEqual(clock(at("2027-03-14T21:30:00Z")), { hour: 2, minute: 30, day: "2027-03-15" });
});

test("Worker cron: each five-minute run sends one slot of the hour, within the request limit", async () => {
  const KV = fakeKV();
  const store = kvStore(KV);
  for (let id = 1; id <= 60; id++) await store.set(id, { h: 8, l: LANGS[id % 3] });
  await store.set(500, { h: 13, l: "en" });
  await store.set(500, { h: 18, l: "en" }); // changing the time moves the delivery key
  assert.equal([...KV.m.keys()].filter((k) => k.startsWith("d:") && k.endsWith(":500")).length, 1);

  const { deliverBatch } = await import("./worker.mjs");
  const realFetch = globalThis.fetch;
  const sentTo = [];
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.startsWith("https://data.example/data/")) return new Response(readFileSync(new URL("../" + u.slice("https://data.example/".length), import.meta.url)), { status: 200 });
    if (u.endsWith("/sendMessage")) {
      const b = JSON.parse(init.body);
      sentTo.push(String(b.chat_id));
      if (String(b.chat_id) === "13") return new Response(JSON.stringify({ ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" }), { status: 403 });
    }
    return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 });
  };
  try {
    const env = { BOT_TOKEN: TOKEN, DATA_URL: "https://data.example", SUBS: KV, TELEGRAM_API: "https://tg.example", MAX_PER_RUN: "45" };
    assert.deepEqual(await deliverBatch(env, new Date("2027-03-15T02:05:00Z")), { sent: 0, gone: 0 }, "07:05 is not a delivery hour");
    let total = 0;
    for (let s = 0; s < 12; s++) {
      const r = await deliverBatch(env, new Date(Date.UTC(2027, 2, 15, 3, s * 5)));
      assert.ok(r.sent + r.gone <= 45);
      total += r.sent + r.gone;
    }
    assert.equal(total, 60, "each 08:00 subscriber exactly once in the hour");
    assert.equal(new Set(sentTo).size, 60);
    assert.ok(!sentTo.includes("500"), "the 18:00 subscriber waits");
    assert.equal(await store.get(13), null, "blocked chat removed");
    assert.equal(slotOf(13), 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});
