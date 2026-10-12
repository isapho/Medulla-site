/*
 * Explorer: the visitor's own space. Hash routes:
 *   #/ dashboard · #/daily challenge · #/badges · #/saved · #/history · #/me
 * Everything lives on this device (js/store.js). Optional sync goes through
 * js/backend.js and only after the consent screen.
 */
Medulla.ready(function () {
  "use strict";

  var M = window.Medulla, Store = window.MedullaStore, B = window.MedullaBackend, G = window.MedullaGames, S = window.MedullaSound;
  var t = M.t, esc = M.esc, icon = M.icon;
  var view = document.getElementById("view"), greet = document.getElementById("greet"), tabs = document.getElementById("app-tabs");
  var facts = [], gameCtrl = null;
  var ROUTES = ["", "daily", "badges", "saved", "history", "me"];

  /* -------------------------------------------------------------- helpers */

  function nick() {
    var n = Store.ensureProfile().nick;
    return t("nick.format", { adj: t("nick.adj." + n.a), noun: t("nick.noun." + n.n), num: n.num });
  }
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
    var c = M.characters[avatar()], lv = Store.level();
    greet.innerHTML = '<span class="greet-avatar" style="--tint:' + c.tint + '">' + M.charImg(avatar(), "idle idle-" + avatar(), "", true) + "</span>" +
      "<div><p class=\"eyebrow\" style=\"margin:0 0 4px\">" + icon("compass") + "<span>" + esc(t("explore.eyebrow")) + "</span></p>" +
      "<h1>" + esc(t("explore.hello", { name: nick() })) + "</h1><p>" + esc(t("explore.levelLine", { n: lv.level, xp: M.fmt(Store.get().xp) })) + "</p></div>";
  }

  function setTabs(route) {
    tabs.querySelectorAll("a").forEach(function (a) {
      var r = a.getAttribute("href").replace("#/", "");
      if (r === route) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }

  /* -------------------------------------------------------- neuron streak */

  function streakNeuron(n) {
    var branches = 7, lit = Math.min(n, branches), parts = "";
    for (var i = 0; i < branches; i++) {
      var a = (-90 + i * (360 / branches)) * Math.PI / 180;
      var x2 = 42 + Math.cos(a) * 36, y2 = 42 + Math.sin(a) * 36, xm = 42 + Math.cos(a + 0.3) * 20, ym = 42 + Math.sin(a + 0.3) * 20;
      parts += '<path class="sn-branch' + (i < lit ? " is-on" : "") + '" d="M42 42 Q' + xm.toFixed(1) + " " + ym.toFixed(1) + " " + x2.toFixed(1) + " " + y2.toFixed(1) + '"/>';
      if (i < lit) parts += '<circle cx="' + x2.toFixed(1) + '" cy="' + y2.toFixed(1) + '" r="3.4" fill="#FF9F43"/>';
    }
    return '<div class="streak-neuron' + (n > 0 ? " is-lit" : "") + '" aria-hidden="true"><svg viewBox="0 0 84 84">' + parts + '<circle class="sn-core" cx="42" cy="42" r="11"/></svg></div>';
  }

  /* ----------------------------------------------------------- dashboard */

  function viewDashboard() {
    var s = Store.get(), lv = Store.level(), wk = Store.weekSummary(), st = Store.streakNow(), d = dailyState();
    var dayNames = t("week.days").split(",");
    var week = wk.days.map(function (day, i) {
      var dt = new Date(day.key + "T12:00:00"), name = dayNames[(dt.getDay() + 6) % 7] || "";
      return '<div class="week-day"><span class="week-dot' + (day.active ? " is-on" : "") + (i === 6 ? " is-today" : "") + '">' + (day.active ? icon("check") : "") + "</span><span>" + esc(name) + "</span></div>";
    }).join("");
    var stepsMini = [["fact", d.fact], ["quiz", d.quiz.length >= 3], ["game", d.game]].map(function (p) {
      return '<span class="' + (p[1] ? "is-done" : "") + '">' + icon(p[1] ? "check" : "plus") + esc(t("daily.step." + p[0])) + "</span>";
    }).join("");
    var tasks = ["share", "thank", "breathe", "help", "listen"];
    var doneToday = (s.kindness[today()] || []);
    return '<div class="daily-cta" data-reveal>' +
        "<h2>" + esc(d.done ? t("daily.doneTitle") : t("daily.title")) + "</h2>" +
        "<p>" + esc(d.done ? t("daily.doneText") : t("daily.lead")) + "</p>" +
        '<div class="steps-mini">' + stepsMini + "</div>" +
        '<a class="btn btn-light press" href="#/daily">' + icon(d.done ? "refresh" : "play") + "<span>" + esc(t(d.done ? "daily.review" : "daily.start")) + "</span></a>" +
        M.charImg("dendi", "idle idle-dendi", "") +
      "</div>" +
      '<div class="app-grid" style="margin-top:16px">' +
        '<div style="display:grid;gap:16px">' +
          '<section class="card app-card" data-reveal><div class="level-row"><span class="level-badge"><span><small>' + esc(t("me.levelShort")) + "</small><strong>" + lv.level + "</strong></span></span>" +
            '<div class="xp-meter"><div class="card-head" style="margin:0 0 6px"><h2>' + esc(t("explore.growth")) + '</h2><strong style="color:var(--purple)">' + M.fmt(s.xp) + " XP</strong></div>" +
            '<div class="meter"><span style="width:' + lv.pct + '%"></span></div><p>' + esc(t("explore.toNext", { n: M.fmt(lv.span - lv.into), level: lv.level + 1 })) + "</p></div></div></section>" +
          '<section class="card app-card" data-reveal><div class="streak-box">' + streakNeuron(st) +
            '<div><p class="streak-num">' + esc(t("streak.days", { n: st })) + '</p><p class="muted" style="margin:4px 0 0">' + esc(t("streak.gentle")) + "</p></div></div>" +
            '<h3 style="margin:16px 0 0;font-size:1rem">' + esc(t("week.title", { n: wk.activeDays })) + '</h3><div class="week">' + week + "</div></section>" +
          '<section class="card app-card" data-reveal><div class="card-head"><h2>' + esc(t("week.summary")) + '</h2><a class="text-link" href="#/history">' + esc(t("explore.allResults")) + icon("arrow", "icon-sm") + "</a></div>" +
            '<ul class="summary-grid">' +
              "<li><strong>" + wk.facts + "</strong><span>" + esc(t("week.facts")) + "</span></li>" +
              "<li><strong>" + wk.quiz + "</strong><span>" + esc(t("week.quiz")) + "</span></li>" +
              "<li><strong>" + wk.games + "</strong><span>" + esc(t("week.games")) + "</span></li>" +
              "<li><strong>" + wk.breathMin + "</strong><span>" + esc(t("week.breath")) + "</span></li>" +
              "<li><strong>" + wk.sleep + "</strong><span>" + esc(t("week.sleep")) + "</span></li>" +
              "<li><strong>" + wk.kind + "</strong><span>" + esc(t("week.kind")) + "</span></li>" +
            "</ul></section>" +
        "</div>" +
        '<div style="display:grid;gap:16px">' +
          '<section class="card app-card" data-reveal><div class="card-head"><h2>' + esc(t("badges.title")) + '</h2><a class="text-link" href="#/badges">' + esc(t("badges.all", { n: Object.keys(s.badges).length, total: Store.badges.length })) + icon("arrow", "icon-sm") + "</a></div>" +
            '<ul class="mini-badges" data-render="badgesPreview" data-limit="6"></ul></section>' +
          '<section class="card app-card" data-reveal><div class="card-head"><h2>' + esc(t("kind.title")) + '</h2><span class="tile" style="width:40px;height:40px">' + icon("heart") + "</span></div>" +
            '<p class="muted">' + esc(t("kind.lead")) + '</p><ul class="kind-tasks">' + tasks.map(function (k) {
              var on = doneToday.indexOf(k) !== -1;
              return '<li><button type="button" class="kind-task press" data-kind="' + k + '" aria-pressed="' + on + '"><span class="kt-box">' + icon("check") + "</span><span>" + esc(t("kind.task." + k)) + "</span></button></li>";
            }).join("") + '</ul><p class="muted" style="font-size:.82rem;margin:10px 0 0">' + esc(t("kind.private")) + "</p></section>" +
          '<section class="card app-card" data-reveal><div class="card-head"><h2>' + esc(t("saved.title")) + '</h2><span class="tile is-orange" style="width:40px;height:40px">' + icon("bookmark") + "</span></div>" +
            '<p class="muted">' + esc(t("saved.count", { n: s.saved.length })) + '</p><a class="btn btn-ghost btn-sm press" href="#/saved">' + icon("book") + "<span>" + esc(t("saved.open")) + "</span></a></section>" +
        "</div>" +
      "</div>";
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
            "<h3>" + esc(M.localized(f.title)) + '</h3><span class="flip-hint">' + icon("refresh") + esc(t("daily.flip")) + "</span>" + M.charImg(who, "idle idle-" + who, "") + "</button>" +
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
          '<p class="field" style="margin:0 0 8px"><strong id="avatar-label">' + esc(t("me.avatar")) + "</strong></p>" +
          '<div class="avatar-picker" role="radiogroup" aria-labelledby="avatar-label">' + M.characterOrder.map(function (id) {
            return '<button type="button" class="avatar-option press" role="radio" aria-checked="' + (avatar() === id) + '" data-avatar="' + id + '" style="--tint:' + M.characters[id].tint + '" aria-label="' + esc(M.characters[id].name) + '">' + M.charImg(id, "", "") + "</button>";
          }).join("") + "</div></section>" +
        '<section class="card app-card"><h2>' + esc(t("sync.title")) + "</h2>" + syncBody + "</section>" +
        '<section class="card app-card"><h2>' + esc(t("club.title")) + "</h2>" + clubBody + "</section>" +
      "</div>" +
      '<div style="display:grid;gap:16px">' +
        '<section class="card app-card"><h2>' + esc(t("data.title")) + '</h2><p class="muted">' + esc(t("data.lead")) + "</p>" +
          '<ul class="plain-list" style="margin-bottom:14px">' + ["data.keep1", "data.keep2", "data.keep3"].map(function (k) { return "<li>" + esc(t(k)) + "</li>"; }).join("") + "</ul>" +
          '<div class="btn-row"><button type="button" class="btn btn-ghost btn-sm press" data-export>' + icon("download") + "<span>" + esc(t("data.download")) + '</span></button><a class="btn btn-ghost btn-sm press" href="' + M.root() + 'privacy.html">' + icon("shield") + "<span>" + esc(t("nav.privacy")) + "</span></a></div></section>" +
        '<section class="card app-card danger-zone"><h2>' + esc(t("data.deleteTitle")) + '</h2><p class="muted">' + esc(t("data.deleteLead")) + "</p>" +
          '<button type="button" class="btn btn-danger press" data-delete-all>' + icon("trash") + "<span>" + esc(t("data.delete")) + "</span></button></section>" +
        '<section class="card app-card tip-card">' + M.charImg("syno", "", "") + "<p>" + esc(t("me.settingsTip")) + "</p></section>" +
      "</div></div>";
  }

  function wireMe() {
    view.addEventListener("click", meClick);
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
      '<div class="modal-art">' + M.charImg("syno", "", "", true) + "</div>" +
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
    modal("consent", '<div class="modal-art">' + M.charImg("dendi", "", "", true) + "</div><h2>" + esc(t("sync.codeTitle")) + "</h2><p>" + esc(t("sync.codeLead")) + "</p>" +
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
    modal("consent", '<div class="modal-art">' + M.charImg("syno", "", "", true) + "</div><h2>" + esc(t("data.deleteTitle")) + "</h2><p>" + esc(t("data.deleteConfirm")) + "</p>" +
      '<div class="btn-row"><button type="button" class="btn btn-danger press" id="del-go">' + icon("trash") + "<span>" + esc(t("data.deleteYes")) + '</span></button><button type="button" class="btn btn-ghost press" id="del-cancel">' + esc(t("consent.cancel")) + "</button></div>",
      function (d) {
        d.querySelector("#del-cancel").addEventListener("click", function () { d.close(); });
        d.querySelector("#del-go").addEventListener("click", function () {
          var s = Store.get(), done = function () { Store.wipe(); d.close(); M.toast({ icon: "trash", title: t("data.deleted") }); location.hash = "#/"; draw(); onboard(); };
          if (s.sync && s.sync.enabled && s.sync.code && B.ready()) B.remove(s.sync.code).then(done, done); else done();
        });
      });
  }

  /* --------------------------------------------------------- onboarding */

  function onboard() {
    var p = Store.ensureProfile();
    if (p.onboarded) return;
    var chosen = p.avatar || "dendi";
    modal("onboard",
      '<div class="modal-art">' + M.poseImg("dendi", "hello", "idle idle-dendi", true) + "</div>" +
      "<h2>" + esc(t("onboard.title")) + "</h2><p>" + esc(t("onboard.lead")) + '</p><ul class="plain-list">' +
        ["onboard.p1", "onboard.p2", "onboard.p3"].map(function (k) { return "<li>" + esc(t(k)) + "</li>"; }).join("") + "</ul>" +
      '<p style="margin:0"><strong>' + esc(t("onboard.yourName")) + '</strong> <span class="nick" style="font-size:1.1rem" id="ob-nick">' + esc(nick()) + '</span> <button type="button" class="link-btn" id="ob-nick-btn">' + esc(t("me.newNick")) + "</button></p>" +
      '<p style="margin:0;font-weight:700;color:var(--ink)" id="ob-av-label">' + esc(t("me.avatar")) + "</p>" +
      '<div class="avatar-picker" role="radiogroup" aria-labelledby="ob-av-label">' + M.characterOrder.map(function (id) {
        return '<button type="button" class="avatar-option press" role="radio" aria-checked="' + (chosen === id) + '" data-ob-avatar="' + id + '" style="--tint:' + M.characters[id].tint + '" aria-label="' + esc(M.characters[id].name) + '">' + M.charImg(id, "", "", true) + "</button>";
      }).join("") + "</div>" +
      '<div class="btn-row"><button type="button" class="btn btn-primary press" id="ob-go">' + esc(t("onboard.guest")) + "</button>" +
        '<a class="text-link" href="' + M.root() + 'privacy.html">' + esc(t("onboard.privacy")) + "</a></div>" +
      '<p class="muted" style="font-size:.85rem;margin:0">' + esc(B.ready() ? t("onboard.syncLater") : t("onboard.noSync")) + "</p>",
      function (d) {
        d.addEventListener("click", function (e) {
          var a = e.target.closest("[data-ob-avatar]");
          if (a) {
            chosen = a.getAttribute("data-ob-avatar");
            d.querySelectorAll("[data-ob-avatar]").forEach(function (b) { b.setAttribute("aria-checked", String(b === a)); });
            S.tap();
          }
          if (e.target.closest("#ob-nick-btn")) { Store.setProfile({ nick: Store.randomNick() }); d.querySelector("#ob-nick").textContent = nick(); }
          if (e.target.closest("#ob-go")) { Store.setProfile({ avatar: chosen, onboarded: true }); d.close(); draw(); }
        });
        d.addEventListener("cancel", function () { Store.setProfile({ avatar: chosen, onboarded: true }); });
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
    view.removeEventListener("click", kindClick);
    var r = currentRoute();
    if (r !== "daily") dailyStep = null;
    setTabs(r);
    renderGreet();
    var html = r === "daily" ? viewDaily() : r === "badges" ? viewBadges() : r === "saved" ? viewSaved() : r === "history" ? viewHistory() : r === "me" ? viewMe() : viewDashboard();
    view.innerHTML = html;
    view.classList.remove("view-enter"); void view.offsetWidth; view.classList.add("view-enter");
    M.runRenderers(view);
    if (window.MedullaMotion) { window.MedullaMotion.initReveals(view); window.MedullaMotion.initTilt(view); }
    if (r === "daily") wireDaily();
    if (r === "me") wireMe();
    if (r === "") view.addEventListener("click", kindClick);
    if (r === "history") {
      var c = view.querySelector("[data-clear-results]");
      if (c) c.addEventListener("click", function () { if (window.confirm(t("lab.clearConfirm"))) { Store.clearResults(); draw(); } });
    }
    document.title = t("explore.tab." + (r || "home")) + " — Medulla";
  }

  function kindClick(e) {
    var b = e.target.closest("[data-kind]");
    if (!b || b.getAttribute("aria-pressed") === "true") return;
    var d = Store.record("kind", { task: b.getAttribute("data-kind") });
    if (d) { b.setAttribute("aria-pressed", "true"); S.correct(); }
  }

  var syncTimer = null;
  window.addEventListener("hashchange", function () { draw(); window.scrollTo({ top: 0, behavior: M.reducedMotion() ? "auto" : "smooth" }); });
  document.addEventListener("medulla:progress", function (e) {
    var type = (e.detail || {}).type;
    renderGreet();
    if (["profile", "merge", "wipe", "clear"].indexOf(type) !== -1) return;
    if (currentRoute() === "") {
      // refresh numbers on the dashboard without losing focus
      var focusKind = document.activeElement && document.activeElement.getAttribute("data-kind");
      draw();
      if (focusKind) { var b = view.querySelector('[data-kind="' + focusKind + '"]'); if (b) b.focus(); }
    }
    // Progress events come in bursts (quiz answer + XP + badge); push once they settle.
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () { syncTimer = null; syncNow(false); }, 4000);
  });
  window.addEventListener("pagehide", function () { if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; syncNow(false); } });
  M.onLangChange(function () { if (currentRoute() !== "daily" || !gameCtrl) draw(); });

  M.loadFacts().then(function (f) {
    facts = f;
    draw();
    onboard();
  }).catch(function () {
    view.innerHTML = '<p class="muted">' + esc(t("learn.error")) + "</p>";
  });
});
