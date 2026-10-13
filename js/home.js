/*
 * Landing page: hero neuron network, pointer parallax, the story chapters'
 * small demos (flip card with today's fact, pupil-and-light explainer).
 */
Medulla.ready(function () {
  "use strict";

  var M = window.Medulla, Mo = window.MedullaMotion, S = window.MedullaSound;

  /* hero neuron network: grows with pointer movement and scrolling */
  var hero = document.querySelector(".hero");
  var canvas = document.getElementById("hero-canvas");
  if (canvas && Mo) Mo.neuronField(canvas, { cx: 0.72, cy: 0.42, target: ".hero-brain", pointerHost: hero });

  /* pointer parallax between the hero layers */
  var layers = hero ? Array.prototype.slice.call(hero.querySelectorAll("[data-depth]")) : [];
  if (hero && layers.length) {
    hero.addEventListener("pointermove", function (e) {
      if (!Mo.ok() || e.pointerType === "touch") return;
      var r = hero.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      layers.forEach(function (l) {
        var d = parseFloat(l.getAttribute("data-depth")) || 0.02;
        l.style.setProperty("--hx", (-x * d * 100).toFixed(1) + "px");
        l.style.setProperty("--hy", (-y * d * 100).toFixed(1) + "px");
      });
    });
    hero.addEventListener("pointerleave", function () { layers.forEach(function (l) { l.style.setProperty("--hx", "0px"); l.style.setProperty("--hy", "0px"); }); });
  }

  /* Memo chapter: flip card with today's fact */
  var flip = document.getElementById("story-flip");
  function drawFlip() {
    if (!flip) return;
    M.loadFacts().then(function (facts) {
      var f = facts[M.todayIndex(facts.length)], who = M.factChar(f);
      flip.innerHTML = '<div class="flip-inner">' +
        '<button type="button" class="flip-face flip-front press" aria-expanded="false"><span class="chip">' + M.esc(M.topicName(f)) + "</span>" +
          "<h3>" + M.esc(M.localized(f.title)) + '</h3><span class="flip-hint">' + M.icon("refresh") + M.esc(M.t("daily.flip")) + "</span>" + M.poseImg(who, "curious", "idle idle-" + who) + "</button>" +
        '<div class="flip-face flip-back" inert><span class="chip">' + M.esc(M.topicName(f)) + "</span><h3>" + M.esc(M.localized(f.title)) + "</h3>" +
          '<p class="fact-text">' + M.esc(M.localized(f.simple)) + "</p>" + M.sourceLine(f) +
          '<div class="btn-row"><a class="text-link" href="' + M.factUrl(f) + '">' + M.esc(M.t("daily.readMore")) + M.icon("arrow", "icon-sm") + "</a></div></div></div>";
      var btn = flip.querySelector(".flip-front");
      btn.addEventListener("click", function () {
        flip.classList.add("is-flipped");
        btn.setAttribute("aria-expanded", "true");
        btn.setAttribute("tabindex", "-1");
        flip.querySelector(".flip-back").removeAttribute("inert");
        var link = flip.querySelector(".flip-back a"); if (link) link.focus({ preventScroll: true });
        S.tap();
        M.readFact(f);
      });
    });
  }
  drawFlip();
  M.onLangChange(drawFlip);

  /* Lumi chapter: the pupil answers the light slider */
  var range = document.getElementById("pupil-range"), eye = document.getElementById("pupil-eye"), hole = document.getElementById("pupil-hole");
  if (range && eye && hole) {
    var update = function () {
      var v = range.value / 100;
      eye.style.setProperty("--light", v);
      hole.setAttribute("r", (27 - v * 18).toFixed(1));
      range.setAttribute("aria-valuetext", M.t(v < 0.34 ? "explain.pupil.dark" : v < 0.67 ? "explain.pupil.mid" : "explain.pupil.bright"));
    };
    range.addEventListener("input", update);
    M.onLangChange(update);
    update();
  }
});
