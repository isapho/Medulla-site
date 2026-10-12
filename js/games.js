/*
 * Medulla activities (Practical pillar). One module, reused by the Lab page
 * and the daily challenge:
 *
 *   MedullaGames.mount(id, container, { heading: "h2", onDone: fn }) → { destroy }
 *
 * Every activity ends with an honest result card: what it measures and what
 * it does NOT show (never IQ, never diagnosis). Results are saved on this
 * device through MedullaStore.
 */
(function () {
  "use strict";

  var M = window.Medulla, S = window.MedullaSound, Store = window.MedullaStore;
  var t = function (k, v) { return M.t(k, v); };
  var esc = function (s) { return M.esc(s); };

  var LIST = [
    { id: "stroop", char: "octa", icon: "swatch", kind: "test", minutes: 1 },
    { id: "reaction", char: "octa", icon: "bolt", kind: "test", minutes: 1 },
    { id: "digits", char: "octa", icon: "hash", kind: "test", minutes: 2 },
    { id: "sequence", char: "octa", icon: "grid", kind: "test", minutes: 2 },
    { id: "breathing", char: "syno", icon: "wind", kind: "exercise", minutes: 3 },
    { id: "sleep", char: "lumi", icon: "moon", kind: "exercise", minutes: 3 }
  ];

  function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  function signedMs(v) { return v === null || v === undefined ? "—" : (v >= 0 ? "+" : "−") + M.msText(Math.abs(v)); }
  function pct(v) { return M.fmt(v, v % 1 ? 1 : 0) + "%"; }
  function sleep(ms, signal) {
    return new Promise(function (res, rej) {
      var id = setTimeout(res, ms);
      if (signal) signal.addEventListener("abort", function () { clearTimeout(id); rej(new Error("aborted")); });
    });
  }

  /* --------------------------------------------------- shared building */

  function head(g, h) {
    return '<div class="experiment-head">' +
      '<span class="tile' + (g.char === "syno" ? "" : g.char === "lumi" ? " is-night" : " is-orange") + '">' + M.icon(g.icon) + "</span>" +
      "<" + h + ">" + esc(t("game." + g.id + ".title")) + "</" + h + ">" +
      '<span class="chip">' + esc(t(g.kind === "test" ? "game.kind.test" : "game.kind.exercise")) + "</span></div>" +
      '<p class="game-how">' + esc(t("game." + g.id + ".how")) + "</p>";
  }

  function statItem(value, label) { return "<li><strong>" + esc(value) + "</strong><span>" + esc(label) + "</span></li>"; }

  // The game's host character cheers next to the result (the sleep wind-down is calmer: Lumi hovers).
  function poseFor(id) {
    var g = LIST.filter(function (x) { return x.id === id; })[0];
    return g ? '<span class="result-pose">' + M.poseImg(g.char, "win", "pose", true) + "</span>" : "";
  }

  function resultCard(el, id, stats, extra) {
    el.innerHTML =
      poseFor(id) + "<h3>" + M.icon("check") + esc(t("lab.yourResult")) + "</h3>" +
      (stats.length ? '<ul class="result-stats">' + stats.map(function (s) { return statItem(s[0], s[1]); }).join("") + "</ul>" : "") +
      (extra || "") +
      '<div class="result-explain">' +
        "<div>" + M.icon("target") + "<p><strong>" + esc(t("lab.whatTitle")) + "</strong>" + esc(t("game." + id + ".what")) + "</p></div>" +
        "<div>" + M.icon("info") + "<p><strong>" + esc(t("lab.limitsTitle")) + "</strong>" + esc(t("game." + id + ".limits")) + "</p></div>" +
      "</div>";
    el.hidden = false;
    el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "nearest", behavior: M.reducedMotion() ? "auto" : "smooth" });
  }

  function finish(id, result, opts) {
    var detail = Store.record(id === "breathing" ? "breathing" : id === "sleep" ? "sleep" : "game",
      id === "breathing" ? { seconds: result.seconds } : { result: result });
    if (window.MedullaBackend) {
      var club = (Store.get().club || null);
      window.MedullaBackend.bump(id === "breathing" ? "breathing_sessions" : "games_played", club);
    }
    if (opts && opts.onDone) opts.onDone(result, detail);
  }

  /* ============================================================ STROOP */

  var COLORS = [
    { id: "red", hex: "#FF6B6B" }, { id: "blue", hex: "#4DA3FF" },
    { id: "green", hex: "#3DDC84" }, { id: "yellow", hex: "#FFD43B" }
  ];

  function stroop(g, el, opts, signal) {
    var ROUNDS = opts.short ? 12 : 24;
    el.innerHTML = head(g, opts.heading) +
      '<ul class="small-notes"><li>' + M.icon("type") + "<span>" + esc(t("stroop.keys")) + "</span></li><li>" + M.icon("eye") + "<span>" + esc(t("stroop.colourNote")) + "</span></li></ul>" +
      '<div class="stage"><div class="stage-top"><div class="meter" aria-hidden="true"><span class="g-bar"></span></div><span class="g-prog"></span></div>' +
      '<div class="stroop-word is-fixation" aria-hidden="true">+</div>' +
      '<p class="sr-only g-prompt">' + esc(t("stroop.prompt")) + "</p>" +
      '<div class="stroop-answers" role="group"></div>' +
      '<div class="btn-row"><button type="button" class="btn btn-primary g-start">' + M.icon("bolt") + "<span>" + esc(t("lab.start")) + "</span></button></div></div>" +
      '<div class="result-card" hidden></div>';

    var word = el.querySelector(".stroop-word"), answers = el.querySelector(".stroop-answers"), start = el.querySelector(".g-start");
    var bar = el.querySelector(".g-bar"), prog = el.querySelector(".g-prog"), res = el.querySelector(".result-card");
    answers.setAttribute("aria-label", t("stroop.prompt"));
    var st = { running: false, trials: [], i: 0, out: [], t0: 0, accepting: false, timer: 0 };

    function buttons() {
      answers.innerHTML = COLORS.map(function (c, i) {
        return '<button type="button" class="stroop-answer press" data-color="' + c.id + '"' + (st.running ? "" : " disabled") + ">" +
          '<span class="swatch" style="background:' + c.hex + '" aria-hidden="true"></span><span>' + esc(t("stroop.color." + c.id)) + "</span>" +
          '<kbd aria-hidden="true">' + (i + 1) + "</kbd></button>";
      }).join("");
    }
    function progress() {
      prog.textContent = st.running ? t("stroop.progress", { i: Math.min(st.i + 1, ROUNDS), n: ROUNDS }) : "";
      bar.style.width = (st.running ? st.i / ROUNDS : 0) * 100 + "%";
    }
    function fixation() { word.textContent = "+"; word.style.color = ""; word.classList.add("is-fixation"); }
    function next() {
      progress();
      if (st.i >= ROUNDS) return done();
      fixation(); st.accepting = false;
      st.timer = setTimeout(function () {
        var tr = st.trials[st.i];
        word.classList.remove("is-fixation");
        word.textContent = t("stroop.color." + tr.word);
        word.style.color = tr.ink.hex;
        st.t0 = performance.now(); st.accepting = true;
      }, 450);
    }
    function answer(id) {
      if (!st.running || !st.accepting) return;
      var tr = st.trials[st.i], rt = performance.now() - st.t0, ok = id === tr.ink.id;
      st.accepting = false;
      st.out.push({ congruent: tr.congruent, correct: ok, rt: rt });
      if (ok) S.tap(); else S.wrong();
      word.classList.add(ok ? "flash-ok" : "flash-no");
      setTimeout(function () { word.classList.remove("flash-ok", "flash-no"); }, 180);
      st.i++; next();
    }
    function begin() {
      var trials = [], per = ROUNDS / 2 / COLORS.length;
      COLORS.forEach(function (ink) {
        for (var i = 0; i < per; i++) {
          trials.push({ word: ink.id, ink: ink, congruent: true });
          var others = COLORS.filter(function (c) { return c.id !== ink.id; });
          trials.push({ word: others[Math.floor(Math.random() * others.length)].id, ink: ink, congruent: false });
        }
      });
      st = { running: true, trials: shuffle(trials), i: 0, out: [], t0: 0, accepting: false, timer: 0 };
      res.hidden = true; start.hidden = true;
      buttons();
      var first = answers.querySelector("button"); if (first) first.focus({ preventScroll: true });
      next();
    }
    function done() {
      clearTimeout(st.timer);
      st.running = false; start.hidden = false; fixation(); buttons(); progress();
      start.querySelector("span").textContent = t("lab.again");
      var ok = st.out.filter(function (x) { return x.correct; });
      var con = mean(ok.filter(function (x) { return x.congruent; }).map(function (x) { return x.rt; }));
      var inc = mean(ok.filter(function (x) { return !x.congruent; }).map(function (x) { return x.rt; }));
      var r = { type: "stroop", con: con, inc: inc, effect: con !== null && inc !== null ? inc - con : null,
        accuracy: Math.round((ok.length / st.out.length) * 1000) / 10 };
      S.correct();
      resultCard(res, "stroop", [
        [M.msText(r.con), t("stroop.congruent") + " — " + t("stroop.avg")],
        [M.msText(r.inc), t("stroop.incongruent") + " — " + t("stroop.avg")],
        [signedMs(r.effect), t("stroop.effect") + ": " + t("stroop.effectHint")],
        [pct(r.accuracy), t("stroop.accuracy")]
      ]);
      finish("stroop", r, opts);
    }

    buttons();
    start.addEventListener("click", begin, { signal: signal });
    answers.addEventListener("click", function (e) { var b = e.target.closest(".stroop-answer"); if (b) answer(b.getAttribute("data-color")); }, { signal: signal });
    document.addEventListener("keydown", function (e) {
      if (!st.running || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) { e.preventDefault(); answer(COLORS[n - 1].id); }
    }, { signal: signal });
    signal.addEventListener("abort", function () { clearTimeout(st.timer); });
  }

  /* ========================================================== REACTION */

  function reaction(g, el, opts, signal) {
    var TRIES = opts.short ? 3 : 5;
    el.innerHTML = head(g, opts.heading) +
      '<div class="stage"><div class="stage-top"><div class="meter" aria-hidden="true"><span class="g-bar"></span></div><span class="g-prog"></span></div>' +
      '<button type="button" class="reaction-pad" data-state="idle"><span class="pad-icon" aria-hidden="true"></span><span class="pad-label"></span></button>' +
      '<p class="sr-only g-status" aria-live="assertive"></p><ol class="tries"></ol></div>' +
      '<div class="result-card" hidden></div>';
    var pad = el.querySelector(".reaction-pad"), icon = pad.querySelector(".pad-icon"), label = pad.querySelector(".pad-label");
    var status = el.querySelector(".g-status"), triesEl = el.querySelector(".tries"), bar = el.querySelector(".g-bar"), prog = el.querySelector(".g-prog"), res = el.querySelector(".result-card");
    var r = { state: "idle", times: [], timer: 0, t0: 0, last: 0, handled: 0, done: null };
    triesEl.setAttribute("aria-label", t("reaction.tries"));

    function set(s) { r.state = s; pad.setAttribute("data-state", s); paint(); }
    function paint() {
      var s = r.state, txt, ic;
      if (s === "waiting") { txt = t("reaction.wait"); ic = "clock"; }
      else if (s === "go") { txt = t("reaction.go"); ic = "bolt"; }
      else if (s === "early") { txt = t("reaction.early"); ic = "info"; }
      else if (s === "result") { txt = t("reaction.tryResult", { ms: M.fmt(Math.round(r.last)) }); ic = "check"; }
      else { txt = t("reaction.idle"); ic = "target"; }
      label.textContent = txt; icon.innerHTML = M.icon(ic); status.textContent = txt;
      var n = r.times.length;
      prog.textContent = s !== "idle" ? t("reaction.progress", { i: Math.min(n + (s === "result" ? 0 : 1), TRIES), n: TRIES }) : "";
      bar.style.width = (s === "idle" && r.done ? 100 : (n / TRIES) * 100) + "%";
      var shown = s === "idle" && r.done ? r.done : r.times;
      triesEl.innerHTML = shown.map(function (v) { return "<li>" + M.fmt(Math.round(v)) + " " + esc(t("lab.ms")) + "</li>"; }).join("");
    }
    function wait() {
      clearTimeout(r.timer); set("waiting");
      r.timer = setTimeout(function () { set("go"); r.t0 = performance.now(); }, 1500 + Math.random() * 2500);
    }
    function press() {
      var now = performance.now(); r.handled = now;
      switch (r.state) {
        case "idle": r.times = []; r.done = null; res.hidden = true; S.tap(); wait(); break;
        case "waiting": clearTimeout(r.timer); S.wrong(); set("early"); break;
        case "early": case "result": wait(); break;
        case "go":
          r.last = now - r.t0; r.times.push(r.last); S.tap();
          if (r.times.length >= TRIES) end(); else set("result");
          break;
      }
    }
    function end() {
      r.done = r.times.slice(); set("idle");
      var avg = mean(r.done), best = Math.min.apply(null, r.done);
      var result = { type: "reaction", times: r.done.map(Math.round), avg: Math.round(avg), best: Math.round(best) };
      S.correct();
      resultCard(res, "reaction", [
        [M.msText(avg), t("reaction.average") + " (≈ " + M.fmt(avg / 1000, 2) + " " + t("lab.sec") + ")"],
        [M.msText(best), t("reaction.fastest")],
        [String(r.done.length), t("reaction.tries")]
      ], M.barsHtml(r.done));
      finish("reaction", result, opts);
    }
    pad.addEventListener("pointerdown", function (e) { if (e.button === 0) press(); }, { signal: signal });
    pad.addEventListener("keydown", function (e) {
      if (e.key !== " " && e.key !== "Enter") return;
      e.preventDefault(); if (!e.repeat) press();
    }, { signal: signal });
    pad.addEventListener("click", function (e) { if (performance.now() - r.handled < 600) return; if (e.detail === 0) press(); }, { signal: signal });
    signal.addEventListener("abort", function () { clearTimeout(r.timer); });
    paint();
  }

  /* ============================================== SPAN TASKS (shared) */

  // Digit span and sequence memory share the same staircase:
  // start at `startLen`, two attempts per length, +1 after a correct answer,
  // stop after two misses at the same length.
  function staircase(cfg) {
    var len = cfg.startLen, attempt = 0, best = 0, rounds = 0;
    return {
      len: function () { return len; },
      best: function () { return best; },
      rounds: function () { return rounds; },
      answer: function (ok) {
        rounds++;
        if (ok) { best = Math.max(best, len); len = Math.min(cfg.maxLen, len + 1); attempt = 0; return "up"; }
        attempt++;
        return attempt >= 2 ? "end" : "retry";
      }
    };
  }

  /* ============================================================ DIGITS */

  function digits(g, el, opts, signal) {
    el.innerHTML = head(g, opts.heading) +
      '<div class="stage"><div class="stage-top"><span class="g-len"></span><span class="g-prog"></span></div>' +
      '<div class="span-display" aria-live="polite"><span class="span-big">·</span><span class="span-hint"></span></div>' +
      '<div class="span-entry" hidden><div class="span-typed" aria-live="polite"></div>' +
      '<div class="keypad">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button type="button" class="key press" data-k="' + n + '">' + n + "</button>"; }).join("") +
        '<button type="button" class="key key-soft press" data-k="del"><span class="sr-only">' + esc(t("game.digits.delete")) + "</span>" + M.icon("arrowLeft") + "</button>" +
        '<button type="button" class="key press" data-k="0">0</button>' +
        '<button type="button" class="key key-go press" data-k="ok">' + esc(t("game.digits.ok")) + "</button></div></div>" +
      '<div class="btn-row"><button type="button" class="btn btn-primary g-start">' + M.icon("bolt") + "<span>" + esc(t("lab.start")) + "</span></button></div></div>" +
      '<div class="result-card" hidden></div>';
    var big = el.querySelector(".span-big"), hint = el.querySelector(".span-hint"), entry = el.querySelector(".span-entry");
    var typed = el.querySelector(".span-typed"), start = el.querySelector(".g-start"), res = el.querySelector(".result-card");
    var lenEl = el.querySelector(".g-len"), prog = el.querySelector(".g-prog"), display = el.querySelector(".span-display");
    var sc, target = [], input = [], accepting = false, running = false;

    function showTyped() { typed.textContent = input.length ? input.join(" ") : t("game.digits.typeHere"); }

    async function round() {
      lenEl.textContent = t("game.span.length", { n: sc.len() });
      prog.textContent = t("game.span.round", { n: sc.rounds() + 1 });
      target = []; for (var i = 0; i < sc.len(); i++) target.push(Math.floor(Math.random() * 10));
      input = []; accepting = false; entry.hidden = true; display.classList.remove("ok", "no");
      hint.textContent = t("game.digits.watch");
      big.textContent = "·";
      try {
        await sleep(700, signal);
        for (var k = 0; k < target.length; k++) {
          big.textContent = target[k]; big.classList.add("pop");
          await sleep(900, signal);
          big.textContent = "·"; big.classList.remove("pop");
          await sleep(300, signal);
        }
      } catch (e) { return; }
      hint.textContent = t("game.digits.yourTurn");
      entry.hidden = false; accepting = true; showTyped();
      var firstKey = entry.querySelector(".key"); if (firstKey) firstKey.focus({ preventScroll: true });
    }
    function check() {
      if (!accepting) return;
      accepting = false;
      var ok = input.join("") === target.join("");
      display.classList.add(ok ? "ok" : "no");
      hint.textContent = ok ? t("game.span.right") : t("game.span.wrong", { seq: target.join(" ") });
      if (ok) S.correct(); else S.wrong();
      var step = sc.answer(ok);
      setTimeout(function () { if (!running) return; if (step === "end") end(); else round(); }, 1300);
    }
    function key(k) {
      if (!accepting) return;
      if (k === "del") input.pop();
      else if (k === "ok") return check();
      else if (input.length < 14) { input.push(+k); S.tap(); }
      showTyped();
    }
    function begin() { sc = staircase({ startLen: 3, maxLen: 12 }); running = true; res.hidden = true; start.hidden = true; round(); }
    function end() {
      running = false; entry.hidden = true; start.hidden = false;
      start.querySelector("span").textContent = t("lab.again");
      big.textContent = sc.best() || "—"; hint.textContent = ""; lenEl.textContent = ""; prog.textContent = "";
      var result = { type: "digits", span: sc.best(), rounds: sc.rounds() };
      resultCard(res, "digits", [[String(sc.best() || "—"), t("game.span.best")], [String(sc.rounds()), t("game.span.rounds")]]);
      finish("digits", result, opts);
    }
    start.addEventListener("click", begin, { signal: signal });
    entry.addEventListener("click", function (e) { var b = e.target.closest(".key"); if (b) key(b.getAttribute("data-k")); }, { signal: signal });
    document.addEventListener("keydown", function (e) {
      if (!accepting || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); key(e.key); }
      else if (e.key === "Backspace") { e.preventDefault(); key("del"); }
      else if (e.key === "Enter") { e.preventDefault(); key("ok"); }
    }, { signal: signal });
  }

  /* ========================================================== SEQUENCE */

  function sequence(g, el, opts, signal) {
    el.innerHTML = head(g, opts.heading) +
      '<div class="stage"><div class="stage-top"><span class="g-len"></span><span class="g-prog"></span></div>' +
      '<p class="seq-hint" aria-live="polite"></p>' +
      '<div class="seq-grid" role="group">' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map(function (i) {
        return '<button type="button" class="seq-tile press" data-i="' + i + '" disabled><span class="sr-only">' + esc(t("game.sequence.tile", { n: i + 1 })) + "</span></button>";
      }).join("") + "</div>" +
      '<div class="btn-row"><button type="button" class="btn btn-primary g-start">' + M.icon("bolt") + "<span>" + esc(t("lab.start")) + "</span></button></div></div>" +
      '<div class="result-card" hidden></div>';
    var grid = el.querySelector(".seq-grid"), tiles = Array.prototype.slice.call(grid.children);
    var hint = el.querySelector(".seq-hint"), start = el.querySelector(".g-start"), res = el.querySelector(".result-card");
    var lenEl = el.querySelector(".g-len"), prog = el.querySelector(".g-prog");
    grid.setAttribute("aria-label", t("game.sequence.gridLabel"));
    var sc, target = [], pos = 0, accepting = false, running = false;

    function lock(on) { tiles.forEach(function (b) { b.disabled = on; }); }
    async function round() {
      lenEl.textContent = t("game.span.length", { n: sc.len() });
      prog.textContent = t("game.span.round", { n: sc.rounds() + 1 });
      target = []; pos = 0; accepting = false; lock(true); grid.classList.remove("ok", "no");
      while (target.length < sc.len()) {
        var n = Math.floor(Math.random() * 9);
        if (target[target.length - 1] !== n) target.push(n);
      }
      hint.textContent = t("game.sequence.watch");
      try {
        await sleep(700, signal);
        for (var k = 0; k < target.length; k++) {
          tiles[target[k]].classList.add("lit"); S.tap();
          await sleep(600, signal);
          tiles[target[k]].classList.remove("lit");
          await sleep(300, signal);
        }
      } catch (e) { return; }
      hint.textContent = t("game.sequence.yourTurn");
      lock(false); accepting = true;
      tiles[0].focus({ preventScroll: true });
    }
    function tap(i) {
      if (!accepting) return;
      var b = tiles[i];
      b.classList.add("tapped"); setTimeout(function () { b.classList.remove("tapped"); }, 220);
      if (i !== target[pos]) return judge(false);
      pos++; S.tap();
      if (pos >= target.length) judge(true);
    }
    function judge(ok) {
      accepting = false; lock(true);
      grid.classList.add(ok ? "ok" : "no");
      hint.textContent = ok ? t("game.span.right") : t("game.sequence.wrong");
      if (ok) S.correct(); else S.wrong();
      var step = sc.answer(ok);
      setTimeout(function () { if (!running) return; if (step === "end") end(); else round(); }, 1200);
    }
    function begin() { sc = staircase({ startLen: 3, maxLen: 9 }); running = true; res.hidden = true; start.hidden = true; round(); }
    function end() {
      running = false; start.hidden = false; lock(true);
      start.querySelector("span").textContent = t("lab.again");
      hint.textContent = ""; lenEl.textContent = ""; prog.textContent = "";
      var result = { type: "sequence", span: sc.best(), rounds: sc.rounds() };
      resultCard(res, "sequence", [[String(sc.best() || "—"), t("game.span.best")], [String(sc.rounds()), t("game.span.rounds")]]);
      finish("sequence", result, opts);
    }
    start.addEventListener("click", begin, { signal: signal });
    grid.addEventListener("click", function (e) { var b = e.target.closest(".seq-tile"); if (b) tap(+b.getAttribute("data-i")); }, { signal: signal });
  }

  /* ========================================================= BREATHING */

  // NHS pattern: in for a count of 5, out for a count of 5.
  function breathing(g, el, opts, signal) {
    var choices = opts.short ? [1] : [1, 3, 5];
    el.innerHTML = head(g, opts.heading) +
      '<div class="stage breath-stage">' +
        '<div class="breath-visual" aria-hidden="true"><div class="breath-blob"></div><img src="' + M.root() + 'assets/characters/syno.png" width="166" height="244" alt="" class="breath-syno"></div>' +
        '<p class="breath-phase" aria-live="polite">' + esc(t("game.breathing.ready")) + '</p><p class="breath-count" aria-hidden="true"></p>' +
        '<div class="meter" aria-hidden="true"><span class="g-bar"></span></div>' +
        '<div class="btn-row breath-choices" role="group" aria-label="' + esc(t("game.breathing.length")) + '">' +
          choices.map(function (m) { return '<button type="button" class="btn btn-ghost btn-sm press" data-min="' + m + '">' + esc(t("game.breathing.minutes", { n: m })) + "</button>"; }).join("") +
        '</div><div class="btn-row"><button type="button" class="btn btn-ghost btn-sm g-stop" hidden>' + M.icon("close") + "<span>" + esc(t("game.breathing.stop")) + "</span></button></div>" +
      '</div><div class="result-card" hidden></div>';
    var stage = el.querySelector(".breath-stage"), phase = el.querySelector(".breath-phase"), count = el.querySelector(".breath-count");
    var bar = el.querySelector(".g-bar"), stop = el.querySelector(".g-stop"), res = el.querySelector(".result-card"), choicesEl = el.querySelector(".breath-choices");
    var running = false, started = 0, total = 0;

    async function run(minutes) {
      running = true; total = minutes * 60; started = performance.now();
      choicesEl.hidden = true; stop.hidden = false; res.hidden = true; stage.classList.add("is-running");
      try {
        while (running) {
          for (var dir of ["in", "out"]) {
            stage.setAttribute("data-phase", dir);
            phase.textContent = t(dir === "in" ? "game.breathing.in" : "game.breathing.out");
            S.breath(dir, 5);
            for (var c = 1; c <= 5; c++) {
              count.textContent = c;
              var elapsed = (performance.now() - started) / 1000;
              bar.style.width = Math.min(100, (elapsed / total) * 100) + "%";
              await sleep(1000, signal);
            }
          }
          if ((performance.now() - started) / 1000 >= total) break;
        }
      } catch (e) { return; }
      end();
    }
    function end() {
      if (!running) return;
      running = false;
      var seconds = Math.round((performance.now() - started) / 1000);
      stage.classList.remove("is-running"); stage.removeAttribute("data-phase");
      phase.textContent = t("game.breathing.done"); count.textContent = "";
      choicesEl.hidden = false; stop.hidden = true;
      if (seconds >= 20) {
        resultCard(res, "breathing", [[M.fmt(seconds / 60, 1), t("game.breathing.minutesDone")]]);
        finish("breathing", { type: "breathing", seconds: seconds }, opts);
      }
    }
    choicesEl.addEventListener("click", function (e) { var b = e.target.closest("[data-min]"); if (b) run(+b.getAttribute("data-min")); }, { signal: signal });
    stop.addEventListener("click", end, { signal: signal });
  }

  /* ============================================================= SLEEP */

  // Lumi's wind-down: a dark, quiet, 3-minute routine based on NHS tips that
  // ends by asking the visitor to put the phone away.
  function sleepMode(g, el, opts, signal) {
    el.innerHTML = head(g, opts.heading) +
      '<div class="stage night-preview"><img src="' + M.root() + 'assets/characters/lumi.png" width="162" height="164" alt="" class="night-lumi-small">' +
      '<ul class="small-notes">' + ["game.sleep.note1", "game.sleep.note2"].map(function (k) { return "<li>" + M.icon("moon") + "<span>" + esc(t(k)) + "</span></li>"; }).join("") + "</ul>" +
      '<div class="btn-row"><button type="button" class="btn btn-night g-start">' + M.icon("moon") + "<span>" + esc(t("game.sleep.start")) + "</span></button></div></div>" +
      '<div class="result-card" hidden></div>';
    var start = el.querySelector(".g-start"), res = el.querySelector(".result-card");
    var overlay = null, steps = ["game.sleep.step1", "game.sleep.step2", "game.sleep.step3", "game.sleep.step4"];
    var TOTAL = 180, began = 0, timer = 0, lastFocus = null;

    function open() {
      lastFocus = document.activeElement;
      overlay = document.createElement("div");
      overlay.className = "night";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", t("game.sleep.title"));
      var stars = "";
      for (var i = 0; i < 40; i++) {
        stars += '<span class="star" style="left:' + (Math.random() * 100).toFixed(1) + "%;top:" + (Math.random() * 70).toFixed(1) + "%;animation-delay:" + (Math.random() * 6).toFixed(1) + "s;animation-duration:" + (5 + Math.random() * 5).toFixed(1) + 's"></span>';
      }
      overlay.innerHTML = '<div class="night-sky" aria-hidden="true">' + stars + "</div>" +
        '<div class="night-inner"><div class="night-moon" aria-hidden="true"></div>' +
        '<img class="night-lumi" src="' + M.root() + 'assets/characters/lumi.png" width="162" height="164" alt="">' +
        '<p class="night-step" aria-live="polite"></p>' +
        '<div class="night-ring" aria-hidden="true"><span></span></div>' +
        '<div class="btn-row"><button type="button" class="btn btn-night-ghost night-end">' + esc(t("game.sleep.end")) + "</button></div></div>";
      document.body.appendChild(overlay);
      document.documentElement.classList.add("night-open");
      requestAnimationFrame(function () { overlay.classList.add("is-open"); });
      overlay.querySelector(".night-end").addEventListener("click", close);
      overlay.addEventListener("keydown", function (e) {
        if (e.key === "Escape") close();
        if (e.key === "Tab") { e.preventDefault(); overlay.querySelector(".night-end").focus(); } // single control: keep focus inside
      });
      overlay.querySelector(".night-end").focus();
      S.ambienceStart();
      began = performance.now();
      tick();
    }
    function tick() {
      if (!overlay) return;
      var el2 = (performance.now() - began) / 1000;
      var idx = Math.min(steps.length - 1, Math.floor(el2 / (TOTAL / steps.length)));
      var stepEl = overlay.querySelector(".night-step");
      var txt = t(steps[idx]);
      if (stepEl.textContent !== txt) stepEl.textContent = txt;
      overlay.querySelector(".night-ring span").style.setProperty("--p", Math.min(1, el2 / TOTAL));
      if (el2 >= TOTAL) return close(true);
      timer = setTimeout(tick, 500);
    }
    function close(completed) {
      if (!overlay) return;
      clearTimeout(timer);
      var seconds = Math.round((performance.now() - began) / 1000);
      S.ambienceStop();
      var o = overlay; overlay = null;
      o.classList.remove("is-open");
      document.documentElement.classList.remove("night-open");
      setTimeout(function () { o.remove(); }, 400);
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
      if (completed === true || seconds >= 60) {
        resultCard(res, "sleep", [[M.fmt(seconds / 60, 1), t("game.sleep.minutes")]]);
        var pose = res.querySelector(".result-pose"); if (pose) pose.innerHTML = M.poseImg("lumi", "asleep", "pose", true);
        finish("sleep", { type: "sleep", seconds: seconds }, opts);
      }
    }
    start.addEventListener("click", open, { signal: signal });
    signal.addEventListener("abort", function () { if (overlay) close(); });
  }

  /* -------------------------------------------------------------- mount */

  var IMPL = { stroop: stroop, reaction: reaction, digits: digits, sequence: sequence, breathing: breathing, sleep: sleepMode };

  window.MedullaGames = {
    list: LIST,
    get: function (id) { return LIST.filter(function (g) { return g.id === id; })[0] || null; },
    mount: function (id, container, opts) {
      var g = this.get(id);
      if (!g) return null;
      opts = Object.assign({ heading: "h2" }, opts || {});
      var ac = new AbortController();
      container.classList.add("game", "game-" + id);
      IMPL[id](g, container, opts, ac.signal);
      if (window.MedullaMotion) window.MedullaMotion.initTilt(container);
      return { destroy: function () { ac.abort(); container.innerHTML = ""; container.classList.remove("game", "game-" + id); } };
    }
  };
})();
