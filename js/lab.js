/*
 * Brain Lab page: a hub of six activities (js/games.js) with one URL each
 * (lab.html#stroop, #reaction, #digits, #sequence, #breathing, #sleep) and a
 * "My results" panel. Results stay in this browser (js/store.js).
 */
Medulla.ready(function () {
  "use strict";

  var M = window.Medulla, G = window.MedullaGames, Store = window.MedullaStore;
  var t = M.t, esc = M.esc;
  var hub = document.getElementById("lab-hub"), view = document.getElementById("lab-activity");
  var grid = document.getElementById("activity-grid"), mount = document.getElementById("activity-mount");
  var ctrl = null, current = null;

  function best(id) {
    var rs = Store.get().results.filter(function (r) { return r.type === id; });
    if (!rs.length) return null;
    if (id === "reaction") return M.msText(Math.min.apply(null, rs.map(function (r) { return r.best; })));
    if (id === "digits" || id === "sequence") return t("game.span.bestShort", { n: Math.max.apply(null, rs.map(function (r) { return r.span || 0; })) });
    if (id === "stroop") return t("game.stroop.timesPlayed", { n: rs.length });
    if (id === "breathing") return t("game.breathing.sessions", { n: rs.length });
    return null;
  }

  function renderHub() {
    grid.innerHTML = G.list.map(function (g) {
      var c = M.characters[g.char], b = g.id === "sleep" ? (Store.get().sleepDays.length ? t("game.sleep.nights", { n: Store.get().sleepDays.length }) : null) : best(g.id);
      return '<li><a class="activity-card tilt press" data-tilt href="#' + g.id + '">' +
        '<span class="act-meta"><span class="chip">' + esc(t(g.kind === "test" ? "game.kind.test" : "game.kind.exercise")) + '</span><span class="chip" style="background:var(--bg-soft);color:var(--ink-3)">' + M.icon("clock") + " " + esc(t("game.minutes", { n: g.minutes })) + "</span></span>" +
        '<span class="act-art" style="--tint:' + c.tint + '">' + M.charImg(g.char, "idle idle-" + g.char, "") + "</span>" +
        "<h3>" + esc(t("game." + g.id + ".title")) + "</h3>" +
        "<p>" + esc(t("game." + g.id + ".short")) + "</p>" +
        (b ? '<span class="act-best">' + M.icon("star") + " " + esc(t("game.yourBest")) + ": " + esc(b) + "</span>" : "") +
        "</a></li>";
    }).join("");
    if (window.MedullaMotion) window.MedullaMotion.initTilt(grid);
  }

  /* ---------------------------------------------------------- dashboard */

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function when(iso) { var d = new Date(iso); return isNaN(d) ? "" : two(d.getDate()) + "." + two(d.getMonth() + 1) + " · " + two(d.getHours()) + ":" + two(d.getMinutes()); }
  function resultValue(r) {
    if (r.type === "reaction") return M.msText(r.avg);
    if (r.type === "stroop") return r.effect === null || r.effect === undefined ? "—" : (r.effect >= 0 ? "+" : "−") + M.msText(Math.abs(r.effect));
    if (r.type === "digits" || r.type === "sequence") return t("game.span.bestShort", { n: r.span || 0 });
    if (r.type === "breathing") return M.fmt((r.seconds || 0) / 60, 1) + " " + t("game.min");
    return "";
  }

  function renderDash() {
    var dash = document.getElementById("lab-dash");
    if (!dash) return;
    var lastR = Store.lastResult("reaction"), lastS = Store.lastResult("stroop"), bestR = Store.bestReaction();
    var spans = function (type) { var r = Store.get().results.filter(function (x) { return x.type === type; }); return r.length ? Math.max.apply(null, r.map(function (x) { return x.span || 0; })) : null; };
    var entries = Store.get().results.slice(-6).reverse();
    dash.innerHTML =
      '<div class="card"><h2 style="display:flex;gap:8px;align-items:center">' + M.icon("chart") + "<span>" + esc(t("lab.dashTitle")) + "</span></h2>" +
        '<p class="muted" style="margin:4px 0 0;font-size:.88rem">' + esc(t("lab.savedHere")) + "</p></div>" +
      '<div class="card"><div class="side-head"><h3 style="margin:0">' + esc(t("game.reaction.title")) + '</h3><span class="tile is-orange" style="width:36px;height:36px">' + M.icon("bolt") + "</span></div>" +
        '<div class="metric-row"><span class="metric-big' + (bestR ? "" : " is-empty") + '">' + esc(M.msText(bestR)) + '</span><span class="metric-label">' + esc(t("lab.best")) + "</span></div>" +
        '<p class="metric-label" style="margin:14px 0 18px">' + esc(t("lab.lastTries")) + "</p>" + M.barsHtml(lastR && lastR.times) + "</div>" +
      '<div class="card"><div class="side-head"><h3 style="margin:0">' + esc(t("game.stroop.title")) + '</h3><span class="tile" style="width:36px;height:36px">' + M.icon("swatch") + "</span></div>" +
        '<div class="metric-row"><span class="metric-big' + (lastS ? "" : " is-empty") + '">' + esc(lastS && lastS.effect !== null ? (lastS.effect >= 0 ? "+" : "−") + M.msText(Math.abs(lastS.effect)) : "—") + '</span><span class="metric-label">' + esc(t("lab.lastEffect")) + "</span></div>" +
        '<div class="metric-row" style="margin-top:12px"><span class="metric-label">' + esc(t("lab.lastAccuracy")) + '</span><strong style="color:var(--ink)">' + esc(lastS ? M.fmt(lastS.accuracy, lastS.accuracy % 1 ? 1 : 0) + "%" : "—") + "</strong></div>" +
        '<div class="meter" style="margin-top:8px"><span style="width:' + (lastS ? lastS.accuracy : 0) + '%"></span></div></div>' +
      '<div class="card"><div class="side-head"><h3 style="margin:0">' + esc(t("lab.spans")) + '</h3><span class="tile" style="width:36px;height:36px">' + M.icon("grid") + "</span></div>" +
        '<ul class="summary-grid" style="grid-template-columns:1fr 1fr"><li><strong>' + esc(spans("digits") || "—") + "</strong><span>" + esc(t("game.digits.title")) + "</span></li>" +
        "<li><strong>" + esc(spans("sequence") || "—") + "</strong><span>" + esc(t("game.sequence.title")) + "</span></li></ul></div>" +
      '<div class="card"><div class="side-head"><h3 style="margin:0">' + esc(t("lab.history")) + "</h3>" +
        (entries.length ? '<button type="button" class="link-btn" id="clear-history">' + esc(t("lab.clear")) + "</button>" : "") + "</div>" +
        (entries.length ? '<ul class="history-list">' + entries.map(function (r) {
          return '<li><span class="h-main"><strong>' + esc(t("game." + r.type + ".title")) + "</strong><span>" + esc(when(r.at)) + '</span></span><span class="h-val">' + esc(resultValue(r)) + "</span></li>";
        }).join("") + "</ul>" : '<p class="empty-line"><strong style="color:var(--ink)">' + esc(t("lab.noData")) + "</strong><br>" + esc(t("lab.noDataHint")) + "</p>") +
        (Store.available() ? "" : '<p class="empty-line">' + esc(t("lab.storageOff")) + "</p>") +
      "</div>" +
      '<div class="card tip-card">' + M.charImg("lumi", "", "") + "<p>" + esc(t("lab.tip")) + "</p></div>";
    var clear = document.getElementById("clear-history");
    if (clear) clear.addEventListener("click", function () {
      if (!window.confirm(t("lab.clearConfirm"))) return;
      Store.clearResults();
      M.toast({ icon: "trash", title: t("lab.cleared") });
    });
  }

  /* ------------------------------------------------------------ routing */

  function open(id) {
    if (ctrl) { ctrl.destroy(); ctrl = null; }
    current = id;
    hub.hidden = true; view.hidden = false;
    ctrl = G.mount(id, mount, { heading: "h2" });
    renderDash();
    document.title = t("game." + id + ".title") + " — " + t("lab.eyebrow") + " — Medulla";
    var h = mount.querySelector("h2");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    window.scrollTo({ top: Math.max(0, view.getBoundingClientRect().top + window.scrollY - 90), behavior: M.reducedMotion() ? "auto" : "smooth" });
  }
  function close() {
    if (ctrl) { ctrl.destroy(); ctrl = null; }
    current = null;
    view.hidden = true; hub.hidden = false;
    renderHub();
    document.title = t("meta.lab.title");
  }
  function route() {
    var id = location.hash.slice(1);
    if (G.get(id)) open(id); else if (current) close();
  }

  document.getElementById("lab-back").addEventListener("click", function (e) {
    e.preventDefault();
    history.pushState(null, "", location.pathname + location.search);
    close();
    var first = grid.querySelector("a"); if (first) first.focus({ preventScroll: true });
  });
  window.addEventListener("hashchange", route);
  document.addEventListener("medulla:progress", function () { renderDash(); if (!current) renderHub(); });
  M.onLangChange(function () { renderHub(); if (current) open(current); });

  renderHub();
  route();
});
