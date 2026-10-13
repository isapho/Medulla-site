/*
 * Loaded in <head> (not deferred) so saved display and accessibility
 * preferences apply before the first paint. localStorage can be blocked
 * (private mode, strict settings), so every access is wrapped in try/catch.
 *
 * Accessibility & comfort settings live in one JSON value ("medulla.a11y").
 * Each setting maps to a class or data attribute on <html>; the CSS does the
 * rest (css/polish.css). Older single keys (largeText, dyslexia) are read
 * once and migrated.
 */
(function () {
  "use strict";

  var KEYS = { lang: "medulla.lang", largeText: "medulla.largeText", dyslexia: "medulla.dyslexia", calm: "medulla.calm", sound: "medulla.sound", a11y: "medulla.a11y" };

  function get(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function set(key, value) {
    try {
      if (value === null || value === undefined) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, String(value));
    } catch (e) { /* storage unavailable: the choice just won't persist */ }
  }

  // Every setting with its default. Numbers are steps, strings are choices.
  var DEFAULTS = {
    text: 0,          // 0 = 100 %, 1 = 112.5 %, 2 = 125 %, 3 = 150 %
    spacing: 0,       // 1 = wider letter, word and line spacing
    font: "default",  // "default" | "readable" (Atkinson Hyperlegible) | "dyslexia" (Verdana + spacing)
    theme: "auto",    // "auto" (follow the device) | "light" | "dark"
    contrast: 0,      // 1 = stronger text and borders
    links: 0,         // 1 = underline every link
    calm: 0,          // 1 = no animation (same as the device's "reduce motion")
    nodecor: 0,       // 1 = hide decorative pictures and moving backgrounds
    ruler: 0,         // 1 = reading guide that follows the pointer / focus
    glossary: 1,      // 1 = explain hard words (dotted underline + definition)
    flash: 1,         // 0 = no flashes or glows at all (seizure-safe)
    slow: 0,          // 1 = more time in memory games, slower reading voice
    tts: 0            // 1 = "read aloud" buttons on paragraphs and selections
  };

  function read() {
    var s = {}, k, raw = get(KEYS.a11y), saved = null;
    try { saved = raw ? JSON.parse(raw) : null; } catch (e) { saved = null; }
    for (k in DEFAULTS) s[k] = DEFAULTS[k];
    if (saved && typeof saved === "object") for (k in DEFAULTS) if (saved[k] !== undefined && typeof saved[k] === typeof DEFAULTS[k]) s[k] = saved[k];
    if (!saved) { // migrate v2.0 switches
      if (get(KEYS.largeText) === "1") s.text = 1;
      if (get(KEYS.dyslexia) === "1") s.font = "dyslexia";
    }
    s.calm = get(KEYS.calm) === "1" ? 1 : 0; // calm keeps its own key (motion.js and older pages read it)
    return s;
  }

  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  var fontLink = null;

  function apply(s) {
    var c = root.classList;
    root.setAttribute("data-text", String(s.text));
    root.setAttribute("data-font", s.font);
    root.setAttribute("data-theme", s.theme === "auto" ? (media && media.matches ? "dark" : "light") : s.theme);
    root.setAttribute("data-theme-choice", s.theme);
    c.toggle("a11y-large", s.text > 0);            // v2.0 class, still used by a few rules
    c.toggle("a11y-dyslexia", s.font === "dyslexia");
    c.toggle("a11y-readable", s.font === "readable");
    c.toggle("a11y-spacing", !!s.spacing);
    c.toggle("a11y-contrast", !!s.contrast);
    c.toggle("a11y-links", !!s.links);
    c.toggle("calm", !!s.calm);
    c.toggle("a11y-nodecor", !!s.nodecor);
    c.toggle("a11y-ruler", !!s.ruler);
    c.toggle("a11y-noglossary", !s.glossary);
    c.toggle("a11y-slow", !!s.slow);
    c.toggle("a11y-noflash", !s.flash);
    c.toggle("a11y-tts", !!s.tts);
    // The readable font is only downloaded when someone chooses it.
    if (s.font === "readable" && !fontLink) {
      fontLink = document.createElement("link");
      fontLink.rel = "stylesheet";
      fontLink.href = "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&display=swap";
      document.head.appendChild(fontLink);
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", root.getAttribute("data-theme") === "dark" ? "#0B0F24" : "#FFFFFF");
  }

  var state = read();
  root.classList.add("js");
  apply(state);
  if (media) {
    var onScheme = function () { if (state.theme === "auto") { apply(state); document.dispatchEvent(new CustomEvent("medulla:a11y", { detail: { key: "theme" } })); } };
    if (media.addEventListener) media.addEventListener("change", onScheme); else if (media.addListener) media.addListener(onScheme);
  }

  function save() {
    var out = {}, k;
    for (k in DEFAULTS) if (k !== "calm") out[k] = state[k];
    set(KEYS.a11y, JSON.stringify(out));
    set(KEYS.calm, state.calm ? "1" : null);
    set(KEYS.largeText, null); set(KEYS.dyslexia, null); // migrated
  }

  // Pages are pre-rendered in Uzbek. If another language is chosen, hide the
  // text until it has loaded (max 1.5 s) so it doesn't flash in Uzbek first.
  var q = null;
  try { q = new URLSearchParams(window.location.search).get("lang"); } catch (e) { q = null; }
  var want = q || get(KEYS.lang);
  if (want && want !== "uz") {
    root.classList.add("i18n-wait");
    setTimeout(function () { root.classList.remove("i18n-wait"); }, 1500);
  }

  // Public site and app (2.3). Runs before the first paint, so nobody sees
  // the wrong page flash. <html data-gate="…"> on a page:
  //   "landing"  index.html: signed-in visitors go straight to their dashboard
  //              (index.html?site=1 shows the landing for the rest of the tab)
  //   "member"   explore.html: needs a profile on this device, else start.html
  //   "start"    start.html: signed-in visitors go on into the app
  // <html class="is-member"> tells the CSS which header buttons to show.
  // If storage is blocked no profile can last, so nothing is redirected.
  function safeNext(v) {
    return v && /^(?:[a-z0-9-]+\/)?[a-z0-9-]+\.html(?:#\/[a-z]*)?$/.test(v) ? v : null;
  }
  var signedIn = false;
  (function gate() {
    var mode = root.getAttribute("data-gate"), st = null, storage = true;
    try { st = JSON.parse(window.localStorage.getItem("medulla.state") || "null"); } catch (e) { storage = false; }
    if (st && st.profile) signedIn = st.profile.signedIn !== undefined ? !!st.profile.signedIn : !!st.profile.onboarded;
    root.classList.toggle("is-member", signedIn);
    if (!mode || !storage) return;
    var params = null;
    try { params = new URLSearchParams(window.location.search); } catch (e) { return; }
    var routeHash = window.location.hash.indexOf("#/") === 0 ? window.location.hash : "";
    var target = null;
    if (mode === "landing" && signedIn) {
      var stay = params.has("site");
      try { if (stay) sessionStorage.setItem("medulla.site", "1"); else stay = sessionStorage.getItem("medulla.site") === "1"; } catch (e) { /* ignore */ }
      if (!stay) target = "explore.html" + routeHash;
    }
    if (mode === "member" && !signedIn) target = "start.html?next=" + encodeURIComponent((window.location.pathname.split("/").pop() || "explore.html") + routeHash);
    if (mode === "start" && signedIn) target = safeNext(params.get("next")) || "explore.html";
    if (!target) return;
    // Opened inside Telegram: remember it, the launch data in the hash is dropped.
    try { if (/tgWebAppData|tgWebAppPlatform/.test(window.location.hash)) sessionStorage.setItem("medulla.tg", "1"); } catch (e) { /* ignore */ }
    root.classList.add("gate-leaving");
    window.location.replace(target);
  })();

  window.MedullaPrefs = {
    KEYS: KEYS, get: get, set: set, DEFAULTS: DEFAULTS,
    safeNext: safeNext,
    a11y: function () { var o = {}, k; for (k in state) o[k] = state[k]; return o; },
    // Change one or more settings: setA11y({ text: 2 }) or setA11y("reset").
    setA11y: function (changes) {
      var k;
      if (changes === "reset") { for (k in DEFAULTS) state[k] = DEFAULTS[k]; }
      else for (k in changes) if (k in DEFAULTS) state[k] = changes[k];
      apply(state); save();
      document.dispatchEvent(new CustomEvent("medulla:a11y", { detail: { changes: changes } }));
      if (changes === "reset" || "calm" in changes) document.dispatchEvent(new CustomEvent("medulla:calm", { detail: { on: !!state.calm } }));
      return this.a11y();
    }
  };
})();
