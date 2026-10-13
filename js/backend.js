/*
 * Backend adapter. The site ALWAYS works without it (guest mode, progress on
 * this device). When keys are set in js/config.js → backend, it adds:
 *   - sync across devices with an anonymous sync code (no email, no name),
 *   - anonymous +1 counters for the impact bar,
 *   - optional school-club totals.
 *
 * Providers:
 *   "none"     default; every call resolves to { ok: false, reason: "off" }
 *   "mock"     local fake server in localStorage, for testing (add ?backend=mock)
 *   "supabase" Supabase REST (PostgREST RPC). No SDK needed. See backend/schema.sql.
 *
 * Swap providers by adding another object with the same methods below.
 */
(function () {
  "use strict";

  var CFG = (window.MEDULLA_CONFIG || {}).backend || {};

  // ?backend=mock (or ?backend=none) switches provider for this browser tab.
  (function () {
    try {
      var q = new URLSearchParams(window.location.search).get("backend");
      if (q === "mock" || q === "none") sessionStorage.setItem("medulla.backend", q);
    } catch (e) { /* ignore */ }
  })();

  function chosen() {
    var forced = null;
    try { forced = sessionStorage.getItem("medulla.backend"); } catch (e) { forced = null; }
    if (forced === "mock") return "mock";
    if (forced === "none") return "none";
    if (CFG.provider === "worker" && CFG.url) return "worker";
    if (CFG.provider === "supabase" && CFG.url && CFG.anonKey) return "supabase";
    if (CFG.provider === "mock") return "mock";
    return "none";
  }

  /* ----------------------------------------------------- sync code helpers */

  var WORDS = ["DENDI", "MEMO", "OCTA", "SYNO", "LUMI"];
  var ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O, 1/I/L

  // e.g. "OCTA-7K3F-92QX-M4TZ": a character word + 3×4 random symbols (~59 bits).
  function newCode() {
    var r = new Uint32Array(13);
    window.crypto.getRandomValues(r);
    var out = WORDS[r[0] % WORDS.length];
    for (var g = 0; g < 3; g++) {
      out += "-";
      for (var i = 0; i < 4; i++) out += ALPHABET[r[1 + g * 4 + i] % ALPHABET.length];
    }
    return out;
  }

  function normalize(code) { return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }

  function validCode(code) {
    var n = normalize(code);
    return /^(DENDI|MEMO|OCTA|SYNO|LUMI)[2-9A-HJKMNP-Z]{12}$/.test(n);
  }

  // Only a SHA-256 hash of the code ever leaves the device.
  function hash(code) {
    var data = new TextEncoder().encode("medulla:" + normalize(code));
    return window.crypto.subtle.digest("SHA-256", data).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return (b < 16 ? "0" : "") + b.toString(16); }).join("");
    });
  }

  var COUNTERS = ["facts_read", "games_played", "breathing_sessions", "daily_challenges"];

  /* -------------------------------------------------------------- none */

  var none = {
    push: function () { return Promise.resolve({ ok: false, reason: "off" }); },
    pull: function () { return Promise.resolve({ ok: false, reason: "off" }); },
    remove: function () { return Promise.resolve({ ok: false, reason: "off" }); },
    bump: function () { return Promise.resolve({ ok: false, reason: "off" }); },
    counters: function () { return Promise.resolve({ ok: false, reason: "off" }); },
    club: function () { return Promise.resolve({ ok: false, reason: "off" }); }
  };

  /* -------------------------------------------------------------- mock */

  var MOCK_KEY = "medulla.mockServer";
  function mockDb() {
    try { return JSON.parse(localStorage.getItem(MOCK_KEY)) || { sync: {}, counters: {}, clubs: {} }; }
    catch (e) { return { sync: {}, counters: {}, clubs: {} }; }
  }
  function mockSave(db) { try { localStorage.setItem(MOCK_KEY, JSON.stringify(db)); } catch (e) { /* ignore */ } }
  function later(v) { return new Promise(function (res) { setTimeout(function () { res(v); }, 250); }); }

  var mock = {
    push: function (code, payload) {
      return hash(code).then(function (h) {
        var db = mockDb(); db.sync[h] = { payload: payload, updated: new Date().toISOString() }; mockSave(db);
        return later({ ok: true });
      });
    },
    pull: function (code) {
      return hash(code).then(function (h) {
        var row = mockDb().sync[h];
        return later(row ? { ok: true, payload: row.payload } : { ok: false, reason: "not-found" });
      });
    },
    remove: function (code) {
      return hash(code).then(function (h) {
        var db = mockDb(); delete db.sync[h]; mockSave(db);
        return later({ ok: true });
      });
    },
    bump: function (name, club) {
      if (COUNTERS.indexOf(name) === -1) return Promise.resolve({ ok: false, reason: "unknown" });
      var db = mockDb();
      db.counters[name] = (db.counters[name] || 0) + 1;
      if (club) { db.clubs[club] = db.clubs[club] || {}; db.clubs[club][name] = (db.clubs[club][name] || 0) + 1; }
      mockSave(db);
      return later({ ok: true });
    },
    counters: function () { return later({ ok: true, values: mockDb().counters }); },
    club: function (club) { return later({ ok: true, values: mockDb().clubs[club] || {} }); }
  };

  /* ---------------------------------------------------------- supabase */

  function rpc(fn, body) {
    // New publishable keys (sb_publishable_…) go only in the apikey header;
    // a legacy anon key (a JWT, "eyJ…") is also sent as the Bearer token.
    var headers = { "Content-Type": "application/json", apikey: CFG.anonKey };
    if (/^eyJ/.test(CFG.anonKey)) headers.Authorization = "Bearer " + CFG.anonKey;
    return fetch(CFG.url.replace(/\/$/, "") + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body || {})
    }).then(function (r) {
      if (!r.ok) return { ok: false, reason: "http-" + r.status };
      return r.text().then(function (txt) { return { ok: true, data: txt ? JSON.parse(txt) : null }; });
    }).catch(function () { return { ok: false, reason: "network" }; });
  }

  var supabase = {
    push: function (code, payload) {
      return hash(code).then(function (h) { return rpc("sync_save", { p_key: h, p_payload: payload }); });
    },
    pull: function (code) {
      return hash(code).then(function (h) { return rpc("sync_load", { p_key: h }); }).then(function (r) {
        if (!r.ok) return r;
        return r.data ? { ok: true, payload: r.data } : { ok: false, reason: "not-found" };
      });
    },
    remove: function (code) {
      return hash(code).then(function (h) { return rpc("sync_delete", { p_key: h }); });
    },
    bump: function (name, club) {
      if (COUNTERS.indexOf(name) === -1) return Promise.resolve({ ok: false, reason: "unknown" });
      return rpc("counter_bump", { p_name: name, p_club: club || null });
    },
    counters: function () {
      return rpc("counters_get").then(function (r) {
        if (!r.ok) return r;
        var values = {};
        (r.data || []).forEach(function (row) { values[row.name] = row.value; });
        return { ok: true, values: values };
      });
    },
    club: function (club) {
      return rpc("club_totals", { p_club: club }).then(function (r) { return r.ok ? { ok: true, values: r.data || {} } : r; });
    }
  };

  /* ------------------------------------------------------------ worker */

  // The Cloudflare Worker in telegram/ (auth.mjs): sync by hashed code, and
  // "Sign in with Telegram / Google" that returns a sync code derived on the server.
  function call(path, body) {
    return fetch(CFG.url.replace(/\/$/, "") + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.ok && j.ok !== false) return Object.assign({ ok: true }, j);
        return { ok: false, reason: j.reason || "http-" + r.status };
      });
    }).catch(function () { return { ok: false, reason: "network" }; });
  }

  var worker = {
    push: function (code, payload) {
      return hash(code).then(function (h) { return call("/sync/save", { key: h, payload: payload }); });
    },
    pull: function (code) {
      return hash(code).then(function (h) { return call("/sync/load", { key: h }); }).then(function (r) {
        return r.ok ? { ok: true, payload: r.payload } : r;
      });
    },
    remove: function (code) {
      return hash(code).then(function (h) { return call("/sync/delete", { key: h }); });
    },
    // Counters stay off here: a key-value store can't add 1 safely.
    bump: none.bump, counters: none.counters, club: none.club
  };

  var providers = { none: none, mock: mock, supabase: supabase, worker: worker };

  // Anonymous counters: at most one +1 per counter per browser session.
  var bumped = {};

  window.MedullaBackend = {
    provider: chosen,
    ready: function () { return chosen() !== "none"; },
    countersOn: function () { return chosen() !== "none" && ((window.MEDULLA_CONFIG || {}).anonymousCounters === true || chosen() === "mock"); },
    newCode: newCode,
    validCode: validCode,
    formatCode: function (code) {
      var n = normalize(code);
      var m = n.match(/^(DENDI|MEMO|OCTA|SYNO|LUMI)(.{4})(.{4})(.{4})$/);
      return m ? [m[1], m[2], m[3], m[4]].join("-") : code;
    },
    push: function (code, payload) { return providers[chosen()].push(code, payload); },
    pull: function (code) { return providers[chosen()].pull(code); },
    remove: function (code) { return providers[chosen()].remove(code); },
    // Sign in: "telegram" (widget fields), "telegram-webapp" ({initData}), "google" ({credential}).
    // Resolves { ok, code } where code is the person's sync code, made by the server.
    login: function (kind, data) {
      if (chosen() === "worker") return call("/auth/" + kind, data);
      if (chosen() === "mock") return later({ ok: true, code: "SYNO-2345-6789-ABCD" });
      return Promise.resolve({ ok: false, reason: "off" });
    },
    canLogin: function () { return chosen() === "worker" || chosen() === "mock"; },
    counters: function () { return providers[chosen()].counters(); },
    club: function (code) { return providers[chosen()].club(normalize(code)); },
    bump: function (name, club) {
      if (!window.MedullaBackend.countersOn()) return Promise.resolve({ ok: false, reason: "off" });
      var key = name + "|" + (club || "");
      var seen = {};
      try { seen = JSON.parse(sessionStorage.getItem("medulla.bumped") || "{}"); } catch (e) { seen = bumped; }
      if (seen[key]) return Promise.resolve({ ok: false, reason: "already" });
      seen[key] = 1; bumped[key] = 1;
      try { sessionStorage.setItem("medulla.bumped", JSON.stringify(seen)); } catch (e) { /* ignore */ }
      return providers[chosen()].bump(name, club ? normalize(club) : null);
    }
  };
})();
