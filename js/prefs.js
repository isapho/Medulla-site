/*
 * Loaded in <head> (not deferred) so saved display preferences apply before
 * the first paint. localStorage can be blocked (private mode, strict
 * settings), so every access is wrapped in try/catch.
 */
(function () {
  "use strict";

  var KEYS = { lang: "medulla.lang", largeText: "medulla.largeText", dyslexia: "medulla.dyslexia", calm: "medulla.calm", sound: "medulla.sound" };

  function get(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function set(key, value) {
    try {
      if (value === null || value === undefined) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, String(value));
    } catch (e) { /* storage unavailable: the choice just won't persist */ }
  }

  var root = document.documentElement;
  root.classList.add("js");
  if (get(KEYS.largeText) === "1") root.classList.add("a11y-large");
  if (get(KEYS.dyslexia) === "1") root.classList.add("a11y-dyslexia");
  if (get(KEYS.calm) === "1") root.classList.add("calm");

  // Pages are pre-rendered in Uzbek. If another language is chosen, hide the
  // text until it has loaded (max 1.5 s) so it doesn't flash in Uzbek first.
  var q = null;
  try { q = new URLSearchParams(window.location.search).get("lang"); } catch (e) { q = null; }
  var want = q || get(KEYS.lang);
  if (want && want !== "uz") {
    root.classList.add("i18n-wait");
    setTimeout(function () { root.classList.remove("i18n-wait"); }, 1500);
  }

  window.MedullaPrefs = { KEYS: KEYS, get: get, set: set };
})();
