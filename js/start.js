/*
 * start.html: entering "Mening Medullam". There are no accounts (the
 * audience is young; see README "Decisions made"): signing in creates or
 * reopens the profile kept on this device: a character and a nickname made
 * of friendly words, never a real name.
 *
 * Views: "new" (pick a character and a nickname), "back" (a profile already
 * on this device: continue, or start a new one), "fresh" (confirm deleting the
 * old one first), "code" (restore from a sync code, only when the backend is on).
 * After signing in the visitor goes to ?next= (checked by MedullaPrefs) or to
 * the dashboard. js/prefs.js already sends signed-in visitors past this page.
 */
Medulla.ready(function () {
  "use strict";

  var M = window.Medulla, Store = window.MedullaStore, B = window.MedullaBackend, S = window.MedullaSound, P = window.MedullaPrefs;
  var t = M.t, esc = M.esc, icon = M.icon;
  var view = document.getElementById("start-view");
  var next = "explore.html";
  try { next = P.safeNext(new URLSearchParams(location.search).get("next")) || next; } catch (e) { /* old browser */ }

  var mode = Store.hasProfile() ? "back" : "new";
  var chosen = Store.get().profile.avatar || "dendi";

  function nick() {
    if (M.nickName) return M.nickName();
    var n = Store.ensureProfile().nick; // an older cached main.js
    return t("nick.format", { adj: t("nick.adj." + n.a), noun: t("nick.noun." + n.n), num: n.num });
  }

  // Before signing in: say what is kept, with a link to the Privacy Policy (as on any professional site).
  function legal() {
    return '<p class="start-legal">' + esc(t("start.legalA")) + ' <a href="' + M.root() + 'privacy.html" target="_blank" rel="noopener noreferrer">' +
      esc(t("start.legalLink")) + '<span class="sr-only"> ' + esc(t("a11y.external")) + "</span></a>" + esc(t("start.legalB")) + "</p>";
  }

  /* ---- Sign in with Telegram / Google (2.7): optional, for syncing progress.
     The server verifies the login and answers with a sync code made from the
     person's id and a secret; name, username, photo and e-mail are dropped. */
  function loginOn() { return !!(B && B.canLogin && B.canLogin()); }
  function tgBot() { return (window.MEDULLA_CONFIG || {}).telegramBot || null; }
  function inTelegram() { try { return !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData); } catch (e) { return false; } }

  function loginBlock() {
    if (!loginOn()) return "";
    var google = !!(window.MEDULLA_CONFIG || {}).googleClientId, tg = !!tgBot() || inTelegram();
    if (!google && !tg) return "";
    return '<div class="start-login">' +
      '<p class="start-or" aria-hidden="true"><span>' + esc(t("start.or")) + "</span></p>" +
      '<label class="login-consent"><input type="checkbox" id="login-ok"><span>' + esc(t("login.consent")) + "</span></label>" +
      '<div class="login-buttons">' +
        (tg ? '<button type="button" class="btn btn-ghost btn-block press" data-login="telegram">' + icon("telegram") + "<span>" + esc(t("login.telegram")) + "</span></button>" : "") +
        '<div id="tg-slot" class="login-slot"></div>' +
        (google ? '<div id="g-slot" class="login-slot" data-google></div>' : "") +
      "</div>" +
      '<p class="muted start-note" id="login-msg" role="status"></p>' +
      '<p class="muted start-note">' + esc(t("login.note")) + "</p></div>";
  }

  function loginMsg(key, vars) { var m = view.querySelector("#login-msg"); if (m) m.textContent = key ? t(key, vars) : ""; }
  function consented() {
    var c = view.querySelector("#login-ok");
    if (c && c.checked) return true;
    loginMsg("login.need");
    if (c) c.focus();
    return false;
  }

  // The server's answer: a sync code. Restore the progress stored under it (if any), then enter.
  function finishLogin(r) {
    if (!r || !r.ok || !B.validCode(r.code)) { loginMsg("login.fail"); return; }
    var code = r.code;
    B.pull(code).then(function (p) {
      if (p.ok) Store.merge(p.payload);
      Store.setSync({ enabled: true, code: code, lastSync: new Date().toISOString(), consent: { at: new Date().toISOString(), ageBand: "login", guardian: null } });
      if (!p.ok) B.push(code, Store.syncPayload());
      chosen = Store.get().profile.avatar || chosen;
      enter();
    });
  }

  function loadScript(srcUrl, attrs) {
    return new Promise(function (resolve, reject) {
      var el = document.createElement("script");
      el.src = srcUrl; el.async = true;
      Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
      el.onload = resolve; el.onerror = reject;
      (attrs && attrs.__into ? attrs.__into : document.head).appendChild(el);
    });
  }

  // Telegram: inside the Mini App one tap; on the website the bot gives a one-time
  // code (/login) that is typed here. No script from telegram.org is needed.
  function startTelegram() {
    if (!consented()) return;
    if (inTelegram()) { loginMsg("login.working"); B.login("telegram-webapp", { initData: window.Telegram.WebApp.initData }).then(finishLogin); return; }
    var slot = view.querySelector("#tg-slot");
    if (!slot) return;
    var bot = tgBot();
    slot.innerHTML = '<div class="tg-code">' +
      "<p>" + esc(t("login.tgSteps")) + "</p>" +
      (bot ? '<a class="btn btn-ghost btn-sm press" target="_blank" rel="noopener" href="https://t.me/' + esc(bot) + '?start=login">' + icon("telegram") + "<span>" + esc(t("login.openBot")) + "</span></a>" : "") +
      '<label for="tg-code-input">' + esc(t("login.codeLabel")) + '</label>' +
      '<div class="tg-code-row"><input id="tg-code-input" class="input" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" maxlength="9" placeholder="ABCD-2345">' +
      '<button type="button" class="btn btn-primary press" data-login-code><span>' + esc(t("login.codeGo")) + "</span></button></div></div>";
    var inp = slot.querySelector("input"); if (inp) inp.focus();
  }

  function submitCode() {
    var inp = view.querySelector("#tg-code-input");
    if (!inp || !consented()) return;
    var code = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length !== 8) { loginMsg("login.codeBad"); return; }
    loginMsg("login.working");
    B.login("telegram-code", { code: code }).then(function (r) {
      if (!r || !r.ok) { loginMsg(r && r.reason === "invalid" ? "login.codeBad" : "login.fail"); return; }
      finishLogin(r);
    });
  }

  function startGoogle() {
    var id = (window.MEDULLA_CONFIG || {}).googleClientId, slot = view.querySelector("#g-slot");
    if (!id || !slot || slot.getAttribute("data-ready")) return;
    // Google's script is loaded when the sign-in page is shown to someone who ticked the box.
    loadScript("https://accounts.google.com/gsi/client").then(function () {
      window.google.accounts.id.initialize({
        client_id: id,
        callback: function (resp) { if (!consented()) return; loginMsg("login.working"); B.login("google", { credential: resp.credential }).then(finishLogin); }
      });
      window.google.accounts.id.renderButton(slot, { theme: "outline", size: "large", shape: "pill", text: "continue_with", width: 280 });
      slot.setAttribute("data-ready", "1");
    }).catch(function () { loginMsg("login.fail"); });
  }

  function enter() {
    var nameBox = view.querySelector("#start-name");
    if (nameBox) Store.setProfile({ name: M.cleanName(nameBox.value) || null });
    Store.signIn({ avatar: chosen });
    try { sessionStorage.setItem("medulla.toast", "welcome"); } catch (e) { /* ignore */ }
    S.correct();
    location.href = M.root() + next;
  }

  function picker() {
    return '<div class="avatar-picker start-picker" role="radiogroup" aria-labelledby="start-pick-label">' + M.characterOrder.map(function (id) {
      return '<button type="button" class="avatar-option is-mood press" role="radio" aria-checked="' + (chosen === id) + '" tabindex="' + (chosen === id ? "0" : "-1") + '" data-avatar="' + id + '" style="--tint:' + M.characters[id].tint + '" aria-label="' + esc(M.characters[id].name) + '">' + '<img src="' + M.avatarSrc(id, "face") + '" width="64" height="64" alt="" decoding="async"></button>';
    }).join("") + "</div>";
  }

  function hero(pose) {
    return '<div class="start-hero-art" style="--tint:' + M.characters[chosen].tint + '">' + M.poseImg(chosen, pose, "idle idle-" + chosen, true) + "</div>";
  }

  function viewNew() {
    return hero("hello") +
      '<p class="eyebrow">' + icon("sparkle") + "<span>" + esc(t("nav.explore")) + "</span></p>" +
      "<h1>" + esc(t("start.title")) + '</h1><p class="lead">' + esc(t("start.lead")) + "</p>" +
      '<div class="start-step"><p class="start-step-label" id="start-pick-label"><span class="start-num" aria-hidden="true">1</span>' + esc(t("start.pick")) + "</p>" + picker() + "</div>" +
      '<div class="start-step"><p class="start-step-label"><span class="start-num" aria-hidden="true">2</span>' + esc(t("start.nick")) + "</p>" +
        '<div class="nick-row"><span class="nick" id="start-nick">' + esc(nick()) + '</span><button type="button" class="btn btn-ghost btn-sm press" data-reroll>' + icon("refresh") + "<span>" + esc(t("me.newNick")) + "</span></button></div>" +
        '<div class="field start-name"><label for="start-name">' + esc(t("start.nameLabel")) + ' <span class="muted">' + esc(t("start.nameOptional")) + "</span></label>" +
          '<input id="start-name" class="input" maxlength="20" autocomplete="off" spellcheck="false" placeholder="' + esc(t("start.namePlaceholder")) + '" value="' + esc(Store.get().profile.name || "") + '" aria-describedby="start-name-hint">' +
          '<p class="muted start-note" id="start-name-hint">' + esc(t("start.nameHint")) + "</p></div>" +
        '<p class="muted start-note">' + esc(t("me.profileLead")) + "</p></div>" +
      legal() +
      '<button type="button" class="btn btn-primary btn-block press" data-enter><span>' + esc(t("start.go")) + "</span>" + icon("arrow") + "</button>" +
      loginBlock() +
      (B.ready() ? '<p class="start-alt">' + esc(t("start.haveCode")) + ' <button type="button" class="link-btn" data-view="code">' + esc(t("sync.restore")) + "</button></p>" : "");
  }

  function viewBack() {
    var s = Store.get(), lv = Store.level();
    return hero("win") +
      "<h1>" + esc(t("start.backTitle")) + '</h1><p class="lead">' + esc(t("start.backLead")) + "</p>" +
      '<div class="start-profile">' + M.avatarPic(Object.assign({}, s.profile, { avatar: chosen }), "me-avatar") +
        "<span><strong>" + esc(nick()) + "</strong><small>" + esc(t("start.levelLine", { n: lv.level, xp: M.fmt(s.xp) })) + "</small></span></div>" +
      legal() +
      '<button type="button" class="btn btn-primary btn-block press" data-enter><span>' + esc(t("start.continue")) + "</span>" + icon("arrow") + "</button>" +
      '<p class="start-alt"><button type="button" class="link-btn" data-view="fresh">' + esc(t("start.newProfile")) + "</button>" +
        (B.ready() ? ' · <button type="button" class="link-btn" data-view="code">' + esc(t("sync.restore")) + "</button>" : "") + "</p>";
  }

  function viewFresh() {
    return hero("tryagain") +
      "<h1>" + esc(t("start.newTitle")) + '</h1><p class="lead">' + esc(t("start.newText")) + "</p>" +
      '<div class="btn-row"><button type="button" class="btn btn-danger press" data-fresh>' + icon("trash") + "<span>" + esc(t("start.newYes")) + "</span></button>" +
        '<button type="button" class="btn btn-ghost press" data-export>' + icon("download") + "<span>" + esc(t("data.download")) + "</span></button></div>" +
      '<p class="start-alt"><button type="button" class="link-btn" data-view="back">' + icon("arrowLeft", "icon-sm") + esc(t("consent.cancel")) + "</button></p>";
  }

  function viewCode() {
    return hero("curious") +
      "<h1>" + esc(t("sync.restoreTitle")) + '</h1><p class="lead">' + esc(t("sync.restoreLead")) + "</p>" +
      '<div class="field"><label for="restore-code">' + esc(t("sync.yourCode")) + '</label><input id="restore-code" class="input" autocomplete="off" spellcheck="false" placeholder="OCTA-XXXX-XXXX-XXXX"></div>' +
      '<p class="muted" id="restore-msg" role="status"></p>' +
      '<div class="btn-row"><button type="button" class="btn btn-primary press" data-restore>' + icon("download") + "<span>" + esc(t("sync.restore")) + "</span></button>" +
        '<button type="button" class="btn btn-ghost press" data-view="' + (Store.hasProfile() ? "back" : "new") + '">' + esc(t("consent.cancel")) + "</button></div>";
  }

  function draw(focus) {
    view.innerHTML = mode === "back" ? viewBack() : mode === "fresh" ? viewFresh() : mode === "code" ? viewCode() : viewNew();
    view.classList.remove("view-enter"); void view.offsetWidth; view.classList.add("view-enter");
    document.title = t(mode === "back" ? "start.backTitle" : mode === "code" ? "sync.restoreTitle" : "meta.start.title").replace(/ — Medulla$/, "") + " — Medulla";
    if (focus) { var h = view.querySelector("h1"); if (h) { h.setAttribute("tabindex", "-1"); h.focus(); } }
    if (mode === "code") { var i = view.querySelector("#restore-code"); if (i) i.focus(); }
    if (view.querySelector("[data-google]")) {
      // Google's button needs the consent box first; render it once the box is ticked.
      var box = view.querySelector("#login-ok");
      if (box) box.addEventListener("change", function () { if (box.checked) startGoogle(); });
    }
  }

  function pickAvatar(btn) {
    chosen = btn.getAttribute("data-avatar");
    view.querySelectorAll("[data-avatar]").forEach(function (b) {
      var on = b === btn;
      b.setAttribute("aria-checked", String(on));
      b.setAttribute("tabindex", on ? "0" : "-1");
    });
    var art = view.querySelector(".start-hero-art");
    if (art) {
      art.style.setProperty("--tint", M.characters[chosen].tint);
      art.innerHTML = M.poseImg(chosen, "hello", "idle idle-" + chosen + " pop-in", true);
    }
    S.tap();
  }

  view.addEventListener("click", function (e) {
    var tgt = e.target;
    var av = tgt.closest("[data-avatar]");
    if (av) { pickAvatar(av); return; }
    if (tgt.closest("[data-reroll]")) { Store.setProfile({ nick: Store.randomNick() }); var box = view.querySelector("#start-name"); view.querySelector("#start-nick").textContent = (box && M.cleanName(box.value)) || nickWords(); S.tap(); return; }
    if (tgt.closest("[data-enter]")) { enter(); return; }
    if (tgt.closest("[data-login]")) { startTelegram(); return; }
    if (tgt.closest("[data-login-code]")) { submitCode(); return; }
    var v = tgt.closest("[data-view]");
    if (v) { mode = v.getAttribute("data-view"); draw(true); return; }
    if (tgt.closest("[data-export]")) {
      var blob = new Blob([Store.exportJSON()], { type: "application/json" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "medulla-my-data.json";
      document.body.appendChild(a); a.click(); a.remove();
      M.toast({ icon: "download", title: t("data.downloaded") });
      return;
    }
    if (tgt.closest("[data-fresh]")) {
      // Only this device. A synced copy stays on the server and can be restored with its code.
      Store.wipe();
      chosen = "dendi"; mode = "new"; draw(true);
      M.toast({ icon: "trash", title: t("data.deleted") });
      return;
    }
    if (tgt.closest("[data-restore]")) {
      var code = view.querySelector("#restore-code").value, msg = view.querySelector("#restore-msg");
      if (!B.validCode(code)) { msg.textContent = t("sync.badCode"); return; }
      code = B.formatCode(code);
      msg.textContent = "";
      B.pull(code).then(function (r) {
        if (!r.ok) { msg.textContent = t(r.reason === "not-found" ? "sync.notFound" : "sync.failed"); return; }
        Store.merge(r.payload);
        Store.setSync({ enabled: true, code: code, lastSync: new Date().toISOString(), consent: { at: new Date().toISOString(), ageBand: "restored", guardian: null } });
        chosen = Store.get().profile.avatar || chosen;
        M.toast({ icon: "check", title: t("sync.restored") });
        enter();
      });
    }
  });

  // The preview under step 2 follows the typed name; the name is saved when entering.
  view.addEventListener("input", function (e) {
    if (e.target.id !== "start-name") return;
    var out = view.querySelector("#start-nick"), typed = M.cleanName(e.target.value);
    if (out) out.textContent = typed || nickWords();
  });
  function nickWords() {
    var n = Store.ensureProfile().nick;
    return t("nick.format", { adj: t("nick.adj." + n.a), noun: t("nick.noun." + n.n), num: n.num });
  }

  // Arrow keys move between characters (radio group).
  view.addEventListener("keydown", function (e) {
    var cur = e.target.closest("[data-avatar]");
    if (cur && /^Arrow(Left|Right|Up|Down)$/.test(e.key)) {
      var all = Array.prototype.slice.call(view.querySelectorAll("[data-avatar]")), i = all.indexOf(cur);
      var step = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
      var nb = all[(i + step + all.length) % all.length];
      e.preventDefault(); pickAvatar(nb); nb.focus();
    }
    if (e.key === "Enter" && e.target.id === "start-name") { e.preventDefault(); enter(); return; }
    if (e.key === "Enter" && e.target.id === "tg-code-input") { e.preventDefault(); submitCode(); }
    if (e.key === "Enter" && e.target.id === "restore-code") { var r = view.querySelector("[data-restore]"); if (r) r.click(); }
  });

  M.onLangChange(function () { draw(false); });
  draw(false);
});
