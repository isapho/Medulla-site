/*
 * Accessibility & comfort (loaded on every page after js/main.js).
 *
 *  - The panel: ready-made profiles (Focus, Easier reading, Calm senses,
 *    Seizure-safe, Simple & slow, See better) and single settings (text size,
 *    spacing, font, theme, contrast, links, motion, sound, decorations,
 *    reading guide, hard words, read-aloud, more time). Alt + A opens it.
 *  - Reading guide: a bright band that follows the pointer or keyboard focus.
 *  - Read aloud: the whole page, a selection, or one hard word, with the
 *    device's own voices (Web Speech API). Nothing is sent anywhere.
 *  - Hard words: the first use of each glossary term on a page gets a dotted
 *    underline; pressing it shows a plain-language definition.
 *
 * Settings themselves are applied before first paint by js/prefs.js; this file
 * only builds the controls and the helpers. Why each option exists, with
 * sources: RESEARCH.md §8.
 */
(function () {
  "use strict";

  var M = window.Medulla, P = window.MedullaPrefs;
  if (!M || !P) return;
  var root = document.documentElement;
  var t = M.t, esc = M.esc, icon = M.icon;

  /* ------------------------------------------------------------ profiles */

  // A profile is only a bundle of settings. Turning it off puts those
  // settings back to their defaults.
  var PROFILES = [
    { id: "focus",   icon: "target",     set: { nodecor: 1, ruler: 1, calm: 1 }, mute: true },
    { id: "read",    icon: "book",       set: { font: "dyslexia", spacing: 1, text: 1, tts: 1 } },
    { id: "calm",    icon: "moon",       set: { calm: 1, nodecor: 1, contrast: 0 }, mute: true },
    { id: "seizure", icon: "shield",     set: { calm: 1, nodecor: 1, flash: 0 }, mute: true },
    { id: "simple",  icon: "bulb",       set: { text: 2, spacing: 1, glossary: 1, tts: 1, slow: 1 } },
    { id: "vision",  icon: "eye",        set: { text: 3, contrast: 1, links: 1, font: "readable" } }
  ];

  function profileOn(p, s) {
    for (var k in p.set) if (s[k] !== p.set[k]) return false;
    return true;
  }

  /* --------------------------------------------------------------- panel */

  var drawer = null, opener = null;

  function seg(key, options, label) {
    var s = P.a11y();
    return '<div class="ax-field"><span class="ax-label" id="ax-l-' + key + '">' + esc(label) + "</span>" +
      '<div class="ax-seg" role="group" aria-labelledby="ax-l-' + key + '">' + options.map(function (o) {
        return '<button type="button" data-ax-set="' + key + '" data-ax-value="' + esc(String(o.v)) + '" aria-pressed="' + (s[key] === o.v) + '"' +
          (o.aria ? ' aria-label="' + esc(o.aria) + '"' : "") + (o.style ? ' style="' + o.style + '"' : "") + ">" + o.html + "</button>";
      }).join("") + "</div></div>";
  }
  function sw(key, label, on) {
    return '<button type="button" class="switch ax-switch" role="switch" data-ax-toggle="' + key + '" aria-checked="' + !!on + '">' +
      "<span>" + esc(label) + '</span><span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span></button>';
  }

  function panelHtml() {
    var s = P.a11y(), soundOn = window.MedullaSound && window.MedullaSound.isOn();
    var langs = window.MEDULLA_I18N.languages.map(function (l) {
      return '<button type="button" class="lang-btn lang-big" data-lang="' + l.code + '" lang="' + l.code + '" aria-pressed="' + (l.code === M.lang()) + '">' + esc(l.name) + "</button>";
    }).join("");
    return '<div class="ax-head">' +
        '<span class="ax-badge" aria-hidden="true">' + icon("access") + "</span>" +
        '<div><h2 class="ax-title" id="ax-title" tabindex="-1">' + esc(t("ax.title")) + '</h2><p class="ax-lead">' + esc(t("ax.lead")) + "</p></div>" +
        '<button type="button" class="icon-btn ax-close" data-ax-close aria-label="' + esc(t("ax.close")) + '">' + icon("close") + "</button>" +
      "</div>" +
      '<div class="ax-body">' +
        '<section class="ax-sec" aria-labelledby="ax-s-prof"><h3 id="ax-s-prof">' + esc(t("ax.profiles")) + "</h3>" +
          '<ul class="ax-profiles">' + PROFILES.map(function (p) {
            return '<li><button type="button" class="ax-profile" data-ax-profile="' + p.id + '" aria-pressed="' + profileOn(p, s) + '">' +
              '<span class="ax-p-icon" aria-hidden="true">' + icon(p.icon) + "</span>" +
              '<span class="ax-p-text"><strong>' + esc(t("ax.p." + p.id + ".title")) + "</strong><small>" + esc(t("ax.p." + p.id + ".for")) + "</small></span>" +
              '<span class="ax-p-check" aria-hidden="true">' + icon("check") + "</span></button></li>";
          }).join("") + "</ul>" +
          '<p class="ax-hint">' + icon("info") + "<span>" + esc(t("ax.profileHint")) + "</span></p>" +
        "</section>" +
        '<section class="ax-sec" aria-labelledby="ax-s-lang"><h3 id="ax-s-lang">' + esc(t("lang.label")) + '</h3><div class="lang-choice" role="group" aria-labelledby="ax-s-lang">' + langs + "</div></section>" +
        '<section class="ax-sec" aria-labelledby="ax-s-text"><h3 id="ax-s-text">' + esc(t("ax.sec.text")) + "</h3>" +
          seg("text", [0, 1, 2, 3].map(function (n) {
            var pct = [100, 112, 125, 150][n];
            return { v: n, html: '<span class="ax-aa" style="font-size:' + (0.8 + n * 0.17).toFixed(2) + 'rem">A</span><small>' + pct + "%</small>", aria: t("ax.textSizeN", { n: pct }) };
          }), t("ax.textSize")) +
          seg("font", ["default", "readable", "dyslexia"].map(function (f) { return { v: f, html: "<span>" + esc(t("ax.font." + f)) + "</span>" }; }), t("ax.font")) +
          sw("spacing", t("ax.spacing"), s.spacing) +
        "</section>" +
        '<section class="ax-sec" aria-labelledby="ax-s-col"><h3 id="ax-s-col">' + esc(t("ax.sec.colour")) + "</h3>" +
          seg("theme", [{ v: "auto", i: "refresh" }, { v: "light", i: "sun" }, { v: "dark", i: "moon" }].map(function (o) { return { v: o.v, html: icon(o.i) + "<span>" + esc(t("ax.theme." + o.v)) + "</span>" }; }), t("ax.theme")) +
          sw("contrast", t("ax.contrast"), s.contrast) +
          sw("links", t("ax.links"), s.links) +
        "</section>" +
        '<section class="ax-sec" aria-labelledby="ax-s-mot"><h3 id="ax-s-mot">' + esc(t("ax.sec.motion")) + "</h3>" +
          sw("calm", t("ax.calm"), s.calm) +
          sw("nodecor", t("ax.nodecor"), s.nodecor) +
          sw("flash", t("ax.noflash"), !s.flash) +
          '<button type="button" class="switch ax-switch" role="switch" data-ax-sound aria-checked="' + !!soundOn + '"><span>' + esc(t("ax.sound")) + '</span><span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span></button>' +
        "</section>" +
        '<section class="ax-sec" aria-labelledby="ax-s-read"><h3 id="ax-s-read">' + esc(t("ax.sec.reading")) + "</h3>" +
          sw("ruler", t("ax.ruler"), s.ruler) +
          sw("glossary", t("ax.glossary"), s.glossary) +
          sw("tts", t("ax.tts"), s.tts) +
          sw("slow", t("ax.slow"), s.slow) +
          '<button type="button" class="btn btn-primary ax-readpage press" data-ax-readpage>' + icon("headphones") + "<span>" + esc(t("ax.readPage")) + "</span></button>" +
        "</section>" +
      "</div>" +
      '<div class="ax-foot">' +
        '<p class="ax-note">' + esc(t("ax.note")) + "</p>" +
        '<div class="ax-foot-row"><button type="button" class="btn btn-ghost btn-sm press" data-ax-reset>' + icon("refresh") + "<span>" + esc(t("ax.reset")) + "</span></button>" +
        '<a class="text-link" href="' + M.root() + 'accessibility.html">' + esc(t("ax.more")) + icon("arrow", "icon-sm") + "</a></div>" +
      "</div>";
  }

  function ensureDrawer() {
    if (drawer) return drawer;
    drawer = document.createElement("div");
    drawer.className = "ax-drawer";
    drawer.id = "a11y-drawer";
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    drawer.setAttribute("aria-labelledby", "ax-title");
    drawer.hidden = true;
    var scrim = document.createElement("div");
    scrim.className = "ax-scrim";
    scrim.hidden = true;
    scrim.addEventListener("click", close);
    document.body.appendChild(scrim);
    document.body.appendChild(drawer);
    drawer._scrim = scrim;
    drawer.addEventListener("click", onPanelClick);
    drawer.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); close(); }
      if (e.key === "Tab") trap(e);
    });
    render();
    return drawer;
  }

  function trap(e) {
    var f = drawer.querySelectorAll("button:not([disabled]), a[href]");
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function render() {
    if (!drawer) return;
    var scroll = drawer.querySelector(".ax-body") ? drawer.querySelector(".ax-body").scrollTop : 0;
    var focusSel = null, a = document.activeElement;
    if (a && drawer.contains(a)) {
      ["data-ax-toggle", "data-ax-profile", "data-ax-set", "data-lang"].forEach(function (k) {
        if (!focusSel && a.hasAttribute(k)) focusSel = "[" + k + '="' + a.getAttribute(k) + '"]' + (k === "data-ax-set" ? '[data-ax-value="' + a.getAttribute("data-ax-value") + '"]' : "");
      });
      if (!focusSel && a.hasAttribute("data-ax-sound")) focusSel = "[data-ax-sound]";
    }
    drawer.innerHTML = panelHtml();
    drawer.querySelector(".ax-body").scrollTop = scroll;
    if (focusSel) { var n = drawer.querySelector(focusSel); if (n) n.focus(); }
  }

  function open(btn) {
    ensureDrawer();
    opener = btn || document.activeElement;
    render();
    drawer.hidden = false; drawer._scrim.hidden = false;
    root.classList.add("ax-open");
    document.querySelectorAll("#display-toggle").forEach(function (b) { b.setAttribute("aria-expanded", "true"); });
    void drawer.offsetWidth; // start the slide-in transition from the hidden state
    drawer.classList.add("is-in");
    drawer.querySelector("#ax-title").focus();
  }
  function close() {
    if (!drawer || drawer.hidden) return;
    drawer.classList.remove("is-in");
    drawer.hidden = true; drawer._scrim.hidden = true;
    root.classList.remove("ax-open");
    document.querySelectorAll("#display-toggle").forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
    if (opener && document.contains(opener)) opener.focus();
  }
  function toggle(btn) { if (drawer && !drawer.hidden) close(); else open(btn); }

  function announce(text) { M.toast({ icon: "access", title: text, ms: 2200 }); }

  function onPanelClick(e) {
    var b = e.target.closest("button, a");
    if (!b || !drawer.contains(b)) return;
    if (b.hasAttribute("data-ax-close")) return close();
    if (b.hasAttribute("data-lang")) return; // handled by main.js language buttons? (they are re-bound below)
    var s = P.a11y(), ch = {};
    if (b.hasAttribute("data-ax-toggle")) {
      var k = b.getAttribute("data-ax-toggle");
      ch[k] = k === "flash" ? (s.flash ? 0 : 1) : (s[k] ? 0 : 1);
      P.setA11y(ch);
    } else if (b.hasAttribute("data-ax-set")) {
      var key = b.getAttribute("data-ax-set"), raw = b.getAttribute("data-ax-value");
      ch[key] = typeof P.DEFAULTS[key] === "number" ? Number(raw) : raw;
      P.setA11y(ch);
    } else if (b.hasAttribute("data-ax-profile")) {
      var p = PROFILES.filter(function (x) { return x.id === b.getAttribute("data-ax-profile"); })[0];
      var on = profileOn(p, s);
      for (var pk in p.set) ch[pk] = on ? P.DEFAULTS[pk] : p.set[pk];
      P.setA11y(ch);
      if (!on && p.mute && window.MedullaSound && window.MedullaSound.isOn()) window.MedullaSound.setEnabled(false);
      announce(t(on ? "ax.profileOff" : "ax.profileOn", { name: t("ax.p." + p.id + ".title") }));
    } else if (b.hasAttribute("data-ax-sound")) {
      if (window.MedullaSound) window.MedullaSound.setEnabled(!window.MedullaSound.isOn());
    } else if (b.hasAttribute("data-ax-reset")) {
      P.setA11y("reset");
      announce(t("ax.resetDone"));
    } else if (b.hasAttribute("data-ax-readpage")) {
      close();
      readPage();
      return;
    } else return;
    render();
  }

  // Language buttons inside the panel reuse main.js's switcher.
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".ax-drawer [data-lang]");
    if (!b) return;
    var hb = document.querySelector('.site-header [data-lang="' + b.getAttribute("data-lang") + '"]');
    if (hb) hb.click();
  });

  // Any [data-open-access] button opens the panel; [data-read-page] reads the page aloud.
  document.addEventListener("click", function (e) {
    var o = e.target.closest("[data-open-access]");
    if (o) { e.preventDefault(); open(o); return; }
    var r = e.target.closest("[data-read-page]");
    if (r) { e.preventDefault(); readPage(); }
  });

  document.addEventListener("keydown", function (e) {
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.code === "KeyA" || e.key === "a" || e.key === "A")) {
      e.preventDefault();
      toggle(document.getElementById("display-toggle"));
    }
  });

  document.addEventListener("medulla:a11y", function () { syncRuler(); glossaryRefresh(); });
  document.addEventListener("medulla:sound", function () { if (drawer && !drawer.hidden) render(); });
  M.onLangChange(function () { if (drawer && !drawer.hidden) render(); stopReading(); glossaryRefresh(true); });

  /* -------------------------------------------------------- reading guide */

  var ruler = null, rulerY = -1;
  function syncRuler() {
    var on = root.classList.contains("a11y-ruler");
    if (on && !ruler) {
      ruler = document.createElement("div");
      ruler.className = "ax-ruler";
      ruler.setAttribute("aria-hidden", "true");
      document.body.appendChild(ruler);
      moveRuler(window.innerHeight * 0.4);
    }
    if (ruler) ruler.hidden = !on;
  }
  function moveRuler(y) {
    if (!ruler || ruler.hidden) return;
    rulerY = y;
    ruler.style.transform = "translateY(" + Math.round(y - ruler.offsetHeight / 2) + "px)";
  }
  document.addEventListener("pointermove", function (e) { if (ruler && e.pointerType !== "touch") moveRuler(e.clientY); }, { passive: true });
  document.addEventListener("touchmove", function (e) { if (ruler && e.touches[0]) moveRuler(e.touches[0].clientY - 60); }, { passive: true });
  document.addEventListener("focusin", function (e) {
    if (!ruler || ruler.hidden || !e.target.getBoundingClientRect) return;
    var r = e.target.getBoundingClientRect();
    moveRuler(r.top + r.height / 2);
  });

  /* ----------------------------------------------------------- read aloud */

  var synth = window.speechSynthesis || null;
  var reading = null; // { items, i, paused }
  var bar = null;

  function voiceFor(code) {
    if (!synth) return null;
    var want = code.toLowerCase();
    var vs = synth.getVoices().filter(function (v) { return v.lang && v.lang.toLowerCase().replace("_", "-").indexOf(want) === 0; });
    // Prefer local (offline) voices: nothing leaves the device.
    return vs.filter(function (v) { return v.localService; })[0] || vs[0] || null;
  }
  function withVoices(fn) {
    if (!synth) { M.toast({ icon: "headphones", title: t("fact.noSpeech") }); return; }
    if (synth.getVoices().length) return fn();
    var done = false;
    synth.onvoiceschanged = function () { if (done) return; done = true; synth.onvoiceschanged = null; fn(); };
    setTimeout(function () { if (!done) { done = true; fn(); } }, 900);
  }
  function chunks(text) {
    var parts = String(text).replace(/\s+/g, " ").trim().match(/[^.!?…:;]+[.!?…:;]*\s*/g) || [], out = [], cur = "";
    parts.forEach(function (p) {
      p = p.trim(); if (!p) return;
      if ((cur + " " + p).length > 220 && cur) { out.push(cur); cur = p; } else cur = cur ? cur + " " + p : p;
    });
    if (cur) out.push(cur);
    return out;
  }
  // Speak text; resolves when finished or stopped.
  function speak(text, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      withVoices(function () {
        var v = voiceFor(M.lang());
        if (!v) {
          M.toast({ icon: "headphones", title: t("fact.noVoice"), text: t("fact.noVoiceHint"), ms: 6500 });
          return resolve(false);
        }
        var list = chunks(text), k = 0;
        (function next() {
          if (k >= list.length || (opts.isStopped && opts.isStopped())) return resolve(true);
          var u = new SpeechSynthesisUtterance(list[k++]);
          u.voice = v; u.lang = v.lang;
          u.rate = root.classList.contains("a11y-slow") ? 0.8 : 0.95;
          u.onend = next;
          u.onerror = function () { resolve(false); };
          synth.speak(u);
        })();
      });
    });
  }
  function stopSpeaking() { if (synth) synth.cancel(); }

  function readable(el) {
    if (!el.offsetParent && getComputedStyle(el).position !== "fixed") return false;
    if (el.closest("[aria-hidden='true'], nav, .sr-only, .ax-drawer, .gloss-pop, .toasts, .skip-link, dialog:not([open])")) return false;
    return (el.innerText || "").trim().length > 1;
  }
  function pageItems() {
    var main = document.getElementById("main") || document.body;
    var dlg = document.querySelector("dialog[open]");
    var scope = dlg || main;
    var all = Array.prototype.slice.call(scope.querySelectorAll("h1, h2, h3, h4, p, li, figcaption, dt, dd, .fact-body, blockquote"));
    var picked = [];
    all.forEach(function (el) {
      if (!readable(el)) return;
      for (var i = 0; i < picked.length; i++) if (picked[i].contains(el)) return;
      picked.push(el);
    });
    return picked;
  }

  function ensureBar() {
    if (bar) return bar;
    bar = document.createElement("div");
    bar.className = "ax-readbar";
    bar.setAttribute("role", "region");
    bar.hidden = true;
    document.body.appendChild(bar);
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      if (b.hasAttribute("data-rb-stop")) stopReading();
      else if (b.hasAttribute("data-rb-pause")) {
        if (!reading) return;
        if (reading.paused) { reading.paused = false; synth.resume(); } else { reading.paused = true; synth.pause(); }
        drawBar();
      } else if (b.hasAttribute("data-rb-next")) { if (reading) { synth.cancel(); } }
    });
    return bar;
  }
  function drawBar() {
    ensureBar();
    if (!reading) { bar.hidden = true; return; }
    bar.setAttribute("aria-label", t("ax.reading"));
    bar.innerHTML = '<span class="rb-wave" aria-hidden="true"><i></i><i></i><i></i></span>' +
      '<span class="rb-text">' + esc(t("ax.reading")) + " <small>" + (reading.i + 1) + " / " + reading.items.length + "</small></span>" +
      '<button type="button" class="icon-btn" data-rb-pause aria-label="' + esc(t(reading.paused ? "ax.resume" : "ax.pause")) + '">' + icon(reading.paused ? "play" : "pause") + "</button>" +
      '<button type="button" class="icon-btn" data-rb-next aria-label="' + esc(t("ax.next")) + '">' + icon("arrow") + "</button>" +
      '<button type="button" class="icon-btn" data-rb-stop aria-label="' + esc(t("ax.stop")) + '">' + icon("close") + "</button>";
    bar.hidden = false;
  }
  function mark(el) {
    document.querySelectorAll(".ax-reading").forEach(function (n) { n.classList.remove("ax-reading"); });
    if (!el) return;
    el.classList.add("ax-reading");
    var r = el.getBoundingClientRect();
    if (r.top < 80 || r.bottom > window.innerHeight - 90) el.scrollIntoView({ block: "center", behavior: M.reducedMotion() ? "auto" : "smooth" });
  }
  function readPage(startEl) {
    stopReading();
    var items = pageItems();
    if (startEl) { var idx = items.indexOf(startEl); if (idx > 0) items = items.slice(idx); }
    if (!items.length) return;
    var run = { items: items, i: 0, paused: false, stopped: false };
    reading = run;
    drawBar();
    (function step() {
      if (run.stopped || reading !== run) return;
      if (run.i >= run.items.length) return stopReading();
      var el = run.items[run.i];
      mark(el); drawBar();
      speak(el.innerText, { isStopped: function () { return run.stopped; } }).then(function (ok) {
        if (run.stopped || reading !== run) return;
        if (ok === false && run.i === 0) return stopReading();
        run.i++; step();
      });
    })();
  }
  function stopReading() {
    if (reading) reading.stopped = true;
    reading = null;
    stopSpeaking();
    mark(null);
    if (bar) bar.hidden = true;
  }

  // "Listen" button for a text selection (when read-aloud buttons are on).
  var selBtn = null;
  function selectionText() {
    var s = window.getSelection ? window.getSelection() : null;
    if (!s || s.isCollapsed) return "";
    var txt = String(s).trim();
    return txt.length > 1 ? txt : "";
  }
  document.addEventListener("selectionchange", function () {
    if (!root.classList.contains("a11y-tts")) { if (selBtn) selBtn.hidden = true; return; }
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(placeSelBtn, 250);
  });
  var selectionTimer = 0;
  function placeSelBtn() {
    var txt = selectionText();
    if (!txt) { if (selBtn) selBtn.hidden = true; return; }
    var s = window.getSelection(), r = s.getRangeAt(0).getBoundingClientRect();
    if (!r || (!r.width && !r.height)) return;
    if (!selBtn) {
      selBtn = document.createElement("button");
      selBtn.type = "button";
      selBtn.className = "ax-selbtn";
      selBtn.addEventListener("mousedown", function (e) { e.preventDefault(); });
      selBtn.addEventListener("click", function () { var tx = selectionText(); stopReading(); if (tx) speak(tx); selBtn.hidden = true; });
      document.body.appendChild(selBtn);
    }
    selBtn.innerHTML = icon("headphones") + "<span>" + esc(t("ax.listenSel")) + "</span>";
    selBtn.hidden = false;
    var top = r.top - 46; if (top < 70) top = r.bottom + 10;
    selBtn.style.top = Math.round(top) + "px";
    selBtn.style.left = Math.round(Math.min(window.innerWidth - 130, Math.max(10, r.left + r.width / 2 - 55))) + "px";
  }

  // Read-aloud buttons next to each main paragraph (when the setting is on).
  function addParaButtons() {
    document.querySelectorAll(".ax-para-btn").forEach(function (b) { b.remove(); });
    if (!root.classList.contains("a11y-tts")) return;
    var main = document.getElementById("main");
    if (!main) return;
    main.querySelectorAll(".fact-body, .lead, .chapter-body > p, .section-head p, .card > p, .prose p").forEach(function (p) {
      if (!readable(p) || p.querySelector(".ax-para-btn")) return;
      var b = document.createElement("button");
      b.type = "button"; b.className = "ax-para-btn";
      b.setAttribute("aria-label", t("ax.listenPara"));
      b.innerHTML = icon("headphones");
      b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); readPage(p); });
      p.appendChild(b);
    });
  }

  /* ----------------------------------------------------------- hard words */

  var gloss = null;      // loaded data
  var glossLoading = null;
  var pop = null, popFor = null;
  var observing = null, busy = false, refreshTimer = 0;

  var SKIP = "h1, h2, h3, h4, a, button, label, input, textarea, select, option, nav, header, footer, code, kbd, svg, " +
    ".gloss, .gloss-pop, .fact-quiz, .quiz-q, .quiz-option, .chip, .btn, .review-badge, .crumbs, .ax-drawer, .toasts, [data-no-gloss], [aria-hidden='true'], .sr-only, .stroop-word, .stage";
  var ALLOW = "p, li, figcaption, dd, td, blockquote, .fact-body";

  function loadGlossary() {
    if (gloss) return Promise.resolve(gloss);
    if (!glossLoading) {
      glossLoading = M.loadJSON("data/glossary.json", { terms: [] }).then(function (d) { gloss = (d && d.terms) || []; return gloss; });
    }
    return glossLoading;
  }
  function termById(id) { return (gloss || []).filter(function (g) { return g.id === id; })[0]; }
  window.MedullaGlossary = { load: loadGlossary, term: termById };

  function buildMatcher(skipIds) {
    var lang = M.lang(), stems = [], owner = {};
    (gloss || []).forEach(function (g) {
      if (skipIds[g.id]) return;
      ((g.match && g.match[lang]) || []).forEach(function (s) {
        // "=word" matches only the whole word (no endings), e.g. "=rem" must not match "remember".
        var exact = s.charAt(0) === "=", k = (exact ? s.slice(1) : s).toLowerCase();
        owner[k] = { id: g.id, exact: exact }; stems.push(k);
      });
    });
    if (!stems.length) return null;
    stems.sort(function (a, b) { return b.length - a.length; });
    var escd = stems.map(function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); });
    try {
      return { re: new RegExp("(^|[^\\p{L}\\p{N}])(" + escd.join("|") + ")(\\p{L}*)", "iu"), owner: owner };
    } catch (e) { return null; }
  }

  function markGlossary() {
    var main = document.getElementById("main");
    if (!main || !gloss || root.classList.contains("a11y-noglossary")) return;
    busy = true;
    var seen = {};
    main.querySelectorAll(".gloss").forEach(function (b) { seen[b.getAttribute("data-term")] = 1; });
    var m = buildMatcher(seen);
    if (m) {
      var walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          if (!n.nodeValue || n.nodeValue.length < 3) return NodeFilter.FILTER_REJECT;
          var p = n.parentElement;
          if (!p || p.closest(SKIP) || !p.closest(ALLOW)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var nodes = [], n;
      while ((n = walker.nextNode())) nodes.push(n);
      nodes.forEach(function (node) {
        var guard = 0;
        while (node && guard++ < 6) {
          var hit = m.re.exec(node.nodeValue);
          if (!hit) break;
          var own = m.owner[hit[2].toLowerCase()], id = own && own.id;
          if (!id || seen[id] || (own.exact && hit[3])) { // already explained earlier on this page: skip this word
            var cut = hit.index + hit[0].length;
            node = node.splitText(cut);
            continue;
          }
          seen[id] = 1;
          var start = hit.index + hit[1].length, word = hit[2] + hit[3];
          var after = node.splitText(start);
          var rest = after.splitText(word.length);
          var b = document.createElement("button");
          b.type = "button"; b.className = "gloss"; b.setAttribute("data-term", id);
          b.setAttribute("aria-expanded", "false");
          b.setAttribute("aria-controls", "gloss-pop");
          b.textContent = word;
          b.title = t("gloss.hint");
          after.parentNode.replaceChild(b, after);
          node = rest;
          m = buildMatcher(seen);
          if (!m) break;
        }
      });
    }
    busy = false;
  }
  function unmarkGlossary() {
    busy = true;
    document.querySelectorAll("#main .gloss").forEach(function (b) {
      var tx = document.createTextNode(b.textContent);
      b.parentNode.replaceChild(tx, b);
      tx.parentNode.normalize();
    });
    busy = false;
    closePop();
  }
  function glossaryRefresh(langChanged) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function () {
      addParaButtons();
      if (root.classList.contains("a11y-noglossary")) { unmarkGlossary(); return; }
      if (langChanged) unmarkGlossary();
      loadGlossary().then(markGlossary);
    }, langChanged ? 60 : 250);
  }
  function observe() {
    var main = document.getElementById("main");
    if (!main || observing || !("MutationObserver" in window)) return;
    observing = new MutationObserver(function (list) {
      if (busy) return;
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        if (r.target && r.target.closest && r.target.closest(".gloss, .ax-para-btn")) continue;
        var relevant = false;
        r.addedNodes.forEach(function (n) { if (!(n.nodeType === 1 && (n.classList.contains("gloss") || n.classList.contains("ax-para-btn")))) relevant = true; });
        if (relevant || r.type === "characterData") { glossaryRefresh(false); return; }
      }
    });
    observing.observe(main, { childList: true, subtree: true, characterData: true });
  }

  function ensurePop() {
    if (pop) return pop;
    pop = document.createElement("div");
    pop.className = "gloss-pop";
    pop.id = "gloss-pop";
    pop.setAttribute("role", "status");
    pop.hidden = true;
    document.body.appendChild(pop);
    pop.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      if (b.hasAttribute("data-gp-close")) { var f = popFor; closePop(); if (f) f.focus(); }
      if (b.hasAttribute("data-gp-listen")) { var g = termById(b.getAttribute("data-gp-listen")); if (g) { stopReading(); speak(M.localized(g.term) + ". " + M.localized(g.def)); } }
    });
    return pop;
  }
  function openPop(btn) {
    var g = termById(btn.getAttribute("data-term"));
    if (!g) return;
    ensurePop();
    if (popFor && popFor !== btn) popFor.setAttribute("aria-expanded", "false");
    popFor = btn;
    btn.setAttribute("aria-expanded", "true");
    pop.innerHTML = '<div class="gp-head"><span class="gp-icon" aria-hidden="true">' + icon("bulb") + '</span><p class="gp-term">' + esc(M.localized(g.term) || "") + "</p>" +
        '<button type="button" class="gp-x" data-gp-close aria-label="' + esc(t("gloss.close")) + '">' + icon("close") + "</button></div>" +
      '<p class="gp-def">' + esc(M.localized(g.def) || "") + "</p>" +
      '<div class="gp-actions"><button type="button" class="btn btn-ghost btn-sm" data-gp-listen="' + esc(g.id) + '">' + icon("headphones") + "<span>" + esc(t("gloss.listen")) + "</span></button>" +
        '<a class="text-link" href="' + M.root() + "glossary.html#" + esc(g.id) + '">' + esc(t("gloss.all")) + icon("arrow", "icon-sm") + "</a></div>" +
      (g.reviewed ? "" : '<p class="gp-note">' + icon("clock") + "<span>" + esc(t("common.pendingReview")) + "</span></p>");
    pop.hidden = false;
    placePop();
  }
  function placePop() {
    if (!pop || pop.hidden || !popFor) return;
    var r = popFor.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    var left = Math.min(window.innerWidth - w - 12, Math.max(12, r.left + r.width / 2 - w / 2));
    var below = r.bottom + 10, above = r.top - h - 10;
    var top = below + h < window.innerHeight - 8 || above < 70 ? below : above;
    pop.style.left = Math.round(left) + "px";
    pop.style.top = Math.round(top) + "px";
    pop.style.setProperty("--arrow", Math.round(r.left + r.width / 2 - left) + "px");
    pop.classList.toggle("is-above", top === above);
  }
  function closePop() {
    if (!pop || pop.hidden) return;
    pop.hidden = true;
    if (popFor) popFor.setAttribute("aria-expanded", "false");
    popFor = null;
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".gloss");
    if (b) { e.preventDefault(); if (popFor === b) closePop(); else openPop(b); return; }
    if (pop && !pop.hidden && !e.target.closest(".gloss-pop")) closePop();
    if (selBtn && !e.target.closest(".ax-selbtn") && !selectionText()) selBtn.hidden = true;
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (drawer && !drawer.hidden) { close(); return; }
    if (pop && !pop.hidden) { var f = popFor; closePop(); if (f) f.focus(); }
    else if (reading) stopReading();
  });
  window.addEventListener("scroll", function () { placePop(); if (selBtn) selBtn.hidden = true; }, { passive: true });
  window.addEventListener("resize", placePop);
  window.addEventListener("pagehide", stopReading);

  /* ---------------------------------------------------------------- start */

  window.MedullaAccess = { open: open, close: close, toggle: toggle, speak: speak, stop: stopReading, readPage: readPage, profiles: PROFILES, profileOn: profileOn };

  M.ready(function () {
    syncRuler();
    observe();
    glossaryRefresh(false);
    // Deep link: accessibility.html?profile=focus or #a11y opens the panel.
    var q = new URLSearchParams(location.search);
    if (location.hash === "#a11y") open(document.getElementById("display-toggle"));
    if (q.get("profile")) {
      var p = PROFILES.filter(function (x) { return x.id === q.get("profile"); })[0];
      if (p && !profileOn(p, P.a11y())) P.setA11y(p.set);
    }
  });
})();
