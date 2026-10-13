/*
 * Medulla motion: no libraries (RESEARCH.md §3). CSS does most of the work;
 * this file adds the hero neural-pathway canvas, parallax, scroll reveals, chapter
 * progress, tilt cards and celebration bursts.
 *
 * Comfort rules:
 *  - prefers-reduced-motion or the in-page "calm mode" (html.calm) → static
 *    frames or simple fades, no canvas animation, no parallax, no tilt.
 *  - Everything pauses when the tab is hidden or the element is off-screen.
 *  - Nothing flashes more than 3 times per second.
 */
(function () {
  "use strict";

  var root = document.documentElement;
  var rm = window.matchMedia("(prefers-reduced-motion: reduce)");

  function motionOK() { return !rm.matches && !root.classList.contains("calm"); }

  // Pause CSS animations while the tab is hidden.
  document.addEventListener("visibilitychange", function () {
    root.classList.toggle("tab-hidden", document.hidden);
  });

  // Cross-document View Transitions do the page change where supported;
  // elsewhere the body fades in (see .no-vt in CSS).
  if (!("onpagereveal" in window)) root.classList.add("no-vt");

  /* ------------------------------------------------- off-screen pausing */

  var pauseIO = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { e.target.classList.toggle("offscreen", !e.isIntersecting); });
    syncSmil();
  }, { rootMargin: "120px" }) : null;

  // SVG (SMIL) animations follow the same rules as CSS ones: paused in calm
  // mode, with reduced motion, off-screen and in a hidden tab.
  function syncSmil() {
    document.querySelectorAll("svg[data-smil]").forEach(function (svg) {
      var host = svg.closest("[data-anim-root]");
      var stop = !motionOK() || document.hidden || (host && host.classList.contains("offscreen"));
      if (stop) { if (svg.pauseAnimations) svg.pauseAnimations(); }
      else if (svg.unpauseAnimations) svg.unpauseAnimations();
    });
  }
  document.addEventListener("visibilitychange", syncSmil);
  document.addEventListener("medulla:calm", syncSmil);
  rm.addEventListener && rm.addEventListener("change", syncSmil);

  /* ------------------------------------------------------ scroll reveal */

  var revealIO = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("is-in"); revealIO.unobserve(e.target); }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }) : null;

  function initReveals(scope) {
    (scope || document).querySelectorAll("[data-reveal]").forEach(function (el) {
      if (!revealIO || !motionOK()) { el.classList.add("is-in"); return; }
      revealIO.observe(el);
    });
    (scope || document).querySelectorAll("[data-anim-root]").forEach(function (el) { if (pauseIO) pauseIO.observe(el); });
  }

  /* ----------------------------------------------------------- parallax */

  var parallaxEls = [];
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      if (!motionOK()) return;
      var vh = window.innerHeight;
      parallaxEls.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        var f = parseFloat(el.getAttribute("data-parallax")) || 0.1;
        var center = r.top + r.height / 2 - vh / 2;
        el.style.setProperty("--py", (-center * f).toFixed(1) + "px");
      });
      updateChapters();
    });
  }

  /* ------------------------------------------------ story chapter dots */

  var story = null, chapters = [], dots = [];

  function initStory() {
    story = document.querySelector("[data-story]");
    if (!story) return;
    chapters = Array.prototype.slice.call(story.querySelectorAll("[data-chapter]"));
    var nav = document.querySelector("[data-story-nav]");
    if (nav) dots = Array.prototype.slice.call(nav.querySelectorAll("a"));
    updateChapters();
  }

  function updateChapters() {
    if (!story) return;
    var r = story.getBoundingClientRect();
    var vh = window.innerHeight;
    var p = Math.min(1, Math.max(0, (vh * 0.5 - r.top) / r.height));
    story.style.setProperty("--story-p", p.toFixed(3));
    var nav = document.querySelector("[data-story-nav]");
    if (nav) nav.classList.toggle("is-visible", r.top < vh * 0.6 && r.bottom > vh * 0.4);
    var active = 0;
    chapters.forEach(function (c, i) { if (c.getBoundingClientRect().top < vh * 0.55) active = i; });
    dots.forEach(function (d, i) {
      if (i === active) d.setAttribute("aria-current", "step"); else d.removeAttribute("aria-current");
    });
  }

  /* --------------------------------------------------------------- tilt */

  function initTilt(scope) {
    (scope || document).querySelectorAll("[data-tilt]").forEach(function (el) {
      if (el.__tilt) return;
      el.__tilt = true;
      el.addEventListener("pointermove", function (e) {
        if (!motionOK()) return;
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty("--rx", (-y * 7).toFixed(2) + "deg");
        el.style.setProperty("--ry", (x * 7).toFixed(2) + "deg");
        el.style.setProperty("--gx", ((x + 0.5) * 100).toFixed(0) + "%");
        el.style.setProperty("--gy", ((y + 0.5) * 100).toFixed(0) + "%");
        el.classList.add("is-tilting");
      });
      el.addEventListener("pointerleave", function () {
        el.style.setProperty("--rx", "0deg");
        el.style.setProperty("--ry", "0deg");
        el.classList.remove("is-tilting");
      });
    });
  }

  /* ------------------------------------------------ hero neural pathways */

  // A few smooth "axon bundles" sweep in from the edges and end at the brain,
  // like pathways converging on it. They draw themselves in as the page loads
  // and as the visitor scrolls; soft signals travel along them towards the
  // brain (faster near the pointer) and light up the end terminal they reach.
  // Two slow orbit rings frame the brain. Calm mode: one still frame.
  function neuronField(canvas, opts) {
    opts = opts || {};
    var g = canvas.getContext("2d");
    if (!g) return null;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, T = { x: 0, y: 0, r: 100 }, paths = [], pulses = [], pointer = null;
    var growth = 0, running = false, raf = 0, visible = true, last = 0, clock = 0;

    function target() {
      var el = opts.target && document.querySelector(opts.target), c = canvas.getBoundingClientRect();
      if (el) {
        var r = el.getBoundingClientRect();
        if (r.width) return { x: r.left - c.left + r.width / 2, y: r.top - c.top + r.height * 0.47, r: Math.min(r.width, r.height) * 0.42 };
      }
      return { x: W * (opts.cx || 0.5), y: H * (opts.cy || 0.5), r: Math.min(W, H) * 0.22 };
    }

    // Sample a cubic Bézier into a polyline with cumulative lengths.
    function bez(p0, p1, p2, p3, n) {
      var pts = [], len = 0;
      for (var i = 0; i <= n; i++) {
        var t = i / n, u = 1 - t;
        var x = u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x;
        var y = u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y;
        if (i) len += Math.hypot(x - pts[i - 1].x, y - pts[i - 1].y);
        pts.push({ x: x, y: y, d: len });
      }
      return { pts: pts, len: len };
    }
    function at(p, f) { // point at fraction f of a path's length
      var want = f * p.len, pts = p.pts, i = 1;
      while (i < pts.length - 1 && pts[i].d < want) i++;
      var a = pts[i - 1], b = pts[i], k = (want - a.d) / ((b.d - a.d) || 1);
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }

    function build() {
      var r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      T = target();
      var wide = W > 860;
      // start points around the edges (fractions of the hero), ordered so the
      // bundles fan in without crossing the headline on wide screens
      var starts = wide
        ? [[-0.02, 0.86], [0.18, 1.04], [0.4, 1.06], [0.62, 1.05], [1.03, 0.92], [1.03, 0.62], [1.02, 0.2], [0.82, -0.04], [0.56, -0.05]]
        : [[-0.04, 0.7], [-0.04, 0.94], [0.3, 1.03], [0.7, 1.03], [1.04, 0.93], [1.04, 0.68]]; // phones: the brain sits low, keep the headline clear
      paths = starts.map(function (s, i) {
        var S = { x: s[0] * W, y: s[1] * H };
        var a = Math.atan2(S.y - T.y, S.x - T.x);                 // direction from the brain to the start
        var E = { x: T.x + Math.cos(a) * T.r, y: T.y + Math.sin(a) * T.r };
        var bend = (i % 2 ? 1 : -1) * Math.min(W, H) * 0.12;      // alternate the S-curve
        var nx = -Math.sin(a), ny = Math.cos(a);
        var C1 = { x: S.x + (E.x - S.x) * 0.35 + nx * bend, y: S.y + (E.y - S.y) * 0.35 + ny * bend };
        var C2 = { x: E.x + Math.cos(a) * T.r * 0.9 - nx * bend * 0.5, y: E.y + Math.sin(a) * T.r * 0.9 - ny * bend * 0.5 };
        var p = bez(S, C1, C2, E, 60);
        p.end = E; p.flash = 0; p.delay = i * 0.09; p.width = 1.1 + (i % 3) * 0.35;
        // a short "myelin" segment pattern on every third path
        p.myelin = i % 3 === 1;
        return p;
      });
      pulses = [];
    }

    function colors() {
      var dark = root.getAttribute("data-theme") === "dark";
      return dark ? { line: "162,155,254", lineA: 0.5, node: "#C9C4FF", ring: "162,155,254" }
        : { line: "108,92,231", lineA: 0.32, node: "#8C7FF2", ring: "108,92,231" };
    }

    function step(dt) {
      clock += dt;
      var r = canvas.getBoundingClientRect();
      var scrollGrow = Math.min(1, Math.max(0, -r.top / (r.height * 0.6)));
      var want = Math.min(1, 0.15 + clock * 0.55 + scrollGrow);
      growth += (want - growth) * Math.min(1, dt * 2.2);
      var rate = pointer ? 3.2 : 1.6; // signals per second
      if (growth > 0.95 && Math.random() < dt * rate) {
        var p = paths[Math.floor(Math.random() * paths.length)];
        var near = pointer ? Math.hypot(pointer.x - p.pts[30].x, pointer.y - p.pts[30].y) < 220 : false;
        pulses.push({ p: p, t: 0, speed: (near ? 0.75 : 0.42) + Math.random() * 0.25, warm: Math.random() < 0.55 });
      }
      pulses = pulses.filter(function (s) {
        s.t += dt * s.speed;
        if (s.t >= 1) { s.p.flash = 1; return false; }
        return true;
      });
      paths.forEach(function (p) { p.flash = Math.max(0, p.flash - dt * 1.6); });
    }

    function draw() {
      var C = colors();
      g.clearRect(0, 0, W, H);
      g.lineCap = "round"; g.lineJoin = "round";
      // orbit rings
      [1.32, 1.62].forEach(function (k, i) {
        g.save();
        g.translate(T.x, T.y);
        g.rotate((i ? -1 : 1) * clock * 0.04 + i);
        g.strokeStyle = "rgba(" + C.ring + "," + (0.16 * growth).toFixed(3) + ")";
        g.lineWidth = 1;
        g.setLineDash(i ? [2, 7] : [14, 10]);
        g.beginPath(); g.ellipse(0, 0, T.r * k, T.r * k * 0.86, 0, 0, Math.PI * 2); g.stroke();
        g.restore();
      });
      g.setLineDash([]);
      paths.forEach(function (p) {
        var f = Math.max(0, Math.min(1, (growth - p.delay) / (1 - p.delay)));
        if (f <= 0) return;
        var S = p.pts[0], E = p.end;
        var grad = g.createLinearGradient(S.x, S.y, E.x, E.y);
        grad.addColorStop(0, "rgba(" + C.line + ",0)");
        grad.addColorStop(0.55, "rgba(" + C.line + "," + (C.lineA * 0.7).toFixed(3) + ")");
        grad.addColorStop(1, "rgba(" + C.line + "," + C.lineA + ")");
        g.strokeStyle = grad;
        g.lineWidth = p.width;
        g.beginPath();
        var n = Math.round((p.pts.length - 1) * f);
        g.moveTo(S.x, S.y);
        for (var i = 1; i <= n; i++) g.lineTo(p.pts[i].x, p.pts[i].y);
        g.stroke();
        if (p.myelin && f > 0.98) { // soft sheaths along the middle of the path
          g.lineWidth = p.width + 3.2;
          g.strokeStyle = "rgba(" + C.line + "," + (C.lineA * 0.35).toFixed(3) + ")";
          for (var m = 0.42; m < 0.86; m += 0.11) {
            var a = at(p, m), b = at(p, m + 0.07);
            g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
          }
        }
        if (f > 0.98) { // end terminal, flashes when a signal arrives
          g.fillStyle = C.node;
          g.globalAlpha = 0.85;
          g.beginPath(); g.arc(E.x, E.y, 2.6 + p.flash * 1.6, 0, Math.PI * 2); g.fill();
          if (p.flash > 0) {
            g.globalAlpha = p.flash * 0.5;
            g.strokeStyle = "#FF9F43"; g.lineWidth = 1.4;
            g.beginPath(); g.arc(E.x, E.y, 4 + (1 - p.flash) * 12, 0, Math.PI * 2); g.stroke();
          }
          g.globalAlpha = 1;
        }
      });
      // signals: a bright head with a fading tail
      pulses.forEach(function (s) {
        var col = s.warm ? "255,159,67" : "162,155,254";
        for (var k = 0; k < 6; k++) {
          var tt = s.t - k * 0.012;
          if (tt < 0) break;
          var q = at(s.p, tt);
          g.fillStyle = "rgba(" + col + "," + (0.55 * (1 - k / 6)).toFixed(3) + ")";
          g.beginPath(); g.arc(q.x, q.y, 2.4 - k * 0.25, 0, Math.PI * 2); g.fill();
        }
        var h = at(s.p, s.t);
        var glow = g.createRadialGradient(h.x, h.y, 0, h.x, h.y, 9);
        glow.addColorStop(0, "rgba(" + col + ",0.9)"); glow.addColorStop(1, "rgba(" + col + ",0)");
        g.fillStyle = glow; g.beginPath(); g.arc(h.x, h.y, 9, 0, Math.PI * 2); g.fill();
      });
    }

    function frame(now) {
      if (!running) return;
      var dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      step(dt);
      draw();
      raf = requestAnimationFrame(frame);
    }
    function start() {
      if (running || !visible || document.hidden || !motionOK()) return;
      running = true; last = 0;
      raf = requestAnimationFrame(frame);
    }
    function stop() { running = false; cancelAnimationFrame(raf); }
    function still() { stop(); growth = 1; pulses = []; draw(); }
    function refresh() { build(); if (motionOK()) start(); else still(); }

    build();
    if (motionOK()) start(); else still();

    var host = opts.pointerHost || canvas;
    host.addEventListener("pointermove", function (e) {
      var r = canvas.getBoundingClientRect();
      pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    host.addEventListener("pointerleave", function () { pointer = null; });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible) start(); else stop();
      }).observe(canvas);
    }
    document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });
    var rt = 0;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(refresh, 200); });
    window.addEventListener("load", refresh);
    document.addEventListener("medulla:calm", refresh);
    new MutationObserver(function () { if (!running) draw(); }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    rm.addEventListener && rm.addEventListener("change", refresh);
    return { refresh: refresh };
  }

  /* ------------------------------------------------------------- bursts */

  // A short, soft sparkle/confetti burst (≈1.2 s). Calm mode: a single fade.
  var burstCanvas = null;
  function burst(x, y, o) {
    o = o || {};
    if (!motionOK()) return;
    if (!burstCanvas) {
      burstCanvas = document.createElement("canvas");
      burstCanvas.className = "burst-layer";
      burstCanvas.setAttribute("aria-hidden", "true");
      document.body.appendChild(burstCanvas);
    }
    var c = burstCanvas, dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    var g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var colors = ["#6C5CE7", "#A29BFE", "#FF9F43", "#FFFFFF"];
    var parts = [];
    var n = o.count || 46;
    if (x === undefined) { x = innerWidth / 2; y = innerHeight / 3; }
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = 2.5 + Math.random() * 5.5;
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3, s: 3 + Math.random() * 4,
        c: colors[i % colors.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, star: i % 3 === 0 });
    }
    var t0 = performance.now();
    function tick(now) {
      var t = (now - t0) / 1200;
      g.clearRect(0, 0, innerWidth, innerHeight);
      if (t >= 1) return;
      parts.forEach(function (p) {
        p.vy += 0.18; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        g.save(); g.globalAlpha = 1 - t; g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.c;
        if (p.star) { g.beginPath(); for (var k = 0; k < 4; k++) { g.rotate(Math.PI / 2); g.moveTo(0, 0); g.lineTo(p.s * 0.5, p.s * 1.6); g.lineTo(-p.s * 0.5, p.s * 1.6); } g.fill(); }
        else g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        g.restore();
      });
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* --------------------------------------------------------------- init */

  function init() {
    parallaxEls = Array.prototype.slice.call(document.querySelectorAll("[data-parallax]"));
    initReveals();
    initTilt();
    initStory();
    syncSmil();
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  window.MedullaMotion = {
    ok: motionOK,
    init: init,
    initReveals: initReveals,
    initTilt: initTilt,
    neuronField: neuronField,
    burst: burst
  };
})();
