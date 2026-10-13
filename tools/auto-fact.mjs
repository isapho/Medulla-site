#!/usr/bin/env node
/*
 * Adds 1–2 new, sourced facts to data/facts.json, fully automatically.
 * Run daily by .github/workflows/auto-fact.yml; can be run by hand too.
 *
 *   node tools/auto-fact.mjs --dry-run         print what would be added, change nothing
 *   node tools/auto-fact.mjs --count=2         add up to 2 facts (default 1, maximum 2)
 *
 * Needs: ANTHROPIC_API_KEY and `npm install @anthropic-ai/sdk` (the workflow
 * does both; the site itself still has no packages).
 *
 * How a fact is made, and why it can be trusted more than "just ask a model":
 *   1. SEARCH: Claude uses web search restricted to ALLOWED_DOMAINS (NHS, WHO,
 *      NIH institutes, …) to find one page about a new, teen-relevant topic.
 *   2. FETCH: this script downloads that page itself.
 *   3. WRITE: Claude writes the fact (uz/ru/en, quiz) from THAT page's text
 *      only, and must copy one exact sentence from the page as evidence.
 *   4. CHECK (code): the evidence sentence must appear in the page; the
 *      source host must be allowed; ids, titles and sources can't repeat;
 *      lengths must fit Telegram (quiz poll limits); the schema must pass.
 *   5. CHECK (second, independent model call): "does the page support every
 *      statement?" Any doubt → the fact is thrown away.
 *   6. `node tools/build.js --check` must still pass, or facts.json is restored.
 * Published facts carry reviewed:false, so the site and bot keep showing
 * "Pending expert review" until a person sets reviewed:true.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FACTS = path.join(ROOT, "data/facts.json");
const MODEL = process.env.FACT_MODEL || "claude-opus-5-5";

export const ALLOWED_DOMAINS = [
  "nhs.uk", "who.int", "medlineplus.gov", "cdc.gov",
  "ninds.nih.gov", "nhlbi.nih.gov", "nimh.nih.gov", "nei.nih.gov", "nia.nih.gov", "nichd.nih.gov", "nccih.nih.gov",
  "nih.gov", "pubmed.ncbi.nlm.nih.gov", "pmc.ncbi.nlm.nih.gov", "ncbi.nlm.nih.gov"
];
export const TOPICS = ["sleep", "learning", "brain", "movement", "senses", "myths"];
// The area (and character) each topic belongs to on the brain map.
const CHARACTER = { sleep: "lumi", movement: "octa", learning: "memo", brain: "dendi", senses: "lumi", myths: "dendi" };
const LANGS = ["uz", "ru", "en"];

/* ------------------------------------------------------------- helpers */

export function hostAllowed(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && ALLOWED_DOMAINS.some((d) => u.hostname === d || u.hostname.endsWith("." + d));
  } catch (e) { return false; }
}

export function pageText(html) {
  return String(html)
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ndash;|&mdash;/g, "-").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim();
}

const squash = (s) => String(s).toLowerCase().replace(/[‘’‚ʼ`]/g, "'").replace(/[“”]/g, '"').replace(/[‐-―]/g, "-").replace(/\s+/g, " ").trim();

export function quoteInPage(quote, text) {
  const q = squash(quote).replace(/[.…]+$/, "");
  return q.length >= 25 && squash(text).includes(q);
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
const words = (s) => new Set(squash(s).split(/[^a-z0-9]+/).filter((w) => w.length > 3));
export function similar(a, b) {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return false;
  let both = 0;
  A.forEach((w) => { if (B.has(w)) both++; });
  return both / Math.min(A.size, B.size) >= 0.7;
}

/* Everything the code can verify without a model. Returns a list of problems. */
export function validateFact(fact, { facts, page, quote }) {
  const bad = [];
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fact.id || "")) bad.push("id must be lowercase letters, digits and dashes");
  if (facts.some((f) => f.id === fact.id)) bad.push("duplicate id");
  if (!TOPICS.includes(fact.topic)) bad.push("unknown topic " + fact.topic);
  if (!hostAllowed(fact.source && fact.source.url)) bad.push("source is not on an allowed domain");
  if (facts.some((f) => f.source.url.replace(/\/$/, "") === String(fact.source.url).replace(/\/$/, ""))) bad.push("source page already used");
  if (!quoteInPage(quote, page)) bad.push("evidence sentence not found in the page");
  for (const l of LANGS) {
    for (const k of ["title", "simple", "detail"]) if (!fact[k] || !String(fact[k][l] || "").trim()) bad.push("missing " + k + "." + l);
    if (facts.some((f) => similar(f.title[l], fact.title[l]) && l === "en")) bad.push("title too similar to an existing fact");
  }
  const lim = (s, n, what) => { if (String(s).length > n) bad.push(what + " longer than " + n); };
  for (const l of LANGS) {
    lim(fact.title[l], 90, "title." + l);
    lim(fact.simple[l], 320, "simple." + l);
    lim(fact.detail[l], 700, "detail." + l);
    lim(fact.quiz.q[l], 280, "quiz.q." + l);
    lim(fact.quiz.why[l], 190, "quiz.why." + l);
    fact.quiz.options.forEach((o, i) => { lim(o[l], 95, "quiz option " + (i + 1) + "." + l); if (!String(o[l] || "").trim()) bad.push("empty quiz option " + (i + 1) + "." + l); });
  }
  if (fact.quiz.options.length !== 3) bad.push("quiz needs exactly 3 options");
  if (!(fact.quiz.answer >= 0 && fact.quiz.answer < fact.quiz.options.length)) bad.push("quiz.answer out of range");
  const en = fact.quiz.options.map((o) => squash(o.en));
  if (new Set(en).size !== en.length) bad.push("duplicate quiz options");
  // Cyrillic must be Russian text, Latin Uzbek: a cheap guard against swapped languages.
  if (!/[Ѐ-ӿ]/.test(fact.title.ru + fact.simple.ru)) bad.push("ru text has no Cyrillic");
  if (/[Ѐ-ӿ]/.test(fact.title.uz + fact.simple.uz + fact.title.en + fact.simple.en)) bad.push("uz/en text contains Cyrillic");
  return bad;
}

/* ------------------------------------------------------------ the model */

const LOC = { type: "object", additionalProperties: false, required: LANGS, properties: { uz: { type: "string" }, ru: { type: "string" }, en: { type: "string" } } };
const FACT_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["id", "topic", "title", "simple", "detail", "source_name", "evidence_quote", "quiz"],
  properties: {
    id: { type: "string" }, topic: { type: "string", enum: TOPICS },
    title: LOC, simple: LOC, detail: LOC,
    source_name: { type: "string" }, evidence_quote: { type: "string" },
    quiz: {
      type: "object", additionalProperties: false, required: ["q", "options", "answer", "why"],
      properties: { q: LOC, options: { type: "array", items: LOC }, answer: { type: "integer" }, why: LOC }
    }
  }
};
const CHECK_SCHEMA = {
  type: "object", additionalProperties: false, required: ["supported", "problems"],
  properties: { supported: { type: "boolean" }, problems: { type: "array", items: { type: "string" } } }
};

async function loadClient() {
  let Anthropic;
  try { ({ default: Anthropic } = await import("@anthropic-ai/sdk")); }
  catch (e) { throw new Error("Run `npm install @anthropic-ai/sdk` first (the workflow does this)."); }
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  return new Anthropic();
}

const textOf = (msg) => msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
function jsonOf(msg) {
  if (msg.stop_reason === "refusal") throw new Error("the model declined");
  return JSON.parse(textOf(msg));
}

const SYSTEM = [
  "You write short brain-health facts for Medulla, a student-run project from Uzbekistan whose readers are teenagers and children, with parents.",
  "Rules: use ONLY what the given source page says; never add numbers, causes, advice or claims that are not on the page;",
  "no medical advice, no diagnosis, no \"you should\"; plain, kind, simple language; Uzbek in Latin script with the letters oʻ and gʻ written with the ʻ mark (as in oʻzbek, gʻoya), Russian in Cyrillic, English;",
  "the three languages must say the same thing."
].join(" ");

async function findCandidate(client, facts, tried) {
  const have = facts.map((f) => "- [" + f.topic + "] " + f.title.en).join("\n");
  const messages = [{
    role: "user",
    content: "Find ONE web page on an allowed site that explains one specific, interesting, well-established fact about the brain, sleep, learning, movement, the senses or a common myth, suitable for teenagers.\n" +
      "It must be a NEW topic, not close to any of these existing facts:\n" + have + "\n" +
      (tried.length ? "Do not use these pages (already tried):\n" + tried.join("\n") + "\n" : "") +
      "Prefer topics that are under-represented above. Use web search, open a real page, and reply with ONLY a JSON object: {\"url\": \"<exact page url>\", \"topic\": \"<one of " + TOPICS.join("|") + ">\"}."
  }];
  const tools = [{ type: "web_search_20260209", name: "web_search", max_uses: 6, allowed_domains: ALLOWED_DOMAINS }];
  let msg;
  for (let turn = 0; turn < 5; turn++) {
    msg = await client.messages.create({ model: MODEL, max_tokens: 16000, output_config: { effort: "medium" }, system: SYSTEM, tools, messages });
    if (msg.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: msg.content });
  }
  const m = /\{[^{}]*"url"[^{}]*\}/.exec(textOf(msg));
  if (!m) throw new Error("no candidate page returned");
  return JSON.parse(m[0]);
}

async function fetchPage(url) {
  const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "MedullaFactBot/1.0 (+https://github.com/isapho/Medulla-site)" }, signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error("page returned " + res.status);
  if (!hostAllowed(res.url)) throw new Error("page redirected off the allowed domains");
  const text = pageText(await res.text());
  if (text.length < 400) throw new Error("page has too little text");
  return { text: text.slice(0, 40000), finalUrl: res.url };
}

async function writeFact(client, facts, url, text, topicHint) {
  const msg = await client.messages.create({
    model: MODEL, max_tokens: 16000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: FACT_SCHEMA } },
    system: SYSTEM,
    messages: [{
      role: "user",
      content: "SOURCE PAGE (" + url + "):\n\"\"\"\n" + text + "\n\"\"\"\n\n" +
        "Write one Medulla fact from this page about: " + topicHint + ".\n" +
        "- id: short lowercase-with-dashes English slug.\n" +
        "- title: a short headline (max 70 characters) per language.\n" +
        "- simple: ONE sentence (max 200 characters) a child can follow. detail: 2–3 sentences (max 600 characters) that name the source organisation.\n" +
        "- source_name: \"<Organisation> — <page title>\".\n" +
        "- evidence_quote: ONE sentence copied EXACTLY, character for character, from the page above that the fact rests on.\n" +
        "- quiz: one question with exactly 3 short options in each language (one correct, answer = its 0-based index; put the correct one in a varied position), and a one-sentence why (max 180 characters).\n" +
        "If the page does not clearly state a fact suitable for teenagers, use the best clearly stated one."
    }]
  });
  const o = jsonOf(msg);
  return {
    id: slug(o.id), character: CHARACTER[o.topic] || "dendi", topic: o.topic,
    title: o.title, simple: o.simple, detail: o.detail,
    source: { name: o.source_name, url },
    quiz: o.quiz, reviewed: false, _quote: o.evidence_quote
  };
}

async function independentCheck(client, fact, text) {
  const { _quote, ...shown } = fact;
  const msg = await client.messages.create({
    model: MODEL, max_tokens: 4000,
    output_config: { effort: "high", format: { type: "json_schema", schema: CHECK_SCHEMA } },
    messages: [{
      role: "user",
      content: "You are a strict fact-checker. SOURCE PAGE:\n\"\"\"\n" + text + "\n\"\"\"\n\nFACT TO CHECK (JSON):\n" + JSON.stringify(shown) + "\n\n" +
        "Is EVERY statement in title, simple, detail and the quiz (question, all options as they would be judged, the marked answer and the explanation) supported by the source page, in all three languages, with the three languages saying the same thing, and with no medical advice? " +
        "Answer supported=true only if so. List every problem otherwise."
    }]
  });
  return jsonOf(msg);
}

/* ---------------------------------------------------------------- main */

export async function addFacts({ count = 1, dryRun = false, log = console.log, client } = {}) {
  client = client || (await loadClient());
  const original = readFileSync(FACTS, "utf8");
  const facts = JSON.parse(original);
  const added = [];
  const tried = [];
  let attempts = 0;
  while (added.length < count && attempts < count * 4) {
    attempts++;
    try {
      const cand = await findCandidate(client, facts, tried);
      tried.push(cand.url);
      log("Candidate: " + cand.url);
      if (!hostAllowed(cand.url)) throw new Error("not an allowed domain");
      const { text, finalUrl } = await fetchPage(cand.url);
      const fact = await writeFact(client, facts, finalUrl, text, cand.topic || "any topic");
      const problems = validateFact(fact, { facts, page: text, quote: fact._quote });
      if (problems.length) throw new Error("rejected: " + problems.join("; "));
      const verdict = await independentCheck(client, fact, text);
      if (!verdict.supported) throw new Error("fact-check failed: " + verdict.problems.join("; "));
      delete fact._quote;
      facts.push(fact);
      added.push(fact);
      log("Accepted: " + fact.id + " — " + fact.title.en);
    } catch (e) {
      log("Skipped: " + e.message);
    }
  }
  if (!added.length) return { added: [] };
  if (dryRun) { added.forEach((f) => log(JSON.stringify(f, null, 2))); return { added }; }

  writeFileSync(FACTS, JSON.stringify(facts, null, 2) + "\n");
  const check = spawnSync(process.execPath, [path.join(ROOT, "tools/build.js"), "--check"], { cwd: ROOT, encoding: "utf8" });
  if (check.status !== 0) {
    writeFileSync(FACTS, original);
    throw new Error("build check failed, facts.json restored:\n" + (check.stdout + check.stderr).slice(-800));
  }
  return { added };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const arg = (n) => (process.argv.find((a) => a.startsWith("--" + n + "=")) || "").split("=")[1];
  const count = Math.min(2, Math.max(1, Number(arg("count")) || 1));
  addFacts({ count, dryRun: process.argv.includes("--dry-run") })
    .then((r) => { console.log(r.added.length + " fact(s) added."); if (!r.added.length) process.exitCode = 0; })
    .catch((e) => { console.error("auto-fact: " + e.message); process.exit(1); });
}
