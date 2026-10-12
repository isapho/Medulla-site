/*
 * Medulla progress store. Everything a visitor does is kept ON THIS DEVICE
 * (localStorage key "medulla.state"). Nothing is sent anywhere unless the
 * visitor turns on sync (see js/backend.js), and even then only these numbers.
 *
 * Design rules (see RESEARCH.md §1):
 *  - Gentle streak: one missed day is an automatic rest day; no punishment.
 *  - No leaderboards, no random rewards, no countdown pressure.
 *  - No free text and nothing that identifies a person.
 *
 * Events: dispatches "medulla:progress" on document with
 *   detail = { type, xp, badges: [ids], levelUp: bool, streak: number }.
 */
(function () {
  "use strict";

  var KEY = "medulla.state";
  var VERSION = 1;
  var memory = null; // fallback when localStorage is blocked

  /* -------------------------------------------------------------- dates */

  function dayKey(d) {
    d = d || new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }
  function daysBetween(a, b) { // a, b = "YYYY-MM-DD"
    var pa = a.split("-"), pb = b.split("-");
    var da = Date.UTC(+pa[0], +pa[1] - 1, +pa[2]), db = Date.UTC(+pb[0], +pb[1] - 1, +pb[2]);
    return Math.round((db - da) / 86400000);
  }
  function addDays(key, n) {
    var p = key.split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2] + n);
    return dayKey(d);
  }

  /* ------------------------------------------------------------ storage */

  function fresh() {
    return {
      v: VERSION,
      created: new Date().toISOString(),
      profile: { nick: null, avatar: "dendi", onboarded: false },
      xp: 0,
      streak: { current: 0, best: 0, last: null },
      days: {},          // "YYYY-MM-DD": { facts, games, quiz, breath, sleep, kind, xp }
      factsRead: [],     // unique fact ids
      saved: [],         // saved fact ids
      quiz: { answered: 0, correct: 0 },
      daily: {},         // "YYYY-MM-DD": { fact, quiz: [bool], game, done }
      results: [],       // last 60 game results
      badges: {},        // id: ISO date unlocked
      kindness: {},      // "YYYY-MM-DD": [task ids]
      visited: [],       // page ids, for the explorer badge
      sleepDays: [],     // days with a wind-down session
      club: null,        // optional school-club code
      sync: { enabled: false, consent: null, lastSync: null }
    };
  }

  function load() {
    var raw = null;
    try { raw = window.localStorage.getItem(KEY); } catch (e) { raw = null; }
    if (!raw) {
      var s = memory || fresh();
      migrateLegacy(s);
      return s;
    }
    try {
      var parsed = JSON.parse(raw);
      var base = fresh();
      Object.keys(base).forEach(function (k) { if (parsed[k] === undefined) parsed[k] = base[k]; });
      return parsed;
    } catch (e) { return fresh(); }
  }

  var available = (function () {
    try { window.localStorage.setItem("medulla.t", "1"); window.localStorage.removeItem("medulla.t"); return true; }
    catch (e) { return false; }
  })();

  function save(s) {
    trimOld(s);
    if (!available) { memory = s; return; }
    try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { memory = s; }
  }

  // Older demo versions kept Lab results under "medulla.labHistory".
  function migrateLegacy(s) {
    try {
      var old = JSON.parse(window.localStorage.getItem("medulla.labHistory") || "null");
      if (Array.isArray(old) && old.length) {
        s.results = old.map(function (e) { return Object.assign({}, e); });
        window.localStorage.removeItem("medulla.labHistory");
      }
    } catch (e) { /* ignore */ }
  }

  // Keep the file small: 90 days of daily stats, 60 results.
  function trimOld(s) {
    var cutoff = addDays(dayKey(), -90);
    ["days", "daily", "kindness"].forEach(function (k) {
      Object.keys(s[k] || {}).forEach(function (d) { if (d < cutoff) delete s[k][d]; });
    });
    if (s.results.length > 60) s.results = s.results.slice(-60);
    if (s.sleepDays.length > 90) s.sleepDays = s.sleepDays.slice(-90);
  }

  var state = load();

  /* ----------------------------------------------------- xp and levels */

  var XP = { fact: 5, quizRight: 10, quizTry: 3, game: 10, daily: 25, breath: 10, sleep: 10, kind: 10, visit: 2 };

  // Level n needs 25·n·(n+1) XP in total: 50, 150, 300, 500, 750 …
  function levelFor(xp) {
    var n = 1;
    while (xp >= 25 * n * (n + 1)) n++;
    var start = 25 * (n - 1) * n, end = 25 * n * (n + 1);
    return { level: n, into: xp - start, span: end - start, pct: Math.round(((xp - start) / (end - start)) * 100) };
  }

  /* ------------------------------------------------------------ badges */

  var TOTAL_FACTS = 0; // set by setTotalFacts() once facts are loaded
  var GAME_IDS = ["stroop", "reaction", "digits", "sequence"];

  function gamesPlayed(s) { return s.results.filter(function (r) { return GAME_IDS.indexOf(r.type) !== -1; }); }
  function countOf(s, type) { return s.results.filter(function (r) { return r.type === type; }).length; }
  function kindTotal(s) { return Object.keys(s.kindness).reduce(function (n, d) { return n + s.kindness[d].length; }, 0); }

  // Character-themed badges. `test` gets the state and returns true when earned.
  var BADGES = [
    { id: "memo-first", char: "memo", test: function (s) { return s.factsRead.length >= 1; } },
    { id: "memo-reader", char: "memo", test: function (s) { return s.factsRead.length >= 10; } },
    { id: "memo-all", char: "memo", test: function (s) { return TOTAL_FACTS > 0 && s.factsRead.length >= TOTAL_FACTS; } },
    { id: "memo-saver", char: "memo", test: function (s) { return s.saved.length >= 5; } },
    { id: "memo-quiz", char: "memo", test: function (s) { return s.quiz.correct >= 5; } },
    { id: "octa-first", char: "octa", test: function (s) { return gamesPlayed(s).length >= 1; } },
    { id: "octa-all", char: "octa", test: function (s) { return GAME_IDS.every(function (g) { return countOf(s, g) > 0; }); } },
    { id: "octa-ten", char: "octa", test: function (s) { return gamesPlayed(s).length >= 10; } },
    { id: "syno-breath", char: "syno", test: function (s) { return countOf(s, "breathing") >= 1; } },
    { id: "syno-kind", char: "syno", test: function (s) { return kindTotal(s) >= 1; } },
    { id: "syno-kind5", char: "syno", test: function (s) { return kindTotal(s) >= 5; } },
    { id: "lumi-wind", char: "lumi", test: function (s) { return s.sleepDays.length >= 1; } },
    { id: "lumi-three", char: "lumi", test: function (s) { return s.sleepDays.length >= 3; } },
    { id: "dendi-daily", char: "dendi", test: function (s) { return Object.keys(s.daily).some(function (d) { return s.daily[d].done; }); } },
    { id: "dendi-explorer", char: "dendi", test: function (s) { return s.visited.length >= 6; } },
    { id: "dendi-streak3", char: "dendi", test: function (s) { return s.streak.best >= 3; } },
    { id: "dendi-streak7", char: "dendi", test: function (s) { return s.streak.best >= 7; } }
  ];

  function checkBadges(s) {
    var earned = [];
    BADGES.forEach(function (b) {
      if (!s.badges[b.id] && b.test(s)) {
        s.badges[b.id] = new Date().toISOString();
        earned.push(b.id);
      }
    });
    return earned;
  }

  /* ------------------------------------------------------------ streak */

  // Gentle streak: active today/yesterday continues; one missed day is a free
  // rest day; two or more missed days start a new streak (best is kept).
  function touchStreak(s) {
    var today = dayKey();
    var st = s.streak;
    if (st.last === today) return false;
    var gap = st.last ? daysBetween(st.last, today) : null;
    if (gap === 1 || gap === 2) st.current += 1;
    else st.current = 1;
    st.last = today;
    if (st.current > st.best) st.best = st.current;
    return true;
  }

  /* ------------------------------------------------------------ record */

  function dayStats(s) {
    var k = dayKey();
    if (!s.days[k]) s.days[k] = { facts: 0, games: 0, quiz: 0, breath: 0, sleep: 0, kind: 0, xp: 0 };
    return s.days[k];
  }

  function emit(detail) {
    try { document.dispatchEvent(new CustomEvent("medulla:progress", { detail: detail })); } catch (e) { /* old browsers */ }
  }

  /**
   * Record an activity. type: "fact" | "quiz" | "game" | "breathing" | "sleep" |
   * "kind" | "daily" | "visit". Returns the progress detail.
   */
  function record(type, data) {
    data = data || {};
    var s = state;
    var before = levelFor(s.xp).level;
    var d = dayStats(s);
    var gained = 0;

    switch (type) {
      case "fact":
        if (data.id && s.factsRead.indexOf(data.id) === -1) { s.factsRead.push(data.id); gained = XP.fact; }
        d.facts += 1;
        break;
      case "quiz":
        s.quiz.answered += 1;
        if (data.correct) s.quiz.correct += 1;
        d.quiz += 1;
        gained = data.correct ? XP.quizRight : XP.quizTry;
        break;
      case "game":
        s.results.push(Object.assign({ at: new Date().toISOString() }, data.result || {}));
        d.games += 1;
        gained = XP.game;
        break;
      case "breathing":
        s.results.push({ type: "breathing", at: new Date().toISOString(), seconds: data.seconds || 0 });
        d.breath += Math.round((data.seconds || 0) / 60);
        gained = XP.breath;
        break;
      case "sleep":
        if (s.sleepDays.indexOf(dayKey()) === -1) s.sleepDays.push(dayKey());
        d.sleep += 1;
        gained = XP.sleep;
        break;
      case "kind":
        var list = s.kindness[dayKey()] || (s.kindness[dayKey()] = []);
        if (list.indexOf(data.task) !== -1) return null; // once per task per day
        list.push(data.task);
        d.kind += 1;
        gained = XP.kind;
        break;
      case "daily":
        var dk = dayKey();
        var dd = s.daily[dk] || (s.daily[dk] = { fact: false, quiz: [], game: false, done: false });
        if (data.part === "fact") dd.fact = true;
        if (data.part === "quiz") dd.quiz = data.answers || dd.quiz;
        if (data.part === "game") dd.game = true;
        if (!dd.done && dd.fact && dd.quiz.length >= 3 && dd.game) { dd.done = true; gained = XP.daily; }
        break;
      case "visit":
        if (data.page && s.visited.indexOf(data.page) === -1) { s.visited.push(data.page); gained = XP.visit; }
        else { save(s); return null; } // repeat visits don't count as activity
        break;
    }

    var streakMoved = type !== "visit" ? touchStreak(s) : false;
    s.xp += gained;
    d.xp += gained;
    var badges = checkBadges(s);
    save(s);

    var detail = { type: type, xp: gained, badges: badges, levelUp: levelFor(s.xp).level > before, streak: streakMoved ? s.streak.current : 0 };
    emit(detail);
    return detail;
  }

  /* ----------------------------------------------------------- queries */

  function weekSummary() {
    var s = state, today = dayKey();
    var out = { activeDays: 0, facts: 0, games: 0, quiz: 0, breathMin: 0, sleep: 0, kind: 0, xp: 0, days: [] };
    for (var i = 6; i >= 0; i--) {
      var k = addDays(today, -i), d = s.days[k];
      out.days.push({ key: k, active: !!(d && (d.facts || d.games || d.quiz || d.breath || d.sleep || d.kind)), xp: d ? d.xp : 0 });
      if (!d) continue;
      if (d.facts || d.games || d.quiz || d.breath || d.sleep || d.kind) out.activeDays += 1;
      out.facts += d.facts; out.games += d.games; out.quiz += d.quiz;
      out.breathMin += d.breath; out.sleep += d.sleep; out.kind += d.kind; out.xp += d.xp;
    }
    return out;
  }

  function lastResult(type) {
    var r = state.results.filter(function (x) { return x.type === type; });
    return r[r.length - 1] || null;
  }

  function bestReaction() {
    var b = state.results.filter(function (x) { return x.type === "reaction" && x.best; }).map(function (x) { return x.best; });
    return b.length ? Math.min.apply(null, b) : null;
  }

  // Current streak as shown today (0 if it has lapsed, without changing data).
  function streakNow() {
    var st = state.streak;
    if (!st.last) return 0;
    var gap = daysBetween(st.last, dayKey());
    return gap <= 2 ? st.current : 0;
  }

  /* ------------------------------------------------------------ profile */

  // Nicknames are stored as word indexes so they read naturally in every
  // language; words live in the language files (nick.adj.N / nick.noun.N).
  var NICK_ADJ = 12, NICK_NOUN = 10;

  function randomNick() {
    var r = new Uint32Array(3);
    (window.crypto || window.msCrypto).getRandomValues(r);
    return { a: r[0] % NICK_ADJ, n: r[1] % NICK_NOUN, num: 10 + (r[2] % 90) };
  }

  function ensureProfile() {
    if (!state.profile.nick) { state.profile.nick = randomNick(); save(state); }
    return state.profile;
  }

  /* --------------------------------------------------------- public API */

  window.MedullaStore = {
    available: function () { return available; },
    get: function () { return state; },
    dayKey: dayKey,
    addDays: addDays,
    record: record,
    level: function () { return levelFor(state.xp); },
    levelFor: levelFor,
    weekSummary: weekSummary,
    lastResult: lastResult,
    bestReaction: bestReaction,
    streakNow: streakNow,
    badges: BADGES,
    setTotalFacts: function (n) {
      TOTAL_FACTS = n;
      var earned = checkBadges(state);
      if (earned.length) { save(state); emit({ type: "check", xp: 0, badges: earned, levelUp: false, streak: 0 }); }
    },
    isSaved: function (id) { return state.saved.indexOf(id) !== -1; },
    toggleSave: function (id) {
      var i = state.saved.indexOf(id);
      if (i === -1) state.saved.push(id); else state.saved.splice(i, 1);
      var earned = checkBadges(state);
      save(state);
      emit({ type: "save", xp: 0, badges: earned, levelUp: false, streak: 0 });
      return i === -1;
    },
    ensureProfile: ensureProfile,
    randomNick: randomNick,
    setProfile: function (patch) { Object.assign(ensureProfile(), patch); save(state); emit({ type: "profile", xp: 0, badges: [], levelUp: false, streak: 0 }); },
    setClub: function (code) { state.club = code || null; save(state); },
    setSync: function (patch) { Object.assign(state.sync, patch); save(state); },
    clearResults: function () { state.results = []; save(state); emit({ type: "clear", xp: 0, badges: [], levelUp: false, streak: 0 }); },
    // Everything we keep, as a downloadable JSON file.
    exportJSON: function () {
      return JSON.stringify({ exportedAt: new Date().toISOString(), app: "Medulla", note: "All data Medulla keeps on this device.", state: state }, null, 2);
    },
    // Replace local state (used when restoring from sync). Keeps the larger of each counter.
    merge: function (remote) {
      if (!remote || typeof remote !== "object") return;
      var s = state;
      s.xp = Math.max(s.xp, remote.xp || 0);
      ["factsRead", "saved", "visited", "sleepDays"].forEach(function (k) {
        (remote[k] || []).forEach(function (v) { if (s[k].indexOf(v) === -1) s[k].push(v); });
      });
      Object.keys(remote.badges || {}).forEach(function (b) { if (!s.badges[b]) s.badges[b] = remote.badges[b]; });
      ["days", "daily", "kindness"].forEach(function (k) {
        Object.keys(remote[k] || {}).forEach(function (d) { if (!s[k][d]) s[k][d] = remote[k][d]; });
      });
      var seen = {};
      s.results = s.results.concat(remote.results || []).filter(function (r) {
        var key = r.type + r.at; if (seen[key]) return false; seen[key] = 1; return true;
      }).sort(function (a, b) { return a.at < b.at ? -1 : 1; });
      s.quiz.answered = Math.max(s.quiz.answered, (remote.quiz || {}).answered || 0);
      s.quiz.correct = Math.max(s.quiz.correct, (remote.quiz || {}).correct || 0);
      if ((remote.streak || {}).best > s.streak.best) s.streak = remote.streak;
      if (remote.profile && remote.profile.nick) s.profile = remote.profile;
      save(s);
      emit({ type: "merge", xp: 0, badges: [], levelUp: false, streak: 0 });
    },
    // What sync uploads: progress only. No free text exists anywhere in it.
    syncPayload: function () {
      var s = state;
      return { v: s.v, profile: s.profile, xp: s.xp, streak: s.streak, days: s.days, factsRead: s.factsRead, saved: s.saved,
        quiz: s.quiz, daily: s.daily, results: s.results, badges: s.badges, kindness: s.kindness, visited: s.visited, sleepDays: s.sleepDays };
    },
    // Delete everything on this device.
    wipe: function () {
      state = fresh();
      memory = null;
      try { window.localStorage.removeItem(KEY); window.localStorage.removeItem("medulla.labHistory"); } catch (e) { /* ignore */ }
      emit({ type: "wipe", xp: 0, badges: [], levelUp: false, streak: 0 });
    }
  };
})();
