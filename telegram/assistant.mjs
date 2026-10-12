/*
 * Medulla Telegram assistant: the interactive bot (private chats, groups,
 * inline mode). No dependencies; runs in Node 18+ and in Cloudflare Workers.
 *
 *   const bot = createAssistant({ facts, glossary, strings, siteUrl, call });
 *   await bot.handleUpdate(update);
 *
 * `call(method, params)` sends one Bot API request and resolves with its
 * result. telegram/poll.mjs (long polling) and telegram/worker.js (webhook)
 * provide it; the tests use a fake one.
 *
 * Privacy: nothing is stored. The language comes from the button the person
 * pressed, or from Telegram's language_code at the moment they write. No
 * names, ids or messages are logged or kept. Quiz polls are anonymous.
 */

export const LANGS = ["uz", "ru", "en"];
const LANG_NAMES = { uz: "Oʻzbekcha", ru: "Русский", en: "English" };

export function escapeHtml(s) {
  return String(s === undefined || s === null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
const loc = (v, lang) => (v && typeof v === "object" ? v[lang] || v.en || v.uz : v);
const clip = (s, n) => (String(s).length <= n ? String(s) : String(s).slice(0, n - 1).replace(/\s+\S*$/, "") + "…");

export function langFrom(code) {
  const c = String(code || "").toLowerCase();
  if (c.startsWith("uz")) return "uz";
  if (c.startsWith("ru")) return "ru";
  if (c.startsWith("en")) return "en";
  return "uz";
}

/* The site and the channel show facts[dayOfYear % n] for the day in Tashkent. */
export function dayOfYear(date = new Date(), timeZone = "Asia/Tashkent") {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "numeric", day: "numeric" })
      .formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, Number(p.value)])
  );
  return Math.floor((Date.UTC(parts.year, parts.month - 1, parts.day) - Date.UTC(parts.year, 0, 0)) / 86400000);
}

// Same stable option order as the website (js/fact-template.js → quizOrder).
export function quizOrder(f) {
  let h = 0;
  for (let i = 0; i < f.id.length; i++) h = (h * 31 + f.id.charCodeAt(i)) >>> 0;
  const n = (f.quiz && f.quiz.options.length) || 0, order = [];
  for (let k = 0; k < n; k++) order.push((k + h) % n);
  return order;
}

function norm(s) {
  return String(s || "").toLowerCase().replace(/[ʻʼ‘’'`]/g, "ʻ").replace(/ё/g, "е");
}

export function createAssistant({ facts, glossary = [], strings, siteUrl = null, call, now = () => new Date(), random = Math.random, timeZone = "Asia/Tashkent", canWait = false, wait = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  if (!facts || !facts.length) throw new Error("createAssistant needs facts");
  const site = siteUrl ? String(siteUrl).replace(/\/$/, "") : null;
  const httpsSite = site && /^https:\/\//.test(site);

  function t(lang, key, vars) {
    let s = (strings[lang] || {})[key];
    if (s === undefined) s = (strings.en || {})[key];
    if (s === undefined) s = key;
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m)) : s;
  }
  const cb = (lang, ...parts) => [lang, ...parts].join(":").slice(0, 64);
  const btn = (text, data) => ({ text, callback_data: data });
  const pick = (list) => list[Math.floor(random() * list.length) % list.length];
  const factById = (id) => facts.find((f) => f.id === id);
  const today = () => facts[dayOfYear(now(), timeZone) % facts.length];
  const charName = (f) => f.character.charAt(0).toUpperCase() + f.character.slice(1);

  /* ---------------------------------------------------------- keyboards */

  function menuKeyboard(lang) {
    const rows = [
      [btn(t(lang, "bot.btn.today"), cb(lang, "f", "today")), btn(t(lang, "bot.btn.random"), cb(lang, "f", "rand"))],
      [btn(t(lang, "bot.btn.quiz"), cb(lang, "q", "rand")), btn(t(lang, "bot.btn.word"), cb(lang, "w"))],
      [btn(t(lang, "bot.btn.breathe"), cb(lang, "b")), btn(t(lang, "bot.btn.sleep"), cb(lang, "f", "sleep"))],
      [btn(t(lang, "bot.btn.lang"), cb(lang, "l"))]
    ];
    if (httpsSite) rows.push([{ text: t(lang, "bot.btn.app"), web_app: { url: site + "/index.html?lang=" + lang } }]);
    else if (site) rows.push([{ text: t(lang, "bot.btn.app"), url: site + "/index.html?lang=" + lang }]);
    return { inline_keyboard: rows };
  }
  const backRow = (lang) => [btn(t(lang, "bot.btn.menu"), cb(lang, "m"))];

  /* ------------------------------------------------------------ content */

  function factText(f, lang, level = "simple", withQuizSpoiler = false) {
    const lines = [
      "🧠 <b>" + escapeHtml(t(lang, "bot.title")) + "</b> · " + escapeHtml(charName(f)),
      "",
      "<b>" + escapeHtml(loc(f.title, lang)) + "</b>",
      "",
      escapeHtml(loc(level === "detail" ? f.detail : f.simple, lang))
    ];
    if (withQuizSpoiler && f.quiz) {
      lines.push("", "❓ " + escapeHtml(loc(f.quiz.q, lang)), escapeHtml(t(lang, "bot.answer")) + " <tg-spoiler>" + escapeHtml(loc(f.quiz.options[f.quiz.answer], lang)) + "</tg-spoiler>");
    }
    if (f.source && f.source.url) lines.push("", escapeHtml(t(lang, "common.source")) + ' <a href="' + escapeHtml(f.source.url) + '">' + escapeHtml(String(f.source.name).split(" — ")[0]) + "</a>");
    if (!f.reviewed) lines.push("⏳ <i>" + escapeHtml(t(lang, "common.pendingReview")) + "</i>");
    return lines.join("\n");
  }
  function factKeyboard(f, lang, level) {
    const rows = [
      [btn(level === "detail" ? t(lang, "bot.btn.simple") : t(lang, "bot.btn.detail"), cb(lang, "f", f.id, level === "detail" ? "s" : "d")),
        btn(t(lang, "bot.btn.quiz"), cb(lang, "q", f.id))],
      [btn(t(lang, "bot.btn.another"), cb(lang, "f", "rand"))]
    ];
    if (site) rows[1].push({ text: t(lang, "bot.btn.site"), url: site + "/facts/" + f.id + ".html?lang=" + lang });
    rows.push(backRow(lang));
    return { inline_keyboard: rows };
  }
  function termText(g, lang) {
    const lines = ["🔤 <b>" + escapeHtml(loc(g.term, lang)) + "</b>", "", escapeHtml(loc(g.def, lang))];
    if (g.source && g.source.url) lines.push("", escapeHtml(t(lang, "common.source")) + ' <a href="' + escapeHtml(g.source.url) + '">' + escapeHtml(String(g.source.name).split(" — ")[0]) + "</a>");
    if (!g.reviewed) lines.push("⏳ <i>" + escapeHtml(t(lang, "common.pendingReview")) + "</i>");
    return lines.join("\n");
  }
  function termKeyboard(g, lang) {
    const rows = [[btn(t(lang, "bot.btn.moreWords"), cb(lang, "w"))]];
    if (g && g.fact && factById(g.fact)) rows[0].push(btn(t(lang, "bot.btn.readFact"), cb(lang, "f", g.fact, "o")));
    if (site) rows.push([{ text: t(lang, "bot.btn.glossary"), url: site + "/glossary.html?lang=" + lang + (g ? "#" + g.id : "") }]);
    rows.push(backRow(lang));
    return { inline_keyboard: rows };
  }
  function wordPicker(lang) {
    const pool = glossary.slice();
    const chosen = [];
    while (pool.length && chosen.length < 8) chosen.push(pool.splice(Math.floor(random() * pool.length) % pool.length, 1)[0]);
    const rows = [];
    for (let i = 0; i < chosen.length; i += 2) rows.push(chosen.slice(i, i + 2).map((g) => btn(loc(g.term, lang), cb(lang, "w", g.id))));
    rows.push([btn(t(lang, "bot.btn.moreWords"), cb(lang, "w"))]);
    rows.push(backRow(lang));
    return { inline_keyboard: rows };
  }

  /* ------------------------------------------------------------- search */

  function findTerm(q, lang) {
    const n = norm(q).trim();
    if (!n) return null;
    for (const g of glossary) {
      const names = LANGS.map((l) => norm(loc(g.term, l)));
      if (names.includes(n)) return g;
    }
    for (const g of glossary) {
      const stems = [].concat(...LANGS.map((l) => (g.match && g.match[l]) || [])).map((s) => norm(s.replace(/^=/, "")));
      if (stems.some((s) => s && (n === s || (n.startsWith(s) && s.length >= 4) || (s.startsWith(n) && n.length >= 4)))) return g;
    }
    return null;
  }
  function searchFacts(q, lang) {
    const words = norm(q).split(/[^\p{L}\p{N}ʻ]+/u).filter((w) => w.length >= 3);
    if (!words.length) return [];
    const scored = facts.map((f) => {
      const hay = norm([loc(f.title, lang), loc(f.simple, lang), loc(f.detail, lang), f.topic].join(" "));
      const title = norm(loc(f.title, lang));
      let score = 0;
      words.forEach((w) => { if (hay.includes(w)) score += 1; if (title.includes(w)) score += 2; });
      return { f, score };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
    return scored.map((x) => x.f);
  }

  /* ------------------------------------------------------------ sending */

  const send = (chatId, text, markup, extra) => call("sendMessage", Object.assign({ chat_id: chatId, text, parse_mode: "HTML", link_preview_options: { is_disabled: true }, reply_markup: markup }, extra || {}));
  const edit = (msg, text, markup) => call("editMessageText", { chat_id: msg.chat.id, message_id: msg.message_id, text, parse_mode: "HTML", link_preview_options: { is_disabled: true }, reply_markup: markup });

  function sendFact(chatId, f, lang, level) { return send(chatId, factText(f, lang, level), factKeyboard(f, lang, level)); }

  function sendQuiz(chatId, f, lang) {
    if (!f.quiz) return sendFact(chatId, f, lang, "simple");
    const order = quizOrder(f);
    const options = order.map((i) => ({ text: clip(loc(f.quiz.options[i], lang), 100) }));
    const rows = [[btn(t(lang, "bot.btn.nextQuiz"), cb(lang, "q", "rand")), btn(t(lang, "bot.btn.readFact"), cb(lang, "f", f.id, "o"))], backRow(lang)];
    return call("sendPoll", {
      chat_id: chatId,
      question: clip(loc(f.quiz.q, lang), 300),
      options,
      type: "quiz",
      is_anonymous: true,
      correct_option_id: order.indexOf(f.quiz.answer),
      explanation: clip(loc(f.quiz.why, lang), 200),
      reply_markup: { inline_keyboard: rows }
    });
  }

  function breatheMarkup(lang) {
    const rows = [];
    if (canWait) rows.push([btn(t(lang, "bot.btn.start"), cb(lang, "b", "go"))]);
    if (httpsSite) rows.push([{ text: t(lang, "bot.btn.site"), web_app: { url: site + "/lab.html?lang=" + lang + "#breathing" } }]);
    else if (site) rows.push([{ text: t(lang, "bot.btn.site"), url: site + "/lab.html?lang=" + lang + "#breathing" }]);
    rows.push(backRow(lang));
    return { inline_keyboard: rows };
  }
  const breatheText = (lang) => "<b>" + escapeHtml(t(lang, "bot.breatheTitle")) + "</b>\n\n" + escapeHtml(t(lang, "bot.breatheSteps"));

  // Guided minute: only where the process can wait (long polling), never in a webhook.
  async function breatheGuided(msg, lang) {
    const bar = (n) => "●".repeat(n) + "○".repeat(5 - n);
    for (let round = 1; round <= 6; round++) {
      await edit(msg, "🌬 <b>" + escapeHtml(t(lang, "bot.breatheIn")) + "</b>\n" + bar(5) + "\n\n" + round + " / 6", undefined);
      await wait(5000);
      await edit(msg, "🌬 <b>" + escapeHtml(t(lang, "bot.breatheOut")) + "</b>\n" + bar(0) + "\n\n" + round + " / 6", undefined);
      await wait(5000);
    }
    await edit(msg, "💜 " + escapeHtml(t(lang, "bot.breatheDone")), { inline_keyboard: [backRow(lang)] });
  }

  function langKeyboard() {
    return { inline_keyboard: [LANGS.map((l) => btn(LANG_NAMES[l], cb(l, "m")))] };
  }
  const welcome = (lang) => escapeHtml(t(lang, "bot.hello")) + "\n\n" + escapeHtml(t(lang, "bot.menuTitle"));

  /* ----------------------------------------------------------- handlers */

  async function onCommand(msg, cmd, arg, lang) {
    const chatId = msg.chat.id;
    switch (cmd) {
      case "start": {
        // Deep links: t.me/<bot>?start=fact_<id> | word_<id> | quiz | ru / en / uz
        const m = /^(fact|word|quiz)_?([a-z0-9-]*)$/.exec(arg || "");
        if (LANGS.includes(arg)) lang = arg;
        if (m && m[1] === "fact" && factById(m[2])) return sendFact(chatId, factById(m[2]), lang, "simple");
        if (m && m[1] === "word") { const g = glossary.find((x) => x.id === m[2]); if (g) return send(chatId, termText(g, lang), termKeyboard(g, lang)); }
        if (m && m[1] === "quiz") return sendQuiz(chatId, pick(facts.filter((f) => f.quiz)), lang);
        return send(chatId, welcome(lang), menuKeyboard(lang));
      }
      case "menu": return send(chatId, welcome(lang), menuKeyboard(lang));
      case "fact": case "today": return sendFact(chatId, today(), lang, "simple");
      case "random": return sendFact(chatId, pick(facts), lang, "simple");
      case "sleep": return sendFact(chatId, pick(facts.filter((f) => f.topic === "sleep")), lang, "simple");
      case "quiz": return sendQuiz(chatId, pick(facts.filter((f) => f.quiz)), lang);
      case "word": case "words": {
        if (arg) {
          const g = findTerm(arg, lang);
          if (g) return send(chatId, termText(g, lang), termKeyboard(g, lang));
          return send(chatId, escapeHtml(t(lang, "bot.wordNone", { q: clip(arg, 40) })), wordPicker(lang));
        }
        return send(chatId, escapeHtml(t(lang, "bot.wordPick")), wordPicker(lang));
      }
      case "breathe": return send(chatId, breatheText(lang), breatheMarkup(lang));
      case "lang": case "language": return send(chatId, escapeHtml(t(lang, "bot.langPick")), langKeyboard());
      case "help": return send(chatId, escapeHtml(t(lang, "bot.help")), menuKeyboard(lang));
      case "about": return send(chatId, escapeHtml(t(lang, "bot.about")), menuKeyboard(lang));
      case "privacy": return send(chatId, escapeHtml(t(lang, "bot.privacy")), { inline_keyboard: [backRow(lang)] });
      default: return send(chatId, escapeHtml(t(lang, "bot.help")), menuKeyboard(lang));
    }
  }

  async function onText(msg, lang) {
    const text = String(msg.text || "").trim();
    const g = findTerm(text, lang);
    if (g) return send(msg.chat.id, termText(g, lang), termKeyboard(g, lang));
    const found = searchFacts(text, lang);
    if (found.length) {
      await send(msg.chat.id, escapeHtml(t(lang, "bot.found")));
      return sendFact(msg.chat.id, found[0], lang, "simple");
    }
    return send(msg.chat.id, escapeHtml(t(lang, "bot.searchNone")), menuKeyboard(lang));
  }

  async function onCallback(q) {
    const msg = q.message;
    const [rawLang, action, a1, a2] = String(q.data || "").split(":");
    const lang = LANGS.includes(rawLang) ? rawLang : langFrom(q.from && q.from.language_code);
    await call("answerCallbackQuery", { callback_query_id: q.id }).catch(() => {});
    if (!msg) return null;
    const chatId = msg.chat.id;
    const canEdit = msg.text !== undefined; // polls can't be edited into text
    switch (action) {
      case "m": return canEdit ? edit(msg, welcome(lang), menuKeyboard(lang)) : send(chatId, welcome(lang), menuKeyboard(lang));
      case "l": return canEdit ? edit(msg, escapeHtml(t(lang, "bot.langPick")), langKeyboard()) : send(chatId, escapeHtml(t(lang, "bot.langPick")), langKeyboard());
      case "f": {
        const f = a1 === "today" ? today() : a1 === "rand" ? pick(facts) : a1 === "sleep" ? pick(facts.filter((x) => x.topic === "sleep")) : factById(a1);
        if (!f) return null;
        const level = a2 === "d" ? "detail" : "simple";
        // Toggling detail/simple edits the same message; anything else sends a new one.
        if ((a2 === "d" || a2 === "s") && canEdit && factById(a1)) return edit(msg, factText(f, lang, level), factKeyboard(f, lang, level));
        return sendFact(chatId, f, lang, level);
      }
      case "q": return sendQuiz(chatId, a1 && a1 !== "rand" && factById(a1) ? factById(a1) : pick(facts.filter((f) => f.quiz)), lang);
      case "w": {
        if (a1) { const g = glossary.find((x) => x.id === a1); if (g) return send(chatId, termText(g, lang), termKeyboard(g, lang)); }
        return canEdit ? edit(msg, escapeHtml(t(lang, "bot.wordPick")), wordPicker(lang)) : send(chatId, escapeHtml(t(lang, "bot.wordPick")), wordPicker(lang));
      }
      case "b": {
        if (a1 === "go" && canWait && canEdit) return breatheGuided(msg, lang);
        return send(chatId, breatheText(lang), breatheMarkup(lang));
      }
      default: return null;
    }
  }

  function onInline(iq) {
    const lang = langFrom(iq.from && iq.from.language_code);
    const q = String(iq.query || "").trim();
    let list = q ? searchFacts(q, lang) : [today()].concat(facts.filter((f) => f.id !== today().id).slice(0, 9));
    if (!list.length) list = [today()];
    const results = list.slice(0, 10).map((f) => {
      const r = {
        type: "article",
        id: (f.id + "-" + lang).slice(0, 64),
        title: loc(f.title, lang),
        description: clip(loc(f.simple, lang), 120),
        input_message_content: { message_text: factText(f, lang, "simple", true), parse_mode: "HTML", link_preview_options: { is_disabled: true } }
      };
      if (site) r.reply_markup = { inline_keyboard: [[{ text: t(lang, "bot.more"), url: site + "/facts/" + f.id + ".html?lang=" + lang }]] };
      if (httpsSite) r.thumbnail_url = site + "/assets/characters/" + f.character + ".png";
      return r;
    });
    return call("answerInlineQuery", { inline_query_id: iq.id, results, cache_time: 300, is_personal: false });
  }

  async function handleUpdate(update) {
    if (!update || typeof update !== "object") return null;
    if (update.callback_query) return onCallback(update.callback_query);
    if (update.inline_query) return onInline(update.inline_query);
    const msg = update.message || update.edited_message;
    if (!msg || !msg.chat || typeof msg.text !== "string") return null;
    const lang = langFrom(msg.from && msg.from.language_code);
    const m = /^\/([a-z_]+)(?:@(\w+))?(?:\s+([\s\S]+))?$/i.exec(msg.text.trim());
    const isPrivate = msg.chat.type === "private";
    if (m) return onCommand(msg, m[1].toLowerCase(), (m[3] || "").trim(), lang);
    if (!isPrivate) return null; // in groups, only answer commands
    return onText(msg, lang);
  }

  return { handleUpdate, factText, findTerm, searchFacts, today, menuKeyboard };
}

/* Commands shown in Telegram's menu, per language. */
export function commandList(strings, lang) {
  const t = (k) => ((strings[lang] || {})[k] !== undefined ? strings[lang][k] : (strings.en || {})[k] || k);
  return ["fact", "random", "quiz", "word", "breathe", "sleep", "lang", "help", "privacy"].map((c) => ({ command: c, description: t("bot.cmd." + c) }));
}
