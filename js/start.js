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
    var n = Store.ensureProfile().nick;
    return t("nick.format", { adj: t("nick.adj." + n.a), noun: t("nick.noun." + n.n), num: n.num });
  }

  function enter() {
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
        '<p class="muted start-note">' + esc(t("me.profileLead")) + "</p></div>" +
      '<button type="button" class="btn btn-primary btn-block press" data-enter><span>' + esc(t("start.go")) + "</span>" + icon("arrow") + "</button>" +
      (B.ready() ? '<p class="start-alt">' + esc(t("start.haveCode")) + ' <button type="button" class="link-btn" data-view="code">' + esc(t("sync.restore")) + "</button></p>" : "");
  }

  function viewBack() {
    var s = Store.get(), lv = Store.level();
    return hero("win") +
      "<h1>" + esc(t("start.backTitle")) + '</h1><p class="lead">' + esc(t("start.backLead")) + "</p>" +
      '<div class="start-profile">' + M.avatarPic(Object.assign({}, s.profile, { avatar: chosen }), "me-avatar") +
        "<span><strong>" + esc(nick()) + "</strong><small>" + esc(t("start.levelLine", { n: lv.level, xp: M.fmt(s.xp) })) + "</small></span></div>" +
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
    if (tgt.closest("[data-reroll]")) { Store.setProfile({ nick: Store.randomNick() }); view.querySelector("#start-nick").textContent = nick(); S.tap(); return; }
    if (tgt.closest("[data-enter]")) { enter(); return; }
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

  // Arrow keys move between characters (radio group).
  view.addEventListener("keydown", function (e) {
    var cur = e.target.closest("[data-avatar]");
    if (cur && /^Arrow(Left|Right|Up|Down)$/.test(e.key)) {
      var all = Array.prototype.slice.call(view.querySelectorAll("[data-avatar]")), i = all.indexOf(cur);
      var step = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
      var nb = all[(i + step + all.length) % all.length];
      e.preventDefault(); pickAvatar(nb); nb.focus();
    }
    if (e.key === "Enter" && e.target.id === "restore-code") { var r = view.querySelector("[data-restore]"); if (r) r.click(); }
  });

  M.onLangChange(function () { draw(false); });
  draw(false);
});
