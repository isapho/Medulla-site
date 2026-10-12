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
    try {
      tg.ready();
      tg.expand();
      if (tg.setHeaderColor) tg.setHeaderColor("#FFFFFF");
      if (tg.setBackgroundColor) tg.setBackgroundColor("#FFFFFF");
    } catch (e) { /* older Telegram clients */ }

    function updateBack() {
      var page = document.body.getAttribute("data-page");
      var inner = page !== "home" || (location.hash && location.hash !== "#" && location.hash !== "#/");
      try { if (inner) tg.BackButton.show(); else tg.BackButton.hide(); } catch (e) { /* ignore */ }
    }
    try { tg.BackButton.onClick(function () { history.length > 1 ? history.back() : (location.href = (document.body.getAttribute("data-root") || "") + "index.html"); }); } catch (e) { /* ignore */ }
    window.addEventListener("hashchange", updateBack);
    updateBack();
  };
  document.head.appendChild(s);
})();
