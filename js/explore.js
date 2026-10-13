/*
 * Explorer: the visitor's own space. Hash routes:
 *   #/ brain map (dashboard) · #/daily challenge · and under "Me":
 *   #/me profile · #/badges · #/saved · #/history
 * Everything lives on this device (js/store.js). Optional sync goes through
 * js/backend.js and only after the consent screen. Only signed-in visitors get
 * here (js/prefs.js sends others to start.html, where the profile is made).
 */
Medulla.ready(function () {
  "use strict";

  var M = window.Medulla, Store = window.MedullaStore, B = window.MedullaBackend, G = window.MedullaGames, S = window.MedullaSound;
  var t = M.t, esc = M.esc, icon = M.icon;
  var view = document.getElementById("view"), greet = document.getElementById("greet");
  var facts = [], gameCtrl = null;
  var ROUTES = ["", "daily", "badges", "saved", "history", "me"];

  /* -------------------------------------------------------------- helpers */

  function nick() { return M.nickName(); }
  function avatar() { return Store.get().profile.avatar || "dendi"; }
  function today() { return Store.dayKey(); }
  function dayIdx() { return M.todayIndex(1000); }
  function dailyState() { return Store.get().daily[today()] || { fact: false, quiz: [], game: false, done: false }; }
  function dailyFacts() {
    var n = facts.length, i = M.todayIndex(n);
    return { fact: facts[i], quiz: [facts[i], facts[(i + 7) % n], facts[(i + 13) % n]] };
  }
  var DAILY_GAMES = ["digits", "sequence", "reaction", "stroop"];
  function dailyGame() { return DAILY_GAMES[dayIdx() % DAILY_GAMES.length]; }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function when(iso) { var d = new Date(iso); return isNaN(d) ? "" : two(d.getDate()) + "." + two(d.getMonth() + 1) + " · " + two(d.getHours()) + ":" + two(d.getMinutes()); }

  function renderGreet() {
    var pr = Store.get().profile, lv = Store.level(), pose = M.avatarMoods.indexOf(pr.mood) > 0 ? pr.mood : "hello";
    greet.innerHTML = '<span class="greet-avatar"' + M.avatarStyle(avatar(), pr.bg) + '>' + M.poseImg(avatar(), pose, "idle idle-" + avatar(), true) + "</span>" +
      "<div><p class=\"eyebrow\" style=\"margin:0 0 4px\">" + icon("compass") + "<span>" + esc(t("explore.eyebrow")) + "</span></p>" +
      "<h1>" + esc(t("explore.hello", { name: nick() })) + "</h1><p>" + esc(t("explore.levelLine", { n: lv.level, xp: M.fmt(Store.get().xp) })) + "</p></div>";
  }

  /* ------------------------------------------------------------ brain map */

  // The dashboard (2.4): five areas of brain care around the visitor's own
  // character, one habit and one character each. Doing something in an area
  // lights it for the day; lighting all five links the whole network.
  var AREA_IDS = Store.areas.map(function (a) { return a.id; }); // ring order
  var AREA_CHAR = {};
  Store.areas.forEach(function (a) { AREA_CHAR[a.id] = a.char; });
  var AREA_ICON = { learn: "book", move: "bolt", explore: "compass", calm: "heart", sleep: "moon" };
  // Each area's "why": a checked fact (its page shows the source and review status).
  var AREA_FACT = { learn: "retrieval-practice", move: "exercise-learning", explore: "neuroplasticity", calm: "hindbrain-breathing", sleep: "sleep-hours" };
  // Positions on the map (percent of a square), clockwise from the top.
  var POS = { learn: [50, 12], move: [87, 39], explore: [73, 83], calm: [27, 83], sleep: [13, 39] };
  var WHO_PA = "https://iris.who.int/bitstream/handle/10665/337001/9789240014886-eng.pdf";
  var focusArea = null;

  function litSet() { var o = {}; Store.litToday().forEach(function (id) { o[id] = true; }); return o; }
  function pctOf(inf) { return Math.round(((inf.days - inf.from) / Math.max(1, inf.to - inf.from)) * 100); }
  function factById(id) { return facts.filter(function (f) { return f.id === id; })[0]; }

  function mapStage(lit, info) {
    var n = AREA_IDS.filter(function (id) { return lit[id]; }).length, full = n === AREA_IDS.length;
    var lines = AREA_IDS.map(function (id) {
      var p = POS[id];
      return '<line class="map-spoke' + (lit[id] ? " is-on" : "") + '" x1="50" y1="50" x2="' + p[0] + '" y2="' + p[1] + '"/>';
    }).join("") + AREA_IDS.map(function (id, i) {
      var nx = AREA_IDS[(i + 1) % AREA_IDS.length], a = POS[id], b = POS[nx];
      return '<line class="map-edge' + (lit[id] && lit[nx] ? " is-on" : "") + '" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"/>';
    }).join("");
    var nodes = AREA_IDS.map(function (id) {
      var c = M.characters[AREA_CHAR[id]], inf = info[id], p = POS[id];
      return '<button type="button" class="map-node' + (lit[id] ? " is-lit" : "") + '" style="left:' + p[0] + "%;top:" + p[1] + "%;--tint:" + c.tint + ";--pct:" + pctOf(inf) + '%" data-area="' + id + '" aria-pressed="' + (focusArea === id) + '"' +
        ' aria-label="' + esc(t("map.nodeAria", { area: t("map.area." + id), name: c.name, state: t(lit[id] ? "map.litYes" : "map.litNo"), n: inf.level })) + '">' +
        '<span class="map-orb">' + M.charFace(AREA_CHAR[id], "", true) + '<span class="map-lv" aria-hidden="true">' + inf.level + "</span></span>" +
        '<span class="map-name" aria-hidden="true">' + icon(AREA_ICON[id]) + "<span>" + esc(t("map.area." + id)) + "</span></span></button>";
    }).join("");
    return '<div class="map-stage' + (full ? " is-full" : "") + '">' +
      '<svg class="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' + lines + "</svg>" +
      '<div class="map-core" aria-hidden="true"><span class="map-core-art">' + M.poseImg(avatar(), full ? "win" : n ? "hello" : "curious", "idle idle-" + avatar(), true) + "</span>" +
        '<span class="map-count">' + n + "/5</span></div>" + nodes + "</div>";
  }

  // A row of answer chips for one check-in question.
  function chips(field, label, values, show, current, unit) {
    return '<fieldset class="ci-row"><legend>' + esc(label) + '</legend><div class="ci-chips">' + values.map(function (v) {
      return '<button type="button" class="ci-chip press" data-ci="' + field + '" data-v="' + String(v) + '" aria-pressed="' + (current === v) + '">' +
        "<strong>" + esc(show(v)) + "</strong>" + (unit ? "<small>" + esc(unit) + "</small>" : "") + "</button>";
    }).join("") + "</div></fieldset>";
  }

  // 1 = low … 5 = great, drawn as small faces (no emoji: they differ per device).
  function moodFace(v) {
    var mouth = ["", "M8 16.6c2.4-2.6 5.6-2.6 8 0", "M8.6 15.8h6.8", "M8.6 15.2h6.8", "M8 14.4c2.4 2.8 5.6 2.8 8 0", "M7.4 13.8c2.6 4 6.6 4 9.2 0"][v];
    var eyes = v === 2 ? '<path d="M7.8 10.4h2.6M13.6 10.4h2.6"/>' : '<circle class="d" cx="9.1" cy="10" r="1.25"/><circle class="d" cx="14.9" cy="10" r="1.25"/>';
    return '<svg class="icon mood-face" viewBox="0 0 24 24" aria-hidden="true"><circle class="f" cx="12" cy="12" r="9"/>' + eyes + '<path d="' + mouth + '"/></svg>';
  }
  function moodRow(current) {
    return '<fieldset class="ci-row"><legend>' + esc(t("map.mood.q")) + '</legend><div class="ci-chips is-mood">' + [1, 2, 3, 4, 5].map(function (v) {
      return '<button type="button" class="ci-chip ci-mood press" data-ci="mood" data-v="' + v + '" aria-pressed="' + (current === v) + '">' + moodFace(v) + "<small>" + esc(t("map.mood." + v)) + "</small></button>";
    }).join("") + "</div></fieldset>" +
      (current && current <= 2 ? '<p class="ci-support">' + icon("heart") + "<span>" + esc(t("map.mood.support")) + "</span></p>" : "");
  }

  function quest(href, key, done) {
    return '<a class="quest' + (done ? " is-done" : "") + '" href="' + href + '"><span class="quest-box">' + icon(done ? "check" : "play") + "</span><span>" + esc(t(key)) + "</span>" + icon("arrow", "icon-sm") + "</a>";
  }

  function panel(id, lit, info) {
    var ch = AREA_CHAR[id], c = M.characters[ch], inf = info[id], on = !!lit[id], d = Store.today(), R = M.root();
    var body = "";
    if (id === "sleep") {
      body = chips("sleepH", t("map.sleep.q"), Store.checkinOptions.sleepH, function (v) { return v === 6 ? "≤6" : v === 10 ? "10+" : String(v); }, d.sleepH, t("map.unit.h")) +
        '<p class="ci-hint">' + esc(t("map.sleep.hint")) + "</p>" +
        chips("screens", t("map.screens.q"), [true, false], function (v) { return t(v ? "map.yes" : "map.no"); }, d.screens) +
        '<div class="quests">' + quest(R + "lab.html#sleep", "map.sleep.quest", d.sleep > 0) + "</div>";
    } else if (id === "move") {
      body = chips("move", t("map.move.q"), Store.checkinOptions.move, function (v) { return v === 60 ? "60+" : String(v); }, d.move, t("map.unit.min")) +
        '<p class="ci-hint">' + esc(t("map.move.hint")) + ' <a href="' + WHO_PA + '"' + M.externalAttrs() + ">" + esc(t("map.move.source")) + M.srExternal() + "</a></p>" +
        '<p class="ci-hint">' + esc(t("map.move.ideas")) + "</p>";
    } else if (id === "learn") {
      body = '<div class="quests">' + quest(R + "learn.html", "map.learn.fact", d.facts > 0) + quest("#/daily", "map.learn.quiz", d.quiz > 0) +
        quest("#/saved", "map.learn.review", false) + "</div>";
    } else if (id === "calm") {
      var kinds = ["share", "thank", "breathe", "help", "listen"], doneK = Store.get().kindness[today()] || [];
      body = moodRow(d.mood) +
        '<div class="quests">' + quest(R + "lab.html#breathing", "map.calm.breathe", (d.breaths || 0) > 0 || d.breath > 0) + "</div>" +
        '<p class="ci-legend">' + esc(t("kind.title")) + '</p><ul class="kind-tasks">' + kinds.map(function (k) {
          var done = doneK.indexOf(k) !== -1;
          return '<li><button type="button" class="kind-task press" data-kind="' + k + '" aria-pressed="' + done + '"><span class="kt-box">' + icon("check") + "</span><span>" + esc(t("kind.task." + k)) + "</span></button></li>";
        }).join("") + "</ul>";
    } else if (id === "explore") {
      body = '<div class="quests">' + quest("#/daily", "map.explore.daily", dailyState().done) + quest(R + "lab.html", "map.explore.lab", d.games > 0) + "</div>";
    }
    var f = factById(AREA_FACT[id]);
    var why = f ? '<a class="area-why" href="' + M.factUrl(f) + '"><span class="tile">' + icon("book") + "</span><span><small>" + esc(t("map.why")) + "</small><strong>" + esc(M.localized(f.title)) + "</strong></span>" + icon("arrow", "icon-sm") + "</a>" : "";
    return '<div class="area-head"><span class="area-art" style="--tint:' + c.tint + '">' + M.poseImg(ch, on ? "correct" : "curious", "", true) + "</span>" +
        '<div><p class="eyebrow">' + icon(AREA_ICON[id]) + "<span>" + esc(c.name + " · " + t("map.area." + id)) + "</span></p>" +
        '<h2 id="area-title">' + esc(t("map.title." + id)) + '</h2><p class="area-state' + (on ? " is-on" : "") + '">' + icon(on ? "check" : "sparkle") + "<span>" + esc(t(on ? "map.litToday" : "map.notYet")) + "</span></p></div></div>" +
      '<div class="area-level"><strong>' + esc(t("me.level", { n: inf.level })) + '</strong><span class="meter"><span style="width:' + pctOf(inf) + '%"></span></span><small>' + esc(t("map.daysLit", { n: inf.days, next: inf.to })) + "</small></div>" +
      '<p class="area-what">' + esc(t("map.what." + id)) + "</p>" + body + why;
  }

  function weekGrid() {
    var wk = Store.weekAreas(), names = t("week.days").split(","), total = 0;
    wk.forEach(function (d) { total += d.lit.length; });
    var head = wk.map(function (d, i) {
      var dt = new Date(d.key + "T12:00:00");
      return '<th scope="col"' + (i === 6 ? ' class="is-today"' : "") + ">" + esc(names[(dt.getDay() + 6) % 7] || "") + "</th>";
    }).join("");
    var rows = AREA_IDS.map(function (id) {
      return '<tr><th scope="row"><span class="wm-face" style="--tint:' + M.characters[AREA_CHAR[id]].tint + '">' + M.charFace(AREA_CHAR[id], "", true) + "</span><span>" + esc(t("map.area." + id)) + "</span></th>" +
        wk.map(function (d, i) {
          var on = d.lit.indexOf(id) !== -1;
          return '<td class="' + (on ? "is-on" : "") + (i === 6 ? " is-today" : "") + '"><span class="wm-dot">' + (on ? icon("check") : "") + '</span><span class="sr-only">' + esc(t(on ? "map.litYes" : "map.litNo")) + "</span></td>";
        }).join("") + "</tr>";
    }).join("");
    return '<section class="card app-card week-map" aria-labelledby="wm-title"><div class="card-head"><h2 id="wm-title">' + esc(t("map.weekTitle")) + '</h2><span class="chip">' + esc(t("map.weekCount", { n: total })) + "</span></div>" +
      '<div class="wm-scroll"><table class="wm-table"><thead><tr><td></td>' + head + "</tr></thead><tbody>" + rows + "</tbody></table></div>" +
      '<p class="muted wm-note">' + esc(t("map.weekNote")) + "</p></section>";
  }

  // My experiment: the visitor's own Reaction test against their own sleep log.
  function experiment() {
    var e = Store.sleepExperiment(), ready = e.enough.n >= 2 && e.less.n >= 2;
    var body;
    if (ready) {
      var max = Math.max(e.enough.avg, e.less.avg);
      var bar = function (key, g) {
        return '<div class="exp-row"><span>' + esc(t(key)) + '</span><span class="exp-bar"><span style="width:' + Math.round((g.avg / max) * 100) + '%"></span></span><strong>' + esc(M.msText(g.avg)) + "</strong><small>" + esc(t("map.exp.times", { n: g.n })) + "</small></div>";
      };
      body = bar("map.exp.enough", e.enough) + bar("map.exp.less", e.less) +
        '<p class="exp-diff">' + esc(t(e.enough.avg < e.less.avg ? "map.exp.faster" : e.enough.avg > e.less.avg ? "map.exp.slower" : "map.exp.same", { ms: Math.abs(e.less.avg - e.enough.avg) })) + "</p>";
    } else {
      body = '<p class="muted">' + esc(t("map.exp.how")) + "</p>" +
        '<ul class="exp-need"><li><strong>' + Math.min(e.enough.n, 2) + "/2</strong>" + esc(t("map.exp.enough")) + "</li><li><strong>" + Math.min(e.less.n, 2) + "/2</strong>" + esc(t("map.exp.less")) + "</li></ul>";
    }
    return '<section class="card app-card experiment" aria-labelledby="exp-title"><div class="card-head"><h2 id="exp-title">' + esc(t("map.exp.title")) + "</h2>" +
        '<span class="exp-faces" aria-hidden="true">' + M.charFace("lumi", "", true) + M.charFace("octa", "", true) + "</span></div>" +
      body + '<p class="exp-honest">' + icon("info") + "<span>" + esc(t("map.exp.honest")) + "</span></p>" +
      '<a class="btn btn-ghost btn-sm press" href="' + M.root() + 'lab.html#reaction">' + icon("bolt") + "<span>" + esc(t("map.exp.play")) + "</span></a></section>";
  }

  // The project beyond the screen: events, volunteering, the families we support.
  function community() {
    var R = M.root();
    return '<section class="card app-card community" aria-labelledby="world-title">' +
      '<span class="community-art">' + M.poseImg("syno", "correct", "", false) + "</span>" +
      '<div><p class="eyebrow">' + icon("users") + "<span>" + esc(t("map.world.eyebrow")) + '</span></p><h2 id="world-title">' + esc(t("map.world.title")) + "</h2>" +
        "<p>" + esc(t("story.syno.text")) + "</p>" +
        '<div class="btn-row"><a class="btn btn-primary btn-sm press" href="' + R + 'events.html">' + icon("calendar") + "<span>" + esc(t("nav.events")) + "</span></a>" +
          '<a class="btn btn-ghost btn-sm press" href="' + R + 'join.html">' + icon("users") + "<span>" + esc(t("map.world.join")) + "</span></a>" +
          '<a class="btn btn-ghost btn-sm press" href="' + R + 'parents.html">' + icon("heart") + "<span>" + esc(t("nav.parents")) + "</span></a></div></div></section>";
  }

  function viewMap() {
    var lit = litSet(), info = Store.areaInfo(), n = Object.keys(lit).length;
    if (!focusArea) focusArea = AREA_IDS.filter(function (id) { return !lit[id]; })[0] || AREA_IDS[0];
    return '<div class="map-grid">' +
        '<section class="card app-card map-card" aria-labelledby="map-title"><div class="card-head"><div><h2 id="map-title">' + esc(t("map.title")) + "</h2>" +
          '<p class="muted" style="margin:4px 0 0">' + esc(n === 5 ? t("map.full") : t("map.today", { n: n })) + "</p></div>" +
          "</div>" +
          '<div id="map-stage-slot">' + mapStage(lit, info) + "</div>" +
          '<p class="muted map-hint">' + esc(t("map.hint")) + "</p></section>" +
        '<section class="card app-card area-panel" id="area-panel" aria-labelledby="area-title">' + panel(focusArea, lit, info) + "</section>" +
      "</div>" +
      '<div class="app-grid map-more">' + weekGrid() + experiment() + "</div>" +
      community();
  }

  // Redraw after a tap without losing the visitor's place (focus and scroll stay).
  function refreshMap(keepFocus) {
    var a = document.activeElement, sel = null;
    if (keepFocus && a && view.contains(a)) {
      if (a.hasAttribute("data-ci")) sel = '[data-ci="' + a.getAttribute("data-ci") + '"][data-v="' + a.getAttribute("data-v") + '"]';
      else if (a.hasAttribute("data-kind")) sel = '[data-kind="' + a.getAttribute("data-kind") + '"]';
      else if (a.hasAttribute("data-area")) sel = '[data-area="' + a.getAttribute("data-area") + '"]';
    }
    view.innerHTML = viewMap();
    M.runRenderers(view);
    if (sel) { var n = view.querySelector(sel); if (n) n.focus({ preventScroll: true }); }
  }

  function mapClick(e) {
    var tgt = e.target;
    var node = tgt.closest("[data-area]");
    if (node) {
      focusArea = node.getAttribute("data-area");
      S.tap();
      refreshMap(true);
      // phones: the panel is below the map
      var p = document.getElementById("area-panel");
      if (p && window.matchMedia("(max-width: 959px)").matches) p.scrollIntoView({ behavior: M.reducedMotion() ? "auto" : "smooth", block: "start" });
      return;
    }
    var ci = tgt.closest("[data-ci]");
    if (ci) {
      var raw = ci.getAttribute("data-v"), v = raw === "true" ? true : raw === "false" ? false : Number(raw);
      Store.record("checkin", { field: ci.getAttribute("data-ci"), value: v });
      S.tap();
      return; // the progress event redraws
    }
    var k = tgt.closest("[data-kind]");
    if (k && k.getAttribute("aria-pressed") !== "true") {
      if (Store.record("kind", { task: k.getAttribute("data-kind") })) S.correct();
    }
  }

  /* -------------------------------------------------------------- "Me" */

  // Profile, badges, saved facts and results share one tab with sub-tabs.
  var ME_ROUTES = [["me", "me.profile", "user"], ["badges", "explore.tab.badges", "trophy"], ["saved", "explore.tab.saved", "bookmark"], ["history", "explore.tab.history", "chart"]];
  function meNav(r) {
    return '<nav class="seg" data-i18n-attr="aria-label:app.me" aria-label="' + esc(t("app.me")) + '">' + ME_ROUTES.map(function (x) {
      return '<a href="#/' + x[0] + '"' + (r === x[0] ? ' aria-current="page"' : "") + ">" + icon(x[2]) + "<span>" + esc(t(x[1])) + "</span></a>";
    }).join("") + "</nav>";
  }

  // The five areas as skills, plus overall level.
  function skills() {
    var info = Store.areaInfo(), s = Store.get(), lv = Store.level();
    return '<section class="card app-card skills"><div class="card-head"><h2>' + esc(t("map.skills")) + '</h2><strong class="xp-num">' + M.fmt(s.xp) + " XP</strong></div>" +
      '<div class="skill-total"><span class="level-badge"><span><small>' + esc(t("me.levelShort")) + "</small><strong>" + lv.level + '</strong></span></span><div><span class="meter"><span style="width:' + lv.pct + '%"></span></span>' +
        "<p>" + esc(t("explore.toNext", { n: M.fmt(lv.span - lv.into), level: lv.level + 1 })) + "</p></div></div>" +
      '<ul class="skill-list">' + AREA_IDS.map(function (id) {
        var inf = info[id], ch = AREA_CHAR[id];
        return '<li><span class="wm-face" style="--tint:' + M.characters[ch].tint + '">' + M.charFace(ch, "", true) + "</span><span class=\"skill-name\"><strong>" + esc(t("map.area." + id)) + "</strong><small>" + esc(t("map.daysLit", { n: inf.days, next: inf.to })) + "</small></span>" +
          '<span class="meter"><span style="width:' + pctOf(inf) + '%"></span></span><span class="skill-lv">' + esc(t("me.level", { n: inf.level })) + "</span></li>";
      }).join("") + "</ul></section>";
  }

  /* --------------------------------------------------------------- daily */

  var dailyStep = null;

  function viewDaily() {
    var d = dailyState(), df = dailyFacts();
    var step = dailyStep || (!d.fact ? "fact" : d.quiz.length < 3 ? "quiz" : !d.game ? "game" : "done");
    dailyStep = step;
    var order = ["fact", "quiz", "game", "done"];
    var steps = '<ol class="steps">' + ["fact", "quiz", "game"].map(function (k) {
      var i = order.indexOf(k), si = order.indexOf(step);
      return '<li class="' + (i < si ? "is-done" : i === si ? "is-now" : "") + '">' + esc(t("daily.step." + k)) + "</li>";
    }).join("") + "</ol>";
    var body = "";
    if (step === "fact") {
      var f = df.fact, who = M.factChar(f);
      body = '<p class="muted">' + esc(t("daily.factLead", { name: M.characters[who].name })) + "</p>" +
        '<div class="flip" id="flip"><div class="flip-inner">' +
          '<button type="button" class="flip-face flip-front press" data-flip aria-expanded="false"><span class="chip">' + esc(M.topicName(f)) + "</span>" +
            "<h3>" + esc(M.localized(f.title)) + '</h3><span class="flip-hint">' + icon("refresh") + esc(t("daily.flip")) + "</span>" + M.poseImg(who, "curious", "idle idle-" + who) + "</button>" +
          '<div class="flip-face flip-back" inert><span class="chip">' + esc(M.topicName(f)) + "</span><h3>" + esc(M.localized(f.title)) + "</h3>" +
            '<p class="fact-text">' + esc(M.localized(f.simple)) + "</p>" + M.sourceLine(f) +
            '<div class="btn-row"><a class="text-link" href="' + M.factUrl(f) + '">' + esc(t("daily.readMore")) + icon("arrow", "icon-sm") + "</a></div></div>" +
        "</div></div>" +
        '<div class="btn-row" style="margin-top:16px"><button type="button" class="btn btn-primary press" data-next="quiz" disabled>' + esc(t("daily.next")) + icon("arrow") + "</button></div>";
    } else if (step === "quiz") {
      body = '<div class="quiz" id="daily-quiz"></div>';
    } else if (step === "game") {
      var gid = dailyGame();
      body = '<p class="muted">' + esc(t("daily.gameLead", { game: t("game." + gid + ".title") })) + '</p><div class="card experiment-card" id="daily-game"></div>';
    } else {
      body = '<div class="done-card">' + M.poseImg("dendi", "win", "idle idle-dendi") + "<h2>" + esc(t("daily.doneTitle")) + "</h2><p>" + esc(t("daily.doneText")) + "</p>" +
        '<div class="btn-row" style="justify-content:center"><a class="btn btn-primary press" href="#/">' + icon("home") + "<span>" + esc(t("daily.backHome")) + '</span></a><a class="btn btn-ghost press" href="' + M.root() + 'lab.html">' + icon("target") + "<span>" + esc(t("daily.moreLab")) + "</span></a></div></div>";
    }
    return '<div class="card app-card"><h2 style="margin-bottom:12px">' + esc(t("daily.title")) + "</h2>" + steps + body + "</div>";
  }

  function wireDaily() {
    var step = dailyStep;
    if (step === "fact") {
      var flip = document.getElementById("flip"), btn = flip.querySelector("[data-flip]"), next = view.querySelector('[data-next="quiz"]');
      btn.addEventListener("click", function () {
        flip.classList.add("is-flipped");
        btn.setAttribute("aria-expanded", "true");
        flip.querySelector(".flip-back").removeAttribute("inert");
        btn.setAttribute("tabindex", "-1");
        next.disabled = false;
        S.tap();
        var f = dailyFacts().fact;
        M.readFact(f);
        Store.record("daily", { part: "fact" });
        next.focus();
      });
      next.addEventListener("click", function () { dailyStep = "quiz"; draw(); });
      if (dailyState().fact) { btn.click(); }
    }
    if (step === "quiz") runQuiz();
    if (step === "game") {
      var gid = dailyGame();
      gameCtrl = G.mount(gid, document.getElementById("daily-game"), { heading: "h3", short: true, onDone: function () {
        Store.record("daily", { part: "game" });
        if (dailyState().done) B.bump("daily_challenges", Store.get().club);
        setTimeout(function () { dailyStep = "done"; draw(); }, 2200);
      } });
    }
    if (step === "done" && window.MedullaMotion && !dailyState().celebrated) {
      window.MedullaMotion.burst();
    }
  }

  function runQuiz() {
    var box = document.getElementById("daily-quiz"), qs = dailyFacts().quiz, i = 0, answers = [];
    function show() {
      var f = qs[i], q = f.quiz, order = window.MedullaFactTemplate.quizOrder(f);
      box.innerHTML = '<div class="quiz-q" data-reveal><p class="eyebrow">' + icon("bulb") + esc(t("daily.question", { i: i + 1, n: qs.length })) + "</p>" +
        "<h3>" + esc(M.localized(q.q)) + '</h3><div class="quiz-options">' + order.map(function (oi, n) {
          return '<button type="button" class="quiz-option" data-opt="' + oi + '"><span class="qo-mark">' + String.fromCharCode(65 + n) + "</span><span>" + esc(M.localized(q.options[oi])) + "</span></button>";
        }).join("") + '</div><div class="quiz-why-slot" aria-live="polite"></div></div>';
      box.querySelector(".quiz-option").focus({ preventScroll: true });
    }
    box.addEventListener("click", function (e) {
      var b = e.target.closest(".quiz-option");
      if (b && !b.disabled) {
        var f = qs[i], ok = +b.getAttribute("data-opt") === f.quiz.answer;
        box.querySelectorAll(".quiz-option").forEach(function (o) {
          o.disabled = true;
          if (+o.getAttribute("data-opt") === f.quiz.answer) o.classList.add("is-right"); else if (o === b) o.classList.add("is-wrong");
        });
        answers.push(ok);
        if (ok) S.correct(); else S.wrong();
        Store.record("quiz", { correct: ok, fact: f.id });
        var last = i === qs.length - 1;
        box.querySelector(".quiz-why-slot").innerHTML = '<div class="quiz-react">' + M.poseImg(M.factChar(f), ok ? "correct" : "tryagain", "pose", true) + '<p class="quiz-why">' + icon(ok ? "check" : "info") + "<span><strong>" + esc(t(ok ? "quiz.right" : "quiz.notQuite")) + "</strong> " + esc(M.localized(f.quiz.why)) + "</span></p></div>" +
          '<div class="btn-row" style="margin-top:12px"><button type="button" class="btn btn-primary press" data-qnext>' + esc(t(last ? "daily.toGame" : "daily.nextQuestion")) + icon("arrow") + "</button></div>";
        box.querySelector("[data-qnext]").focus({ preventScroll: true });
        return;
      }
      if (e.target.closest("[data-qnext]")) {
        if (i < qs.length - 1) { i++; show(); }
        else { Store.record("daily", { part: "quiz", answers: answers }); dailyStep = "game"; draw(); }
      }
    });
    show();
  }

  /* ------------------------------------------------------------- badges */

  function viewBadges() {
    var s = Store.get();
    return '<div class="card app-card"><div class="card-head"><h2>' + esc(t("badges.title")) + '</h2><span class="chip">' + esc(t("badges.count", { n: Object.keys(s.badges).length, total: Store.badges.length })) + "</span></div>" +
      '<p class="muted">' + esc(t("badges.lead")) + '</p><ul class="badges-grid" data-render="badgesPreview"></ul></div>';
  }

  /* --------------------------------------------------------------- saved */

  function viewSaved() {
    var ids = Store.get().saved, list = facts.filter(function (f) { return ids.indexOf(f.id) !== -1; });
    if (!list.length) return '<div class="empty-state">' + M.poseImg("memo", "curious", "idle idle-memo") + "<h3>" + esc(t("saved.emptyTitle")) + "</h3><p>" + esc(t("saved.empty")) + '</p><a class="btn btn-primary press" href="' + M.root() + 'learn.html">' + icon("book") + "<span>" + esc(t("saved.browse")) + "</span></a></div>";
    return '<div class="card app-card"><h2>' + esc(t("saved.title")) + '</h2><ul class="related-list" style="margin-top:12px">' + list.map(function (f) {
      return '<li><a href="' + M.factUrl(f) + '"><span><span class="chip" style="margin-right:8px">' + esc(M.topicName(f)) + "</span>" + esc(M.localized(f.title)) + "</span>" + icon("arrow") + "</a></li>";
    }).join("") + "</ul></div>";
  }

  /* ------------------------------------------------------------- history */

  function resultValue(r) {
    if (r.type === "reaction") return M.msText(r.avg);
    if (r.type === "stroop") return r.effect === null || r.effect === undefined ? "—" : (r.effect >= 0 ? "+" : "−") + M.msText(Math.abs(r.effect));
    if (r.type === "digits" || r.type === "sequence") return t("game.span.bestShort", { n: r.span || 0 });
    if (r.type === "breathing") return M.fmt((r.seconds || 0) / 60, 1) + " " + t("game.min");
    return "";
  }

  function viewHistory() {
    var rs = Store.get().results.slice().reverse();
    return '<div class="app-grid"><div class="card app-card"><div class="card-head"><h2>' + esc(t("history.title")) + "</h2>" +
      (rs.length ? '<button type="button" class="link-btn" data-clear-results>' + esc(t("lab.clear")) + "</button>" : "") + "</div>" +
      (rs.length ? '<ul class="history-list">' + rs.map(function (r) {
        return '<li><span class="h-main"><strong>' + esc(t("game." + r.type + ".title")) + "</strong><span>" + esc(when(r.at)) + '</span></span><span class="h-val">' + esc(resultValue(r)) + "</span></li>";
      }).join("") + "</ul>" : '<p class="empty-line">' + esc(t("lab.noDataHint")) + "</p>") +
      '<p class="muted" style="font-size:.85rem;margin-top:12px">' + esc(t("history.honest")) + "</p></div>" +
      '<div class="card app-card"><h2>' + esc(t("lab.best")) + '</h2><p class="metric-big">' + esc(M.msText(Store.bestReaction())) + "</p>" +
      M.barsHtml((Store.lastResult("reaction") || {}).times) + '<p class="muted" style="font-size:.85rem;margin-top:18px">' + esc(t("lab.tip")) + "</p></div></div>";
  }

  /* ------------------------------------------------------------------ me */

  function viewMe() {
    var s = Store.get(), sync = s.sync || {}, ready = B.ready();
    var syncBody;
    if (!ready) syncBody = '<p class="muted">' + esc(t("sync.notSetUp")) + '</p><span class="tbd">' + esc(t("common.tbd")) + "</span>";
    else if (sync.enabled && sync.code) syncBody = '<p class="status-ok">' + icon("check") + " " + esc(t("sync.onSince", { date: (sync.lastSync || "").slice(0, 10) })) + "</p>" +
      '<div class="code-box" aria-label="' + esc(t("sync.yourCode")) + '"><span>' + esc(sync.code) + '</span><button type="button" class="btn btn-ghost btn-sm press" data-copy-code>' + icon("copy") + "<span>" + esc(t("sync.copy")) + "</span></button></div>" +
      '<div class="btn-row" style="margin-top:12px"><button type="button" class="btn btn-ghost btn-sm press" data-sync-now>' + icon("refresh") + "<span>" + esc(t("sync.now")) + '</span></button><button type="button" class="btn btn-danger btn-sm press" data-sync-off>' + icon("close") + "<span>" + esc(t("sync.off")) + "</span></button></div>";
    else syncBody = '<p class="muted">' + esc(t("sync.lead")) + '</p><div class="btn-row"><button type="button" class="btn btn-primary btn-sm press" data-sync-on>' + icon("refresh") + "<span>" + esc(t("sync.turnOn")) + '</span></button><button type="button" class="btn btn-ghost btn-sm press" data-sync-restore>' + icon("download") + "<span>" + esc(t("sync.restore")) + "</span></button></div>";
    var clubBody = '<p class="muted">' + esc(t("club.lead")) + "</p>" +
      (s.club ? '<p><strong>' + esc(t("club.yours", { code: s.club })) + '</strong></p><div id="club-totals" class="muted">' + esc(ready ? t("club.loading") : t("club.needsSync")) + '</div><button type="button" class="link-btn" data-club-leave>' + esc(t("club.leave")) + "</button>"
        : '<div class="field"><label for="club-input">' + esc(t("club.label")) + '</label><div class="btn-row"><input id="club-input" class="input" maxlength="12" autocomplete="off" spellcheck="false" style="flex:1;min-width:160px" placeholder="' + esc(t("club.placeholder")) + '"><button type="button" class="btn btn-ghost press" data-club-join>' + esc(t("club.join")) + "</button></div></div>" +
          '<p class="muted" style="font-size:.85rem">' + esc(ready ? t("club.privacy") : t("club.needsSync")) + "</p>");
    return '<div class="app-grid">' +
      '<div style="display:grid;gap:16px">' +
        '<section class="card app-card"><h2>' + esc(t("me.profile")) + '</h2><p class="muted">' + esc(t("me.profileLead")) + "</p>" +
          '<div class="nick-row" style="margin:10px 0 16px"><span class="nick">' + esc(nick()) + '</span><button type="button" class="btn btn-ghost btn-sm press" data-new-nick>' + icon("refresh") + "<span>" + esc(t("me.newNick")) + "</span></button></div>" +
          '<form class="field profile-name-form" data-name-form novalidate><label for="me-name">' + esc(t("start.nameLabel")) + ' <span class="muted">' + esc(t("start.nameOptional")) + "</span></label>" +
            '<div class="btn-row"><input id="me-name" class="input" maxlength="20" autocomplete="off" spellcheck="false" placeholder="' + esc(t("start.namePlaceholder")) + '" value="' + esc(Store.get().profile.name || "") + '" style="flex:1;min-width:160px" aria-describedby="me-name-hint">' +
            '<button type="submit" class="btn btn-ghost press">' + icon("check") + "<span>" + esc(t("me.saveName")) + "</span></button></div>" +
            '<p class="muted start-note" id="me-name-hint">' + esc(t("start.nameHint")) + "</p></form>" +
          avatarStudio() + "</section>" +
        '<section class="card app-card"><h2>' + esc(t("sync.title")) + "</h2>" + syncBody + "</section>" +
        '<section class="card app-card"><h2>' + esc(t("club.title")) + "</h2>" + clubBody + "</section>" +
      "</div>" +
      '<div style="display:grid;gap:16px">' +
        '<section class="card app-card"><h2>' + esc(t("data.title")) + '</h2><p class="muted">' + esc(t("data.lead")) + "</p>" +
          '<ul class="plain-list" style="margin-bottom:14px">' + ["data.keep1", "data.keep2", "data.keep3"].map(function (k) { return "<li>" + esc(t(k)) + "</li>"; }).join("") + "</ul>" +
          '<div class="btn-row"><button type="button" class="btn btn-ghost btn-sm press" data-export>' + icon("download") + "<span>" + esc(t("data.download")) + '</span></button><a class="btn btn-ghost btn-sm press" href="' + M.root() + 'privacy.html">' + icon("shield") + "<span>" + esc(t("nav.privacy")) + "</span></a></div></section>" +
        '<section class="card app-card danger-zone"><h2>' + esc(t("data.deleteTitle")) + '</h2><p class="muted">' + esc(t("data.deleteLead")) + "</p>" +
          '<button type="button" class="btn btn-danger press" data-delete-all>' + icon("trash") + "<span>" + esc(t("data.delete")) + "</span></button></section>" +
        '<section class="card app-card tip-card">' + M.poseImg("syno", "aha", "") + "<p>" + esc(t("me.settingsTip")) + "</p></section>" +
      "</div></div>";
  }

  // Avatar studio (2.5): character, expression and background, with a live
  // preview. Some backgrounds open at a level (a small reward, as in Finch).
  function avatarStudio() {
    var p = Store.get().profile, id = avatar(), mood = M.avatarMoods.indexOf(p.mood) > 0 ? p.mood : "face";
    var bg = M.avatarBgs[p.bg] && M.avatarBgOpen(p.bg) ? p.bg : "tint", lv = Store.level().level;
    function group(key, label, items) {
      return '<p class="studio-label" id="studio-' + key + '">' + esc(label) + "</p>" +
        '<div class="avatar-picker studio-' + key + '" role="radiogroup" aria-labelledby="studio-' + key + '">' + items.join("") + "</div>";
    }
    return '<div class="avatar-studio">' +
      '<div class="studio-preview">' + M.avatarPic({ avatar: id, mood: mood, bg: bg }, "studio-avatar") +
        "<p><strong>" + esc(M.characters[id].name) + "</strong><span>" + esc(t("me.mood." + mood)) + " · " + esc(t("me.bg." + bg)) + "</span></p></div>" +
      group("char", t("me.avatar"), M.characterOrder.map(function (c) {
        return '<button type="button" class="avatar-option is-mood press" role="radio" aria-checked="' + (id === c) + '" data-avatar="' + c + '"' + M.avatarStyle(c, bg) + ' aria-label="' + esc(M.characters[c].name) + '">' +
          '<img src="' + M.avatarSrc(c, mood) + '" width="64" height="64" alt="" loading="lazy" decoding="async"></button>';
      })) +
      group("mood", t("me.moodTitle"), M.avatarMoods.map(function (m) {
        return '<button type="button" class="avatar-option is-mood press" role="radio" aria-checked="' + (mood === m) + '" data-mood="' + m + '"' + M.avatarStyle(id, bg) + ' aria-label="' + esc(t("me.mood." + m)) + '" title="' + esc(t("me.mood." + m)) + '">' +
          '<img src="' + M.avatarSrc(id, m) + '" width="64" height="64" alt="" loading="lazy" decoding="async"></button>';
      })) +
      group("bg", t("me.bgTitle"), M.avatarBgOrder.map(function (b) {
        var open = M.avatarBgOpen(b), need = M.avatarBgs[b].level;
        var label = t("me.bg." + b) + (open ? "" : " · " + t("me.bgLocked", { n: need }));
        return '<button type="button" class="bg-option press' + (open ? "" : " is-locked") + '" role="radio" aria-checked="' + (bg === b) + '"' + (open ? "" : ' aria-disabled="true"') +
          ' data-bg="' + b + '"' + (M.avatarBgs[b].bg ? ' style="--avbg:' + M.avatarBgs[b].bg + '" data-avbg' : ' style="--tint:' + M.characters[id].tint + '"') + ' aria-label="' + esc(label) + '" title="' + esc(label) + '">' +
          (open ? "" : icon("lock") + '<span class="bg-lv">' + need + "</span>") + "</button>";
      })) +
      (lv < 5 ? '<p class="muted studio-note">' + esc(t("me.bgNote")) + "</p>" : "") +
    "</div>";
  }

  function nameSubmit(e) {
    var form = e.target.closest && e.target.closest("[data-name-form]");
    if (!form) return;
    e.preventDefault();
    var name = M.cleanName(form.querySelector("input").value);
    Store.setProfile({ name: name || null });
    draw();
    M.toast({ icon: "check", title: t(name ? "me.nameSaved" : "me.nameCleared"), ms: 2200 });
  }

  function wireMe() {
    view.addEventListener("click", meClick);
    view.addEventListener("submit", nameSubmit);
    var s = Store.get();
    if (s.club && B.ready()) {
      B.club(s.club).then(function (r) {
        var el = document.getElementById("club-totals");
        if (!el) return;
        var v = (r.ok && r.values) || {};
        el.textContent = r.ok ? t("club.totals", { facts: v.facts_read || 0, games: v.games_played || 0 }) : t("club.error");
      });
    }
  }

  function meClick(e) {
    var tgt = e.target;
    if (tgt.closest("[data-new-nick]")) { Store.setProfile({ nick: Store.randomNick() }); draw(); return; }
    var av = tgt.closest("[data-avatar]");
    if (av) { Store.setProfile({ avatar: av.getAttribute("data-avatar") }); S.tap(); draw(); view.querySelector('[data-avatar="' + av.getAttribute("data-avatar") + '"]').focus(); return; }
    var md = tgt.closest("[data-mood]");
    if (md) { Store.setProfile({ mood: md.getAttribute("data-mood") }); S.tap(); draw(); view.querySelector('[data-mood="' + md.getAttribute("data-mood") + '"]').focus(); return; }
    var bgb = tgt.closest("[data-bg]");
    if (bgb) {
      var key = bgb.getAttribute("data-bg");
      if (!M.avatarBgOpen(key)) { M.toast({ icon: "lock", title: t("me.bgLocked", { n: M.avatarBgs[key].level }), ms: 2200 }); return; }
      Store.setProfile({ bg: key }); S.tap(); draw(); view.querySelector('[data-bg="' + key + '"]').focus(); return;
    }
    if (tgt.closest("[data-export]")) {
      var blob = new Blob([Store.exportJSON()], { type: "application/json" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "medulla-my-data.json";
      document.body.appendChild(a); a.click(); a.remove();
      M.toast({ icon: "download", title: t("data.downloaded") });
      return;
    }
    if (tgt.closest("[data-delete-all]")) { confirmDelete(); return; }
    if (tgt.closest("[data-sync-on]")) { openConsent(); return; }
    if (tgt.closest("[data-sync-restore]")) { openRestore(); return; }
    if (tgt.closest("[data-sync-now]")) { syncNow(true); return; }
    if (tgt.closest("[data-sync-off]")) {
      if (!window.confirm(t("sync.offConfirm"))) return;
      var code = Store.get().sync.code;
      B.remove(code).then(function () {
        Store.setSync({ enabled: false, code: null, consent: null, lastSync: null });
        M.toast({ icon: "check", title: t("sync.offDone") }); draw();
      });
      return;
    }
    if (tgt.closest("[data-copy-code]")) {
      var c = Store.get().sync.code;
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(c).then(function () { M.toast({ icon: "copy", title: t("sync.copied") }); });
      return;
    }
    if (tgt.closest("[data-club-join]")) {
      var v = (document.getElementById("club-input").value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (v.length < 4) { M.toast({ icon: "info", title: t("club.invalid") }); return; }
      Store.setClub(v); draw(); return;
    }
    if (tgt.closest("[data-club-leave]")) { Store.setClub(null); draw(); return; }
  }

  /* --------------------------------------------------------------- sync */

  function syncNow(loud) {
    var s = Store.get();
    if (!s.sync.enabled || !s.sync.code || !B.ready()) return Promise.resolve();
    return B.push(s.sync.code, Store.syncPayload()).then(function (r) {
      if (r.ok) { Store.setSync({ lastSync: new Date().toISOString() }); if (loud) M.toast({ icon: "check", title: t("sync.done") }); }
      else if (loud) M.toast({ icon: "info", title: t("sync.failed") });
    });
  }

  function modal(id, html, onWire) {
    var d = document.getElementById(id);
    d.innerHTML = '<div class="modal-body">' + html + "</div>";
    var h = d.querySelector("h2");
    if (h) { h.id = id + "-title"; d.setAttribute("aria-labelledby", h.id); }
    M.renderIcons(d);
    if (onWire) onWire(d);
    d.showModal();
    return d;
  }

  function openConsent() {
    modal("consent",
      '<div class="modal-art">' + M.poseImg("syno", "hello", "", true) + "</div>" +
      "<h2>" + esc(t("consent.title")) + "</h2><p>" + esc(t("consent.lead")) + '</p><ul class="plain-list">' +
        ["consent.p1", "consent.p2", "consent.p3", "consent.p4"].map(function (k) { return "<li>" + esc(t(k)) + "</li>"; }).join("") + "</ul>" +
      '<fieldset class="choice-row" style="border:0;padding:0;margin:0"><legend style="font-weight:700;color:var(--ink);margin-bottom:6px">' + esc(t("consent.age")) + "</legend>" +
        '<label class="choice"><input type="radio" name="age" value="u18"><span><strong>' + esc(t("consent.under18")) + "</strong><span>" + esc(t("consent.under18Hint")) + "</span></span></label>" +
        '<label class="choice"><input type="radio" name="age" value="18"><span><strong>' + esc(t("consent.adult")) + "</strong></span></label></fieldset>" +
      '<div id="guardian" hidden><div class="callout-box"><span data-icon="users"></span><div><h3>' + esc(t("consent.guardianTitle")) + "</h3><p>" + esc(t("consent.guardianText")) + "</p></div></div>" +
        '<label class="choice" style="margin-top:10px"><input type="checkbox" id="guardian-ok"><span><strong>' + esc(t("consent.guardianCheck")) + "</strong><span>" + esc(t("consent.guardianNote")) + "</span></span></label></div>" +
      '<div class="btn-row"><button type="button" class="btn btn-primary press" id="consent-go" disabled>' + esc(t("consent.agree")) + '</button><button type="button" class="btn btn-ghost press" id="consent-cancel">' + esc(t("consent.cancel")) + "</button></div>",
      function (d) {
        var go = d.querySelector("#consent-go"), guard = d.querySelector("#guardian"), gok = d.querySelector("#guardian-ok");
        function update() {
          var age = (d.querySelector('input[name="age"]:checked') || {}).value;
          guard.hidden = age !== "u18";
          go.disabled = !age || (age === "u18" && !gok.checked);
        }
        d.addEventListener("change", update);
        d.querySelector("#consent-cancel").addEventListener("click", function () { d.close(); });
        go.addEventListener("click", function () {
          var age = d.querySelector('input[name="age"]:checked').value;
          var code = B.newCode();
          go.disabled = true;
          B.push(code, Store.syncPayload()).then(function (r) {
            if (!r.ok) { M.toast({ icon: "info", title: t("sync.failed") }); go.disabled = false; return; }
            Store.setSync({ enabled: true, code: code, lastSync: new Date().toISOString(), consent: { at: new Date().toISOString(), ageBand: age, guardian: age === "u18" } });
            d.close();
            showCode(code);
          });
        });
      });
  }

  function showCode(code) {
    modal("consent", '<div class="modal-art">' + M.poseImg("dendi", "focus", "", true) + "</div><h2>" + esc(t("sync.codeTitle")) + "</h2><p>" + esc(t("sync.codeLead")) + "</p>" +
      '<div class="code-box">' + esc(code) + '</div><p class="muted" style="font-size:.88rem">' + esc(t("sync.codeWarn")) + "</p>" +
      '<div class="btn-row"><button type="button" class="btn btn-primary press" id="code-done">' + esc(t("sync.codeDone")) + "</button></div>",
      function (d) { d.querySelector("#code-done").addEventListener("click", function () { d.close(); draw(); }); });
  }

  function openRestore() {
    modal("consent", "<h2>" + esc(t("sync.restoreTitle")) + "</h2><p>" + esc(t("sync.restoreLead")) + "</p>" +
      '<div class="field"><label for="restore-code">' + esc(t("sync.yourCode")) + '</label><input id="restore-code" class="input" autocomplete="off" spellcheck="false" placeholder="OCTA-XXXX-XXXX-XXXX"></div>' +
      '<p class="muted" id="restore-msg" role="status"></p><div class="btn-row"><button type="button" class="btn btn-primary press" id="restore-go">' + esc(t("sync.restore")) + '</button><button type="button" class="btn btn-ghost press" id="restore-cancel">' + esc(t("consent.cancel")) + "</button></div>",
      function (d) {
        d.querySelector("#restore-cancel").addEventListener("click", function () { d.close(); });
        d.querySelector("#restore-go").addEventListener("click", function () {
          var code = d.querySelector("#restore-code").value, msg = d.querySelector("#restore-msg");
          if (!B.validCode(code)) { msg.textContent = t("sync.badCode"); return; }
          code = B.formatCode(code);
          B.pull(code).then(function (r) {
            if (!r.ok) { msg.textContent = t(r.reason === "not-found" ? "sync.notFound" : "sync.failed"); return; }
            Store.merge(r.payload);
            Store.setSync({ enabled: true, code: code, lastSync: new Date().toISOString(), consent: { at: new Date().toISOString(), ageBand: "restored", guardian: null } });
            d.close(); M.toast({ icon: "check", title: t("sync.restored") }); draw();
          });
        });
      });
  }

  function confirmDelete() {
    modal("consent", '<div class="modal-art">' + M.poseImg("syno", "tryagain", "", true) + "</div><h2>" + esc(t("data.deleteTitle")) + "</h2><p>" + esc(t("data.deleteConfirm")) + "</p>" +
      '<div class="btn-row"><button type="button" class="btn btn-danger press" id="del-go">' + icon("trash") + "<span>" + esc(t("data.deleteYes")) + '</span></button><button type="button" class="btn btn-ghost press" id="del-cancel">' + esc(t("consent.cancel")) + "</button></div>",
      function (d) {
        d.querySelector("#del-cancel").addEventListener("click", function () { d.close(); });
        d.querySelector("#del-go").addEventListener("click", function () {
          // Deleting everything also signs out: back to the public site.
          var s = Store.get(), done = function () {
            Store.wipe();
            try { sessionStorage.setItem("medulla.toast", "deleted"); } catch (e) { /* ignore */ }
            location.replace(M.root() + "index.html");
          };
          if (s.sync && s.sync.enabled && s.sync.code && B.ready()) B.remove(s.sync.code).then(done, done); else done();
        });
      });
  }

  /* -------------------------------------------------------------- router */

  function currentRoute() {
    var r = location.hash.replace(/^#\/?/, "");
    return ROUTES.indexOf(r) !== -1 ? r : "";
  }

  function draw() {
    if (gameCtrl) { gameCtrl.destroy(); gameCtrl = null; }
    view.removeEventListener("click", meClick);
    view.removeEventListener("submit", nameSubmit);
    view.removeEventListener("click", mapClick);
    var r = currentRoute();
    if (r !== "daily") dailyStep = null;
    renderGreet();
    var html = r === "daily" ? viewDaily() : r === "badges" ? viewBadges() : r === "saved" ? viewSaved() : r === "history" ? viewHistory() : r === "me" ? skills() + viewMe() : viewMap();
    if (r === "me" || r === "badges" || r === "saved" || r === "history") html = meNav(r) + html;
    view.innerHTML = html;
    view.classList.remove("view-enter"); void view.offsetWidth; view.classList.add("view-enter");
    M.runRenderers(view);
    if (window.MedullaMotion) { window.MedullaMotion.initReveals(view); window.MedullaMotion.initTilt(view); }
    if (r === "daily") wireDaily();
    if (r === "me") wireMe();
    if (r === "") view.addEventListener("click", mapClick);
    if (r === "history") {
      var c = view.querySelector("[data-clear-results]");
      if (c) c.addEventListener("click", function () { if (window.confirm(t("lab.clearConfirm"))) { Store.clearResults(); draw(); } });
    }
    document.title = (r ? t(r === "me" ? "me.profile" : "explore.tab." + r) : t("map.title")) + " — Medulla";
  }

  var syncTimer = null;
  window.addEventListener("hashchange", function () { draw(); window.scrollTo({ top: 0, behavior: M.reducedMotion() ? "auto" : "smooth" }); });
  document.addEventListener("medulla:progress", function (e) {
    var type = (e.detail || {}).type;
    renderGreet();
    if (["profile", "merge", "wipe", "clear"].indexOf(type) !== -1) return;
    if (currentRoute() === "") refreshMap(true); // new numbers, same place
    // Progress events come in bursts (quiz answer + XP + badge); push once they settle.
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () { syncTimer = null; syncNow(false); }, 4000);
  });
  window.addEventListener("pagehide", function () { if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; syncNow(false); } });
  M.onLangChange(function () { if (currentRoute() !== "daily" || !gameCtrl) draw(); });

  M.loadFacts().then(function (f) {
    facts = f;
    draw();
  }).catch(function () {
    view.innerHTML = '<p class="muted">' + esc(t("learn.error")) + "</p>";
  });
});
