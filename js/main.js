/*
 * Shared site shell: language loading, header/footer, settings (language,
 * sound, calm mode, larger text, dyslexia font), icons, the character system,
 * toasts and celebrations, the fact reader, and sections rendered from
 * js/config.js and data/*.json.
 *
 * HTML marks text with data-i18n="key" (text) or
 * data-i18n-attr="attr:key; attr2:key2" (attributes). Sections built from
 * data use data-render="name" (see `renderers`). Page scripts run their code
 * inside Medulla.ready(fn), after the language file has loaded.
 */
(function () {
  "use strict";

  var CFG = window.MEDULLA_CONFIG || {};
  // ?placeholders=1 shows the dashed "TBD" stand-ins (for the team checking what is still missing).
  try { if (new URLSearchParams(location.search).get("placeholders") === "1") CFG.showPlaceholders = true; } catch (e) { /* old browser */ }
  var I18N = window.MEDULLA_I18N;
  var prefs = window.MedullaPrefs;
  var Store = window.MedullaStore;
  var root = document.documentElement;
  var ROOT = document.body.getAttribute("data-root") || "";
  var page = document.body.getAttribute("data-page") || "home";
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var langListeners = [];
  var readyQueue = [];
  var isReady = false;

  /* ---------------------------------------------------------------- i18n */

  var langCodes = I18N.languages.map(function (l) { return l.code; });

  function pickInitialLang() {
    var fromUrl = new URLSearchParams(window.location.search).get("lang");
    if (fromUrl && langCodes.indexOf(fromUrl) !== -1) { prefs.set(prefs.KEYS.lang, fromUrl); return fromUrl; }
    var saved = prefs.get(prefs.KEYS.lang);
    return saved && langCodes.indexOf(saved) !== -1 ? saved : I18N.defaultLang;
  }

  var lang = pickInitialLang();

  function langInfo() { return I18N.languages.filter(function (l) { return l.code === lang; })[0] || I18N.languages[0]; }

  function t(key, vars) {
    var s = (I18N.strings[lang] || {})[key];
    if (s === undefined) s = (I18N.strings.en || {})[key];
    if (s === undefined) s = key;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? vars[k] : m; });
    return s;
  }

  // Data values may be "text" or { uz: "...", ru: "...", en: "..." }.
  function localized(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "object") return value[lang] || value.en || value[I18N.defaultLang] || null;
    return value;
  }

  // Locale-aware numbers: Uzbek and Russian use a decimal comma.
  function fmt(n, decimals) {
    var info = langInfo();
    var parts = Number(n).toFixed(decimals || 0).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, info.group);
    return parts.join(info.decimal);
  }

  function applyI18n(scope) {
    var el = scope || document;
    // Only touch what changed: rewriting the pre-rendered Uzbek text would make
    // the browser repaint it and report a late Largest Contentful Paint.
    el.querySelectorAll("[data-i18n]").forEach(function (node) {
      var s = t(node.getAttribute("data-i18n"));
      if (node.textContent !== s) node.textContent = s;
    });
    el.querySelectorAll("[data-i18n-attr]").forEach(function (node) {
      node.getAttribute("data-i18n-attr").split(";").forEach(function (pair) {
        var bits = pair.split(":");
        if (bits.length !== 2) return;
        var name = bits[0].trim(), s = t(bits[1].trim());
        if (node.getAttribute(name) !== s) node.setAttribute(name, s);
      });
    });
  }

  function applyMeta() {
    root.setAttribute("lang", lang);
    var custom = document.body.getAttribute("data-title-key");
    if (page !== "fact" && page !== "topic") {
      document.title = t("meta." + page + ".title");
      var desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute("content", t("meta." + page + ".description"));
    } else if (custom) {
      document.title = t(custom) + " — Medulla";
    }
  }

  function setLang(code) {
    if (code === lang || langCodes.indexOf(code) === -1) return;
    I18N.load(code).then(function () {
      lang = code;
      prefs.set(prefs.KEYS.lang, code);
      applyMeta();
      applyI18n();
      updateLangButtons();
      runRenderers();
      if (reader.dialog && reader.dialog.open) renderReader(false);
      langListeners.forEach(function (fn) { fn(lang); });
    }).catch(function () { toast({ icon: "info", title: t("lang.loadError") }); });
  }

  /* ------------------------------------------------------------- helpers */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }

  var ICONS = {
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/><path d="M8 7h8M8 11h5"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    bolt: '<path d="M13 2.5 4.5 13.5h6.5l-1 8 8.5-11h-6.5z"/>',
    swatch: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/>',
    telegram: '<path d="M21.5 4.5 2.8 11.6l6.1 2.1 2.3 6.3 3.4-4.2 5 3.7z"/><path d="m8.9 13.7 12.6-9.2"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/>',
    share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.3 10.9 7.4-3.7M8.3 13.1l7.4 3.7"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
    user: '<circle cx="12" cy="8.5" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    school: '<path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5M22 9v6"/>',
    shield: '<path d="M12 3 4.5 6v6c0 4.4 3.2 7.9 7.5 9 4.3-1.1 7.5-4.6 7.5-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5h.01"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    access: '<circle cx="12" cy="4.5" r="1.6"/><path d="M5 8.5 12 10l7-1.5M12 10v4l-3 6.5M12 14l3 6.5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    sparkle: '<path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"/><path d="M19 15.5c.3 1.8 1 2.5 2.5 2.8-1.5.3-2.2 1-2.5 2.7-.3-1.7-1-2.4-2.5-2.7 1.5-.3 2.2-1 2.5-2.8z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    message: '<path d="M4 5h16v11H9.5L4 20z"/><path d="M8 9.5h8M8 12.5h5"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    type: '<path d="M4 7V5h16v2M12 5v14M9 19h6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    hash: '<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>',
    grid: '<rect x="3.5" y="3.5" width="5" height="5" rx="1.2"/><rect x="9.5" y="3.5" width="5" height="5" rx="1.2"/><rect x="15.5" y="3.5" width="5" height="5" rx="1.2"/><rect x="3.5" y="9.5" width="5" height="5" rx="1.2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1.2" fill="currentColor"/><rect x="15.5" y="9.5" width="5" height="5" rx="1.2"/><rect x="3.5" y="15.5" width="5" height="5" rx="1.2"/><rect x="9.5" y="15.5" width="5" height="5" rx="1.2"/><rect x="15.5" y="15.5" width="5" height="5" rx="1.2"/>',
    wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
    sound: '<path d="M4 9.5v5h4l5 4v-13l-5 4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    mute: '<path d="M4 9.5v5h4l5 4v-13l-5 4z"/><path d="m17 9.5 5 5M22 9.5l-5 5"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v3M8 21h8M9 21v-4h6v4"/>',
    neuron: '<circle cx="12" cy="12" r="3.2"/><path d="M12 8.8V3M9.5 10 5 6M14.5 10 19 6M9.4 13.6 4.5 17M14.6 13.6 19.5 17M12 15.2V21"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    printer: '<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v6.5H7z"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    bookmark: '<path d="M6 3.5h12v17l-6-4-6 4z"/>',
    bookmarkOn: '<path d="M6 3.5h12v17l-6-4-6 4z" fill="currentColor"/>',
    flag: '<path d="M5 21V4h11.5l-2 4 2 4H5"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    home: '<path d="m3 11 9-7.5 9 7.5"/><path d="M5.5 9.5V20h13V9.5"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3.5" y="14" width="4.5" height="6.5" rx="1.5"/><rect x="16" y="14" width="4.5" height="6.5" rx="1.5"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5"/>',
    bot: '<rect x="4" y="8" width="16" height="12" rx="4"/><path d="M12 8V4.5M9 13.5h.01M15 13.5h.01M9.5 17h5"/><circle cx="12" cy="3.5" r="1"/>',
    textSize: '<path d="M3 19 8 5l5 14M4.8 14h6.4M14 19l3.5-9 3.5 9M15.2 16h4.6"/>',
    contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'
  };

  function icon(name, cls) {
    return '<svg class="icon ' + (cls || "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONS[name] || "") + "</svg>";
  }

  function externalAttrs() { return ' target="_blank" rel="noopener noreferrer"'; }
  function srExternal() { return '<span class="sr-only"> ' + esc(t("a11y.external")) + "</span>"; }
  function instagramUrl() { return CFG.instagramHandle ? "https://www.instagram.com/" + encodeURIComponent(CFG.instagramHandle) + "/" : null; }
  function telegramUrl() { return CFG.telegramHandle ? "https://t.me/" + encodeURIComponent(CFG.telegramHandle) : null; }
  function telegramBotUrl(start) { return CFG.telegramBot ? "https://t.me/" + encodeURIComponent(CFG.telegramBot) + (start ? "?start=" + encodeURIComponent(start) : "") : null; }
  function initials(name) { return String(name || "").trim().split(/s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join(""); }
  function telegramContactUrl() { var h = CFG.telegramContact || CFG.telegramHandle; return h ? "https://t.me/" + encodeURIComponent(h) : null; }
  function mailtoUrl(subjectKey, bodyKey) {
    if (!CFG.contactEmail) return null;
    return "mailto:" + CFG.contactEmail + "?subject=" + encodeURIComponent(t(subjectKey || "join.subject.general")) +
      (bodyKey ? "&body=" + encodeURIComponent(t(bodyKey)) : "");
  }

  // A dashed, obviously temporary stand-in for a missing config value.
  function placeholderChip(text, iconName) {
    if (!CFG.showPlaceholders) return "";
    return '<span class="btn btn-placeholder" aria-disabled="true">' + (iconName ? icon(iconName) : "") +
      "<span>" + esc(text) + '</span><span class="tbd">' + esc(t("common.tbd")) + "</span></span>";
  }

  /* ---------------------------------------------------------- characters */

  // The Medulla character system: transparent cut-outs of the original sheet.
  var CHARACTERS = {
    dendi: { name: "Dendi", w: 194, h: 280, tint: "#EFEDFF", guide: true },
    memo:  { name: "Memo",  w: 276, h: 229, tint: "#E8E5FF" },
    octa:  { name: "Octa",  w: 198, h: 233, tint: "#F3F1FF" },
    syno:  { name: "Syno",  w: 168, h: 248, tint: "#ECE9FF" },
    lumi:  { name: "Lumi",  w: 160, h: 161, tint: "#FFF3E6" }
  };
  var CHARACTER_ORDER = ["dendi", "memo", "octa", "syno", "lumi"];

  function charImg(id, cls, alt, eager) {
    var c = CHARACTERS[id] || CHARACTERS.memo;
    return '<img src="' + ROOT + "assets/characters/" + id + '.webp" width="' + c.w + '" height="' + c.h + '" alt="' + esc(alt || "") + '"' +
      (cls ? ' class="' + cls + '"' : "") + (eager ? "" : ' loading="lazy"') + ' decoding="async">';
  }

  /* -------------------------------------------------------- facts loader */

  var factsPromise = null;
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script"); s.src = src; s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
    });
  }
  // data/facts.json is the source of truth. Pages opened straight from disk
  // (file://) can't fetch(), so they use the generated mirror data/facts.js.
  function loadFacts() {
    if (factsPromise) return factsPromise;
    var fromMirror = function () {
      return loadScript(ROOT + "data/facts.js").then(function () {
        if (!Array.isArray(window.MEDULLA_FACTS)) throw new Error("facts.js did not define MEDULLA_FACTS");
        return window.MEDULLA_FACTS;
      });
    };
    factsPromise = (location.protocol === "file:" ? fromMirror() :
      fetch(ROOT + "data/facts.json").then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).catch(fromMirror))
      .then(function (f) { Store.setTotalFacts(f.length); return f; });
    return factsPromise;
  }
  function loadJSON(path, fallback) {
    if (location.protocol === "file:") return Promise.resolve(fallback);
    return fetch(ROOT + path).then(function (r) { return r.ok ? r.json() : fallback; }).catch(function () { return fallback; });
  }

  function todayIndex(n) {
    var now = new Date();
    var day = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(now.getFullYear(), 0, 0)) / 86400000);
    return n ? day % n : 0;
  }
  // Reaction poses (assets/characters/poses/<character>-<pose>.webp). Only poses that exist are listed;
  // anything else falls back to the normal character image.
  var POSES = {
    dendi: ["hello", "curious", "aha", "correct", "tryagain", "win", "inhale", "exhale", "asleep"],
    lumi:  ["hello", "curious", "aha", "correct", "tryagain", "win", "inhale", "exhale", "asleep"],
    memo:  ["hello", "curious", "aha", "correct", "tryagain", "win", "inhale", "exhale", "asleep"],
    octa:  ["hello", "curious", "aha", "correct", "tryagain", "win", "inhale", "exhale", "asleep"],
    syno:  ["hello", "curious", "correct", "tryagain", "win"]
  };
  function poseImg(id, pose, cls, eager) {
    if (!CHARACTERS[id] || (POSES[id] || []).indexOf(pose) === -1) return charImg(id, cls, "", eager);
    return '<img src="' + ROOT + "assets/characters/poses/" + id + "-" + pose + '.webp" alt=""' +
      (cls ? ' class="' + cls + '"' : "") + (eager ? "" : ' loading="lazy"') + ' decoding="async">';
  }
  function factChar(f) { return CHARACTERS[f.character] ? f.character : "memo"; }
  function topicName(f) { return t("topic." + f.topic); }
  function publisher(f) { return ((f.source && f.source.name) || "").split(" — ")[0]; }
  function factUrl(f) { return ROOT + "facts/" + f.id + ".html"; }

  function reviewBadge(fact) {
    if (fact.reviewed) return "";
    return '<span class="review-badge" title="' + esc(t("common.pendingReview")) + '">' + icon("clock") + esc(t("common.pendingReview")) + "</span>";
  }
  function sourceLine(fact) {
    var src = fact.source || {};
    if (!src.url) return "";
    return '<p class="fact-source"><span>' + esc(t("common.source")) + '</span> <a href="' + esc(src.url) + '"' + externalAttrs() + ">" +
      esc(src.name) + icon("external", "icon-sm") + srExternal() + "</a></p>";
  }

  function readFact(fact) {
    Store.record("fact", { id: fact.id });
    if (window.MedullaBackend) window.MedullaBackend.bump("facts_read", Store.get().club);
  }

  /* --------------------------------------------------------------- toasts */

  var toastBox = null;
  function toast(o) {
    if (!toastBox) {
      toastBox = document.createElement("div");
      toastBox.className = "toasts";
      toastBox.setAttribute("role", "status");
      toastBox.setAttribute("aria-live", "polite");
      document.body.appendChild(toastBox);
    }
    var el = document.createElement("div");
    el.className = "toast" + (o.tone ? " is-" + o.tone : "");
    el.innerHTML = (o.char ? '<span class="toast-art" style="--tint:' + CHARACTERS[o.char].tint + '">' + charImg(o.char, "", "", true) + "</span>"
      : '<span class="toast-icon">' + icon(o.icon || "sparkle") + "</span>") +
      '<span class="toast-text"><strong>' + esc(o.title || "") + "</strong>" + (o.text ? "<span>" + esc(o.text) + "</span>" : "") + "</span>";
    toastBox.appendChild(el);
    while (toastBox.children.length > 3) toastBox.firstChild.remove();
    requestAnimationFrame(function () { el.classList.add("is-in"); });
    setTimeout(function () { el.classList.remove("is-in"); el.classList.add("is-out"); setTimeout(function () { el.remove(); }, 400); }, o.ms || 3800);
  }

  var BADGE_INDEX = {};
  ((window.MedullaStore || {}).badges || []).forEach(function (b) { BADGE_INDEX[b.id] = b; });

  document.addEventListener("medulla:progress", function (e) {
    var d = e.detail || {};
    var S = window.MedullaSound, Mo = window.MedullaMotion;
    (d.badges || []).forEach(function (id, i) {
      setTimeout(function () {
        toast({ char: BADGE_INDEX[id].char, title: t("badge.unlocked"), text: t("badge." + id + ".name"), tone: "badge", ms: 5200 });
        if (S) S.badge();
        if (Mo) Mo.burst();
      }, i * 700);
    });
    if (d.levelUp) {
      toast({ icon: "neuron", title: t("level.up", { n: Store.level().level }), text: t("level.upText"), tone: "level" });
      if (S) S.streak();
    } else if (d.streak > 1) {
      toast({ icon: "neuron", title: t("streak.toast", { n: d.streak }), text: t("streak.toastText"), tone: "streak" });
      if (S) S.streak();
    } else if (d.xp >= 10 && !(d.badges || []).length) {
      toast({ icon: "sparkle", title: t("xp.gained", { n: d.xp }), ms: 2400 });
    }
    updateMePill();
  });

  /* --------------------------------------------------------- fact reader */

  var reader = { dialog: null, list: [], index: 0, opener: null };

  function ensureReader() {
    if (reader.dialog) return;
    var d = document.createElement("dialog");
    d.className = "reader";
    d.setAttribute("aria-labelledby", "reader-heading");
    d.innerHTML =
      '<div class="reader-head"><p data-i18n="reader.title"></p>' +
        '<div class="btn-row"><span class="muted reader-count"></span>' +
        '<button type="button" class="icon-btn" data-reader-close data-i18n-attr="aria-label:reader.close">' + icon("close") + "</button></div></div>" +
      '<div class="reader-body"></div>' +
      '<div class="reader-foot">' +
        '<button type="button" class="btn btn-ghost btn-sm press" data-reader-prev>' + icon("arrowLeft") + '<span data-i18n="reader.prev"></span></button>' +
        '<div class="dots" aria-hidden="true"></div>' +
        '<button type="button" class="btn btn-primary btn-sm press" data-reader-next><span data-i18n="reader.next"></span>' + icon("arrow") + "</button>" +
      "</div>";
    document.body.appendChild(d);
    applyI18n(d);
    reader.dialog = d;
    d.querySelector("[data-reader-close]").addEventListener("click", function () { d.close(); });
    d.querySelector("[data-reader-prev]").addEventListener("click", function () { turn(-1); });
    d.querySelector("[data-reader-next]").addEventListener("click", function () { turn(1); });
    d.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); turn(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); turn(-1); }
    });
    d.addEventListener("click", function (e) { if (e.target === d) d.close(); });
    d.addEventListener("close", function () {
      var o = reader.opener;
      if (o && !document.contains(o) && o.getAttribute("data-read") !== null) o = document.querySelector('[data-read="' + o.getAttribute("data-read") + '"]');
      if (o && document.contains(o)) o.focus();
    });
  }
  function turn(step) {
    var next = reader.index + step;
    if (next < 0 || next >= reader.list.length) return;
    reader.index = next;
    renderReader(true);
  }
  function renderReader(animate) {
    var fact = reader.list[reader.index];
    if (!fact) return;
    var who = factChar(fact), d = reader.dialog;
    d.querySelector(".reader-body").innerHTML =
      '<div class="reader-spread' + (animate && !reducedMotion.matches ? " reader-turn" : "") + '">' +
        '<div class="reader-cover"><div><span class="chip">' + esc(topicName(fact)) + "</span></div>" +
          poseImg(who, "aha", "idle idle-float", true) +
          '<p class="presenter">' + esc(t("reader.presenter", { name: CHARACTERS[who].name })) + "</p></div>" +
        '<div class="reader-page">' +
          '<div class="fact-meta" style="justify-content:flex-start;margin-bottom:14px">' + reviewBadge(fact) + "</div>" +
          '<h2 id="reader-heading">' + esc(localized(fact.title) || "") + "</h2>" +
          '<p class="fact-text">' + esc(localized(fact.simple) || "") + "</p>" +
          sourceLine(fact) +
          '<div class="btn-row" style="margin-top:16px"><a class="btn btn-ghost btn-sm" href="' + factUrl(fact) + '">' + icon("book") + "<span>" + esc(t("reader.fullPage")) + "</span></a></div>" +
          (fact.reviewed ? "" : '<p class="reader-note">' + icon("info") + "<span>" + esc(t("reader.note")) + "</span></p>") +
        "</div>" +
      "</div>";
    d.querySelector(".reader-count").textContent = t("reader.counter", { i: reader.index + 1, n: reader.list.length });
    d.querySelector(".dots").innerHTML = reader.list.map(function (f, i) { return '<span class="' + (i === reader.index ? "is-on" : "") + '"></span>'; }).join("");
    d.querySelector("[data-reader-prev]").disabled = reader.index === 0;
    d.querySelector("[data-reader-next]").disabled = reader.index === reader.list.length - 1;
    readFact(fact);
  }
  function openReader(list, index, opener) {
    if (!list || !list.length) return;
    ensureReader();
    reader.list = list;
    reader.index = Math.max(0, Math.min(index || 0, list.length - 1));
    reader.opener = opener || document.activeElement;
    renderReader(false);
    if (typeof reader.dialog.showModal === "function") reader.dialog.showModal(); else reader.dialog.setAttribute("open", "");
  }

  /* ----------------------------------------------------------- lab utils */

  function msText(v) { return v === null || v === undefined ? "—" : fmt(Math.round(v)) + " " + t("lab.ms"); }

  // Small bar chart of reaction times; the fastest bar is highlighted.
  function barsHtml(times) {
    if (!times || !times.length) {
      return '<div class="bars is-empty" aria-hidden="true">' + [55, 80, 45, 70, 60].map(function (h) { return '<div class="bar" style="height:' + h + '%"></div>'; }).join("") + "</div>";
    }
    var max = Math.max.apply(null, times), min = Math.min.apply(null, times);
    return '<div class="bars" role="img" aria-label="' + esc(times.map(function (v) { return Math.round(v) + " " + t("lab.ms"); }).join(", ")) + '">' +
      times.map(function (v) {
        return '<div class="bar' + (v === min ? " is-best" : "") + '" style="height:' + Math.max(12, Math.round((v / max) * 100)) + '%"><span>' + fmt(Math.round(v)) + "</span></div>";
      }).join("") + "</div>";
  }

  /* -------------------------------------------------------- header/footer */

  var NAV = [
    { page: "home", href: "index.html", key: "nav.home" },
    { page: "explore", href: "explore.html", key: "nav.explore", primary: true },
    { page: "learn", href: "learn.html", key: "nav.learn", primary: true },
    { page: "lab", href: "lab.html", key: "nav.lab", primary: true },
    { page: "parents", href: "parents.html", key: "nav.parents", primary: true },
    { page: "events", href: "events.html", key: "nav.events" },
    { page: "activities", href: "activities.html", key: "nav.activities" },
    { page: "about", href: "about.html", key: "nav.about", primary: true },
    { page: "partners", href: "partners.html", key: "nav.partners" },
    { page: "join", href: "join.html", key: "nav.join" },
    { page: "glossary", href: "glossary.html", key: "nav.glossary" },
    { page: "accessibility", href: "accessibility.html", key: "nav.accessibility" },
    { page: "privacy", href: "privacy.html", key: "nav.privacy" }
  ];

  function navLinks(header) {
    return NAV.map(function (n) {
      var current = n.page === page || (page === "fact" && n.page === "learn") || (page === "topic" && n.page === "learn");
      return "<li" + (header && !n.primary ? ' class="nav-more"' : "") + '><a href="' + ROOT + n.href + '"' +
        (current ? ' aria-current="page"' : "") + ' data-i18n="' + n.key + '"></a></li>';
    }).join("");
  }

  function brandHtml() {
    return '<a class="brand" href="' + ROOT + 'index.html" data-i18n-attr="aria-label:a11y.homeLink">' +
      '<span class="brand-mark"><img src="' + ROOT + 'assets/brand/logo-96.webp" width="40" height="40" alt=""></span>' +
      '<span class="brand-text"><span class="brand-name">Medulla</span><span class="brand-tag" data-i18n="brand.tagline"></span></span></a>';
  }

  function renderHeader() {
    var header = document.getElementById("site-header");
    if (!header) return;
    var langButtons = I18N.languages.map(function (l) {
      return '<button type="button" class="lang-btn" data-lang="' + l.code + '" lang="' + l.code + '" aria-label="' + esc(l.name) + '">' + esc(l.label) + "</button>";
    }).join("");
    header.innerHTML =
      '<div class="container header-inner">' + brandHtml() +
        '<nav class="site-nav" id="site-nav" data-i18n-attr="aria-label:a11y.mainNav"><ul>' + navLinks(true) + "</ul></nav>" +
        '<div class="header-tools">' +
          '<div class="lang-switch wide-only" role="group" data-i18n-attr="aria-label:lang.label">' + langButtons + "</div>" +
          '<button type="button" class="icon-btn sound-btn mid-only" data-sound-toggle aria-pressed="false" data-i18n-attr="aria-label:sound.toggle;title:sound.toggle">' + icon("mute", "icon-off") + icon("sound", "icon-on") + "</button>" +
          '<button type="button" class="icon-btn ax-toggle" id="display-toggle" aria-expanded="false" aria-controls="a11y-drawer" data-i18n-attr="aria-label:ax.buttonAria;title:ax.buttonAria">' + icon("access") + '<span class="ax-toggle-text" data-i18n="ax.button"></span></button>' +
          '<a class="me-pill" href="' + ROOT + 'explore.html" data-me-pill></a>' +
          '<a class="btn btn-primary btn-sm header-cta press" href="' + ROOT + 'join.html"><span data-i18n="nav.cta"></span></a>' +
          '<button type="button" class="icon-btn menu-btn" id="menu-toggle" aria-expanded="false" aria-controls="site-nav" data-i18n-attr="aria-label:nav.menu">' + icon("menu", "icon-open") + icon("close", "icon-close") + "</button>" +
        "</div>" +
      "</div>";
    updateMePill();
  }

  function updateMePill() {
    var el = document.querySelector("[data-me-pill]");
    if (!el) return;
    var s = Store.get(), lv = Store.level(), av = (s.profile && s.profile.avatar) || "dendi";
    el.innerHTML = '<span class="me-avatar" style="--tint:' + CHARACTERS[av].tint + '">' + charImg(av, "", "", true) + "</span>" +
      '<span class="me-text">' + esc(s.xp > 0 ? t("me.level", { n: lv.level }) : t("me.start")) + "</span>";
    el.setAttribute("aria-label", s.xp > 0 ? t("me.aria", { n: lv.level, xp: s.xp }) : t("me.start"));
    if (page === "explore") el.setAttribute("aria-current", "page");
  }

  function renderFooter() {
    var footer = document.getElementById("site-footer");
    if (!footer) return;
    footer.innerHTML =
      '<div class="container footer-grid">' +
        "<div>" + brandHtml() + '<p class="closing-line" data-i18n="brand.closing"></p></div>' +
        '<nav data-i18n-attr="aria-label:footer.pages"><p class="footer-heading" data-i18n="footer.pages"></p><ul class="footer-links">' + navLinks(false) + "</ul></nav>" +
        '<div><p class="footer-heading" data-i18n="footer.follow"></p><div class="follow-row" data-render="follow"></div>' +
          '<a class="footer-access" href="' + ROOT + 'accessibility.html">' + icon("access") + '<span><strong data-i18n="footer.accessTitle"></strong><small data-i18n="footer.accessText"></small></span></a></div>' +
      "</div>" +
      '<div class="container footer-bottom">' +
        '<p class="demo-note">' + icon("info") + '<span data-i18n="footer.demo"></span></p>' +
        '<p data-i18n="footer.medical"></p><p><span data-i18n="footer.copy"></span> · <a href="' + ROOT + 'privacy.html" data-i18n="nav.privacy"></a></p>' +
      "</div>";
  }

  function updateLangButtons() {
    document.querySelectorAll(".lang-btn").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-lang") === lang)); });
  }

  function updateSoundButtons() {
    var on = window.MedullaSound && window.MedullaSound.isOn();
    document.querySelectorAll("[data-sound-toggle]").forEach(function (b) { b.setAttribute("aria-pressed", String(!!on)); });
    document.querySelectorAll('[data-switch="sound"]').forEach(function (b) { b.setAttribute("aria-checked", String(!!on)); });
  }

  function setupHeader() {
    var menuBtn = document.getElementById("menu-toggle");
    var nav = document.getElementById("site-nav");
    var displayBtn = document.getElementById("display-toggle");
    if (!menuBtn) return;

    function setMenu(open) {
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.setAttribute("data-i18n-attr", "aria-label:" + (open ? "nav.closeMenu" : "nav.menu"));
      menuBtn.setAttribute("aria-label", t(open ? "nav.closeMenu" : "nav.menu"));
      nav.classList.toggle("is-open", open);
    }
    menuBtn.addEventListener("click", function () { var o = menuBtn.getAttribute("aria-expanded") !== "true"; setMenu(o); });
    displayBtn.addEventListener("click", function () { setMenu(false); if (window.MedullaAccess) window.MedullaAccess.toggle(displayBtn); });
    document.querySelectorAll(".lang-btn").forEach(function (b) { b.addEventListener("click", function () { setLang(b.getAttribute("data-lang")); }); });
    document.querySelectorAll("[data-sound-toggle]").forEach(function (b) {
      b.addEventListener("click", function () { window.MedullaSound.setEnabled(!window.MedullaSound.isOn()); });
    });
    document.addEventListener("medulla:sound", function (e) {
      updateSoundButtons();
      toast({ icon: e.detail.on ? "sound" : "mute", title: t(e.detail.on ? "sound.on" : "sound.off"), ms: 1800 });
    });
    updateSoundButtons();
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || (reader.dialog && reader.dialog.open)) return;
      if (nav.classList.contains("is-open")) { setMenu(false); menuBtn.focus(); }
    });
    document.addEventListener("click", function (e) {
      if (!document.getElementById("site-header").contains(e.target)) setMenu(false);
    });
  }

  /* ----------------------------------------------------------- renderers */

  var PILLARS = [
    { key: "edu", char: "memo", href: "learn.html" },
    { key: "social", char: "syno", href: "parents.html" },
    { key: "practical", char: "octa", href: "lab.html" }
  ];

  // Number of Brain Lab activities (js/games.js). tools/build.js checks it matches.
  var LAB_ACTIVITIES = 6;

  // Public "trust strip": only numbers that are real. Counted values from
  // js/config.js (null = not counted yet, so not shown) plus facts the site
  // can count itself (checked facts, Lab activities, languages).
  function trustStrip(el, items) {
    function cell(iconName, value, label, extra) {
      return '<li class="stat"><span class="tile">' + icon(iconName) + "</span>" + value + '<span class="stat-label">' + esc(label) + (extra || "") + "</span></li>";
    }
    function num(v, suffix) { return '<span class="stat-value" data-count="' + Number(v) + '" data-suffix="' + esc(suffix || "") + '">' + fmt(v) + esc(suffix || "") + "</span>"; }
    function draw(nFacts, live) {
      var out = [];
      items.forEach(function (item) {
        var v = item.value;
        if (item.live && live && typeof live[item.live] === "number") v = live[item.live];
        if (v === null || v === undefined) return;
        out.push(cell(item.icon || "sparkle", num(v, item.suffix), t("impact." + item.key), item.live ? ' <span class="live-dot" title="' + esc(t("impact.liveTitle")) + '"></span>' : ""));
      });
      if (nFacts) out.push(cell("book", num(nFacts), t("impact.factsChecked")));
      out.push(cell("target", num(LAB_ACTIVITIES), t("impact.labActivities")));
      out.push(cell("globe", num(I18N.languages.length), t("impact.languages")));
      el.className = el.className.replace(/\bstats-\d\b/g, "").trim() + " stats-" + out.length;
      el.innerHTML = out.join("");
      animateCounters(el);
    }
    draw(0, null);
    loadFacts().then(function (f) {
      draw(f.length, null);
      if (window.MedullaBackend && window.MedullaBackend.countersOn()) window.MedullaBackend.counters().then(function (r) { if (r.ok) draw(f.length, r.values); });
    }).catch(function () { /* keeps the first draw */ });
  }

  var renderers = {
    // Telegram bot card: what the bot does, and a button once the bot exists.
    botCard: function (el) {
      var url = telegramBotUrl("site");
      var icons = { fact: "book", quiz: "bolt", words: "bulb", breathe: "wind" };
      var feats = ["fact", "quiz", "words", "breathe"].map(function (k) {
        return "<li>" + icon(icons[k]) + "<span>" + esc(t("botcard." + k)) + "</span></li>";
      }).join("");
      el.innerHTML = '<div class="bot-card">' +
        '<div class="bot-card-art" aria-hidden="true"><span class="bot-bubble b1">/fact</span><span class="bot-bubble b2">/quiz</span><span class="bot-bubble b3">/word</span>' + charImg("dendi", "idle idle-dendi", "") + "</div>" +
        '<div class="bot-card-body"><p class="eyebrow">' + icon("bot") + "<span>" + esc(t("botcard.eyebrow")) + "</span></p>" +
          "<h3>" + esc(t("botcard.title")) + "</h3><p>" + esc(t("botcard.text")) + "</p>" +
          '<ul class="bot-feats">' + feats + "</ul>" +
          '<div class="btn-row">' + (url ? '<a class="btn btn-primary press" href="' + url + '"' + externalAttrs() + ">" + icon("telegram") + "<span>" + esc(t("botcard.open")) + "</span>" + srExternal() + "</a>"
            : '<span class="btn btn-soon" aria-disabled="true">' + icon("clock") + "<span>" + esc(t("botcard.soon")) + "</span></span>") +
          (telegramUrl() ? '<a class="btn btn-ghost press" href="' + telegramUrl() + '"' + externalAttrs() + ">" + icon("telegram") + "<span>@" + esc(CFG.telegramHandle) + "</span>" + srExternal() + "</a>" : "") +
          (instagramUrl() ? '<a class="btn btn-ghost press" href="' + instagramUrl() + '"' + externalAttrs() + ">" + icon("instagram") + "<span>@" + esc(CFG.instagramHandle) + "</span>" + srExternal() + "</a>" : "") + "</div>" +
          '<p class="bot-privacy">' + icon("lock") + "<span>" + esc(t("botcard.privacy")) + "</span></p>" +
        "</div></div>";
    },

    // Glossary page: every hard word with its plain-language meaning.
    glossaryList: function (el) {
      var draw = function (terms) {
        var list = terms.slice().sort(function (a, b) { return (localized(a.term) || "").localeCompare(localized(b.term) || "", lang); });
        el.innerHTML = '<div class="gl-tools"><label class="sr-only" for="gl-q">' + esc(t("glossary.search")) + "</label>" +
          '<span class="search-field">' + icon("search") + '<input id="gl-q" type="search" autocomplete="off" placeholder="' + esc(t("glossary.search")) + '"></span>' +
          '<p class="muted gl-count" aria-live="polite"></p></div>' +
          '<dl class="gl-list">' + list.map(function (g) {
            return '<div class="gl-item card" id="' + esc(g.id) + '" data-gl="' + esc(((localized(g.term) || "") + " " + (localized(g.def) || "")).toLowerCase()) + '">' +
              '<dt><span class="gl-term">' + esc(localized(g.term) || "") + "</span></dt>" +
              "<dd><p>" + esc(localized(g.def) || "") + "</p>" +
              '<div class="gl-actions"><button type="button" class="btn btn-ghost btn-sm press" data-gl-listen="' + esc(g.id) + '">' + icon("headphones") + "<span>" + esc(t("gloss.listen")) + "</span></button>" +
              (g.fact ? '<a class="text-link" href="' + ROOT + "facts/" + esc(g.fact) + '.html">' + esc(t("glossary.inFact")) + icon("arrow", "icon-sm") + "</a>" : "") +
              (g.reviewed ? "" : '<span class="review-badge">' + icon("clock") + esc(t("common.pendingReview")) + "</span>") + "</div></dd></div>";
          }).join("") + "</dl>";
        var q = el.querySelector("#gl-q"), count = el.querySelector(".gl-count");
        function filter() {
          var v = q.value.trim().toLowerCase(), n = 0;
          el.querySelectorAll(".gl-item").forEach(function (it) { var ok = !v || it.getAttribute("data-gl").indexOf(v) !== -1; it.hidden = !ok; if (ok) n++; });
          count.textContent = t("glossary.count", { n: n });
        }
        q.addEventListener("input", filter); filter();
        if (!el._wired) {
          el._wired = true;
          el.addEventListener("click", function (e) {
            var b = e.target.closest("[data-gl-listen]");
            if (!b || !window.MedullaAccess || !window.MedullaGlossary) return;
            window.MedullaGlossary.load().then(function () {
              var g = window.MedullaGlossary.term(b.getAttribute("data-gl-listen"));
              if (g) window.MedullaAccess.speak((localized(g.term) || "") + ". " + (localized(g.def) || ""));
            });
          });
        }
        if (location.hash) { var target = document.getElementById(location.hash.slice(1)); if (target) { target.classList.add("is-target"); target.scrollIntoView({ block: "center" }); } }
      };
      loadJSON("data/glossary.json", { terms: [] }).then(function (d) { draw((d && d.terms) || []); });
    },

    // Home page: one toggle chip per comfort profile.
    axChips: function (el) {
      var A = window.MedullaAccess;
      if (!A) { el.hidden = true; return; }
      var s = prefs.a11y();
      el.innerHTML = A.profiles.map(function (p) {
        var on = A.profileOn(p, s);
        return '<li><button type="button" data-ax-chip="' + p.id + '" aria-pressed="' + on + '" title="' + esc(t("ax.p." + p.id + ".for")) + '">' + icon(p.icon) + "<span>" + esc(t("ax.p." + p.id + ".title")) + "</span></button></li>";
      }).join("");
      if (!el._wired) {
        el._wired = true;
        el.addEventListener("click", function (e) {
          var b = e.target.closest("[data-ax-chip]");
          if (!b) return;
          var id = b.getAttribute("data-ax-chip");
          var p = A.profiles.filter(function (x) { return x.id === id; })[0], ch = {};
          var on = A.profileOn(p, prefs.a11y());
          for (var k in p.set) ch[k] = on ? prefs.DEFAULTS[k] : p.set[k];
          prefs.setA11y(ch);
          if (!on && p.mute && window.MedullaSound && window.MedullaSound.isOn()) window.MedullaSound.setEnabled(false);
          toast({ icon: "access", title: t(on ? "ax.profileOff" : "ax.profileOn", { name: t("ax.p." + id + ".title") }), ms: 2200 });
        });
        document.addEventListener("medulla:a11y", function () {
          var f = document.activeElement && el.contains(document.activeElement) ? document.activeElement.getAttribute("data-ax-chip") : null;
          renderers.axChips(el);
          if (f) { var n = el.querySelector('[data-ax-chip="' + f + '"]'); if (n) n.focus(); }
        });
      }
    },

    // Accessibility page: one card per comfort profile.
    axProfiles: function (el) {
      var A = window.MedullaAccess;
      if (!A) { el.innerHTML = ""; return; }
      var s = prefs.a11y();
      el.innerHTML = A.profiles.map(function (p) {
        var on = A.profileOn(p, s);
        return '<li class="card ax-pcard' + (on ? " is-on" : "") + '"><span class="ax-p-icon" aria-hidden="true">' + icon(p.icon) + "</span>" +
          "<h3>" + esc(t("ax.p." + p.id + ".title")) + "</h3>" +
          '<p class="ax-pfor">' + esc(t("ax.p." + p.id + ".for")) + "</p>" +
          "<p>" + esc(t("ax.p." + p.id + ".what")) + "</p>" +
          '<button type="button" class="btn ' + (on ? "btn-ghost" : "btn-primary") + ' btn-sm press" data-ax-apply="' + p.id + '" aria-pressed="' + on + '">' + icon(on ? "check" : "plus") + "<span>" + esc(t(on ? "ax.turnOff" : "ax.turnOn")) + "</span></button></li>";
      }).join("");
      if (!el._wired) {
        el._wired = true;
        el.addEventListener("click", function (e) {
          var b = e.target.closest("[data-ax-apply]");
          if (!b) return;
          var id = b.getAttribute("data-ax-apply");
          var p = A.profiles.filter(function (x) { return x.id === id; })[0], cur = prefs.a11y(), ch = {};
          var on = A.profileOn(p, cur);
          for (var k in p.set) ch[k] = on ? prefs.DEFAULTS[k] : p.set[k];
          prefs.setA11y(ch);
          if (!on && p.mute && window.MedullaSound && window.MedullaSound.isOn()) window.MedullaSound.setEnabled(false);
          toast({ icon: "access", title: t(on ? "ax.profileOff" : "ax.profileOn", { name: t("ax.p." + p.id + ".title") }), ms: 2200 });
          var nb = el.querySelector('[data-ax-apply="' + id + '"]'); if (nb) nb.focus();
        });
        document.addEventListener("medulla:a11y", function () {
          var f = document.activeElement && el.contains(document.activeElement) ? document.activeElement.getAttribute("data-ax-apply") : null;
          renderers.axProfiles(el);
          if (f) { var n = el.querySelector('[data-ax-apply="' + f + '"]'); if (n) n.focus(); }
        });
      }
    },

    characters: function (el) {
      var full = el.getAttribute("data-variant") === "full";
      el.innerHTML = CHARACTER_ORDER.map(function (id) {
        var c = CHARACTERS[id];
        return '<li class="char-card tilt' + (c.guide ? " is-guide" : "") + '" style="--tint:' + c.tint + '" data-tilt>' +
          '<div class="char-art">' + (c.guide ? '<span class="char-guide">' + esc(t("chars.guide")) + "</span>" : "") + charImg(id, "idle idle-" + id, "") + "</div>" +
          '<div class="char-body"><h3>' + esc(c.name) + ' <span class="char-kind">' + esc(t("char." + id + ".kind")) + "</span></h3>" +
            '<span class="chip char-trait">' + esc(t("char." + id + ".trait")) + "</span>" +
            '<p class="char-role">' + esc(t("char." + id + ".role")) + "</p>" +
            (full ? '<p class="char-pillar">' + esc(t("char." + id + ".line")) + "</p>" : "") +
          "</div></li>";
      }).join("");
      if (window.MedullaMotion) window.MedullaMotion.initTilt(el);
    },

    pillars: function (el) {
      var headingTag = el.getAttribute("data-heading") || "h3";
      el.innerHTML = PILLARS.map(function (p, i) {
        var c = CHARACTERS[p.char];
        var meta = p.key === "practical" ? t("pillar.practical.meta", { n: window.MedullaGames ? window.MedullaGames.list.length : 6 }) : p.key === "social" ? t("pillar.social.meta") : "";
        return '<li class="card pillar tilt" data-tilt><span class="pillar-num" aria-hidden="true">0' + (i + 1) + "</span>" +
          '<div class="pillar-art" style="--tint:' + c.tint + '">' + charImg(p.char, "idle idle-" + p.char, "") + "</div>" +
          "<" + headingTag + ">" + esc(t("pillar." + p.key + ".title")) + "</" + headingTag + ">" +
          '<p class="pillar-meta" data-pillar-meta="' + p.key + '">' + esc(meta) + "</p>" +
          "<p>" + esc(t("pillar." + p.key + ".text")) + "</p>" +
          '<a class="text-link" href="' + ROOT + p.href + '">' + esc(t("pillar." + p.key + ".cta")) + icon("arrow", "icon-sm") + "</a></li>";
      }).join("");
      loadFacts().then(function (facts) {
        var m = el.querySelector('[data-pillar-meta="edu"]');
        if (m) m.textContent = t("pillar.edu.meta", { n: facts.length });
      }).catch(function () { /* stays empty */ });
      if (window.MedullaMotion) window.MedullaMotion.initTilt(el);
    },

    // Impact bar: config values; items with `live` are filled from anonymous
    // backend counters when those are switched on, otherwise they stay "—".
    impact: function (el) {
      var items = (CFG.impact || []);
      if (!CFG.showPlaceholders) return trustStrip(el, items);
      function draw(live) {
        el.innerHTML = items.map(function (item) {
          var v = item.value;
          if (item.live && live && typeof live[item.live] === "number") v = live[item.live];
          var known = v !== null && v !== undefined;
          var value = known
            ? '<span class="stat-value" data-count="' + Number(v) + '" data-suffix="' + esc(item.suffix || "") + '">' + fmt(v) + esc(item.suffix || "") + "</span>"
            : '<span class="stat-value" aria-hidden="true">—</span><span class="sr-only">' + esc(t("common.notCounted")) + "</span>";
          return '<li class="stat' + (known ? "" : " is-placeholder-stat") + '">' +
            '<span class="tile">' + icon(item.icon || "sparkle") + "</span>" + value +
            '<span class="stat-label">' + esc(t("impact." + item.key)) + (item.live ? ' <span class="live-dot" title="' + esc(t("impact.liveTitle")) + '"></span>' : "") + "</span>" +
            (known ? "" : '<span class="tbd">' + esc(t("common.tbd")) + "</span>") + "</li>";
        }).join("");
        animateCounters(el);
      }
      draw(null);
      if (window.MedullaBackend && window.MedullaBackend.countersOn()) {
        window.MedullaBackend.counters().then(function (r) { if (r.ok) draw(r.values); });
      }
    },

    proof: function (el) {
      var f = (CFG.impact || []).filter(function (i) { return i.key === "followers"; })[0];
      var avatars = CHARACTER_ORDER.map(function (id) { return '<span class="avatar" style="--tint:' + CHARACTERS[id].tint + '">' + charImg(id, "", "") + "</span>"; }).join("");
      el.innerHTML = '<div class="avatars" aria-hidden="true">' + avatars + "</div>" +
        (f && f.value !== null ? "<p><strong>" + esc(t("home.proof.title", { n: fmt(f.value) + (f.suffix || "") })) + "</strong>" + esc(t("home.proof.text")) + "</p>" : "");
    },

    heroFact: function (el) {
      loadFacts().then(function (facts) {
        var i = todayIndex(facts.length), fact = facts[i];
        el.querySelector("strong").textContent = localized(fact.title) || "";
        el.setAttribute("href", factUrl(fact));
        el.onclick = function (e) { e.preventDefault(); openReader(facts, i, el); };
      }).catch(function () { /* keeps the plain link */ });
    },

    heroReader: function (el) {
      loadFacts().then(function (facts) {
        el.onclick = function (e) { e.preventDefault(); openReader(facts, todayIndex(facts.length), el); };
      }).catch(function () { /* keeps the plain link */ });
    },

    factOfDay: function (el) {
      loadFacts().then(function (facts) {
        if (!facts.length) return;
        var i = todayIndex(facts.length), fact = facts[i], who = factChar(fact);
        el.innerHTML =
          '<div class="feature">' +
            '<div class="feature-art"><p class="bubble">' + esc(t("fotd.says", { name: CHARACTERS[who].name })) + "</p>" + charImg(who, "idle idle-" + who, "") + "</div>" +
            '<div class="feature-body">' +
              '<div class="fact-meta" style="justify-content:flex-start"><span class="chip">' + esc(topicName(fact)) + "</span>" + reviewBadge(fact) + "</div>" +
              "<h3>" + esc(localized(fact.title) || "") + "</h3>" +
              '<p class="fact-text">' + esc(localized(fact.simple) || "") + "</p>" +
              sourceLine(fact) +
              '<div class="btn-row"><button type="button" class="btn btn-primary press" data-open-reader>' + icon("book") + "<span>" + esc(t("fotd.read")) + "</span></button>" +
              '<a class="text-link" href="' + factUrl(fact) + '">' + esc(t("fotd.page")) + icon("arrow", "icon-sm") + "</a></div>" +
            "</div>" +
          "</div>";
        el.querySelector("[data-open-reader]").addEventListener("click", function (e) { openReader(facts, i, e.currentTarget); });
      }).catch(function () { el.innerHTML = '<p class="muted">' + esc(t("fotd.error")) + "</p>"; });
    },

    labDash: function (el) {
      var r = Store.lastResult("reaction"), s = Store.lastResult("stroop"), best = Store.bestReaction();
      var effect = s && s.effect !== null && s.effect !== undefined ? (s.effect >= 0 ? "+" : "−") + msText(Math.abs(s.effect)) : null;
      el.innerHTML =
        '<div class="dash">' +
          '<div class="dash-card"><small>' + esc(t("lab.best")) + '</small><span class="metric' + (best ? "" : " is-empty") + '">' + esc(msText(best)) + "</span></div>" +
          '<div class="dash-card"><small>' + esc(t("lab.lastEffect")) + '</small><span class="metric' + (effect ? "" : " is-empty") + '">' + esc(effect || "—") + "</span></div>" +
          '<div class="dash-card is-wide"><small>' + esc(t("lab.lastTries")) + "</small>" + barsHtml(r && r.times) + "</div>" +
          '<div class="dash-card is-wide" style="padding-right:120px"><small>' + esc(t("lab.lastAccuracy")) + '</small><span class="metric' + (s ? "" : " is-empty") + '">' +
            esc(s ? fmt(s.accuracy, s.accuracy % 1 ? 1 : 0) + "%" : "—") + "</span>" +
            '<div class="meter" style="margin-top:10px"><span style="width:' + (s ? s.accuracy : 0) + '%"></span></div>' +
            '<span class="dash-host">' + charImg("octa", "idle idle-octa", "") + "</span></div>" +
        "</div>";
    },

    badgesPreview: function (el) {
      var s = Store.get(), limit = +(el.getAttribute("data-limit") || 0);
      var list = Store.badges.slice(0, limit || Store.badges.length);
      el.innerHTML = list.map(function (b) {
        var got = !!s.badges[b.id];
        return '<li class="badge' + (got ? " is-earned" : "") + '" style="--tint:' + CHARACTERS[b.char].tint + '">' +
          '<span class="badge-art">' + charImg(b.char, "", "") + (got ? "" : '<span class="badge-lock">' + icon("lock") + "</span>") + "</span>" +
          '<span class="badge-name">' + esc(t("badge." + b.id + ".name")) + "</span>" +
          '<span class="badge-how">' + esc(got ? t("badge.earned") : t("badge." + b.id + ".how")) + "</span></li>";
      }).join("");
    },

    team: function (el) {
      var compact = el.hasAttribute("data-compact");
      if (!CFG.showPlaceholders) {
        var people = (CFG.team || []).filter(function (m) { return localized(m.name); });
        el.innerHTML = people.map(function (m, i) {
          var name = localized(m.name), role = localized(m.role) || t("team.slot." + (m.slot || "member")), bio = localized(m.bio);
          var face = m.photo ? '<img class="photo" src="' + esc(ROOT + m.photo) + '" alt="' + esc(t("team.photoAlt", { name: name })) + '" width="160" height="160" loading="lazy">'
            : '<span class="photo initials" aria-hidden="true" style="--hue:' + ((i * 47) % 360) + '">' + esc(initials(name)) + "</span>";
          return '<li class="card person is-clean">' + face + '<div class="person-body"><h3>' + esc(name) + "</h3>" +
            '<p class="person-role">' + esc(role) + "</p>" + (!compact && bio ? '<p class="person-bio">' + esc(bio) + "</p>" : "") + "</div></li>";
        }).join("");
        return;
      }
      el.innerHTML = (CFG.team || []).map(function (m) {
        var slotName = t("team.slot." + (m.slot || "member"));
        var name = localized(m.name), role = localized(m.role), bio = localized(m.bio);
        var filled = name && role && bio && m.photo;
        var photo = m.photo
          ? '<img class="photo" src="' + esc(ROOT + m.photo) + '" alt="' + esc(t("team.photoAlt", { name: name || slotName })) + '" width="160" height="160" loading="lazy">'
          : '<div class="photo photo-slot">' + icon("user") + "<span>" + esc(t("team.photoTbd")) + "</span></div>";
        return '<li class="card person' + (filled ? "" : " is-placeholder") + '">' + photo +
          '<div class="person-body"><h3>' + esc(name || t("team.nameTbd", { slot: slotName })) + "</h3>" +
            '<p class="person-role">' + esc(role ? ((m.slot || "member") === "member" ? role : slotName + " · " + role) : (name ? slotName : t("team.roleTbd"))) + "</p>" +
            (compact ? "" : '<p class="person-bio">' + esc(bio || t("team.bioTbd")) + "</p>") +
          "</div>" + (filled ? "" : '<span class="tbd">' + esc(t("common.tbd")) + "</span>") + "</li>";
      }).join("");
    },

    advisors: function (el) {
      var list = CFG.advisors || [];
      if (!list.length && !CFG.showPlaceholders) {
        el.innerHTML = '<p class="soft-empty">' + icon("users") + "<span>" + esc(t("advisors.open")) + "</span></p>";
        return;
      }
      if (!list.length) {
        el.innerHTML = '<div class="advisor-row is-placeholder"><span class="avatar-slot">' + icon("user") + '</span><span class="avatar-slot">' + icon("user") + '</span><span class="avatar-slot">' + icon("user") + "</span>" +
          '<p class="advisor-soon">' + esc(t("advisors.soon")) + '</p><span class="tbd">' + esc(t("common.tbd")) + "</span></div>";
        return;
      }
      el.innerHTML = '<ul class="advisor-list">' + list.map(function (a) {
        return '<li class="advisor-chip">' + icon("user") + "<span><strong>" + esc(localized(a.name) || "") + "</strong>" + (a.field ? "<small>" + esc(localized(a.field)) + "</small>" : "") + "</span></li>";
      }).join("") + "</ul>";
    },

    partners: function (el) {
      var compact = el.hasAttribute("data-compact");
      var real = (CFG.partners || []).filter(function (p) { return p.logo || localized(p.name); });
      if (!real.length && !CFG.showPlaceholders && el.getAttribute("data-cta") === "none") {
        el.innerHTML = '<li class="soft-empty">' + icon("link") + "<span>" + esc(t("partners.openText")) + "</span></li>";
        return;
      }
      if (!real.length && !CFG.showPlaceholders) {
        el.innerHTML = '<li class="partner-cta"><span class="pc-icon">' + icon("plus") + '</span><span><strong>' + esc(t("partners.openTitle")) + "</strong><small>" + esc(t("partners.openText")) + "</small></span>" +
          '<a class="btn btn-ghost btn-sm press" href="' + ROOT + 'partners.html#become-partner">' + esc(t("partners.openButton")) + icon("arrow", "icon-sm") + "</a></li>";
        return;
      }
      if (!CFG.showPlaceholders) {
        el.innerHTML = real.map(function (p) {
          var name = localized(p.name), inner = p.logo ? '<img src="' + esc(ROOT + p.logo) + '" alt="' + esc(t("partners.logoAlt", { name: name || "" })) + '" loading="lazy">' : '<span class="partner-name">' + esc(name) + "</span>";
          if (p.url) inner = '<a href="' + esc(p.url) + '"' + externalAttrs() + ">" + inner + srExternal() + "</a>";
          return '<li class="partner">' + inner + "</li>";
        }).join("");
        return;
      }
      el.innerHTML = (CFG.partners || []).map(function (p) {
        var name = localized(p.name), inner;
        if (p.logo) inner = '<img src="' + esc(ROOT + p.logo) + '" alt="' + esc(t("partners.logoAlt", { name: name || "" })) + '" loading="lazy">';
        else if (name) inner = '<span class="partner-name">' + esc(name) + "</span>";
        else inner = icon("plus") + (compact ? '<span class="sr-only">' + esc(t("partners.slot")) + "</span>" : '<span class="partner-slot-text">' + esc(t("partners.slot")) + "</span>") + '<span class="tbd">' + esc(t("common.tbd")) + "</span>";
        if (p.url && (p.logo || name)) inner = '<a href="' + esc(p.url) + '"' + externalAttrs() + ">" + inner + srExternal() + "</a>";
        return '<li class="partner' + (p.logo || name ? "" : " is-placeholder") + '">' + inner + "</li>";
      }).join("");
    },

    follow: function (el) {
      var ig = instagramUrl(), tg = telegramUrl();
      el.innerHTML =
        (ig ? '<a class="btn btn-social press" href="' + ig + '"' + externalAttrs() + ">" + icon("instagram") + "<span>@" + esc(CFG.instagramHandle) + "</span>" + srExternal() + "</a>" : placeholderChip(t("social.instagram"), "instagram")) +
        (tg ? '<a class="btn btn-social press" href="' + tg + '"' + externalAttrs() + ">" + icon("telegram") + "<span>@" + esc(CFG.telegramHandle) + "</span>" + srExternal() + "</a>" : placeholderChip(t("social.telegramSoon"), "telegram"));
    },

    contact: function (el) {
      var mail = mailtoUrl("join.subject.general"), tg = telegramContactUrl();
      el.innerHTML =
        (mail ? '<a class="btn btn-light press" href="' + esc(mail) + '">' + icon("mail") + "<span>" + esc(t("join.emailButton")) + "</span></a>" : placeholderChip(t("join.emailTbd"), "mail")) +
        (tg ? '<a class="btn btn-outline-light press" href="' + tg + '"' + externalAttrs() + ">" + icon("telegram") + "<span>" + esc(t("join.telegramButton")) + "</span>" + srExternal() + "</a>" : placeholderChip(t("join.telegramTbd"), "telegram"));
    },

    // A mailto button, e.g. data-render="mailto" data-subject="join.subject.club" data-body="visit.body".
    mailto: function (el) {
      var mail = mailtoUrl(el.getAttribute("data-subject"), el.getAttribute("data-body"));
      var label = el.getAttribute("data-label") || "join.write";
      var tgc = telegramContactUrl();
      el.innerHTML = mail ? '<a class="btn ' + (el.getAttribute("data-style") || "btn-ghost") + ' press" href="' + esc(mail) + '">' + icon(el.getAttribute("data-icon") || "mail") + "<span>" + esc(t(label)) + "</span></a>"
        : tgc && !CFG.showPlaceholders ? '<a class="btn ' + (el.getAttribute("data-style") || "btn-ghost") + ' press" href="' + tgc + '"' + externalAttrs() + ">" + icon("telegram") + "<span>" + esc(t(label)) + "</span>" + srExternal() + "</a>"
        : placeholderChip(t("join.emailTbd"), "mail");
    },

    share: function (el) {
      el.innerHTML = '<button type="button" class="btn btn-ghost press">' + icon("share") + "<span>" + esc(t("join.share.button")) + "</span></button>" + '<p class="share-status" role="status"></p>';
      var btn = el.querySelector("button"), status = el.querySelector(".share-status");
      btn.addEventListener("click", function () {
        var url = CFG.domain || window.location.href.split("#")[0];
        if (navigator.share) navigator.share({ title: "Medulla", text: t("join.share.text2"), url: url }).catch(function () { /* cancelled */ });
        else if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(function () { status.textContent = t("join.share.copied"); }, function () { status.textContent = t("join.share.manual", { url: url }); });
        else status.textContent = t("join.share.manual", { url: url });
      });
    },

    // Kindness wall: only messages the team approved (data/kindness.json).
    kindnessWall: function (el) {
      loadJSON("data/kindness.json", { messages: [] }).then(function (data) {
        var list = (data && data.messages) || [];
        if (!list.length) {
          el.innerHTML = '<div class="empty-state">' + charImg("syno", "idle idle-syno", "") + "<h3>" + esc(t("kind.wallEmptyTitle")) + "</h3><p>" + esc(t("kind.wallEmpty")) + "</p></div>";
          return;
        }
        el.innerHTML = '<ul class="kind-wall">' + list.map(function (m) {
          return '<li class="kind-note" style="--r:' + ((m.id || 0) % 5 - 2) + 'deg">' + charImg(m.character || "syno", "", "") + "<p>" + esc(localized(m.text) || "") + "</p></li>";
        }).join("") + "</ul>";
      });
    },

    // Parents' resource directory: starts empty until entries are verified.
    resources: function (el) {
      loadJSON("data/resources.json", { resources: [] }).then(function (data) {
        var list = (data && data.resources) || [];
        if (!list.length) {
          el.innerHTML = '<div class="empty-state">' + icon("shield") + "<h3>" + esc(t("parents.dirEmptyTitle")) + "</h3><p>" + esc(t("parents.dirEmpty")) + "</p>" + (CFG.showPlaceholders ? '<span class="tbd">' + esc(t("common.tbd")) + "</span>" : "") + "</div>";
          return;
        }
        el.innerHTML = '<ul class="resource-list">' + list.map(function (r) {
          return '<li class="card"><h3>' + esc(localized(r.name) || "") + "</h3><p>" + esc(localized(r.what) || "") + "</p>" +
            (r.url ? '<a class="text-link" href="' + esc(r.url) + '"' + externalAttrs() + ">" + esc(t("common.visit")) + icon("external", "icon-sm") + srExternal() + "</a>" : "") +
            '<p class="muted" style="font-size:.85rem">' + esc(t("parents.verifiedOn", { date: r.verified || "—" })) + "</p></li>";
        }).join("") + "</ul>";
      });
    }
  };

  function runRenderers(scope) {
    (scope || document).querySelectorAll("[data-render]").forEach(function (el) {
      var fn = renderers[el.getAttribute("data-render")];
      if (fn) fn(el);
    });
  }

  function renderIcons(scope) {
    (scope || document).querySelectorAll("[data-icon]").forEach(function (el) { el.innerHTML = icon(el.getAttribute("data-icon")); });
  }

  function renderChars(scope) {
    (scope || document).querySelectorAll("img[data-char]").forEach(function (img) {
      var id = img.getAttribute("data-char"), c = CHARACTERS[id];
      if (!c) return;
      img.src = ROOT + "assets/characters/" + id + ".webp";
      img.width = c.w; img.height = c.h;
    });
  }

  /* ------------------------------------------------------------ counters */

  var countersDone = false;
  function animateCounters(scope) {
    var nodes = scope.querySelectorAll("[data-count]");
    if (!nodes.length || countersDone || reducedMotion.matches || root.classList.contains("calm") || !("IntersectionObserver" in window)) return;
    function run(node) {
      var target = Number(node.getAttribute("data-count")), suffix = node.getAttribute("data-suffix") || "", start = null;
      function step(ts) {
        if (start === null) start = ts;
        var p = Math.min(1, (ts - start) / 1200);
        node.textContent = fmt(Math.round(target * (1 - Math.pow(1 - p, 3)))) + suffix;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (!entry.isIntersecting) return; io.unobserve(entry.target); countersDone = true; run(entry.target); });
    }, { threshold: 0.6 });
    nodes.forEach(function (n) { io.observe(n); });
  }

  /* ----------------------------------------------------------------- init */

  var VISIT_PAGES = ["home", "learn", "lab", "explore", "parents", "events", "activities", "about", "partners", "join", "fact", "topic"];

  window.Medulla = {
    t: t, fmt: fmt, esc: esc, icon: icon, localized: localized,
    lang: function () { return lang; },
    langInfo: langInfo,
    root: function () { return ROOT; },
    page: function () { return page; },
    onLangChange: function (fn) { langListeners.push(fn); },
    ready: function (fn) { if (isReady) fn(); else readyQueue.push(fn); },
    loadFacts: loadFacts,
    loadJSON: loadJSON,
    todayIndex: todayIndex,
    openReader: openReader,
    readFact: readFact,
    reviewBadge: reviewBadge,
    sourceLine: sourceLine,
    publisher: publisher,
    factUrl: factUrl,
    factChar: factChar,
    topicName: topicName,
    barsHtml: barsHtml,
    msText: msText,
    charImg: charImg,
    poseImg: poseImg,
    characters: CHARACTERS,
    characterOrder: CHARACTER_ORDER,
    toast: toast,
    applyI18n: applyI18n,
    runRenderers: runRenderers,
    renderIcons: renderIcons,
    mailtoUrl: mailtoUrl,
    placeholderChip: placeholderChip,
    reducedMotion: function () { return reducedMotion.matches || root.classList.contains("calm"); },
    // Timing multiplier for memory games ("More time" setting).
    pace: function () { return root.classList.contains("a11y-slow") ? 1.6 : 1; },
    initials: initials,
    telegramBotUrl: telegramBotUrl,
    externalAttrs: externalAttrs,
    srExternal: srExternal
  };

  function init() {
    root.classList.toggle("show-tbd", !!CFG.showPlaceholders);
    renderHeader();
    renderFooter();
    renderIcons();
    renderChars();
    applyMeta();
    runRenderers();
    applyI18n();
    updateLangButtons();
    setupHeader();
    root.classList.remove("i18n-wait");
    if (window.MedullaMotion) window.MedullaMotion.init();
    if (VISIT_PAGES.indexOf(page) !== -1) Store.record("visit", { page: page });
    isReady = true;
    readyQueue.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
    readyQueue = [];

    // Offline support (not for file:// pages).
    if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
      navigator.serviceWorker.register(ROOT + "sw.js").catch(function () { /* offline mode just won't be available */ });
    }
    // Inside Telegram (Mini App), load the small adapter.
    var inTelegram = /tgWebAppData|tgWebAppPlatform/.test(location.hash);
    try { if (inTelegram) sessionStorage.setItem("medulla.tg", "1"); inTelegram = inTelegram || sessionStorage.getItem("medulla.tg") === "1"; } catch (e) { /* ignore */ }
    if (inTelegram) loadScript(ROOT + "js/telegram.js").catch(function () { /* not essential */ });
  }

  I18N.load(lang)
    .catch(function () { lang = "en"; return I18N.load("en"); })
    .then(init)
    .catch(function (err) { root.classList.remove("i18n-wait"); console.error("Medulla could not start:", err); });
})();
