/*
 * Printable activity sheets (A4). Each sheet is built here in the current
 * language and printed on its own: "Print" marks it .is-printing and calls
 * window.print(); css/app.css hides everything else when printing.
 * Colouring pages use line art made from the character art
 * (assets/printables/*-lines.png, made by tools/cutout.mjs).
 */
Medulla.ready(function () {
  "use strict";

  var M = window.Medulla, t = M.t, esc = M.esc;
  var list = document.getElementById("sheet-list"), area = document.getElementById("sheets");

  function footer() { return '<p class="sheet-footer">Medulla · Mind • Learn • Grow · ' + esc(t("sheet.footer")) + "</p>"; }

  /* ----------------------------------------------------------- the maze */

  // Deterministic maze (recursive backtracker with a fixed seed).
  function mazeSvg(cols, rows, cell) {
    var seed = 20261012;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    var walls = [], seen = [], i, j;
    for (i = 0; i < rows; i++) { walls.push([]); seen.push([]); for (j = 0; j < cols; j++) { walls[i].push({ n: 1, e: 1, s: 1, w: 1 }); seen[i].push(false); } }
    var stack = [[0, 0]]; seen[0][0] = true;
    while (stack.length) {
      var cur = stack[stack.length - 1], r = cur[0], c = cur[1], opts = [];
      if (r > 0 && !seen[r - 1][c]) opts.push(["n", r - 1, c, "s"]);
      if (c < cols - 1 && !seen[r][c + 1]) opts.push(["e", r, c + 1, "w"]);
      if (r < rows - 1 && !seen[r + 1][c]) opts.push(["s", r + 1, c, "n"]);
      if (c > 0 && !seen[r][c - 1]) opts.push(["w", r, c - 1, "e"]);
      if (!opts.length) { stack.pop(); continue; }
      var o = opts[Math.floor(rnd() * opts.length)];
      walls[r][c][o[0]] = 0; walls[o[1]][o[2]][o[3]] = 0; seen[o[1]][o[2]] = true; stack.push([o[1], o[2]]);
    }
    walls[0][0].w = 0; walls[rows - 1][cols - 1].e = 0;
    var p = "", pad = 4;
    for (i = 0; i < rows; i++) for (j = 0; j < cols; j++) {
      var x = pad + j * cell, y = pad + i * cell, w = walls[i][j];
      if (w.n) p += "M" + x + " " + y + "h" + cell;
      if (w.w) p += "M" + x + " " + y + "v" + cell;
      if (i === rows - 1 && w.s) p += "M" + x + " " + (y + cell) + "h" + cell;
      if (j === cols - 1 && w.e) p += "M" + (x + cell) + " " + y + "v" + cell;
    }
    return '<svg viewBox="0 0 ' + (cols * cell + pad * 2) + " " + (rows * cell + pad * 2) + '" role="img" aria-label="' + esc(t("sheet.maze.title")) + '"><path d="' + p + '" stroke="#0D1128" stroke-width="3" stroke-linecap="square" fill="none"/></svg>';
  }

  /* --------------------------------------------------------- the neuron */

  function neuronSvg(labels) {
    return '<svg viewBox="0 0 600 300" role="img" aria-label="' + esc(t("sheet.neuron.title")) + '">' +
      '<g fill="none" stroke="#0D1128" stroke-width="3" stroke-linecap="round">' +
        '<circle cx="130" cy="150" r="42"/>' +
        '<path d="M100 120 60 80 30 85M60 80 55 45M95 180 55 220 25 215M55 220 60 255M130 108 130 60 110 35M130 60 150 32M160 125 190 95"/>' +
        '<path d="M172 150H520"/>' +
        '<rect x="210" y="136" width="60" height="28" rx="12"/><rect x="290" y="136" width="60" height="28" rx="12"/><rect x="370" y="136" width="60" height="28" rx="12"/>' +
        '<path d="M520 150 560 120M520 150 565 150M520 150 560 182"/>' +
        '<circle cx="572" cy="114" r="8"/><circle cx="578" cy="150" r="8"/><circle cx="572" cy="188" r="8"/>' +
      '</g><g stroke="#0D1128" stroke-width="1.5" stroke-dasharray="4 5" fill="none">' +
        '<path d="M45 60 30 20M130 170 130 270M240 136 240 40M470 150 470 260M565 120 560 40"/></g>' +
      '<g font-family="Arial, sans-serif" font-size="15" fill="#0D1128">' +
        labels.map(function (l) { return '<rect x="' + (l[0] - 70) + '" y="' + (l[1] - 18) + '" width="140" height="28" fill="#fff" stroke="#0D1128"/><text x="' + l[0] + '" y="' + l[1] + '" text-anchor="middle">' + esc(l[2]) + "</text>"; }).join("") +
      "</g></svg>";
  }

  /* -------------------------------------------------------------- sheets */

  var CHARS = ["dendi", "memo", "octa", "syno", "lumi"];

  function sheets() {
    var out = [];
    CHARS.forEach(function (id) {
      var c = M.characters[id], img = M.root() + "assets/printables/" + id + "-lines.png", px = [1024, 1024];
      out.push({
        id: "color-" + id, char: id, kind: "color",
        title: t("sheet.color.title", { name: c.name }),
        thumb: '<img src="' + img + '" width="' + px[0] + '" height="' + px[1] + '" alt="" loading="lazy">',
        html: "<h1>" + esc(t("sheet.color.title", { name: c.name })) + "</h1><p>" + esc(t("char." + id + ".trait")) + " — " + esc(t("char." + id + ".role")) + "</p>" +
          '<img src="' + img + '" alt="' + esc(t("sheet.color.alt", { name: c.name })) + '" style="display:block;width:100%;max-height:200mm;object-fit:contain;margin:6mm 0">' +
          "<p>" + esc(t("sheet.color.hint")) + "</p>" + footer()
      });
    });
    var words = [t("sheet.neuron.dendrites"), t("sheet.neuron.body"), t("sheet.neuron.myelin"), t("sheet.neuron.axon"), t("sheet.neuron.synapse")];
    out.push({
      id: "neuron", char: "dendi", kind: "learn", title: t("sheet.neuron.title"),
      thumb: neuronSvg([[45, 18, "?"], [130, 290, "?"], [240, 32, "?"], [470, 282, "?"], [560, 32, "?"]]),
      html: "<h1>" + esc(t("sheet.neuron.title")) + "</h1><p>" + esc(t("sheet.neuron.how")) + "</p>" +
        neuronSvg([[45, 18, ""], [130, 290, ""], [240, 32, ""], [470, 282, ""], [560, 32, ""]]) +
        "<p><strong>" + esc(t("sheet.wordBank")) + ":</strong> " + words.map(esc).join(" · ") + "</p>" +
        '<p style="font-size:10pt">' + esc(t("sheet.neuron.source")) + "</p>" + footer()
    });
    var days = t("week.days").split(",");
    out.push({
      id: "sleep-diary", char: "lumi", kind: "habit", title: t("sheet.diary.title"),
      thumb: '<svg viewBox="0 0 210 297"><rect x="15" y="40" width="180" height="200" fill="none" stroke="#0D1128" stroke-width="2"/>' + [0, 1, 2, 3, 4, 5, 6].map(function (i) { return '<line x1="15" x2="195" y1="' + (68 + i * 25) + '" y2="' + (68 + i * 25) + '" stroke="#0D1128"/>'; }).join("") + '<text x="15" y="28" font-size="14" font-family="Arial" fill="#0D1128">' + esc(t("sheet.diary.title")) + "</text></svg>",
      html: "<h1>" + esc(t("sheet.diary.title")) + "</h1><p>" + esc(t("sheet.diary.how")) + "</p>" +
        '<table style="width:100%;border-collapse:collapse;font-size:11pt" border="1" cellpadding="8"><thead><tr><th>' + esc(t("sheet.diary.day")) + "</th><th>" + esc(t("sheet.diary.bed")) + "</th><th>" + esc(t("sheet.diary.wake")) + "</th><th>" + esc(t("sheet.diary.screens")) + "</th><th>" + esc(t("sheet.diary.feel")) + "</th></tr></thead><tbody>" +
        days.map(function (d) { return "<tr><td>" + esc(d) + '</td><td style="height:16mm"></td><td></td><td>☐</td><td>☺ ☹</td></tr>'; }).join("") + "</tbody></table>" +
        '<p style="font-size:10pt">' + esc(t("sheet.diary.source")) + "</p>" + footer()
    });
    out.push({
      id: "breathing", char: "syno", kind: "habit", title: t("sheet.breath.title"),
      thumb: '<svg viewBox="0 0 210 297"><path d="M20 180 Q45 90 70 180 T120 180 T170 180" fill="none" stroke="#0D1128" stroke-width="3" stroke-dasharray="6 6"/></svg>',
      html: "<h1>" + esc(t("sheet.breath.title")) + "</h1><p>" + esc(t("sheet.breath.how")) + "</p>" +
        '<svg viewBox="0 0 600 260" role="img" aria-label="' + esc(t("sheet.breath.title")) + '"><path d="M20 210 Q70 40 120 210 T220 210 T320 210 T420 210 T520 210" fill="none" stroke="#0D1128" stroke-width="5" stroke-dasharray="10 10" stroke-linecap="round"/>' +
        '<text x="60" y="30" font-family="Arial" font-size="18">↑ ' + esc(t("game.breathing.in")) + '</text><text x="120" y="250" font-family="Arial" font-size="18">↓ ' + esc(t("game.breathing.out")) + "</text></svg>" +
        '<p style="font-size:10pt">' + esc(t("sheet.breath.source")) + "</p>" + footer()
    });
    out.push({
      id: "maze", char: "octa", kind: "game", title: t("sheet.maze.title"),
      thumb: mazeSvg(8, 10, 22),
      html: "<h1>" + esc(t("sheet.maze.title")) + "</h1><p>" + esc(t("sheet.maze.how")) + "</p>" + mazeSvg(14, 16, 40) + footer()
    });
    var pairs = ["neuron", "synapse", "myelin", "cerebellum", "melatonin", "plasticity"];
    out.push({
      id: "memory-match", char: "memo", kind: "game", title: t("sheet.match.title"),
      thumb: '<svg viewBox="0 0 210 297">' + [0, 1, 2, 3].map(function (r) { return [0, 1, 2].map(function (c) { return '<rect x="' + (18 + c * 60) + '" y="' + (40 + r * 60) + '" width="52" height="52" rx="6" fill="none" stroke="#0D1128" stroke-width="2"/>'; }).join(""); }).join("") + "</svg>",
      html: "<h1>" + esc(t("sheet.match.title")) + "</h1><p>" + esc(t("sheet.match.how")) + "</p>" +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4mm">' + pairs.map(function (k) {
          return '<div style="border:1.5px dashed #0D1128;border-radius:4mm;min-height:36mm;padding:4mm;display:grid;place-items:center;text-align:center;font-weight:700;font-size:16pt">' + esc(t("sheet.match." + k)) + "</div>" +
            '<div style="border:1.5px dashed #0D1128;border-radius:4mm;min-height:36mm;padding:4mm;display:grid;place-items:center;text-align:center;font-size:11pt">' + esc(t("sheet.match." + k + ".def")) + "</div>";
        }).join("") + "</div>" + footer()
    });
    return out;
  }

  function render() {
    var all = sheets();
    list.innerHTML = all.map(function (s) {
      var c = M.characters[s.char];
      return '<li class="card sheet-card tilt" data-tilt><div class="sheet-thumb">' + s.thumb + "</div>" +
        '<div class="act-meta"><span class="chip" style="background:' + c.tint + '">' + esc(c.name) + '</span><span class="chip" style="background:var(--bg-soft);color:var(--ink-3)">' + esc(t("sheet.kind." + s.kind)) + "</span></div>" +
        '<h2 class="h3" style="margin:0">' + esc(s.title) + "</h2>" +
        '<button type="button" class="btn btn-primary btn-sm press" data-print="' + s.id + '">' + M.icon("printer") + "<span>" + esc(t("sheet.print")) + "</span></button></li>";
    }).join("");
    area.innerHTML = all.map(function (s) { return '<section class="sheet" data-sheet="' + s.id + '">' + s.html + "</section>"; }).join("");
    if (window.MedullaMotion) window.MedullaMotion.initTilt(list);
  }

  function printSheet(ids) {
    area.querySelectorAll(".sheet").forEach(function (el) { el.classList.toggle("is-printing", ids.indexOf(el.getAttribute("data-sheet")) !== -1); });
    window.print();
  }
  window.addEventListener("afterprint", function () { area.querySelectorAll(".is-printing").forEach(function (el) { el.classList.remove("is-printing"); }); });

  list.addEventListener("click", function (e) { var b = e.target.closest("[data-print]"); if (b) printSheet([b.getAttribute("data-print")]); });
  var allColor = document.getElementById("print-colouring");
  if (allColor) allColor.addEventListener("click", function () { printSheet(CHARS.map(function (c) { return "color-" + c; })); });
  M.onLangChange(render);
  render();
});
