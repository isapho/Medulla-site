#!/usr/bin/env node
/*
 * Medulla content build — optional, zero dependencies (Node 18+).
 *
 *   node tools/build.js           rebuild generated files
 *   node tools/build.js --check   only run the checks (exit code 1 on problems)
 *
 * The site works WITHOUT running this (pages fill their text with JavaScript).
 * Running it after you change text, facts or the domain:
 *   1. pre-renders the Uzbek text into every page (search engines, no-JS),
 *   2. fills <title>, description and Open Graph tags (absolute if `domain` is set),
 *   3. generates facts/<id>.html (one page per fact) and topics/<topic>.html,
 *   4. writes data/facts.js (copy used when the site is opened from disk),
 *   5. writes sitemap.xml and robots.txt,
 *   6. updates the offline file list and cache version in sw.js,
 *   6b. writes data/bot-strings.json (the texts the Telegram bot needs),
 *   7. checks: same keys in every language, every key used exists, facts are
 *      complete in every language, internal links point to real files.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const CHECK_ONLY = process.argv.includes("--check");
const rel = (p) => path.join(ROOT, p);
const read = (p) => fs.readFileSync(rel(p), "utf8");
const write = (p, s) => { fs.mkdirSync(path.dirname(rel(p)), { recursive: true }); fs.writeFileSync(rel(p), s, "utf8"); };

/* ------------------------------------------------------------- loading */

function loadBrowserScript(file, sandbox) {
  vm.runInNewContext(read(file), sandbox, { filename: file });
  return sandbox;
}

const sandbox = { window: {}, document: { body: null } };
loadBrowserScript("js/config.js", sandbox);
loadBrowserScript("js/i18n.js", sandbox);
const I18N = sandbox.window.MEDULLA_I18N;
const LANGS = I18N.languages.map((l) => l.code);
LANGS.forEach((code) => loadBrowserScript("js/lang/" + code + ".js", sandbox));
const CFG = sandbox.window.MEDULLA_CONFIG;
const STR = I18N.strings;
const DEFAULT = I18N.defaultLang;
const facts = JSON.parse(read("data/facts.json"));
const Tpl = require(rel("js/fact-template.js"));
const DOMAIN = CFG.domain ? CFG.domain.replace(/\/$/, "") : null;

const t = (key, vars, lang) => {
  let s = (STR[lang || DEFAULT] || {})[key];
  if (s === undefined) s = (STR.en || {})[key];
  if (s === undefined) s = key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  return s;
};
const loc = (v, lang) => (v && typeof v === "object" ? v[lang || DEFAULT] || v.en : v);
const esc = Tpl.esc;

const TOPICS = ["sleep", "learning", "brain", "movement", "senses", "myths"];
const PAGES = ["index", "learn", "lab", "explore", "parents", "events", "activities", "about", "partners", "join", "glossary", "accessibility", "privacy", "offline", "404"];
const glossary = JSON.parse(read("data/glossary.json")).terms || [];
const CHAR_DIMS = { dendi: [194, 280], memo: [276, 229], octa: [198, 233], syno: [168, 248], lumi: [160, 161] };

/* --------------------------------------------------------------- checks */

const problems = [];
const warn = (msg) => problems.push(msg);

function checkKeys() {
  const sets = LANGS.map((l) => new Set(Object.keys(STR[l] || {})));
  LANGS.forEach((l, i) => {
    LANGS.forEach((m, j) => {
      if (i === j) return;
      sets[j].forEach((k) => { if (!sets[i].has(k)) warn(`[i18n] "${k}" exists in ${m} but is missing in ${l}`); });
    });
  });
  // keys used in HTML and JS
  const used = new Set();
  const htmlFiles = PAGES.map((p) => p + ".html");
  htmlFiles.forEach((f) => {
    const s = read(f);
    for (const m of s.matchAll(/data-i18n="([^"]+)"/g)) used.add(m[1]);
    for (const m of s.matchAll(/data-i18n-attr="([^"]+)"/g)) m[1].split(";").forEach((p) => { const k = (p.split(":")[1] || "").trim(); if (k) used.add(k); });
    for (const m of s.matchAll(/data-(?:subject|body|label)="([a-z][\w.]+)"/g)) used.add(m[1]);
  });
  fs.readdirSync(rel("js")).filter((f) => f.endsWith(".js")).forEach((f) => {
    const s = read("js/" + f);
    for (const m of s.matchAll(/\bt\("([a-z][\w.-]+)"/g)) used.add(m[1]);
    for (const m of s.matchAll(/M\.t\("([a-z][\w.-]+)"/g)) used.add(m[1]);
  });
  // Keys ending in "." are prefixes completed in code (e.g. "game." + id): skip them.
  used.forEach((k) => { if (!/\.$/.test(k) && !(k in STR[DEFAULT])) warn(`[i18n] key "${k}" is used but not defined`); });
  // Dynamic keys that must exist for every language: characters, games, badges, topics.
  ["dendi", "memo", "octa", "syno", "lumi"].forEach((c) => ["kind", "trait", "role", "line"].forEach((p) => { if (!(`char.${c}.${p}` in STR[DEFAULT])) warn(`[i18n] missing char.${c}.${p}`); }));
  ["stroop", "reaction", "digits", "sequence", "breathing", "sleep"].forEach((g) => ["title", "short", "how", "what", "limits"].forEach((p) => { if (!(`game.${g}.${p}` in STR[DEFAULT])) warn(`[i18n] missing game.${g}.${p}`); }));
  TOPICS.forEach((k) => { if (!(`topic.${k}` in STR[DEFAULT])) warn(`[i18n] missing topic.${k}`); });
  const storeSrc = read("js/store.js");
  for (const m of storeSrc.matchAll(/\{ id: "([a-z0-9-]+)", char:/g)) ["name", "how"].forEach((p) => { if (!(`badge.${m[1]}.${p}` in STR[DEFAULT])) warn(`[i18n] missing badge.${m[1]}.${p}`); });
}

function checkFacts() {
  const ids = new Set();
  facts.forEach((f, i) => {
    const where = `[facts] #${i + 1} ${f.id || "(no id)"}`;
    if (!f.id || !/^[a-z0-9-]+$/.test(f.id)) warn(`${where}: id must be lowercase letters, digits and dashes`);
    if (ids.has(f.id)) warn(`${where}: duplicate id`);
    ids.add(f.id);
    if (TOPICS.indexOf(f.topic) === -1) warn(`${where}: unknown topic "${f.topic}" (use one of ${TOPICS.join(", ")})`);
    if (!CHAR_DIMS[f.character]) warn(`${where}: unknown character "${f.character}"`);
    ["title", "simple", "detail"].forEach((k) => LANGS.forEach((l) => { if (!f[k] || !f[k][l]) warn(`${where}: missing ${k}.${l}`); }));
    if (!f.source || !/^https:\/\//.test(f.source.url || "") || !f.source.name) warn(`${where}: needs source.name and an https source.url`);
    if (!f.quiz) warn(`${where}: missing quiz`);
    else {
      LANGS.forEach((l) => {
        if (!f.quiz.q[l]) warn(`${where}: missing quiz.q.${l}`);
        if (!f.quiz.why[l]) warn(`${where}: missing quiz.why.${l}`);
        (f.quiz.options || []).forEach((o, n) => { if (!o[l]) warn(`${where}: missing quiz option ${n + 1} in ${l}`); });
      });
      if (!(f.quiz.answer >= 0 && f.quiz.answer < (f.quiz.options || []).length)) warn(`${where}: quiz.answer must point to an option`);
    }
    if (f.reviewed !== false && f.reviewed !== true) warn(`${where}: reviewed must be true or false`);
  });
}

function checkGlossary() {
  const ids = new Set(), factIds = new Set(facts.map((f) => f.id));
  glossary.forEach((g, i) => {
    const where = `[glossary] #${i + 1} ${g.id || "(no id)"}`;
    if (!g.id || !/^[a-z0-9-]+$/.test(g.id)) warn(`${where}: id must be lowercase letters, digits and dashes`);
    if (ids.has(g.id)) warn(`${where}: duplicate id`);
    ids.add(g.id);
    LANGS.forEach((l) => {
      if (!g.term || !g.term[l]) warn(`${where}: missing term.${l}`);
      if (!g.def || !g.def[l]) warn(`${where}: missing def.${l}`);
      if (!g.match || !Array.isArray(g.match[l]) || !g.match[l].length) warn(`${where}: needs at least one match.${l} word start`);
      (g.match && g.match[l] || []).forEach((m) => { if (m.replace(/^=/, "").length < 3) warn(`${where}: match "${m}" is too short (min 3 letters)`); });
    });
    if (g.fact && !factIds.has(g.fact)) warn(`${where}: fact "${g.fact}" does not exist`);
    if (g.source && !/^https:\/\//.test(g.source.url || "")) warn(`${where}: source.url must start with https://`);
    if (g.reviewed !== false && g.reviewed !== true) warn(`${where}: reviewed must be true or false`);
  });
  // The Brain Lab count shown on the home page must match js/games.js.
  const games = (read("js/games.js").match(/var LIST = \[([\s\S]*?)\];/) || [])[1] || "";
  const n = (games.match(/\{ id: "/g) || []).length;
  const shown = Number((read("js/main.js").match(/var LAB_ACTIVITIES = (\d+);/) || [])[1]);
  if (n && shown !== n) warn(`[main.js] LAB_ACTIVITIES is ${shown} but js/games.js lists ${n} activities`);
}

function checkLinks(files) {
  files.forEach((f) => {
    const s = read(f);
    const base = path.posix.dirname(f.replace(/\\/g, "/"));
    for (const m of s.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      const u = m[1];
      if (/^(https?:|mailto:|data:|#|javascript:)/.test(u) || u.startsWith("/")) continue;
      const clean = u.split("#")[0].split("?")[0];
      if (!clean) continue;
      const target = path.posix.normalize(path.posix.join(base === "." ? "" : base, clean));
      if (!fs.existsSync(rel(target))) warn(`[links] ${f} → ${u} (missing ${target})`);
    }
  });
}

/* ------------------------------------------------------------ rendering */

function metaBlock(o) {
  const url = DOMAIN ? DOMAIN + "/" + o.path : null;
  const img = DOMAIN ? DOMAIN + "/assets/brand/og-image.jpg" : o.base + "assets/brand/og-image.jpg";
  return [
    "<!-- meta:start (filled by node tools/build.js from js/lang/uz.js) -->",
    `  <title>${esc(o.title)}</title>`,
    `  <meta name="description" content="${esc(o.description)}">`,
    url ? `  <link rel="canonical" href="${esc(url)}">` : "  <!-- canonical/og:url: set `domain` in js/config.js, then run node tools/build.js -->",
    `  <meta property="og:type" content="${o.type || "website"}">`,
    "  <meta property=\"og:site_name\" content=\"Medulla\">",
    `  <meta property="og:title" content="${esc(o.title)}">`,
    `  <meta property="og:description" content="${esc(o.description)}">`,
    url ? `  <meta property="og:url" content="${esc(url)}">` : null,
    `  <meta property="og:image" content="${esc(img)}">`,
    "  <meta property=\"og:image:width\" content=\"1200\">",
    "  <meta property=\"og:image:height\" content=\"630\">",
    "  <meta property=\"og:image:alt\" content=\"Medulla — Mind • Learn • Grow\">",
    "  <meta property=\"og:locale\" content=\"uz_UZ\">",
    "  <meta property=\"og:locale:alternate\" content=\"ru_RU\">",
    "  <meta property=\"og:locale:alternate\" content=\"en_US\">",
    "  <meta name=\"twitter:card\" content=\"summary_large_image\">",
    "  <!-- meta:end -->"
  ].filter(Boolean).join("\n");
}

// Pre-render text into leaf elements that carry data-i18n / data-i18n-attr.
function prerender(html, base) {
  html = html.replace(/(<([a-z0-9]+)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)([^<]*)(<\/\2>)/gi,
    (m, open, tag, key, inner, close) => open + esc(t(key)) + close);
  html = html.replace(/<[a-z0-9]+\b[^>]*\bdata-i18n-attr="([^"]+)"[^>]*>/gi, (tag, spec) => {
    spec.split(";").forEach((pair) => {
      const bits = pair.split(":");
      if (bits.length !== 2) return;
      const attr = bits[0].trim(), val = esc(t(bits[1].trim()));
      const re = new RegExp("\\s" + attr + "=\"[^\"]*\"");
      tag = re.test(tag) ? tag.replace(re, ` ${attr}="${val}"`) : tag.replace(/\s*(\/?)>$/, ` ${attr}="${val}"$1>`);
    });
    return tag;
  });
  // <img data-char="memo"> → add src
  html = html.replace(/<img\b([^>]*)\bdata-char="([a-z]+)"([^>]*)>/gi, (tag, a, id, b) => {
    if (/\ssrc="/.test(tag)) tag = tag.replace(/\ssrc="[^"]*"/, "");
    return tag.replace(/<img\b/, `<img src="${base}assets/characters/${id}.webp"`);
  });
  return html;
}

function setMeta(html, meta) {
  return html.replace(/<!-- meta:start[\s\S]*?<!-- meta:end -->/, metaBlock(meta));
}

function shellHead(meta, base, extraHead) {
  return `<!doctype html>
<html lang="uz">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  ${metaBlock(meta)}
  <meta name="theme-color" content="#FFFFFF">
  <link rel="manifest" href="${base}manifest.webmanifest">
  <link rel="icon" type="image/png" href="${base}assets/brand/favicon-64.png">
  <link rel="apple-touch-icon" href="${base}assets/brand/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700&amp;family=Manrope:wght@700;800&amp;display=swap">
  <link rel="stylesheet" href="${base}css/styles.css">
  <link rel="stylesheet" href="${base}css/app.css">
  <link rel="stylesheet" href="${base}css/polish.css">${extraHead || ""}
  <script src="${base}js/prefs.js"></script>
</head>`;
}

function scripts(base, extra) {
  return ["config", "i18n", "store", "backend", "sound", "motion", "main", "access"].concat(extra)
    .map((s) => `  <script src="${base}js/${s}.js"></script>`).join("\n");
}

function factPage(f) {
  const base = "../";
  const related = facts.filter((x) => x.topic === f.topic && x.id !== f.id)
    .concat(facts.filter((x) => x.topic !== f.topic && x.character === f.character)).slice(0, 4);
  const ctx = { t: (k, v) => t(k, v), loc: (v) => loc(v), base, level: "simple", related, saved: false };
  const meta = { title: loc(f.title) + " — Medulla", description: loc(f.simple), path: "facts/" + f.id + ".html", base, type: "article" };
  const jsonld = {
    "@context": "https://schema.org", "@type": "Article", headline: loc(f.title), inLanguage: "uz",
    description: loc(f.simple), citation: f.source.url, isAccessibleForFree: true,
    publisher: { "@type": "Organization", name: "Medulla" }
  };
  const html = `${shellHead(meta, base, `\n  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>`)}
<body data-page="fact" data-root="../" data-fact="${f.id}">
  <a class="skip-link" href="#main" data-i18n="a11y.skip"></a>
  <header id="site-header" class="site-header"></header>
  <noscript><p class="noscript">JavaScript yoqilmagan. Включите JavaScript. Please turn on JavaScript.</p></noscript>
  <main id="main" tabindex="-1">
    <section class="section" style="padding-top:28px">
      <div class="container">
        <nav class="crumbs" aria-label="Breadcrumbs"><a href="../index.html" data-i18n="nav.home"></a><span aria-hidden="true">/</span><a href="../learn.html" data-i18n="nav.learn"></a><span aria-hidden="true">/</span><a href="../topics/${f.topic}.html" data-crumb-topic>${esc(t("topic." + f.topic))}</a></nav>
        <div class="fact-layout">
          <article class="card fact-article" id="fact-article" aria-labelledby="fact-title">
${Tpl.article(f, ctx)}
          </article>
          <div class="fact-side" id="fact-side">
${Tpl.side(f, ctx)}
          </div>
        </div>
      </div>
    </section>
  </main>
  <footer id="site-footer" class="site-footer"></footer>
${scripts(base, ["fact-template", "fact"])}
</body>
</html>
`;
  return prerender(html, base);
}

function topicPage(key) {
  const base = "../";
  const name = t("topic." + key);
  const list = facts.filter((f) => f.topic === key);
  const meta = { title: name + " — " + t("learn.eyebrow") + " — Medulla", description: t("meta.topic.description", { topic: name }), path: "topics/" + key + ".html", base };
  const cards = list.map((f) => `<li><article class="fact-card" id="fact-${f.id}"><div class="fact-meta"><span class="chip">${esc(name)}</span></div><h2><a href="../facts/${f.id}.html">${esc(loc(f.title))}</a></h2><p class="fact-excerpt">${esc(loc(f.simple))}</p></article></li>`).join("\n");
  const others = TOPICS.filter((k) => k !== key).map((k) => `<li><a class="topic-hub press" href="${k}.html"><span class="tile"><span data-icon="book"></span></span><span>${esc(t("topic." + k))}</span></a></li>`).join("");
  const html = `${shellHead(meta, base)}
<body data-page="topic" data-root="../" data-topic="${key}" data-title-key="topic.${key}">
  <a class="skip-link" href="#main" data-i18n="a11y.skip"></a>
  <header id="site-header" class="site-header"></header>
  <noscript><p class="noscript">JavaScript yoqilmagan. Включите JavaScript. Please turn on JavaScript.</p></noscript>
  <main id="main" tabindex="-1">
    <section class="page-hero">
      <div class="container">
        <div>
          <p class="eyebrow"><span data-icon="book"></span><span data-i18n="topicPage.eyebrow"></span></p>
          <h1 data-i18n="topic.${key}"></h1>
          <p class="lead" id="topic-lead">${esc(t("topicPage.lead", { topic: name }))}</p>
        </div>
        <div class="page-hero-art"><img class="idle idle-memo" data-char="${key === "sleep" || key === "senses" ? "lumi" : key === "movement" ? "octa" : key === "brain" || key === "myths" ? "dendi" : "memo"}" alt="" width="160" height="160"></div>
      </div>
    </section>
    <section class="section" style="padding-top:32px">
      <div class="container">
        <div class="toolbar">
          <div class="toolbar-row">
            <div class="search" role="search">
              <label class="sr-only" for="fact-search" data-i18n="learn.searchLabel"></label>
              <span data-icon="search"></span>
              <input id="fact-search" type="search" autocomplete="off" spellcheck="false" data-i18n-attr="placeholder:learn.searchPlaceholder">
            </div>
            <div>
              <label class="sr-only" for="fact-sort" data-i18n="learn.sortLabel"></label>
              <select id="fact-sort" class="select"><option value="default" data-i18n="learn.sortDefault"></option><option value="az" data-i18n="learn.sortAz"></option></select>
            </div>
          </div>
          <div class="filter-chips" id="topic-chips" role="group" data-i18n-attr="aria-label:learn.filterLabel"></div>
        </div>
        <p class="results-count" id="results-count" role="status" aria-live="polite" data-i18n="learn.loading"></p>
        <ul class="facts-grid" id="facts-list">
${cards}
        </ul>
        <h2 class="h3" style="margin-top:32px" data-i18n="learn.topicsTitle"></h2>
        <ul class="topic-hubs">${others}</ul>
      </div>
    </section>
  </main>
  <footer id="site-footer" class="site-footer"></footer>
${scripts(base, ["learn"])}
</body>
</html>
`;
  return prerender(html, base);
}

/* ------------------------------------------------------------ the build */

checkKeys();
checkFacts();
checkGlossary();

if (!CHECK_ONLY) {
  // 1–2. top-level pages
  PAGES.forEach((p) => {
    const file = p + ".html";
    let html = read(file);
    const page = (html.match(/<body[^>]*data-page="([^"]+)"/) || [])[1] || p;
    const base = p === "404" ? "/" : "";
    html = setMeta(html, {
      title: t("meta." + page + ".title"),
      description: t("meta." + page + ".description"),
      path: p === "index" ? "" : file,
      base: p === "404" ? "/" : ""
    });
    html = prerender(html, base);
    write(file, html);
  });

  // 3. fact and topic pages
  const keepFacts = new Set(facts.map((f) => f.id + ".html"));
  if (fs.existsSync(rel("facts"))) fs.readdirSync(rel("facts")).forEach((f) => { if (!keepFacts.has(f)) fs.unlinkSync(rel("facts/" + f)); });
  facts.forEach((f) => write("facts/" + f.id + ".html", factPage(f)));
  TOPICS.forEach((k) => write("topics/" + k + ".html", topicPage(k)));

  // 4. file:// mirror
  write("data/facts.js", "// GENERATED from data/facts.json by tools/build.js. Do not edit by hand.\n// Used only when the site is opened directly from disk (file://).\nwindow.MEDULLA_FACTS = " + JSON.stringify(facts, null, 2) + ";\n");

  // 4b. texts for the Telegram bot (telegram/worker.js reads this from the site)
  const botStrings = {};
  LANGS.forEach((l) => {
    botStrings[l] = {};
    Object.keys(STR[l]).filter((k) => k.startsWith("bot.") || k === "common.source" || k === "common.pendingReview").sort()
      .forEach((k) => { botStrings[l][k] = STR[l][k]; });
  });
  write("data/bot-strings.json", JSON.stringify(botStrings, null, 2) + "\n");

  // 5. sitemap + robots
  const urls = PAGES.filter((p) => ["404", "offline", "explore"].indexOf(p) === -1).map((p) => (p === "index" ? "" : p + ".html"))
    .concat(facts.map((f) => "facts/" + f.id + ".html")).concat(TOPICS.map((k) => "topics/" + k + ".html"));
  const today = new Date().toISOString().slice(0, 10);
  const origin = DOMAIN || "https://YOUR-DOMAIN.example";
  write("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n' +
    (DOMAIN ? "" : "<!-- Set `domain` in js/config.js and run node tools/build.js to replace YOUR-DOMAIN. -->\n") +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url><loc>${origin}/${u}</loc><lastmod>${today}</lastmod></url>`).join("\n") + "\n</urlset>\n");
  write("robots.txt", "User-agent: *\nAllow: /\nDisallow: /explore.html\n" + (DOMAIN ? `Sitemap: ${DOMAIN}/sitemap.xml\n` : "# Sitemap: set `domain` in js/config.js and run node tools/build.js\n"));

  // 6. service-worker precache list + version
  const precache = [
    "./", "index.html", "learn.html", "lab.html", "explore.html", "offline.html", "manifest.webmanifest",
    "css/styles.css", "css/app.css", "css/polish.css",
    "js/prefs.js", "js/config.js", "js/i18n.js", "js/store.js", "js/backend.js", "js/sound.js", "js/motion.js", "js/main.js", "js/access.js",
    "js/home.js", "js/learn.js", "js/lab.js", "js/games.js", "js/explore.js", "js/fact-template.js", "js/fact.js",
    "js/lang/uz.js", "js/lang/ru.js", "js/lang/en.js",
    "data/facts.json", "data/kindness.json", "data/resources.json", "data/glossary.json",
    "glossary.html", "accessibility.html",
    "assets/brand/logo-96.webp", "assets/brand/logo-192.webp", "assets/brand/logo-white-96.webp", "assets/brand/favicon-64.png",
    "assets/img/brain-glass.webp"
  ]
    .concat(Object.keys(CHAR_DIMS).map((c) => "assets/characters/" + c + ".webp"))
    // reactions used offline: quiz feedback, game results and the offline page
    .concat(Object.keys(CHAR_DIMS).flatMap((c) => ["correct", "tryagain", "win"].map((p) => "assets/characters/poses/" + c + "-" + p + ".webp")))
    .concat(["assets/characters/poses/lumi-curious.webp"]);
  const hash = crypto.createHash("sha256");
  precache.filter((p) => p !== "./").forEach((p) => hash.update(fs.readFileSync(rel(p))));
  const version = "medulla-" + hash.digest("hex").slice(0, 10);
  let sw = read("sw.js");
  sw = sw.replace(/const VERSION = "[^"]*";/, `const VERSION = "${version}";`)
    .replace(/const PRECACHE = \[[\s\S]*?\];/, "const PRECACHE = [\n" + precache.map((p) => `  "${p}"`).join(",\n") + "\n];");
  write("sw.js", sw);

  console.log(`Built ${PAGES.length} pages, ${facts.length} fact pages, ${TOPICS.length} topic pages. Cache ${version}.`);
}

checkLinks(PAGES.map((p) => p + ".html").filter((f) => f !== "404.html")
  .concat(fs.existsSync(rel("facts")) ? fs.readdirSync(rel("facts")).map((f) => "facts/" + f) : [])
  .concat(fs.existsSync(rel("topics")) ? fs.readdirSync(rel("topics")).map((f) => "topics/" + f) : []));

if (problems.length) {
  console.log("\n" + problems.length + " problem(s):\n" + problems.map((p) => "  - " + p).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Checks passed: " + LANGS.length + " languages with identical keys, " + facts.length + " complete facts, all internal links resolve.");
}
