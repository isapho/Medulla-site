/*
 * Learn page: fact library from data/facts.json with search (all languages),
 * topic filter, sorting, saved-only view, and the book-style reader.
 * Search treats the apostrophes used in Uzbek (' ʻ ʼ ‘ ’ `) as one character.
 */
Medulla.ready(function () {
  "use strict";

  var M = window.Medulla, Store = window.MedullaStore;
  var input = document.getElementById("fact-search");
  var sortSel = document.getElementById("fact-sort");
  var chipsEl = document.getElementById("topic-chips");
  var list = document.getElementById("facts-list");
  var count = document.getElementById("results-count");
  var hubs = document.getElementById("topic-hubs");

  var facts = [], shown = [], topic = "all", loaded = false, highlighted = false;
  var TOPICS = ["sleep", "learning", "brain", "movement", "senses", "myths"];
  var TOPIC_ICON = { sleep: "moon", learning: "book", brain: "neuron", movement: "bolt", senses: "eye", myths: "bulb" };

  // Topic hub pages (topics/<key>.html) set data-topic; learn.html?topic=sleep also works.
  var q = document.body.getAttribute("data-topic") || new URLSearchParams(location.search).get("topic");
  if (q && TOPICS.indexOf(q) !== -1) topic = q;
  if (new URLSearchParams(location.search).get("saved") === "1") topic = "saved";

  function normalize(s) { return String(s || "").toLowerCase().replace(/[ʻʼ‘’`´]/g, "'").replace(/\s+/g, " ").trim(); }

  function haystack(f) {
    var parts = [f.source && f.source.name, f.topic];
    ["title", "simple", "detail"].forEach(function (k) { var v = f[k]; if (v) Object.keys(v).forEach(function (l) { parts.push(v[l]); }); });
    return normalize(parts.join(" "));
  }

  function skeleton() {
    var one = '<li><div class="skeleton-card" aria-hidden="true"><div class="skeleton sk-chip"></div><div class="skeleton sk-title"></div><div class="skeleton sk-line"></div><div class="skeleton sk-line"></div><div class="skeleton sk-line short"></div></div></li>';
    list.innerHTML = one + one + one + one + one + one;
  }

  function renderHubs() {
    if (!hubs) return;
    hubs.innerHTML = TOPICS.map(function (k) {
      var n = facts.filter(function (f) { return f.topic === k; }).length;
      return '<li><a class="topic-hub press" href="' + M.root() + "topics/" + k + '.html"><span class="tile">' + M.icon(TOPIC_ICON[k]) + "</span><span>" +
        M.esc(M.t("topic." + k)) + "<small>" + M.esc(M.t("learn.factsCount", { n: n })) + "</small></span></a></li>";
    }).join("");
  }

  function renderChips() {
    var opts = ["all"].concat(TOPICS.filter(function (k) { return facts.some(function (f) { return f.topic === k; }); })).concat(["saved"]);
    chipsEl.innerHTML = opts.map(function (k) {
      var label = k === "all" ? M.t("learn.all") : k === "saved" ? M.t("learn.savedOnly") : M.t("topic." + k);
      return '<button type="button" class="filter-chip press" data-topic="' + k + '" aria-pressed="' + (k === topic) + '">' +
        (k === "saved" ? M.icon("bookmark") + " " : "") + M.esc(label) + "</button>";
    }).join("");
  }

  function card(f, i) {
    var saved = Store.isSaved(f.id);
    return '<li><article class="fact-card tilt" data-tilt id="fact-' + M.esc(f.id) + '">' +
      '<div class="fact-meta"><span class="chip">' + M.esc(M.topicName(f)) + "</span>" + M.reviewBadge(f) + "</div>" +
      '<h2><a class="card-link" href="' + M.factUrl(f) + '">' + M.esc(M.localized(f.title) || "") + "</a></h2>" +
      '<p class="fact-excerpt">' + M.esc(M.localized(f.simple) || "") + "</p>" +
      '<div class="fact-foot"><span class="src">' + M.icon("link") + "<span>" + M.esc(M.publisher(f)) + "</span></span>" +
        '<span class="btn-row" style="gap:6px">' +
          '<button type="button" class="icon-btn save-mini' + (saved ? " is-saved" : "") + '" data-save="' + M.esc(f.id) + '" aria-pressed="' + saved + '" aria-label="' + M.esc(M.t(saved ? "fact.saved" : "fact.save")) + '">' + M.icon(saved ? "bookmarkOn" : "bookmark") + "</button>" +
          '<button type="button" class="btn btn-primary btn-sm press" data-read="' + i + '">' + M.icon("book") + "<span>" + M.esc(M.t("learn.read")) +
          '</span><span class="sr-only">: ' + M.esc(M.localized(f.title) || "") + "</span></button>" +
        "</span></div>" +
      "</article></li>";
  }

  function render() {
    if (!loaded) return;
    var words = normalize(input.value).split(" ").filter(Boolean);
    shown = facts.filter(function (f) {
      if (topic === "saved" && !Store.isSaved(f.id)) return false;
      if (topic !== "all" && topic !== "saved" && f.topic !== topic) return false;
      return words.every(function (w) { return f._search.indexOf(w) !== -1; });
    });
    if (sortSel.value === "az") shown = shown.slice().sort(function (a, b) { return (M.localized(a.title) || "").localeCompare(M.localized(b.title) || "", M.lang()); });
    list.innerHTML = shown.length ? shown.map(card).join("")
      : '<li class="empty-state">' + M.poseImg("memo", "curious", "idle idle-memo") + "<p>" + M.esc(M.t(topic === "saved" ? "learn.savedEmpty" : "learn.empty")) + "</p></li>";
    count.textContent = M.t("learn.showing", { shown: shown.length, total: facts.length });
    if (window.MedullaMotion) window.MedullaMotion.initTilt(list);
    highlightFromHash();
  }

  function highlightFromHash() {
    if (highlighted || !location.hash) return;
    var target = document.getElementById(location.hash.slice(1));
    if (!target) return;
    highlighted = true;
    target.classList.add("is-highlight");
    target.scrollIntoView({ block: "center", behavior: M.reducedMotion() ? "auto" : "smooth" });
  }

  input.addEventListener("input", render);
  sortSel.addEventListener("change", render);
  chipsEl.addEventListener("click", function (e) {
    var b = e.target.closest(".filter-chip");
    if (!b) return;
    topic = b.getAttribute("data-topic");
    renderChips(); render();
  });
  list.addEventListener("click", function (e) {
    var r = e.target.closest("[data-read]");
    if (r) { M.openReader(shown, Number(r.getAttribute("data-read")), r); return; }
    var s = e.target.closest("[data-save]");
    if (s) {
      var on = Store.toggleSave(s.getAttribute("data-save"));
      s.classList.toggle("is-saved", on);
      s.setAttribute("aria-pressed", String(on));
      s.setAttribute("aria-label", M.t(on ? "fact.saved" : "fact.save"));
      s.innerHTML = M.icon(on ? "bookmarkOn" : "bookmark");
      M.toast({ icon: "bookmark", title: M.t(on ? "fact.savedToast" : "fact.unsavedToast"), ms: 1800 });
      if (topic === "saved") render();
    }
  });
  function topicLead() {
    var lead = document.getElementById("topic-lead");
    if (lead && q) lead.textContent = M.t("topicPage.lead", { topic: M.t("topic." + q) });
  }
  topicLead();
  M.onLangChange(function () { topicLead(); if (!loaded) return; renderHubs(); renderChips(); render(); });

  skeleton();
  M.loadFacts().then(function (data) {
    facts = data.map(function (f) { f._search = haystack(f); return f; });
    loaded = true;
    count.removeAttribute("data-i18n");
    renderHubs(); renderChips(); render();
  }).catch(function () {
    count.removeAttribute("data-i18n");
    count.textContent = "";
    list.innerHTML = '<li class="empty-state">' + M.icon("info") + "<p>" + M.esc(M.t("learn.error")) + "</p></li>";
  });
});
