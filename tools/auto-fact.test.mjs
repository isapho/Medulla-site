// Tests for tools/auto-fact.mjs with a fake model: no network, no API key,
// nothing written. Run: node --test tools/auto-fact.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hostAllowed, quoteInPage, pageText, similar, validateFact, addFacts, TOPICS } from "./auto-fact.mjs";

const facts = JSON.parse(readFileSync(new URL("../data/facts.json", import.meta.url), "utf8"));
const QUOTE = "Teenagers need about 8 to 10 hours of sleep each night to stay healthy and learn well.";
const PAGE = "<html><nav>menu</nav><main><h1>Sleep</h1><p>" + QUOTE.replace("8 to 10", "8&nbsp;to&nbsp;10") + " Many do not get this. " + "Sleep helps the body and brain rest, grow and recover, and regular bedtimes make good sleep easier. ".repeat(6) + "</p></main><script>x()</script></html>";
const L = (uz, ru, en) => ({ uz, ru, en });
const good = () => ({
  id: "teen-sleep-hours-check", character: "lumi", topic: "sleep",
  title: L("Qisqa tundan keyingi kun qiyinroq", "После короткой ночи день труднее", "A short night makes the next day harder"),
  simple: L("Oʻspirinlarga kechasi taxminan 8–10 soat uyqu kerak.", "Подросткам нужно примерно 8–10 часов сна за ночь.", "Teens need about 8 to 10 hours of sleep a night."),
  detail: L("Sogʻliqni saqlash manbasi oʻspirinlarga sogʻlom boʻlish va yaxshi oʻrganish uchun 8–10 soat uyqu kerakligini aytadi.", "Источник по здоровью говорит, что подросткам нужно 8–10 часов сна, чтобы быть здоровыми и хорошо учиться.", "A health source says teenagers need 8 to 10 hours of sleep to stay healthy and learn well."),
  source: { name: "Example Health — Sleep", url: "https://www.nhs.uk/example-sleep-page/" },
  quiz: {
    q: L("Oʻspirinlarga kechasi necha soat uyqu kerak?", "Сколько часов сна нужно подросткам?", "How many hours of sleep do teens need?"),
    options: [L("3–4 soat", "3–4 часа", "3 to 4 hours"), L("8–10 soat", "8–10 часов", "8 to 10 hours"), L("14–16 soat", "14–16 часов", "14 to 16 hours")],
    answer: 1, why: L("Manba 8–10 soat deydi.", "Источник говорит о 8–10 часах.", "The source says 8 to 10 hours.")
  },
  reviewed: false
});

test("only https pages on the allowed health domains pass", () => {
  assert.ok(hostAllowed("https://www.nhs.uk/x"));
  assert.ok(hostAllowed("https://www.ninds.nih.gov/a/b"));
  assert.ok(hostAllowed("https://pubmed.ncbi.nlm.nih.gov/1/"));
  assert.ok(!hostAllowed("http://www.nhs.uk/x"));
  assert.ok(!hostAllowed("https://nhs.uk.evil.example/x"));
  assert.ok(!hostAllowed("https://example.com/"));
  assert.ok(!hostAllowed("not a url"));
  // the health sources the project already uses stay acceptable (two journal sources are older, hand-picked exceptions)
  for (const f of facts) if (!/plos.org|psychologicalscience.org/.test(f.source.url)) assert.ok(hostAllowed(f.source.url), f.source.url);
});

test("the evidence sentence must really be on the page", () => {
  const text = pageText(PAGE);
  assert.ok(!text.includes("<"), "tags removed");
  assert.ok(!text.includes("x()"), "scripts removed");
  assert.ok(quoteInPage(QUOTE, text), "found despite &nbsp; and case");
  assert.ok(!quoteInPage("Teenagers need exactly 12 hours of sleep each night to be healthy.", text));
  assert.ok(!quoteInPage("Sleep", text), "too short to count");
});

test("a good fact passes every code check", () => {
  assert.deepEqual(validateFact(good(), { facts, page: pageText(PAGE), quote: QUOTE }), []);
});

test("bad facts are rejected with a reason", () => {
  const ctx = { facts, page: pageText(PAGE), quote: QUOTE };
  const t = (mut, re) => { const f = good(); mut(f); const p = validateFact(f, ctx).join("; "); assert.match(p, re); };
  t((f) => { f.id = facts[0].id; }, /duplicate id/);
  t((f) => { f.id = "Bad ID"; }, /id must be/);
  t((f) => { f.source.url = "https://example.com/p"; }, /allowed domain/);
  t((f) => { f.source.url = facts[0].source.url; }, /already used/);
  t((f) => { f.topic = "gossip"; }, /unknown topic/);
  t((f) => { f.title.en = facts.find((x) => x.topic === "sleep").title.en; }, /too similar/);
  t((f) => { f.quiz.options.pop(); }, /exactly 3/);
  t((f) => { f.quiz.options[0].en = f.quiz.options[1].en; }, /duplicate quiz/);
  t((f) => { f.quiz.options[0].uz = "x".repeat(120); }, /longer than 95/);
  t((f) => { f.quiz.answer = 3; }, /out of range/);
  t((f) => { f.simple.ru = "Teens need sleep"; f.title.ru = "Sleep"; }, /no Cyrillic/);
  t((f) => { f.simple.uz = "Подросткам нужен сон"; }, /Cyrillic/);
  assert.match(validateFact(good(), { facts, page: pageText(PAGE), quote: "Teens need 20 hours of sleep every single night." }).join(), /evidence/);
  assert.ok(similar("The brain uses a lot of energy", "How much energy the brain uses"));
});

// A fake Anthropic client that answers the three kinds of calls in order.
function fakeClient({ fact = good(), supported = true, url = "https://www.nhs.uk/example-sleep-page/" } = {}) {
  const calls = [];
  return {
    calls,
    messages: {
      async create(req) {
        calls.push(req);
        const text = (t) => ({ stop_reason: "end_turn", content: [{ type: "text", text: t }] });
        if (req.tools) return text(JSON.stringify({ url, topic: "sleep" }));
        if (req.output_config && req.output_config.format.schema.required.includes("supported")) return text(JSON.stringify({ supported, problems: supported ? [] : ["number not on page"] }));
        const { id, topic, title, simple, detail, quiz, source } = fact;
        return text(JSON.stringify({ id, topic, title, simple, detail, source_name: source.name, evidence_quote: QUOTE, quiz }));
      }
    }
  };
}
const withPage = async (fn) => {
  const real = globalThis.fetch;
  globalThis.fetch = async (u) => ({ ok: true, status: 200, url: String(u), text: async () => PAGE });
  try { return await fn(); } finally { globalThis.fetch = real; }
};

test("end to end with a fake model: accepted, never writes in dry-run", () => withPage(async () => {
  const client = fakeClient();
  const before = readFileSync(new URL("../data/facts.json", import.meta.url), "utf8");
  const { added } = await addFacts({ count: 1, dryRun: true, client, log: () => {} });
  assert.equal(added.length, 1);
  assert.equal(added[0].reviewed, false, "stays 'pending expert review'");
  assert.equal(added[0].character, "lumi");
  assert.ok(!("_quote" in added[0]));
  assert.ok(TOPICS.includes(added[0].topic));
  assert.equal(readFileSync(new URL("../data/facts.json", import.meta.url), "utf8"), before);
  const search = client.calls.find((c) => c.tools);
  assert.deepEqual(search.tools[0].type, "web_search_20260209");
  assert.ok(search.tools[0].allowed_domains.includes("nhs.uk"));
}));

test("a failed second opinion throws the fact away", () => withPage(async () => {
  const logs = [];
  const { added } = await addFacts({ count: 1, dryRun: true, client: fakeClient({ supported: false }), log: (m) => logs.push(m) });
  assert.equal(added.length, 0);
  assert.ok(logs.some((l) => /fact-check failed/.test(l)));
}));

test("a candidate off the allowed domains is never fetched", async () => {
  const real = globalThis.fetch;
  let fetched = false;
  globalThis.fetch = async () => { fetched = true; return new Response("x"); };
  try {
    const { added } = await addFacts({ count: 1, dryRun: true, client: fakeClient({ url: "https://blog.example.com/brain" }), log: () => {} });
    assert.equal(added.length, 0);
    assert.equal(fetched, false);
  } finally { globalThis.fetch = real; }
});
