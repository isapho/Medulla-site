/*
 * Medulla motion: no libraries (RESEARCH.md §3). CSS does most of the work;
 * this file adds the hero neuron canvas, parallax, scroll reveals, chapter
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
  }, { rootMargin: "120px" }) : null;

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

  /* ------------------------------------------------ hero neuron network */

  // A field of neurons that "grows" outward from the centre as the visitor
  // moves the pointer or scrolls; small signals travel along grown links.
  function neuronField(canvas, opts) {
    opts = opts || {};
    var ctx2d = canvas.getContext("2d");
    if (!ctx2d) return null;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, nodes = [], links = [], signals = [];
    var growth = 0.18, pointer = null, running = false, raf = 0, visible = true, last = 0;
    var COLORS = { line: "162,155,254", node: "#A29BFE", core: "#FF9F43", signal: "#6C5CE7" };

    function build() {
      var r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = Math.round(Math.min(70, Math.max(26, (W * H) / 9000)));
      var cx = W * (opts.cx || 0.5), cy = H * (opts.cy || 0.5);
      var seed = 7;
      function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; } // stable layout
      nodes = [];
      for (var i = 0; i < count; i++) {
        var a = rnd() * Math.PI * 2, d = Math.pow(rnd(), 0.75);
        var x = cx + Math.cos(a) * d * W * 0.55, y = cy + Math.sin(a) * d * H * 0.6;
        nodes.push({ x: x, y: y, r: 1.4 + rnd() * 2.2, dist: Math.hypot(x - cx, y - cy) / Math.hypot(W, H) * 1.6, g: 0, core: rnd() < 0.18, ph: rnd() * 6.28 });
      }
      links = [];
      nodes.forEach(function (n, i) {
        var near = nodes.map(function (m, j) { return { j: j, d: Math.hypot(m.x - n.x, m.y - n.y) }; })
          .filter(function (o) { return o.j !== i; }).sort(function (a, b) { return a.d - b.d; }).slice(0, 3);
        near.forEach(function (o) { if (o.j > i || near.length < 2) links.push({ a: i, b: o.j, len: o.d, g: 0 }); });
      });
    }

    function step(dt) {
      // growth target from scroll position within the hero
      var r = canvas.getBoundingClientRect();
      var scrollGrow = Math.min(1, Math.max(0, -r.top / (r.height * 0.8)));
      var target = Math.max(growth, 0.35 + scrollGrow * 0.65);
      growth += (target - growth) * Math.min(1, dt * 1.6);
      nodes.forEach(function (n) {
        var near = pointer ? Math.hypot(pointer.x - n.x, pointer.y - n.y) < 140 : false;
        var want = n.dist < growth || near ? 1 : 0;
        n.g += (want - n.g) * Math.min(1, dt * (want ? 2.4 : 0.4));
      });
      links.forEach(function (l) {
        var want = Math.min(nodes[l.a].g, nodes[l.b].g);
        l.g += (want - l.g) * Math.min(1, dt * 1.8);
      });
      // spawn signals along grown links (a few per second)
      if (Math.random() < dt * (pointer ? 9 : 4)) {
        var grown = links.filter(function (l) { return l.g > 0.9; });
        if (grown.length) {
          var l = grown[Math.floor(Math.random() * grown.length)];
          signals.push({ l: l, t: 0, dir: Math.random() < 0.5 ? 1 : -1, speed: 0.6 + Math.random() * 0.8 });
        }
      }
      signals = signals.filter(function (s) { s.t += dt * s.speed; return s.t < 1; });
    }

    function draw(time) {
      ctx2d.clearRect(0, 0, W, H);
      ctx2d.lineCap = "round";
      links.forEach(function (l) {
        if (l.g < 0.02) return;
        var a = nodes[l.a], b = nodes[l.b];
        ctx2d.strokeStyle = "rgba(" + COLORS.line + "," + (0.38 * l.g).toFixed(3) + ")";
        ctx2d.lineWidth = 1.2;
        ctx2d.beginPath();
        ctx2d.moveTo(a.x, a.y);
        ctx2d.lineTo(a.x + (b.x - a.x) * l.g, a.y + (b.y - a.y) * l.g);
        ctx2d.stroke();
      });
      nodes.forEach(function (n) {
        if (n.g < 0.02) return;
        var pulse = 1 + Math.sin(time / 900 + n.ph) * 0.12;
        ctx2d.globalAlpha = n.g;
        ctx2d.fillStyle = n.core ? COLORS.core : COLORS.node;
        ctx2d.beginPath();
        ctx2d.arc(n.x, n.y, n.r * pulse * n.g, 0, Math.PI * 2);
        ctx2d.fill();
      });
      ctx2d.globalAlpha = 1;
      signals.forEach(function (s) {
        var a = nodes[s.l.a], b = nodes[s.l.b];
        var t = s.dir > 0 ? s.t : 1 - s.t;
        var x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
        var grd = ctx2d.createRadialGradient(x, y, 0, x, y, 7);
        grd.addColorStop(0, "rgba(255,159,67,0.95)");
        grd.addColorStop(1, "rgba(255,159,67,0)");
        ctx2d.fillStyle = grd;
        ctx2d.beginPath(); ctx2d.arc(x, y, 7, 0, Math.PI * 2); ctx2d.fill();
      });
    }

    function frame(now) {
      if (!running) return;
      var dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      step(dt);
      draw(now);
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running || !visible || document.hidden || !motionOK()) return;
      running = true; last = 0;
      raf = requestAnimationFrame(frame);
    }
    function stop() { running = false; cancelAnimationFrame(raf); }

    // Calm / reduced motion: one still, fully grown frame.
    function still() {
      stop();
      nodes.forEach(function (n) { n.g = 1; });
      links.forEach(function (l) { l.g = 1; });
      signals = [];
      draw(0);
    }

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
    document.addEventListener("medulla:calm", refresh);
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
