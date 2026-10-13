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
      // signedIn: the visitor has "entered" Mening Medullam on this device
      // (start.html). There is no account: signing out only hides the app until
      // they come back; their progress stays here until they delete it.
      // mood / bg: the avatar's expression and background ("Men", 2.5); null = classic
      profile: { nick: null, avatar: "dendi", mood: null, bg: null, onboarded: false, signedIn: false },
      xp: 0,
      streak: { current: 0, best: 0, last: null },
      // "YYYY-MM-DD": { facts, games, quiz, breath, breaths, sleep, kind, xp } plus the
      // check-in, only when given: sleepH (last night, hours), screens (true =
      // no screens the hour before bed), move (active minutes), mood (1 low … 5 great)
      days: {},
      areas: {},         // brain map: { sleep: { days, last }, … } days each area lit up
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
      // before 2.3 finishing onboarding was the same as being signed in
      if (parsed.profile && parsed.profile.signedIn === undefined) parsed.profile.signedIn = !!parsed.profile.onboarded;
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

  var XP = { fact: 5, quizRight: 10, quizTry: 3, game: 10, daily: 25, breath: 10, sleep: 10, kind: 10, visit: 2, checkin: 5, network: 15 };

  /* ---------------------------------------------------------- brain map */

  // Five areas, one habit and one character each. An area lights up for the
  // day when any one of its actions is done; logging honestly counts (noticing
  // is the first step), except movement, which needs some movement.
  var AREAS = [
    { char: "memo", id: "learn", lit: function (d) { return d.facts > 0 || d.quiz > 0; } },
    { char: "octa", id: "move", lit: function (d) { return (d.move || 0) >= 15; } },
    { char: "dendi", id: "explore", lit: function (d, daily) { return d.games > 0 || !!(daily && daily.done); } },
    { char: "syno", id: "calm", lit: function (d) { return d.mood !== undefined || d.breath > 0 || (d.breaths || 0) > 0 || d.kind > 0; } },
    { char: "lumi", id: "sleep", lit: function (d) { return d.sleepH !== undefined || d.screens === true || d.sleep > 0; } }
  ];
  var CHECKIN = { sleepH: [6, 7, 8, 9, 10], screens: [true, false], move: [0, 15, 30, 45, 60], mood: [1, 2, 3, 4, 5] };

  function litOn(s, key) {
    var d = s.days[key];
    if (!d) return [];
    return AREAS.filter(function (a) { return a.lit(d, s.daily[key]); }).map(function (a) { return a.id; });
  }
  // Area level from the number of days it lit up: 1, 3, 6, 10, 15 … days.
  function areaLevel(days) { return Math.floor((Math.sqrt(8 * days + 1) - 1) / 2) + 1; }
  function areaInfo(s) {
    var out = {};
    AREAS.forEach(function (a) {
      var n = (s.areas[a.id] || {}).days || 0, lv = areaLevel(n);
      out[a.id] = { days: n, level: lv, from: (lv - 1) * lv / 2, to: lv * (lv + 1) / 2 };
    });
    return out;
  }
  // Count today's lit areas into the totals (once per area per day).
  function touchAreas(s, key) {
    var lit = litOn(s, key);
    lit.forEach(function (id) {
      var a = s.areas[id] || (s.areas[id] = { days: 0, last: null });
      if (a.last !== key) { a.days += 1; a.last = key; }
    });
    return lit;
  }
  // States from before 2.4: rebuild the totals from the days kept on the device.
  function migrateAreas(s) {
    if (!s.areas || typeof s.areas !== "object") s.areas = {};
    if (Object.keys(s.areas).length) return;
    Object.keys(s.days || {}).sort().forEach(function (k) { touchAreas(s, k); });
  }
  migrateAreas(state);

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
    { id: "dendi-streak7", char: "dendi", test: function (s) { return s.streak.best >= 7; } },
    // brain map (2.4)
    { id: "lumi-log7", char: "lumi", test: function (s) { return ((s.areas || {}).sleep || {}).days >= 7; } },
    { id: "octa-move5", char: "octa", test: function (s) { return ((s.areas || {}).move || {}).days >= 5; } },
    { id: "syno-mood5", char: "syno", test: function (s) { return Object.keys(s.days).filter(function (k) { return s.days[k].mood !== undefined; }).length >= 5; } },
    { id: "dendi-network", char: "dendi", test: function (s) { return Object.keys(s.days).some(function (k) { return s.days[k].network; }); } }
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
   * "kind" | "daily" | "visit" | "checkin" ({ field, value }). Returns the progress detail.
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
        d.breaths = (d.breaths || 0) + 1;
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
      case "checkin":
        // Self-reported, private, can be changed during the day (XP only the first time).
        if (!CHECKIN[data.field] || CHECKIN[data.field].indexOf(data.value) === -1) return null;
        if (d[data.field] === undefined) gained = XP.checkin;
        d[data.field] = data.value;
        break;
      case "visit":
        if (data.page && s.visited.indexOf(data.page) === -1) { s.visited.push(data.page); gained = XP.visit; }
        else { save(s); return null; } // repeat visits don't count as activity
        break;
    }

    var streakMoved = type !== "visit" ? touchStreak(s) : false;
    // All five areas in one day: the whole network lights up, once a day.
    var network = false;
    if (touchAreas(s, dayKey()).length === AREAS.length && !d.network) { d.network = true; network = true; gained += XP.network; }
    s.xp += gained;
    d.xp += gained;
    var badges = checkBadges(s);
    save(s);

    var detail = { type: type, xp: gained, badges: badges, levelUp: levelFor(s.xp).level > before, streak: streakMoved ? s.streak.current : 0, network: network };
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

  // Last 7 days, oldest first: { key, lit: [area ids] }.
  function weekAreas() {
    var out = [], today = dayKey();
    for (var i = 6; i >= 0; i--) { var k = addDays(today, -i); out.push({ key: k, lit: litOn(state, k) }); }
    return out;
  }

  // "My experiment": Reaction test averages on days after 8+ hours of sleep
  // against days after less. Only the visitor's own logs; no conclusions drawn.
  function sleepExperiment() {
    var g = { enough: [], less: [] };
    state.results.forEach(function (r) {
      if (r.type !== "reaction" || !r.avg || !r.at) return;
      var d = state.days[dayKey(new Date(r.at))];
      if (!d || d.sleepH === undefined) return;
      g[d.sleepH >= 8 ? "enough" : "less"].push(r.avg);
    });
    function sum(list) { return list.length ? { n: list.length, avg: Math.round(list.reduce(function (a, b) { return a + b; }, 0) / list.length) } : { n: 0, avg: null }; }
    return { enough: sum(g.enough), less: sum(g.less) };
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
    areas: AREAS.map(function (a) { return { id: a.id, char: a.char }; }),
    checkinOptions: CHECKIN,
    litToday: function () { return litOn(state, dayKey()); },
    areaInfo: function () { return areaInfo(state); },
    today: function () { return state.days[dayKey()] || {}; },
    weekAreas: weekAreas,
    sleepExperiment: sleepExperiment,
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
    // Signed in = the app interface is shown (see js/prefs.js for the redirects).
    isSignedIn: function () { return !!state.profile.signedIn; },
    // A profile someone used on this device before ("Continue as …" on start.html).
    hasProfile: function () { return !!state.profile.onboarded; },
    signIn: function (patch) {
      Object.assign(ensureProfile(), patch || {}, { onboarded: true, signedIn: true });
      save(state);
      emit({ type: "profile", xp: 0, badges: [], levelUp: false, streak: 0 });
    },
    signOut: function () {
      state.profile.signedIn = false;
      save(state);
      emit({ type: "profile", xp: 0, badges: [], levelUp: false, streak: 0 });
    },
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
      if (remote.profile && remote.profile.nick) { var inNow = s.profile.signedIn; s.profile = remote.profile; s.profile.signedIn = inNow; }
      Object.keys(remote.areas || {}).forEach(function (id) {
        var r = remote.areas[id] || {}, l = s.areas[id] || (s.areas[id] = { days: 0, last: null });
        if ((r.days || 0) > l.days) { l.days = r.days; l.last = r.last || l.last; }
      });
      save(s);
      emit({ type: "merge", xp: 0, badges: [], levelUp: false, streak: 0 });
    },
    // What sync uploads: progress only. No free text exists anywhere in it.
    syncPayload: function () {
      var s = state;
      return { v: s.v, profile: s.profile, xp: s.xp, streak: s.streak, days: s.days, factsRead: s.factsRead, saved: s.saved,
        quiz: s.quiz, daily: s.daily, results: s.results, badges: s.badges, kindness: s.kindness, visited: s.visited, sleepDays: s.sleepDays, areas: s.areas };
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
