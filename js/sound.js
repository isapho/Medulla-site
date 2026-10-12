/*
 * Medulla sound: every sound is synthesized with the Web Audio API, so there
 * are no audio files and no licences to track (see CREDITS.md).
 *
 * Rules (RESEARCH.md §4):
 *  - OFF by default. Only the visitor turns it on; the choice is remembered.
 *  - The AudioContext is created inside that click (browser autoplay rules).
 *  - Quiet: master volume ~15 %. Nothing ever autoplays.
 *  - Every sound has a visual equivalent in the UI (toasts, colours, text).
 */
(function () {
  "use strict";

  var prefs = window.MedullaPrefs;
  var KEY = "medulla.sound";
  var enabled = prefs && prefs.get(KEY) === "1";
  var ctx = null, master = null, ambience = null;

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.15;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // One soft note with an attack/decay envelope.
  function note(freq, dur, o) {
    o = o || {};
    if (!enabled || !ensure()) return;
    var t0 = ctx.currentTime + (o.delay || 0);
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.4, t0 + (o.attack || 0.012));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  var api = {
    isOn: function () { return enabled; },
    supported: function () { return !!(window.AudioContext || window.webkitAudioContext); },
    // Must be called from a click/keypress handler.
    setEnabled: function (on) {
      enabled = !!on;
      if (prefs) prefs.set(KEY, enabled ? "1" : null);
      if (enabled) { ensure(); api.tap(); }
      else api.ambienceStop();
      document.dispatchEvent(new CustomEvent("medulla:sound", { detail: { on: enabled } }));
    },
    tap: function () { note(660, 0.06, { type: "triangle", vol: 0.22 }); },
    correct: function () { note(523.25, 0.14, { vol: 0.35 }); note(783.99, 0.22, { delay: 0.1, vol: 0.35 }); },
    wrong: function () { note(246.94, 0.22, { type: "triangle", to: 196, vol: 0.3 }); },
    badge: function () {
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { note(f, 0.28, { delay: i * 0.09, vol: 0.3 }); });
    },
    streak: function () {
      [392, 523.25, 659.25].forEach(function (f, i) { note(f, 0.22, { delay: i * 0.08, vol: 0.28, type: "triangle" }); });
    },
    // A slow rising (in) or falling (out) tone that lasts the whole breath.
    breath: function (dir, seconds) {
      if (!enabled || !ensure()) return;
      var up = dir === "in";
      note(up ? 196 : 261.63, seconds, { to: up ? 261.63 : 196, vol: 0.16, attack: Math.min(1.2, seconds / 3) });
    },
    // Very quiet "night air": filtered noise with a slow swell. Sleep mode only.
    ambienceStart: function () {
      if (!enabled || !ensure() || ambience) return;
      var len = ctx.sampleRate * 4;
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0), last = 0;
      for (var i = 0; i < len; i++) { // brown noise
        var white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
      var src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 380;
      var g = ctx.createGain(); g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 3);
      var lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
      var lfoGain = ctx.createGain(); lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain); lfoGain.connect(g.gain);
      src.connect(lp); lp.connect(g); g.connect(master);
      src.start(); lfo.start();
      ambience = { src: src, lfo: lfo, gain: g };
    },
    ambienceStop: function () {
      if (!ambience || !ctx) { ambience = null; return; }
      var a = ambience; ambience = null;
      a.gain.gain.cancelScheduledValues(ctx.currentTime);
      a.gain.gain.setValueAtTime(a.gain.gain.value, ctx.currentTime);
      a.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
      setTimeout(function () { try { a.src.stop(); a.lfo.stop(); } catch (e) { /* already stopped */ } }, 1400);
    }
  };

  // Stop the night sound if the tab is hidden.
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) api.ambienceStop();
  });

  window.MedullaSound = api;
})();
