/*
 * Shared fact-page template. Used in the browser (js/fact.js) AND by the
 * build script (tools/build.js) to pre-render each facts/<id>.html in Uzbek
 * for search engines. Icons are <span data-icon> placeholders that
 * js/main.js fills in at runtime, so this file works in Node too.
 */
(function (root) {
  "use strict";

  var CHARS = {
    dendi: { name: "Dendi", w: 194, h: 280, tint: "#EFEDFF" },
    memo: { name: "Memo", w: 276, h: 229, tint: "#E8E5FF" },
    octa: { name: "Octa", w: 198, h: 233, tint: "#F3F1FF" },
    syno: { name: "Syno", w: 168, h: 248, tint: "#ECE9FF" },
    lumi: { name: "Lumi", w: 160, h: 161, tint: "#FFF3E6" }
  };

  function esc(s) {
    return String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function ic(name) { return '<span data-icon="' + name + '"></span>'; }

  // Stable option order per fact so the right answer isn't always first.
  function quizOrder(f) {
    var h = 0;
    for (var i = 0; i < f.id.length; i++) h = (h * 31 + f.id.charCodeAt(i)) >>> 0;
    var n = (f.quiz && f.quiz.options.length) || 0, order = [];
    for (var k = 0; k < n; k++) order.push((k + h) % n);
    return order;
  }

  function charImg(id, base, cls) {
    var c = CHARS[id] || CHARS.memo;
    return '<img src="' + base + "assets/characters/" + id + '.webp" width="' + c.w + '" height="' + c.h + '" alt=""' + (cls ? ' class="' + cls + '"' : "") + ">";
  }

  /**
   * ctx = { t(key, vars), loc(value), base: "../", level: "simple"|"detail",
   *         related: [facts], saved: bool }
   */
  function article(f, ctx) {
    var t = ctx.t, loc = ctx.loc, level = ctx.level || "simple";
    var q = f.quiz, order = quizOrder(f);
    return '<div class="fact-meta"><span class="chip">' + esc(t("topic." + f.topic)) + "</span>" +
        (f.reviewed ? "" : '<span class="review-badge">' + ic("clock") + esc(t("common.pendingReview")) + "</span>") + "</div>" +
      '<h1 id="fact-title">' + esc(loc(f.title)) + "</h1>" +
      '<div class="level-toggle" role="group" aria-label="' + esc(t("fact.levelLabel")) + '">' +
        '<button type="button" data-level="simple" aria-pressed="' + (level === "simple") + '">' + esc(t("fact.simple")) + "</button>" +
        '<button type="button" data-level="detail" aria-pressed="' + (level === "detail") + '">' + esc(t("fact.detail")) + "</button></div>" +
      '<p class="fact-body" id="fact-body" aria-live="polite">' + esc(loc(f[level])) + "</p>" +
      '<div class="fact-tools">' +
        '<button type="button" class="btn btn-ghost btn-sm press listen-btn" data-listen>' + ic("headphones") + "<span>" + esc(t("fact.listen")) + "</span></button>" +
        '<button type="button" class="btn btn-ghost btn-sm press save-btn' + (ctx.saved ? " is-saved" : "") + '" data-save aria-pressed="' + !!ctx.saved + '">' + ic(ctx.saved ? "bookmarkOn" : "bookmark") + "<span>" + esc(t(ctx.saved ? "fact.saved" : "fact.save")) + "</span></button>" +
        '<button type="button" class="btn btn-ghost btn-sm press" data-share-card>' + ic("share") + "<span>" + esc(t("fact.shareCard")) + "</span></button>" +
      "</div>" +
      '<p class="fact-source"><span>' + esc(t("common.source")) + '</span> <a href="' + esc(f.source.url) + '" target="_blank" rel="noopener noreferrer">' + esc(f.source.name) + "</a></p>" +
      (f.reviewed ? "" : '<p class="reader-note">' + ic("info") + "<span>" + esc(t("reader.note")) + "</span></p>") +
      (q ? '<section class="fact-quiz" aria-labelledby="fq-title"><div class="quiz-q" data-quiz="' + esc(f.id) + '">' +
        '<p class="eyebrow" id="fq-title">' + ic("bulb") + esc(t("fact.quizTitle")) + "</p>" +
        '<h2 class="h3">' + esc(loc(q.q)) + '</h2><div class="quiz-options">' +
        order.map(function (oi, n) {
          return '<button type="button" class="quiz-option" data-opt="' + oi + '"><span class="qo-mark">' + String.fromCharCode(65 + n) + "</span><span>" + esc(loc(q.options[oi])) + "</span></button>";
        }).join("") + '</div><div class="quiz-why-slot" aria-live="polite"></div></div></section>' : "");
  }

  function side(f, ctx) {
    var t = ctx.t, loc = ctx.loc, base = ctx.base, c = CHARS[f.character] || CHARS.memo;
    return '<div class="card fact-presenter"><div class="host-circle" style="--tint:' + c.tint + '">' + charImg(f.character || "memo", base, "idle idle-" + (f.character || "memo")) + "</div>" +
        '<p class="muted" style="margin:0">' + esc(t("reader.presenter", { name: c.name })) + "</p></div>" +
      ((ctx.related || []).length ? '<div class="card"><h2 class="h3" style="margin:0 0 10px">' + esc(t("fact.related")) + '</h2><ul class="related-list">' +
        ctx.related.map(function (r) { return '<li><a href="' + base + "facts/" + r.id + '.html"><span>' + esc(loc(r.title)) + "</span>" + ic("arrow") + "</a></li>"; }).join("") +
        "</ul></div>" : "") +
      '<div class="card"><h2 class="h3" style="margin:0 0 6px">' + esc(t("fact.helpTitle")) + '</h2><p class="muted" style="font-size:.9rem">' + esc(t("fact.helpText")) + "</p>" +
        '<div class="btn-row"><span data-render="mailto" data-subject="fact.reportSubject" data-body="fact.reportBody" data-label="fact.report" data-icon="flag"></span>' +
        '<span data-render="mailto" data-subject="fact.suggestSubject" data-body="fact.suggestBody" data-label="fact.suggest" data-icon="bulb"></span></div></div>' +
      '<div class="card" data-share-slot hidden></div>';
  }

  var api = { article: article, side: side, quizOrder: quizOrder, chars: CHARS, esc: esc };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MedullaFactTemplate = api;
})(this);
