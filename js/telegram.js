/*
 * Telegram Mini App adapter. Loaded by js/main.js ONLY when the site is
 * opened inside Telegram (the launch URL contains #tgWebAppData…).
 * It loads Telegram's official script, then:
 *   - expands to full height and marks the app as ready,
 *   - matches the header colour,
 *   - shows Telegram's Back button on inner pages / routes.
 * No Telegram user data is read or sent anywhere (see telegram/MINI_APP.md).
 */
(function () {
  "use strict";

  var s = document.createElement("script");
  s.src = "https://telegram.org/js/telegram-web-app.js";
  s.onload = function () {
    var tg = window.Telegram && window.Telegram.WebApp;
    if (!tg) return;
    document.documentElement.classList.add("in-telegram");
    // Telegram's own header matches the page: the app's navy top bar (2.4+, both
    // themes), otherwise the light or dark theme. Follows the dark/light switch.
    var root = document.documentElement;
    function paint() {
      var dark = root.getAttribute("data-theme") === "dark";
      var page = dark ? "#0B0F24" : "#FFFFFF";
      try {
        if (tg.setHeaderColor) tg.setHeaderColor(root.getAttribute("data-shell") === "app" ? "#141A40" : page);
        if (tg.setBackgroundColor) tg.setBackgroundColor(page);
      } catch (e) { /* older Telegram clients */ }
    }
    try {
      tg.ready();
      tg.expand();
    } catch (e) { /* older Telegram clients */ }
    paint();
    if (window.MutationObserver) new MutationObserver(paint).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    function updateBack() {
      var page = document.body.getAttribute("data-page");
      // the landing, or for signed-in visitors their dashboard, is the first screen
      var inner = (page !== "home" && page !== "explore") || (location.hash && location.hash !== "#" && location.hash !== "#/");
      try { if (inner) tg.BackButton.show(); else tg.BackButton.hide(); } catch (e) { /* ignore */ }
    }
    try { tg.BackButton.onClick(function () { history.length > 1 ? history.back() : (location.href = (document.body.getAttribute("data-root") || "") + "index.html"); }); } catch (e) { /* ignore */ }
    window.addEventListener("hashchange", updateBack);
    updateBack();
  };
  document.head.appendChild(s);
})();
