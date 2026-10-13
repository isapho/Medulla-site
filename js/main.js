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

  // Medulla icon set: rounded 2 px strokes, a soft tinted body (.f), solid
  // accents (.d) and a small shine (.s). Colours follow currentColor, so the
  // same icon works on white, on purple buttons and in the dark theme.
  var ICONS = {
    book: '<path class="f" d="M12 6.6C10.2 5 7.9 4.4 4.6 4.7c-.6.1-1.1.6-1.1 1.2v11.4c0 .7.6 1.2 1.3 1.2 3-.2 5.2.4 7.2 2 2-1.6 4.2-2.2 7.2-2 .7 0 1.3-.5 1.3-1.2V5.9c0-.6-.5-1.1-1.1-1.2-3.3-.3-5.6.3-7.4 1.9z"/><path d="M12 6.6v13.6"/><path class="s" d="M6.4 8.2c1.2-.1 2.3 0 3.2.4"/>',
    heart: '<path class="f" d="M12 20.3c-.3 0-.6-.1-.9-.3C7.4 17 3.4 13.8 3.4 9.4 3.4 6.6 5.5 4.5 8.1 4.5c1.6 0 3 .8 3.9 2.1.9-1.3 2.3-2.1 3.9-2.1 2.6 0 4.7 2.1 4.7 4.9 0 4.4-4 7.6-7.7 10.6-.3.2-.6.3-.9.3z"/><path class="s" d="M6.3 8.6c.2-1 .9-1.7 1.9-1.9"/>',
    target: '<circle class="f" cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.6"/><circle class="d" cx="12" cy="12" r="1.7"/>',
    bolt: '<path class="f" d="M13.2 2.9 5.4 12.6c-.5.6-.1 1.6.7 1.6h4.6l-.9 6.2c-.1.9 1 1.4 1.6.7l7.6-9.7c.5-.6.1-1.6-.7-1.6h-4.6l.9-6.2c.1-.9-1-1.4-1.6-.7z"/>',
    swatch: '<rect class="f" x="3.5" y="3.5" width="7.4" height="7.4" rx="2.6"/><rect x="13.1" y="3.5" width="7.4" height="7.4" rx="2.6"/><rect x="3.5" y="13.1" width="7.4" height="7.4" rx="2.6"/><rect class="f" x="13.1" y="13.1" width="7.4" height="7.4" rx="2.6"/>',
    instagram: '<rect class="f" x="3" y="3" width="18" height="18" rx="5.6"/><circle cx="12" cy="12" r="4"/><circle class="d" cx="17.2" cy="6.8" r="1.25"/>',
    telegram: '<path class="f" d="M20.4 4.3 3.6 10.9c-.9.4-.9 1.6 0 1.9l4.2 1.4 1.6 5c.3.8 1.3 1 1.8.4l2.3-2.5 4.3 3.1c.7.5 1.6.1 1.8-.7l2.5-12.9c.2-.9-.7-1.6-1.6-1.3z"/><path d="m7.9 14.2 9.2-6.4-6.1 7.4"/>',
    mail: '<rect class="f" x="3" y="5" width="18" height="14" rx="3.6"/><path d="m4.2 7.6 6.6 5c.7.5 1.7.5 2.4 0l6.6-5"/>',
    share: '<circle class="f" cx="6" cy="12" r="2.9"/><circle class="f" cx="18" cy="5.9" r="2.9"/><circle class="f" cx="18" cy="18.1" r="2.9"/><path d="m8.6 10.6 6.8-3.3M8.6 13.4l6.8 3.3"/>',
    users: '<circle class="f" cx="9" cy="8" r="3.6"/><path class="f" d="M2.8 19.4c0-3.4 2.8-6 6.2-6s6.2 2.6 6.2 6c0 .6-.5 1.1-1.1 1.1H3.9c-.6 0-1.1-.5-1.1-1.1z"/><path d="M15.8 4.6a3.4 3.4 0 0 1 0 6.8M17.8 13.8c2 .7 3.4 2.5 3.4 4.7"/>',
    user: '<circle class="f" cx="12" cy="8.3" r="4.1"/><path class="f" d="M4.5 19.8c0-3.9 3.4-6.7 7.5-6.7s7.5 2.8 7.5 6.7c0 .7-.5 1.2-1.2 1.2H5.7c-.7 0-1.2-.5-1.2-1.2z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    school: '<path class="f" d="m2.6 9.1 8.5-4.3c.6-.3 1.3-.3 1.8 0l8.5 4.3-8.5 4.3c-.6.3-1.3.3-1.8 0z"/><path d="M6 11.4V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.6M21.4 9.4v5.1"/>',
    shield: '<path class="f" d="M11.3 3.3 5.4 5.6c-.6.2-.9.7-.9 1.3V12c0 4.3 3.1 7.7 7.5 9 4.4-1.3 7.5-4.7 7.5-9V6.9c0-.6-.4-1.1-.9-1.3l-5.9-2.3c-.5-.2-1-.2-1.4 0z"/><path d="m8.8 12.1 2.3 2.3 4.2-4.6"/>',
    info: '<circle class="f" cx="12" cy="12" r="9"/><path d="M12 11v5.4"/><circle class="d" cx="12" cy="7.6" r="1.3"/>',
    lock: '<rect class="f" x="4.5" y="10.4" width="15" height="10.6" rx="3.3"/><path d="M8 10.4V8a4 4 0 0 1 8 0v2.4"/><circle class="d" cx="12" cy="15.7" r="1.5"/>',
    access: '<circle class="f" cx="12" cy="12" r="9.4"/><circle class="d" cx="12" cy="7.2" r="1.6"/><path d="M7.4 10.1 12 11l4.6-.9M12 11v3.1l-2.3 3.9M12 14.1l2.3 3.9"/>',
    search: '<circle class="f" cx="11" cy="11" r="7"/><path d="m20 20-3.9-3.9"/><path class="s" d="M7.9 9.4a3.6 3.6 0 0 1 2.4-2.2"/>',
    menu: '<path d="M4.5 7h15M4.5 12h15M4.5 17h15"/>',
    close: '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>',
    arrow: '<path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5"/>',
    arrowLeft: '<path d="M19 12H5M10.5 6.5 5 12l5.5 5.5"/>',
    external: '<path d="M14 4h6v6M20 4l-8.5 8.5"/><path d="M18 14v4.5c0 .8-.7 1.5-1.5 1.5h-11c-.8 0-1.5-.7-1.5-1.5v-11C4 6.7 4.7 6 5.5 6H10"/>',
    sparkle: '<path class="f" d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"/><path class="f" d="M19 15.5c.3 1.8 1 2.5 2.5 2.8-1.5.3-2.2 1-2.5 2.7-.3-1.7-1-2.4-2.5-2.7 1.5-.3 2.2-1 2.5-2.8z"/>',
    clock: '<circle class="f" cx="12" cy="12" r="9"/><path d="M12 7.4V12l3.1 2"/>',
    message: '<path class="f" d="M5.6 4.5h12.8c1.2 0 2.1.9 2.1 2.1v7.8c0 1.2-.9 2.1-2.1 2.1h-7.9l-4.3 3.4c-.6.4-1.4 0-1.4-.7v-2.9c-.9-.3-1.4-1.1-1.4-1.9V6.6c0-1.2.9-2.1 2.2-2.1z"/><path d="M8.5 9.4h7M8.5 12.4H13"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    globe: '<circle class="f" cx="12" cy="12" r="9"/><path d="M3.4 12h17.2M12 3a13.5 13.5 0 0 1 0 18M12 3a13.5 13.5 0 0 0 0 18"/>',
    eye: '<path class="f" d="M2.6 12.6c-.3-.4-.3-.9 0-1.3C4.3 8.7 7.6 5.5 12 5.5s7.7 3.2 9.4 5.8c.3.4.3.9 0 1.3-1.7 2.6-5 5.9-9.4 5.9s-7.7-3.3-9.4-5.9z"/><circle cx="12" cy="12" r="3.3"/><circle class="d" cx="12" cy="12" r="1.3"/>',
    type: '<path d="M4.5 7V5.5h15V7M12 5.5v13M9 18.5h6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    play: '<path class="d" d="M8 6.3v11.4c0 .9 1 1.4 1.7 1l9-5.7c.7-.4.7-1.5 0-1.9l-9-5.7C9 4.9 8 5.4 8 6.3z"/>',
    pause: '<rect class="d" x="6.4" y="5" width="4.2" height="14" rx="1.7"/><rect class="d" x="13.4" y="5" width="4.2" height="14" rx="1.7"/>',
    chart: '<rect class="f" x="3.5" y="11" width="4.2" height="9" rx="1.6"/><rect class="f" x="9.9" y="4" width="4.2" height="16" rx="1.6"/><rect class="f" x="16.3" y="13" width="4.2" height="7" rx="1.6"/>',
    trash: '<path class="f" d="M6 7.5h12l-.9 11.5c-.1 1.1-1 2-2.1 2H9c-1.1 0-2-.9-2.1-2z"/><path d="M4 7.5h16M10 11v6M14 11v6M9 7.5V5.4C9 4.6 9.6 4 10.4 4h3.2c.8 0 1.4.6 1.4 1.4v2.1"/>',
    hash: '<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>',
    grid: '<rect x="3.5" y="3.5" width="5" height="5" rx="1.7"/><rect x="9.5" y="3.5" width="5" height="5" rx="1.7"/><rect x="15.5" y="3.5" width="5" height="5" rx="1.7"/><rect x="3.5" y="9.5" width="5" height="5" rx="1.7"/><rect class="d" x="9.5" y="9.5" width="5" height="5" rx="1.7"/><rect x="15.5" y="9.5" width="5" height="5" rx="1.7"/><rect x="3.5" y="15.5" width="5" height="5" rx="1.7"/><rect x="9.5" y="15.5" width="5" height="5" rx="1.7"/><rect class="f" x="15.5" y="15.5" width="5" height="5" rx="1.7"/>',
    wind: '<path d="M3 8.5h10.5a3 3 0 1 0-3-3M3 12.5h15.5a3 3 0 1 1-3 3M3 16.5h7"/>',
    moon: '<path class="f" d="M19.6 14.9c.4-.8-.4-1.6-1.2-1.3-.8.3-1.7.4-2.6.4a6.6 6.6 0 0 1-6.6-6.6c0-.9.2-1.8.5-2.6.3-.8-.5-1.6-1.3-1.2A8.4 8.4 0 1 0 19.6 14.9z"/><path class="s" d="M6.8 10.2c.2-1.2.8-2.2 1.6-3"/>',
    sound: '<path class="f" d="M4 10.1v3.8c0 .6.5 1.1 1.1 1.1H8l4.3 3.6c.7.6 1.7.1 1.7-.8V6.2c0-.9-1-1.4-1.7-.8L8 9H5.1c-.6 0-1.1.5-1.1 1.1z"/><path d="M17 9a4.6 4.6 0 0 1 0 6M19.4 6.6a8 8 0 0 1 0 10.8"/>',
    mute: '<path class="f" d="M4 10.1v3.8c0 .6.5 1.1 1.1 1.1H8l4.3 3.6c.7.6 1.7.1 1.7-.8V6.2c0-.9-1-1.4-1.7-.8L8 9H5.1c-.6 0-1.1.5-1.1 1.1z"/><path d="m17 9.5 5 5M22 9.5l-5 5"/>',
    star: '<path class="f" d="m12.9 3.6 2.1 4.4 4.8.7c.9.1 1.2 1.2.6 1.8l-3.5 3.4.8 4.8c.2.9-.8 1.5-1.5 1.1L12 17.5l-4.3 2.3c-.7.4-1.7-.2-1.5-1.1l.8-4.8-3.5-3.4c-.6-.6-.3-1.7.6-1.8l4.8-.7 2.1-4.4c.4-.8 1.6-.8 1.9 0z"/>',
    trophy: '<path class="f" d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4.5a3 3 0 0 0 2.8 4M17 6h2.5a3 3 0 0 1-2.8 4M12 14v3M8.5 20.5h7M9.5 20.5v-3.5h5v3.5"/><path class="s" d="M9.5 6.5v2"/>',
    neuron: '<circle class="f" cx="12" cy="12" r="3.6"/><path d="M12 8.4V4.6M9.5 10 6 6.5M14.5 10 18 6.5M9.4 13.8 5.6 16.8M14.6 13.8l3.8 3M12 15.6v3.6"/><circle class="d" cx="12" cy="3.6" r="1.5"/><circle class="d" cx="5.4" cy="5.9" r="1.5"/><circle class="d" cx="18.6" cy="5.9" r="1.5"/><circle class="d" cx="4.9" cy="17.4" r="1.5"/><circle class="d" cx="19.1" cy="17.4" r="1.5"/><circle class="d" cx="12" cy="20.3" r="1.5"/>',
    calendar: '<rect class="f" x="3.5" y="5" width="17" height="15.5" rx="3.4"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle class="d" cx="8.5" cy="14.5" r="1.2"/><circle class="d" cx="12" cy="14.5" r="1.2"/>',
    printer: '<path d="M7 9V4.5c0-.6.4-1 1-1h8c.6 0 1 .4 1 1V9"/><rect class="f" x="3.5" y="9" width="17" height="8" rx="2.6"/><rect x="7" y="14" width="10" height="6.5" rx="1.2"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    bookmark: '<path class="f" d="M7.5 3.5h9c.8 0 1.5.7 1.5 1.5v14.6c0 .8-.9 1.3-1.6.8L12 17.3l-4.4 3.1c-.7.5-1.6 0-1.6-.8V5c0-.8.7-1.5 1.5-1.5z"/>',
    bookmarkOn: '<path class="d" d="M7.5 3.5h9c.8 0 1.5.7 1.5 1.5v14.6c0 .8-.9 1.3-1.6.8L12 17.3l-4.4 3.1c-.7.5-1.6 0-1.6-.8V5c0-.8.7-1.5 1.5-1.5z"/>',
    flag: '<path d="M5 21V4.5"/><path class="f" d="M5 4.5h11.3c.8 0 1.3.9.9 1.5L15.5 8.5l1.7 2.5c.4.7-.1 1.5-.9 1.5H5"/>',
    bulb: '<path class="f" d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z"/><path d="M9.5 18.5h5M10.5 21h3"/><path class="s" d="M9.6 7.6c.4-.8 1.1-1.4 1.9-1.7"/>',
    home: '<path class="f" d="M4.5 10.2 11 4.6c.6-.5 1.4-.5 2 0l6.5 5.6c.3.3.5.7.5 1.1v7.9c0 .8-.7 1.4-1.4 1.4H15v-5.2c0-.6-.4-1-1-1h-4c-.6 0-1 .4-1 1v5.2H5.4c-.8 0-1.4-.6-1.4-1.4v-7.9c0-.4.2-.8.5-1.1z"/>',
    compass: '<circle class="f" cx="12" cy="12" r="9"/><path class="d" d="m15.7 8.3-2 5.1c-.1.2-.2.3-.4.4l-5.1 2 2-5.1c.1-.2.2-.3.4-.4z"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4.5V11h-6.5"/>',
    sun: '<circle class="f" cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect class="f" x="3.5" y="14" width="4.6" height="6.6" rx="2"/><rect class="f" x="15.9" y="14" width="4.6" height="6.6" rx="2"/>',
    copy: '<rect class="f" x="8.5" y="8.5" width="12" height="12" rx="2.6"/><path d="M15.5 8.5V5.6c0-1.2-.9-2.1-2.1-2.1H5.6c-1.2 0-2.1.9-2.1 2.1v7.8c0 1.2.9 2.1 2.1 2.1h2.9"/>',
    bot: '<rect class="f" x="4" y="8" width="16" height="12" rx="4.2"/><path d="M12 8V4.6M9.5 17h5"/><circle class="d" cx="12" cy="3.6" r="1.3"/><circle class="d" cx="9" cy="13.2" r="1.4"/><circle class="d" cx="15" cy="13.2" r="1.4"/>',
    textSize: '<path d="M3 19 8 5l5 14M4.8 14h6.4M14 19l3.5-9 3.5 9M15.2 16h4.6"/>',
    contrast: '<circle class="f" cx="12" cy="12" r="9"/><path class="d" d="M12 3a9 9 0 0 1 0 18z"/>',
    sliders: '<path d="M4 6h9.5M18.5 6H20M4 12h3.5M12.5 12H20M4 18h11.5"/><circle class="f" cx="16" cy="6" r="2.4"/><circle class="f" cx="10" cy="12" r="2.4"/><circle class="f" cx="18" cy="18" r="2.4"/>',
    logout: '<path class="f" d="M5.6 3.5h6.2c1.2 0 2.1.9 2.1 2.1v12.8c0 1.2-.9 2.1-2.1 2.1H5.6c-1.2 0-2.1-.9-2.1-2.1V5.6c0-1.2.9-2.1 2.1-2.1z"/><path d="M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5"/>',
    // App top bar (2.5): the brain map, today's quests, the Lab flask, the streak flame.
    brain: '<path class="f" d="M12 5.2c-.8-1.3-2.4-1.9-3.9-1.4-1.3.4-2.2 1.5-2.4 2.8-1.6.4-2.7 1.9-2.6 3.6-1.1.8-1.6 2.3-1.1 3.7.3.8.8 1.4 1.5 1.8-.1 1.9 1.3 3.6 3.2 3.8.9 1.2 2.5 1.7 3.9 1.2.5-.2 1-.5 1.4-.9.4.4.9.7 1.4.9 1.4.5 3 0 3.9-1.2 1.9-.2 3.3-1.9 3.2-3.8.7-.4 1.2-1 1.5-1.8.5-1.4 0-2.9-1.1-3.7.1-1.7-1-3.2-2.6-3.6-.2-1.3-1.1-2.4-2.4-2.8-1.5-.5-3.1.1-3.9 1.4z"/><path d="M12 5.2v14.6"/><path stroke-width="1.6" d="M8.4 8.6c1 .1 1.8.8 2 1.8M6.4 13.4c.9-.6 2.2-.5 3 .3M15.6 8.6c-1 .1-1.8.8-2 1.8M17.6 13.4c-.9-.6-2.2-.5-3 .3"/>',
    quest: '<rect class="f" x="3.5" y="5" width="17" height="15.5" rx="3.6"/><path d="M8 3v4M16 3v4"/><path d="m8.4 13.4 2.5 2.5 4.8-4.9"/>',
    flask: '<path class="f" d="M9.6 3.6v5.5l-4.8 8.3c-.9 1.6.2 3.6 2 3.6h10.4c1.8 0 2.9-2 2-3.6l-4.8-8.3V3.6"/><path d="M8.2 3.6h7.6M7.3 14.6h9.4"/><circle class="d" cx="10.7" cy="17.6" r="1.15"/><circle class="d" cx="14" cy="16.9" r=".85"/>',
    flame: '<path class="f" d="M12 21.2c-4 0-6.9-2.8-6.9-6.5 0-2.6 1.4-4.6 3-6.2.5-.5 1.3-.1 1.3.6 0 1.2.6 2.2 1.5 2.6.2-2.6 1.3-5.4 3.6-7.4.5-.4 1.2-.1 1.3.5.4 2.4 1.6 3.9 2.6 5.3 1 1.4 1.5 2.9 1.5 4.6 0 3.8-3 6.5-7.9 6.5z"/><path class="d" d="M12 21.2c-1.8 0-3.1-1.2-3.1-2.9 0-1.5 1-2.6 2.2-3.6.4-.3.9-.1 1 .3.2.8.7 1.3 1.3 1.6.3-.6.5-1.3.5-2 0-.4.5-.7.8-.4 1.1 1 1.8 2.3 1.8 3.7 0 1.9-1.9 3.3-4.5 3.3z"/>',
    // Instagram and Telegram together (the follower count covers both).
    social: '<rect class="f" x="2.6" y="2.6" width="12.2" height="12.2" rx="3.9"/><circle cx="8.7" cy="8.7" r="2.7"/><circle class="d" cx="11.9" cy="5.5" r=".9"/><circle class="f" cx="16.3" cy="16.3" r="5.6"/><path d="m13.4 16.2 5.6-2.3-1 5.1-2.1-1.5-1 1.2-.2-1.9z"/>'
  };

  function icon(name, cls) {
    return '<svg class="icon ' + (cls || "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
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

  // The Medulla character system: the team's art, cut out of green-screen
  // sheets by tools/cutout.mjs (512 × 512 WebP, same body size in every pose).
  // Warm tints contrast with the purple characters.
  var CHARACTERS = {
    dendi: { name: "Dendi", w: 240, h: 240, tint: "#FFF1E4", guide: true },
    memo:  { name: "Memo",  w: 240, h: 240, tint: "#FFF5EC" },
    octa:  { name: "Octa",  w: 240, h: 240, tint: "#FFF2E9" },
    syno:  { name: "Syno",  w: 240, h: 240, tint: "#FFF0E6" },
    lumi:  { name: "Lumi",  w: 240, h: 240, tint: "#E9E6FF" }
  };
  var CHARACTER_ORDER = ["dendi", "memo", "octa", "syno", "lumi"];
  // The expression each character shows when you point at its card.
  var CHAR_HOVER = { dendi: "aha", memo: "hello", octa: "curious", syno: "correct", lumi: "hello" };

  function charImg(id, cls, alt, eager) {
    var c = CHARACTERS[id] || CHARACTERS.memo;
    return '<img src="' + ROOT + "assets/characters/" + id + '.webp" width="' + c.w + '" height="' + c.h + '" alt="' + esc(alt || "") + '"' +
      (cls ? ' class="' + cls + '"' : "") + (eager ? "" : ' loading="lazy"') + ' decoding="async">';
  }
  // Head-and-shoulders crop for avatars and small circles.
  function charFace(id, cls, eager) {
    if (!CHARACTERS[id]) id = "memo";
    return '<img src="' + ROOT + "assets/characters/faces/" + id + '.webp" width="64" height="64" alt=""' +
      (cls ? ' class="' + cls + '"' : "") + (eager ? "" : ' loading="lazy"') + ' decoding="async">';
  }

  // Avatars (2.5): a character, an expression and a background, picked in "Men".
  // Every picture shows the whole character (assets/characters/avatars/, made
  // by tools/avatars.mjs); "face" is the normal ("classic") image. Two backgrounds
  // are rewards that open at a level, as in Finch.
  var AVATAR_MOODS = ["face", "hello", "correct", "win", "aha", "curious", "focus", "inhale", "asleep"];
  var AVATAR_BGS = {
    tint: { bg: null },
    lav: { bg: "#E9E6FF" },
    peach: { bg: "#FFE0C2" },
    purple: { bg: "linear-gradient(150deg, #9C90FA, #6C5CE7 55%, #4B3BC4)" },
    night: { bg: "radial-gradient(circle at 30% 25%, #3A4290, #0D1128 75%)" },
    sunset: { bg: "linear-gradient(160deg, #A29BFE, #6C5CE7 45%, #FF9F43)", level: 3 },
    galaxy: { bg: "radial-gradient(circle at 70% 20%, #FFF 0 1.2%, transparent 2%), radial-gradient(circle at 22% 70%, #FFC28C 0 1.5%, transparent 2.4%), radial-gradient(circle at 30% 30%, #6C5CE7, #1B1F4F 60%, #0D1128)", level: 5 }
  };
  var AVATAR_BG_ORDER = ["tint", "lav", "peach", "purple", "night", "sunset", "galaxy"];
  function avatarSrc(id, mood) {
    if (!CHARACTERS[id]) id = "dendi";
    return ROOT + "assets/characters/avatars/" + id + "-" + (mood && mood !== "face" && AVATAR_MOODS.indexOf(mood) !== -1 ? mood : "classic") + ".webp";
  }
  function avatarBgOpen(key) { var b = AVATAR_BGS[key]; return !!b && (!b.level || Store.level().level >= b.level); }
  function avatarBg(id, key) { var b = AVATAR_BGS[key]; return (b && b.bg && avatarBgOpen(key)) ? b.bg : (CHARACTERS[id] || CHARACTERS.dendi).tint; }
  // Inline style for an avatar holder. A chosen background goes in --avbg
  // (data-avbg), so the dark theme, which darkens every --tint, keeps it.
  function avatarStyle(id, key) {
    var tint = (CHARACTERS[id] || CHARACTERS.dendi).tint, bg = avatarBg(id, key);
    return bg === tint ? ' style="--tint:' + tint + '"' : ' style="--tint:' + tint + ";--avbg:" + bg + '" data-avbg';
  }
  // <span class="cls"> with the picture; p = { avatar, mood, bg } (a profile).
  function avatarPic(p, cls) {
    var id = CHARACTERS[p.avatar] ? p.avatar : "dendi", mood = AVATAR_MOODS.indexOf(p.mood) > 0 ? p.mood : "face";
    return '<span class="' + cls + ' is-mood"' + avatarStyle(id, p.bg) + '><img src="' + avatarSrc(id, mood) +
      '" width="64" height="64" alt="" decoding="async"></span>';
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
  // Expressions (assets/characters/poses/<character>-<pose>.webp). Every character
  // has every pose; "love" uses the happy "correct" face; anything unknown falls
  // back to the normal character image.
  var POSES = ["hello", "curious", "aha", "correct", "tryagain", "focus", "win", "inhale", "exhale", "asleep", "love"];
  var POSE_ALIAS = { love: "correct" };
  function poseSrc(id, pose) {
    if (pose === "face") return ROOT + "assets/characters/faces/" + id + ".webp";
    if (pose === "avatar") return ROOT + "assets/characters/avatars/" + id + "-classic.webp";
    pose = POSE_ALIAS[pose] || pose;
    return ROOT + "assets/characters/" + (POSES.indexOf(pose) === -1 ? id : "poses/" + id + "-" + pose) + ".webp";
  }
  function poseImg(id, pose, cls, eager) {
    if (!CHARACTERS[id] || POSES.indexOf(pose) === -1) return charImg(id, cls, "", eager);
    return '<img src="' + poseSrc(id, pose) + '" width="240" height="240" alt=""' +
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
    el.innerHTML = (o.char ? '<span class="toast-art" style="--tint:' + CHARACTERS[o.char].tint + '">' + poseImg(o.char, o.pose || "win", "", true) + "</span>"
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
    if (d.network) {
      toast({ char: "dendi", pose: "win", title: t("map.networkToast"), text: t("map.networkToastText"), tone: "level", ms: 5200 });
      if (S) S.badge();
      if (Mo) Mo.burst();
    } else if (d.levelUp) {
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

  // Two interfaces (2.3).
  //  - The public site (landing, about, parents, events, partners, join …):
  //    site header with "Sign in" / "Get started", full footer.
  //  - The app (<html data-shell="app">: Mening Medullam, facts, Lab,
  //    printables, hard words): sidebar on wide screens; top bar, slide-in
  //    menu and bottom tab bar on phones; a small footer.
  // "Signing in" (start.html) only creates or reopens the profile kept on this
  // device. js/prefs.js sends signed-in visitors from the landing to the app
  // and guests from the dashboard to start.html.
  var isApp = root.getAttribute("data-shell") === "app";

  var SITE_NAV = [
    { page: "about", href: "about.html", key: "nav.about" },
    { page: "parents", href: "parents.html", key: "nav.parents" },
    { page: "events", href: "events.html", key: "nav.events" },
    { page: "partners", href: "partners.html", key: "nav.partners" },
    { page: "join", href: "join.html", key: "nav.join" }
  ];
  var FOOTER_GROUPS = [
    { key: "footer.site", links: [["home", "index.html", "nav.home"]].concat(SITE_NAV.map(function (n) { return [n.page, n.href, n.key]; })) },
    { key: "footer.app", links: [["explore", "explore.html", "nav.explore"], ["learn", "learn.html", "nav.learn"], ["lab", "lab.html", "nav.lab"],
      ["activities", "activities.html", "nav.activities"], ["glossary", "glossary.html", "nav.glossary"]] }
  ];

  // App navigation (2.4): a game-style top bar, a menu behind the avatar and,
  // on phones, a bottom tab bar. member: needs a profile. routes: the hash
  // routes of explore.html that belong to an item; pages: the data-page values.
  var APP_ITEMS = {
    map: { href: "explore.html#/", key: "app.map", icon: "brain", routes: [""], member: true },
    daily: { href: "explore.html#/daily", key: "explore.tab.daily", icon: "quest", routes: ["daily"], member: true },
    learn: { href: "learn.html", key: "nav.learn", icon: "book", pages: ["learn", "fact", "topic"] },
    lab: { href: "lab.html", key: "nav.lab", tabKey: "app.tab.lab", icon: "flask", pages: ["lab"] },
    me: { href: "explore.html#/me", key: "app.me", icon: "user", routes: ["me", "badges", "saved", "history"], member: true },
    badges: { href: "explore.html#/badges", key: "explore.tab.badges", icon: "trophy", routes: ["badges"], member: true },
    saved: { href: "explore.html#/saved", key: "explore.tab.saved", icon: "bookmark", routes: ["saved"], member: true },
    history: { href: "explore.html#/history", key: "explore.tab.history", icon: "chart", routes: ["history"], member: true },
    activities: { href: "activities.html", key: "nav.activities", tabKey: "app.tab.activities", icon: "printer", pages: ["activities"] },
    glossary: { href: "glossary.html", key: "nav.glossary", tabKey: "app.tab.glossary", icon: "bulb", pages: ["glossary"] }
  };
  var TABS = { member: ["map", "daily", "learn", "lab", "me"], guest: ["learn", "lab", "activities", "glossary"] };

  function member() { return Store.isSignedIn(); }
  // The landing for guests; for signed-in visitors ?site=1 (else it sends them to the app).
  function homeHref() { return ROOT + (member() ? "index.html?site=1" : "index.html"); }
  function startHref() {
    var here = page === "fact" || page === "topic" ? location.pathname.split("/").slice(-2).join("/") : location.pathname.split("/").pop();
    return ROOT + "start.html" + (isApp && here && /\.html$/.test(here) ? "?next=" + encodeURIComponent(here) : "");
  }
  function appItem(id) {
    if (id === "signin") return { id: "signin", href: startHref(), key: "nav.signIn", icon: "user", raw: true };
    return APP_ITEMS[id] ? Object.assign({ id: id }, APP_ITEMS[id]) : null;
  }
  function route() { return page === "explore" ? location.hash.replace(/^#\/?/, "") : null; }
  // The tab that is "here" (the Me tab covers badges, saved and results too).
  function appCurrent() {
    var ids = Object.keys(APP_ITEMS), r = route();
    if (r !== null) return ids.filter(function (id) { return (APP_ITEMS[id].routes || []).indexOf(r) !== -1; })[0] || "map";
    return ids.filter(function (id) { return (APP_ITEMS[id].pages || []).indexOf(page) !== -1; })[0] || null;
  }

  function brandHtml(href, labelKey) {
    return '<a class="brand" href="' + (href || homeHref()) + '" data-i18n-attr="aria-label:' + (labelKey || "a11y.homeLink") + '">' +
      '<span class="brand-mark"><img src="' + ROOT + 'assets/brand/logo-mark-96.webp" width="40" height="40" alt=""></span>' +
      '<span class="brand-text"><span class="brand-name">Medulla</span><span class="brand-tag" data-i18n="brand.tagline"></span></span></a>';
  }
  function langButtons(always) {
    return '<div class="lang-switch' + (always ? "" : " wide-only") + '" role="group" data-i18n-attr="aria-label:lang.label">' + I18N.languages.map(function (l) {
      return '<button type="button" class="lang-btn" data-lang="' + l.code + '" lang="' + l.code + '" aria-label="' + esc(l.name) + '">' + esc(l.label) + "</button>";
    }).join("") + "</div>";
  }
  function axButton() {
    return '<button type="button" class="icon-btn ax-toggle" id="display-toggle" aria-expanded="false" aria-controls="a11y-drawer" data-i18n-attr="aria-label:ax.buttonAria;title:ax.buttonAria">' + icon("access") + '<span class="ax-toggle-text" data-i18n="ax.button"></span></button>';
  }
  function soundButton(always) {
    return '<button type="button" class="icon-btn sound-btn' + (always ? "" : " mid-only") + '" data-sound-toggle aria-pressed="false" data-i18n-attr="aria-label:sound.toggle;title:sound.toggle">' + icon("mute", "icon-off") + icon("sound", "icon-on") + "</button>";
  }
  function avatarHtml() { return avatarPic(Store.get().profile || {}, "me-avatar"); }

  /* public site */

  // Guests: "Sign in" + "Get started". Signed in: "Mening Medullam" with their avatar.
  function authHtml() {
    if (member()) return '<a class="btn btn-primary btn-sm press app-pill" href="' + ROOT + 'explore.html">' + avatarHtml() + '<span data-i18n="nav.openApp"></span></a>';
    return '<a class="btn btn-ghost btn-sm press auth-in' + "" + '" href="' + ROOT + 'start.html"><span data-i18n="nav.signIn"></span></a>' +
      '<a class="btn btn-primary btn-sm press auth-start" href="' + ROOT + 'start.html"><span data-i18n="nav.start"></span></a>';
  }

  function renderSiteHeader(header) {
    header.innerHTML =
      '<div class="container header-inner">' + brandHtml() +
        '<nav class="site-nav" id="site-nav" data-i18n-attr="aria-label:a11y.mainNav"><ul>' + SITE_NAV.map(function (n) {
          return '<li><a href="' + ROOT + n.href + '"' + (n.page === page ? ' aria-current="page"' : "") + ' data-i18n="' + n.key + '"></a></li>';
        }).join("") + '</ul><div class="nav-auth">' + authHtml() + "</div></nav>" +
        '<div class="header-tools">' + langButtons() + axButton() +
          '<span class="header-auth">' + authHtml() + "</span>" +
          '<button type="button" class="icon-btn menu-btn" id="menu-toggle" aria-expanded="false" aria-controls="site-nav" data-i18n-attr="aria-label:nav.menu">' + icon("menu", "icon-open") + icon("close", "icon-close") + "</button>" +
        "</div>" +
      "</div>";
  }

  function renderSiteFooter(footer) {
    footer.innerHTML =
      '<div class="container footer-grid footer-grid--site">' +
        "<div>" + brandHtml() + '<p class="closing-line" data-i18n="brand.closing"></p></div>' +
        FOOTER_GROUPS.map(function (g) {
          return '<nav data-i18n-attr="aria-label:' + g.key + '"><p class="footer-heading" data-i18n="' + g.key + '"></p><ul class="footer-links">' + g.links.map(function (l) {
            var href = l[0] === "home" ? homeHref() : ROOT + l[1];
            return '<li><a href="' + href + '"' + (l[0] === page ? ' aria-current="page"' : "") + ' data-i18n="' + l[2] + '"></a></li>';
          }).join("") + "</ul></nav>";
        }).join("") +
        '<div><p class="footer-heading" data-i18n="footer.follow"></p><div class="follow-row" data-render="follow"></div>' +
          '<a class="footer-access" href="' + ROOT + 'accessibility.html">' + icon("access") + '<span><strong data-i18n="footer.accessTitle"></strong><small data-i18n="footer.accessText"></small></span></a></div>' +
      "</div>" +
      '<div class="container footer-bottom">' +
        '<p class="demo-note">' + icon("info") + '<span data-i18n="footer.demo"></span></p>' +
        '<p data-i18n="footer.medical"></p><p><span data-i18n="footer.copy"></span> · <a href="' + ROOT + 'privacy.html" data-i18n="nav.privacy"></a> · <a href="' + ROOT + 'accessibility.html" data-i18n="nav.accessibility"></a></p>' +
      "</div>";
  }

  /* app shell: top bar (HUD) */

  // The bottom tab bar uses short labels where the full one would not fit.
  function hudLink(id, cls) {
    var n = appItem(id), key = cls === "app-tab" && n.tabKey ? n.tabKey : n.key;
    return '<a class="' + cls + '" href="' + (n.raw ? n.href : ROOT + n.href) + '" data-app-item="' + id + '"><span class="hud-ico">' + icon(n.icon) + '</span><span class="hud-label" data-i18n="' + key + '"></span></a>';
  }

  // Behind the avatar (signed in) or the menu button (guests).
  function menuHtml(on) {
    return (on
      ? '<div class="hud-menu-me" data-app-me></div><div class="hud-menu-grid">' + ["me", "badges", "saved", "history"].map(function (id) { return hudLink(id, "hud-menu-tile"); }).join("") + "</div>"
      : '<div class="hud-menu-guest">' + poseImg("dendi", "curious", "", true) + '<p><strong data-i18n="app.guest.title"></strong><span data-i18n="app.guest.text"></span></p>' +
        '<a class="btn btn-primary btn-sm press" href="' + startHref() + '"><span data-i18n="nav.signIn"></span></a></div>') +
      '<ul class="hud-menu-list">' + (on ? "<li>" + hudLink("activities", "hud-menu-link") + "</li><li>" + hudLink("glossary", "hud-menu-link") + "</li>" : "") +
        '<li><a class="hud-menu-link" href="' + homeHref() + '"><span class="hud-ico">' + icon("globe") + '</span><span data-i18n="app.site"></span></a></li></ul>' +
      '<div class="hud-menu-row">' + langButtons(true) + soundButton(true) + "</div>" +
      (on ? '<button type="button" class="hud-menu-link is-out" data-sign-out><span class="hud-ico">' + icon("logout") + '</span><span data-i18n="app.signOut"></span></button>' : "");
  }

  function renderAppShell(header) {
    var on = member(), tabs = TABS[on ? "member" : "guest"];
    header.classList.add("app-hud");
    header.innerHTML =
      '<div class="hud">' +
        brandHtml(on ? ROOT + "explore.html" : homeHref(), on ? "app.homeLink" : "a11y.homeLink") +
        '<nav class="hud-tabs" data-i18n-attr="aria-label:a11y.mainNav">' + tabs.map(function (id) { return hudLink(id, "hud-tab"); }).join("") + "</nav>" +
        '<div class="hud-right">' +
          (on ? '<a class="hud-chip" href="' + ROOT + 'explore.html#/history" data-app-streak></a>' : '<a class="btn btn-primary btn-sm press hud-signin" href="' + startHref() + '"><span data-i18n="nav.signIn"></span></a>') +
          axButton() +
          (on ? '<button type="button" class="hud-me" id="hud-me" aria-expanded="false" aria-controls="hud-menu" data-me-pill></button>'
            : '<button type="button" class="icon-btn hud-more" id="hud-me" aria-expanded="false" aria-controls="hud-menu" data-i18n-attr="aria-label:nav.menu">' + icon("menu") + "</button>") +
        "</div>" +
      "</div>" +
      '<div class="hud-menu" id="hud-menu" hidden>' + menuHtml(on) + "</div>";
    document.body.insertAdjacentHTML("beforeend",
      '<nav class="app-tabbar" data-i18n-attr="aria-label:app.tabs">' + tabs.concat(on ? [] : ["signin"]).map(function (id) { return hudLink(id, "app-tab"); }).join("") + "</nav>");
    updateAppShell();
  }

  // Current tab, streak, level ring and the menu's profile card.
  function updateAppShell() {
    if (!isApp) return;
    var cur = appCurrent(), r = route();
    document.querySelectorAll("[data-app-item]").forEach(function (a) {
      var id = a.getAttribute("data-app-item"), n = APP_ITEMS[id] || {};
      var here = a.closest(".hud-menu") ? (n.routes ? n.routes[0] === r : (n.pages || []).indexOf(page) !== -1) : id === cur;
      if (here) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    updateMePill();
    var chip = document.querySelector("[data-app-streak]");
    if (chip) {
      var n = Store.streakNow();
      chip.innerHTML = '<span class="hud-ico">' + icon("flame") + "</span><span>" + fmt(n) + "</span>";
      chip.classList.toggle("is-lit", n > 0);
      chip.setAttribute("aria-label", t("streak.days", { n: n }));
      chip.setAttribute("title", t("streak.days", { n: n }));
    }
    var me = document.querySelector("[data-app-me]");
    if (me) {
      var s = Store.get(), lv = Store.level();
      me.innerHTML = avatarHtml() + "<span><strong>" + esc(nickName()) + "</strong><small>" + esc(t("me.level", { n: lv.level })) + " · " + fmt(s.xp) + " XP</small></span>" +
        '<span class="hud-bar" aria-hidden="true"><span style="width:' + lv.pct + '%"></span></span>';
    }
  }

  function nickName() {
    var n = Store.ensureProfile().nick;
    return t("nick.format", { adj: t("nick.adj." + n.a), noun: t("nick.noun." + n.n), num: n.num });
  }

  // The avatar button: a ring that fills towards the next level, the level number.
  function updateMePill() {
    var el = document.querySelector("[data-me-pill]");
    if (!el) return;
    var s = Store.get(), lv = Store.level();
    el.style.setProperty("--pct", lv.pct + "%");
    el.innerHTML = avatarHtml() + '<span class="hud-lv" aria-hidden="true">' + lv.level + "</span>";
    el.setAttribute("aria-label", t("me.aria", { n: lv.level, xp: s.xp }));
  }

  function renderHeader() {
    var header = document.getElementById("site-header");
    if (!header) return;
    if (isApp) renderAppShell(header); else renderSiteHeader(header);
  }

  function renderFooter() {
    var footer = document.getElementById("site-footer");
    if (!footer) return;
    if (!isApp) { renderSiteFooter(footer); return; }
    footer.className = "app-foot";
    footer.innerHTML = '<div class="container"><p data-i18n="footer.medical"></p><p><span data-i18n="footer.copy"></span> · ' +
      '<a href="' + homeHref() + '" data-i18n="app.site"></a> · <a href="' + ROOT + 'about.html" data-i18n="nav.about"></a> · ' +
      '<a href="' + ROOT + 'privacy.html" data-i18n="nav.privacy"></a> · <a href="' + ROOT + 'accessibility.html" data-i18n="nav.accessibility"></a></p></div>';
  }

  function updateLangButtons() {
    document.querySelectorAll(".lang-btn").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-lang") === lang)); });
  }

  function updateSoundButtons() {
    var on = window.MedullaSound && window.MedullaSound.isOn();
    document.querySelectorAll("[data-sound-toggle]").forEach(function (b) { b.setAttribute("aria-pressed", String(!!on)); });
    document.querySelectorAll('[data-switch="sound"]').forEach(function (b) { b.setAttribute("aria-checked", String(!!on)); });
  }

  function signOut() {
    Store.signOut();
    try { sessionStorage.removeItem("medulla.site"); sessionStorage.setItem("medulla.toast", "signedOut"); } catch (e) { /* ignore */ }
    location.href = ROOT + "index.html";
  }

  // Dark / light switch (2.5), next to the accessibility button on every page.
  // It sets the same "theme" setting as the accessibility panel; "Auto" (follow
  // the device) stays available there.
  function setupThemeToggle(displayBtn) {
    if (!displayBtn || document.querySelector("[data-theme-toggle]")) return;
    displayBtn.insertAdjacentHTML("beforebegin", '<button type="button" class="icon-btn theme-btn" data-theme-toggle>' + icon("moon", "icon-moon") + icon("sun", "icon-sun") + "</button>");
    var btn = document.querySelector("[data-theme-toggle]");
    function label() {
      var k = root.getAttribute("data-theme") === "dark" ? "theme.toLight" : "theme.toDark";
      btn.setAttribute("aria-label", t(k)); btn.setAttribute("title", t(k));
    }
    btn.addEventListener("click", function () {
      var dark = root.getAttribute("data-theme") !== "dark";
      prefs.setA11y({ theme: dark ? "dark" : "light" });
      toast({ icon: dark ? "moon" : "sun", title: t(dark ? "theme.darkOn" : "theme.lightOn"), ms: 1600 });
    });
    document.addEventListener("medulla:a11y", label);
    langListeners.push(label);
    label();
  }

  function setupHeader() {
    var displayBtn = document.getElementById("display-toggle");
    setupThemeToggle(displayBtn);
    document.querySelectorAll(".lang-btn").forEach(function (b) { b.addEventListener("click", function () { setLang(b.getAttribute("data-lang")); }); });
    document.querySelectorAll("[data-sound-toggle]").forEach(function (b) {
      b.addEventListener("click", function () { window.MedullaSound.setEnabled(!window.MedullaSound.isOn()); });
    });
    document.addEventListener("medulla:sound", function (e) {
      updateSoundButtons();
      toast({ icon: e.detail.on ? "sound" : "mute", title: t(e.detail.on ? "sound.on" : "sound.off"), ms: 1800 });
    });
    updateSoundButtons();
    if (isApp) { setupAppShell(displayBtn); return; }

    var menuBtn = document.getElementById("menu-toggle");
    var nav = document.getElementById("site-nav");
    if (!menuBtn) { // start.html: no menu, just the accessibility button
      if (displayBtn) displayBtn.addEventListener("click", function () { if (window.MedullaAccess) window.MedullaAccess.toggle(displayBtn); });
      return;
    }
    function setMenu(open) {
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.setAttribute("data-i18n-attr", "aria-label:" + (open ? "nav.closeMenu" : "nav.menu"));
      menuBtn.setAttribute("aria-label", t(open ? "nav.closeMenu" : "nav.menu"));
      nav.classList.toggle("is-open", open);
    }
    menuBtn.addEventListener("click", function () { var o = menuBtn.getAttribute("aria-expanded") !== "true"; setMenu(o); });
    if (displayBtn) displayBtn.addEventListener("click", function () { setMenu(false); if (window.MedullaAccess) window.MedullaAccess.toggle(displayBtn); });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || (reader.dialog && reader.dialog.open)) return;
      if (nav.classList.contains("is-open")) { setMenu(false); menuBtn.focus(); }
    });
    document.addEventListener("click", function (e) {
      if (!document.getElementById("site-header").contains(e.target)) setMenu(false);
    });
  }

  // A message left by the previous page (signed in, signed out, data deleted).
  function pendingToast() {
    var k = null;
    try { k = sessionStorage.getItem("medulla.toast"); if (k) sessionStorage.removeItem("medulla.toast"); } catch (e) { k = null; }
    var o = k === "signedOut" ? { icon: "check", title: t("app.signedOut"), text: t("app.signedOutText") }
      : k === "deleted" ? { icon: "trash", title: t("data.deleted") }
      : k === "welcome" && member() ? { char: (Store.get().profile || {}).avatar || "dendi", pose: "hello", title: t("start.welcome", { name: nickName() }), text: t("start.welcomeText") }
      : null;
    if (o && CHARACTERS[o.char] === undefined) delete o.char;
    if (o) setTimeout(function () { toast(o); }, 500);
  }

  // The menu behind the avatar: a disclosure panel (Escape or a click outside closes it).
  function setupAppShell(displayBtn) {
    var btn = document.getElementById("hud-me"), menu = document.getElementById("hud-menu");
    function setMenu(open, focusBack) {
      menu.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
      if (open) { var f = menu.querySelector("a[href], button"); if (f) f.focus(); }
      else if (focusBack) btn.focus();
    }
    btn.addEventListener("click", function () { setMenu(menu.hidden); });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("[data-sign-out]")) { signOut(); return; }
      if (e.target.closest("a[href]")) setMenu(false);
    });
    document.addEventListener("click", function (e) { if (!menu.hidden && !menu.contains(e.target) && !btn.contains(e.target)) setMenu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !menu.hidden) setMenu(false, true); });
    if (displayBtn) displayBtn.addEventListener("click", function () { setMenu(false); if (window.MedullaAccess) window.MedullaAccess.toggle(displayBtn); });
    window.addEventListener("hashchange", updateAppShell);
    document.addEventListener("medulla:progress", updateAppShell);
  }

  /* ----------------------------------------------------------- renderers */

  var PILLARS = [
    { key: "edu", char: "memo", pose: "aha", href: "learn.html" },
    { key: "social", char: "syno", pose: "love", href: "parents.html" },
    { key: "practical", char: "octa", pose: "curious", href: "lab.html" }
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
        '<div class="bot-card-art" aria-hidden="true"><span class="bot-bubble b1">/fact</span><span class="bot-bubble b2">/quiz</span><span class="bot-bubble b3">/word</span>' + poseImg("dendi", "hello", "idle idle-dendi") + "</div>" +
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
          '<div class="char-art">' + (c.guide ? '<span class="char-guide">' + esc(t("chars.guide")) + "</span>" : "") +
            '<span class="char-pose">' + charImg(id, "idle idle-" + id + " is-rest", "") + poseImg(id, CHAR_HOVER[id], "idle idle-" + id + " is-hover") + "</span></div>" +
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
          '<div class="pillar-art" style="--tint:' + c.tint + '">' + poseImg(p.char, p.pose, "idle idle-" + p.char) + "</div>" +
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
      var avatars = CHARACTER_ORDER.map(function (id) { return '<span class="avatar" style="--tint:' + CHARACTERS[id].tint + '">' + charFace(id) + "</span>"; }).join("");
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
            '<div class="feature-art"><p class="bubble">' + esc(t("fotd.says", { name: CHARACTERS[who].name })) + "</p>" + poseImg(who, "aha", "idle idle-" + who) + "</div>" +
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
            '<span class="dash-host">' + poseImg("octa", s || r ? "correct" : "curious", "idle idle-octa") + "</span></div>" +
        "</div>";
    },

    badgesPreview: function (el) {
      var s = Store.get(), limit = +(el.getAttribute("data-limit") || 0);
      var list = Store.badges.slice(0, limit || Store.badges.length);
      el.innerHTML = list.map(function (b) {
        var got = !!s.badges[b.id];
        return '<li class="badge' + (got ? " is-earned" : "") + '" style="--tint:' + CHARACTERS[b.char].tint + '">' +
          '<span class="badge-art">' + (got ? poseImg(b.char, "win", "") : charFace(b.char)) + (got ? "" : '<span class="badge-lock">' + icon("lock") + "</span>") + "</span>" +
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
          el.innerHTML = '<div class="empty-state">' + poseImg("syno", "love", "idle idle-syno") + "<h3>" + esc(t("kind.wallEmptyTitle")) + "</h3><p>" + esc(t("kind.wallEmpty")) + "</p></div>";
          return;
        }
        el.innerHTML = '<ul class="kind-wall">' + list.map(function (m) {
          return '<li class="kind-note" style="--r:' + ((m.id || 0) % 5 - 2) + 'deg">' + poseImg(m.character || "syno", "love", "") + "<p>" + esc(localized(m.text) || "") + "</p></li>";
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
      img.src = poseSrc(id, img.getAttribute("data-pose"));
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
    charFace: charFace,
    poseImg: poseImg,
    poseSrc: poseSrc,
    poses: POSES,
    characters: CHARACTERS,
    characterOrder: CHARACTER_ORDER,
    avatarMoods: AVATAR_MOODS,
    avatarBgs: AVATAR_BGS,
    avatarBgOrder: AVATAR_BG_ORDER,
    avatarBgOpen: avatarBgOpen,
    avatarBg: avatarBg,
    avatarStyle: avatarStyle,
    avatarSrc: avatarSrc,
    avatarPic: avatarPic,
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
    pendingToast();
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
