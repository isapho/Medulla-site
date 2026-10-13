#!/usr/bin/env node
/*
 * Character cut-outs from the team's green-screen sheets (needs Edge or Chrome).
 *
 *   node tools/cutout.mjs
 *
 * Reads assets/source/gemini/<character>-<batch>.jpg (5 or 6 poses on flat
 * green, white sticker border) and writes, for every pose, a transparent
 * 512 × 512 WebP: assets/characters/poses/<character>-<pose>.webp, plus the
 * normal image assets/characters/<character>.webp (+ .png for the Telegram
 * bot), a head crop assets/characters/faces/<character>.webp and a colouring
 * page assets/printables/<character>-lines.png (from the "hello" pose).
 *
 * The art itself is not changed: the green is removed (edge colours are
 * un-mixed from the green so there is no fringe), each pose is separated
 * together with its sparkles, and every pose of a character is scaled so the
 * body has the same size and stands on the same baseline.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = "assets/source/gemini/";

// Poses in reading order (left → right, then the next row).
const SHEETS = [
  { file: "dendi-1.jpg", char: "dendi", poses: ["hello", "curious", "aha", "correct", "tryagain"] },
  { file: "dendi-2.jpg", char: "dendi", poses: ["focus", "win", "inhale", "exhale", "asleep"] },
  { file: "memo-1.jpg", char: "memo", poses: ["hello", "curious", "correct", "idle", "aha", "tryagain"],
    // "aha" (below) touches "curious" (above); paint out aha's spark lines
    // that were drawn over curious's legs
    fix: { paint: [{ box: [966, 442, 1042, 484] }] } },
  { file: "memo-2.jpg", char: "memo", poses: ["focus", "win", "inhale", "exhale", "asleep"] },
  { file: "octa-1.jpg", char: "octa", poses: ["hello", "curious", "aha", "correct", "tryagain"] },
  { file: "octa-2.jpg", char: "octa", poses: ["focus", "win", "inhale", "exhale", "asleep"] },
  { file: "syno-1.jpg", char: "syno", poses: ["hello", "curious", "aha", "correct", "tryagain"] },
  { file: "syno-2.jpg", char: "syno", poses: ["focus", "win", "inhale", "exhale", "asleep"] },
  { file: "lumi-1.jpg", char: "lumi", poses: ["hello", "curious", "aha", "correct", "tryagain"] },
  { file: "lumi-2.jpg", char: "lumi", poses: ["focus", "win", "inhale", "exhale", "asleep"] }
];
// Which pose is the normal (idle) image, when a sheet has no "idle".
const IDLE_FROM = { dendi: "hello", memo: "idle", octa: "tryagain", syno: "tryagain", lumi: "tryagain" };
// Head crop inside the 512 px idle image: [x, y, size].
const FACE = { dendi: [131, 130, 290], memo: [131, 160, 250], octa: [136, 90, 240], syno: [136, 175, 240], lumi: [235, 120, 225] };
const S = 512;

// Runs in the browser: key out the green, split the poses, render each one.
const PAGE = String.raw`<!doctype html><meta charset="utf-8"><body><script>
window.cut = async function (src, count, S) {
  window.__gpix = null;
  const img = new Image(); img.src = src; await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const id = g.getImageData(0, 0, W, H), px = id.data;
  // background colour: median of the borders
  const samp = [];
  for (let x = 0; x < W; x += 7) { samp.push(x * 4, ((H - 1) * W + x) * 4); }
  for (let y = 0; y < H; y += 7) { samp.push(y * W * 4, (y * W + W - 1) * 4); }
  const med = (k) => samp.map((i) => px[i + k]).sort((a, b) => a - b)[samp.length >> 1];
  const G = [med(0), med(1), med(2)];
  const dBg = G[1] - Math.max(G[0], G[2]);
  const A = new Float32Array(W * H);
  for (let i = 0, p = 0; p < W * H; p++, i += 4) {
    const r = px[i], gg = px[i + 1], b = px[i + 2];
    const t = (gg - Math.max(r, b)) / dBg;
    let a = Math.min(1, Math.max(0, (0.78 - t) / 0.58));
    if (a > 0 && a < 0.985) { // un-mix the green from edge pixels
      for (let k = 0; k < 3; k++) px[i + k] = Math.max(0, Math.min(255, (px[i + k] - (1 - a) * G[k]) / a));
    }
    if (a > 0 && px[i + 1] > Math.max(px[i], px[i + 2])) px[i + 1] = Math.max(px[i], px[i + 2]); // spill
    A[p] = a;
  }
  // hand fixes for sheets where Gemini let two poses overlap
  const fix = window.__fix || {};
  (fix.paint || []).forEach((f) => { // remove orange marks: each one takes the nearest clean colour on its row
    const [bx0, by0, bx1, by1] = f.box;
    const isMark = (i) => px[i] > 150 && px[i] - px[i + 2] > -12 && px[i + 1] < 215;
    for (let y = by0; y <= by1; y++) {
      const row = [];
      for (let x = bx0; x <= bx1; x++) row.push(isMark((y * W + x) * 4));
      for (let x = bx0; x <= bx1; x++) {
        if (!row[x - bx0]) continue;
        let l = x, r = x; while (l > bx0 - 20 && (l >= bx0 && row[l - bx0])) l--; while (r < bx1 + 20 && (r <= bx1 && row[r - bx0])) r++;
        // grow a pixel more past the anti-aliased edge
        l -= 2; r += 2;
        const src = (x - l <= r - x ? l : r), i = (y * W + x) * 4, j = (y * W + src) * 4;
        px[i] = px[j]; px[i + 1] = px[j + 1]; px[i + 2] = px[j + 2]; A[y * W + x] = A[y * W + src];
      }
    }
  });
  (fix.erase || []).forEach((bx) => { for (let y = bx[1]; y <= bx[3]; y++) for (let x = bx[0]; x <= bx[2]; x++) A[y * W + x] = 0; });
  (fix.cut || []).forEach((line) => { // clear a 2 px line along a polyline
    for (let k = 0; k < line.length - 1; k++) {
      const [x0, y0] = line[k], [x1, y1] = line[k + 1], n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let t = 0; t <= n; t++) { const x = Math.round(x0 + (x1 - x0) * t / n), y = Math.round(y0 + (y1 - y0) * t / n); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) A[(y + dy) * W + x + dx] = 0; }
    }
  });
  // split: dilate the solid mask, then connected components
  const R = 2, M = new Uint8Array(W * H), D1 = new Uint8Array(W * H), D = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) M[p] = A[p] > 0.5 ? 1 : 0;
  for (let y = 0; y < H; y++) { let run = -1e9; for (let x = 0; x < W; x++) { if (M[y * W + x]) run = x; if (x - run <= R) D1[y * W + x] = 1; } run = 1e9; for (let x = W - 1; x >= 0; x--) { if (M[y * W + x]) run = x; if (run - x <= R) D1[y * W + x] = 1; } }
  for (let x = 0; x < W; x++) { let run = -1e9; for (let y = 0; y < H; y++) { if (D1[y * W + x]) run = y; if (y - run <= R) D[y * W + x] = 1; } run = 1e9; for (let y = H - 1; y >= 0; y--) { if (D1[y * W + x]) run = y; if (run - y <= R) D[y * W + x] = 1; } }
  const L = new Int32Array(W * H), comps = [], stack = new Int32Array(W * H);
  for (let p = 0; p < W * H; p++) {
    if (!D[p] || L[p]) continue;
    const c = { id: comps.length + 1, x0: W, y0: H, x1: 0, y1: 0, area: 0 }; comps.push(c);
    let sp = 0; stack[sp++] = p; L[p] = c.id;
    while (sp) {
      const q = stack[--sp], x = q % W, y = (q / W) | 0;
      if (M[q]) { c.area++; if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y; }
      const nb = [q - 1, q + 1, q - W, q + W];
      for (const n of nb) { if (n < 0 || n >= W * H) continue; if ((n === q - 1 && x === 0) || (n === q + 1 && x === W - 1)) continue; if (D[n] && !L[n]) { L[n] = c.id; stack[sp++] = n; } }
    }
  }
  // Poses that touch (their white borders meet, sometimes in a chain): take as
  // many seeds as there are missing poses (the coloured parts of the art, or
  // the blob eroded until it falls apart), then grow every seed back over its
  // own pixels, so the cuts follow the contacts instead of straight lines.
  for (let guard = 0; guard < 4; guard++) {
    const top = Math.max(...comps.map((k) => k.area));
    const bigs = comps.filter((c) => c.area > top * 0.2);
    if (bigs.length >= count) break;
    const c = bigs.sort((a, b) => b.area - a.area)[0];
    const need = Math.min(count - bigs.length + 1, 6); // seeds wanted inside this blob
    const bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1, N = bw * bh;
    const inC = (x, y) => L[(c.y0 + y) * W + c.x0 + x] === c.id && M[(c.y0 + y) * W + c.x0 + x];
    const label = (mask) => { // connected components of a mask, largest first
      const EL = new Int32Array(N), sizes = [0];
      for (let p = 0; p < N; p++) {
        if (!mask[p] || EL[p]) continue;
        const id2 = sizes.length; sizes.push(0); let sp = 0; stack[sp++] = p; EL[p] = id2;
        while (sp) { const q = stack[--sp], qx = q % bw, qy = (q / bw) | 0; sizes[id2]++; for (const [nx, ny] of [[qx - 1, qy], [qx + 1, qy], [qx, qy - 1], [qx, qy + 1]]) { if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue; const n = ny * bw + nx; if (mask[n] && !EL[n]) { EL[n] = id2; stack[sp++] = n; } } }
      }
      return { EL, order: sizes.map((s, i) => [s, i]).slice(1).sort((a, b) => b[0] - a[0]) };
    };
    const pick = (res) => { // the largest parts, as many as are needed, if there are that many real ones
      const real = res.order.filter((o) => o[0] > res.order[0][0] * 0.04 && o[0] > 150);
      return real.length >= need ? real.slice(0, need).map((o) => o[1]) : null;
    };
    let seeds = null, EL = null;
    { // 1) the coloured parts (not the white border)
      const core = new Uint8Array(N);
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { if (!inC(x, y)) continue; const i = ((c.y0 + y) * W + c.x0 + x) * 4; core[y * bw + x] = (px[i] > 215 && px[i + 1] > 215 && px[i + 2] > 215) ? 0 : 1; }
      const res = label(core), s = pick(res);
      if (s) { seeds = s; EL = res.EL; }
    }
    for (let e = 3; e <= 45 && !seeds; e += 3) { // 2) erosion of the solid shape
      const E1 = new Uint8Array(N), E = new Uint8Array(N);
      for (let y = 0; y < bh; y++) { let run = 0; for (let x = 0; x < bw; x++) { run = inC(x, y) ? run + 1 : 0; E1[y * bw + x] = run; } run = 0; for (let x = bw - 1; x >= 0; x--) { run = inC(x, y) ? run + 1 : 0; E1[y * bw + x] = Math.min(E1[y * bw + x], run) > e ? 1 : 0; } }
      for (let x = 0; x < bw; x++) { let run = 0; const col = new Int32Array(bh); for (let y = 0; y < bh; y++) { run = E1[y * bw + x] ? run + 1 : 0; col[y] = run; } run = 0; for (let y = bh - 1; y >= 0; y--) { run = E1[y * bw + x] ? run + 1 : 0; E[y * bw + x] = Math.min(col[y], run) > e ? 1 : 0; } }
      const res = label(E), s = pick(res);
      if (s) { seeds = s; EL = res.EL; }
    }
    if (!seeds) break;
    // grow all seeds over the blob (breadth-first: each pixel goes to the nearest seed)
    const own = new Uint8Array(N), queue = new Int32Array(N); let qh = 0, qt = 0;
    const idx = new Map(seeds.map((s, k) => [s, k + 1]));
    for (let p = 0; p < N; p++) { const k = idx.get(EL[p]); if (k) { own[p] = k; queue[qt++] = p; } }
    while (qh < qt) { const q = queue[qh++], qx = q % bw, qy = (q / bw) | 0; for (const [nx, ny] of [[qx - 1, qy], [qx + 1, qy], [qx, qy - 1], [qx, qy + 1]]) { if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue; const n = ny * bw + nx; if (own[n] || L[(c.y0 + ny) * W + c.x0 + nx] !== c.id) continue; own[n] = own[q]; queue[qt++] = n; } }
    const parts = seeds.map((_, k) => k === 0 ? c : { id: comps.length + k, x0: W, y0: H, x1: 0, y1: 0, area: 0 });
    for (let k = 1; k < parts.length; k++) comps.push(parts[k]);
    const box0 = { x0: W, y0: H, x1: 0, y1: 0, area: 0 };
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const p = (c.y0 + y) * W + c.x0 + x; if (L[p] !== c.id) continue;
      const k = own[y * bw + x] || 1; const t = k === 1 ? box0 : parts[k - 1];
      if (k > 1) L[p] = t.id;
      if (M[p]) { t.area++; const X = c.x0 + x, Y = c.y0 + y; if (X < t.x0) t.x0 = X; if (X > t.x1) t.x1 = X; if (Y < t.y0) t.y0 = Y; if (Y > t.y1) t.y1 = Y; }
    }
    Object.assign(c, box0);
  }
  const big = Math.max(...comps.map((c) => c.area));
  let groups = comps.filter((c) => c.area > big * 0.2);
  // reading order: rows by centre y, then x
  groups.sort((a, b) => (a.y0 + a.y1) - (b.y0 + b.y1));
  const rows = []; groups.forEach((c) => { const cy = (c.y0 + c.y1) / 2, r = rows.find((r) => Math.abs(r.cy - cy) < H * 0.22); if (r) r.items.push(c); else rows.push({ cy, items: [c] }); });
  groups = rows.flatMap((r) => r.items.sort((a, b) => a.x0 - b.x0));
  // stray small pieces (sparkles further away) join the nearest group
  // crumbs left on either side of a hand cut are dropped
  const nearCut = (c) => (fix.cut || []).some((line) => line.some((p, k) => k < line.length - 1 &&
    c.x1 >= Math.min(p[0], line[k + 1][0]) - 8 && c.x0 <= Math.max(p[0], line[k + 1][0]) + 8 &&
    c.y1 >= Math.min(p[1], line[k + 1][1]) - 8 && c.y0 <= Math.max(p[1], line[k + 1][1]) + 8));
  comps.filter((c) => !groups.includes(c) && c.area > 45 && !(c.area < 1500 && nearCut(c))).forEach((c) => {
    let best = null, bd = 1e9; const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
    // distance to the group's real pixels (bounding boxes of neighbours can overlap)
    if (!window.__gpix) { window.__gpix = new Map(); }
    groups.forEach((gp) => {
      if (!window.__gpix.has(gp)) { const pts = []; for (let y = gp.y0; y <= gp.y1; y += 3) for (let x = gp.x0; x <= gp.x1; x += 3) { const p = y * W + x; if (M[p] && L[p] === gp.id) pts.push(x, y); } window.__gpix.set(gp, pts); }
      const pts = window.__gpix.get(gp); let d = 1e9;
      for (let k = 0; k < pts.length; k += 2) { const dd = Math.hypot(pts[k] - cx, pts[k + 1] - cy); if (dd < d) d = dd; }
      if (d < bd) { bd = d; best = gp; }
    });
    if (best && bd < 200) { c.join = best.id; best.x0 = Math.min(best.x0, c.x0); best.y0 = Math.min(best.y0, c.y0); best.x1 = Math.max(best.x1, c.x1); best.y1 = Math.max(best.y1, c.y1); }
  });
  if (groups.length !== count) return { dbg: { sd: window.__sd, G, dBg, boxes: groups.map((c) => [c.x0, c.y0, c.x1, c.y1, c.area]), comps: comps.filter((c) => c.area > 200).map((c) => [c.x0, c.y0, c.x1, c.y1, c.area]) }, error: "found " + groups.length + " poses, expected " + count, sizes: groups.map((c) => c.area) };
  const owner = new Int32Array(comps.length + 2); comps.forEach((c) => { owner[c.id] = c.join || c.id; });
  const out = [];
  for (const gp of groups) {
    // body = the largest solid blob of this group
    const BL = new Int32Array((gp.x1 - gp.x0 + 1) * (gp.y1 - gp.y0 + 1)), gw = gp.x1 - gp.x0 + 1, gh = gp.y1 - gp.y0 + 1;
    let body = null, lab = 0;
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const p = (gp.y0 + y) * W + gp.x0 + x; if (!M[p] || owner[L[p]] !== gp.id || BL[y * gw + x]) continue;
      const b = { x0: 1e9, y0: 1e9, x1: 0, y1: 0, n: 0 }; lab++;
      let sp = 0; stack[sp++] = y * gw + x; BL[y * gw + x] = lab;
      while (sp) { const q = stack[--sp], qx = q % gw, qy = (q / gw) | 0; b.n++; if (qx < b.x0) b.x0 = qx; if (qx > b.x1) b.x1 = qx; if (qy < b.y0) b.y0 = qy; if (qy > b.y1) b.y1 = qy;
        for (const [nx, ny] of [[qx - 1, qy], [qx + 1, qy], [qx, qy - 1], [qx, qy + 1]]) { if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue; const pp = (gp.y0 + ny) * W + gp.x0 + nx; if (M[pp] && owner[L[pp]] === gp.id && !BL[ny * gw + nx]) { BL[ny * gw + nx] = lab; stack[sp++] = ny * gw + nx; } } }
      if (!body || b.n > body.n) body = b;
    }
    // copy this group's pixels only
    const pc = document.createElement("canvas"); pc.width = gw; pc.height = gh;
    const pg = pc.getContext("2d"), pd = pg.createImageData(gw, gh);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const p = (gp.y0 + y) * W + gp.x0 + x, o = (y * gw + x) * 4;
      if (owner[L[p]] !== gp.id || A[p] <= 0.02) continue;
      pd.data[o] = px[p * 4]; pd.data[o + 1] = px[p * 4 + 1]; pd.data[o + 2] = px[p * 4 + 2]; pd.data[o + 3] = Math.round(A[p] * 255);
    }
    pg.putImageData(pd, 0, 0);
    out.push({ canvas: pc, body, gw, gh });
  }
  window.__pieces = out;
  return { ok: out.map((o) => ({ gw: o.gw, gh: o.gh, bw: o.body.x1 - o.body.x0 + 1, bh: o.body.y1 - o.body.y0 + 1 })) };
};
// render piece i with a body size (px of the body's longer side in the source)
window.render = function (i, S, bodyRef) {
  const o = window.__pieces[i], b = o.body;
  const bcx = (b.x0 + b.x1) / 2, bBottom = b.y1;
  let s = (0.8 * S) / bodyRef;
  s = Math.min(s, (S * 0.49) / Math.max(bcx, o.gw - bcx), (S * 0.97) / Math.max(1, bBottom), (S * 0.985) / o.gh);
  const c = document.createElement("canvas"); c.width = S; c.height = S;
  const g = c.getContext("2d"); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  const ox = S / 2 - bcx * s, oy = Math.min(S * 0.975 - bBottom * s, S * 0.985 - o.gh * s + (o.gh - 1 - bBottom) * 0);
  g.drawImage(o.canvas, ox, Math.max(S * 0.012, oy), o.gw * s, o.gh * s);
  window.__last = c;
  return { webp: c.toDataURL("image/webp", 0.92), png: c.toDataURL("image/png") };
};
// colouring page: draw the pose on white, then ink every sharp colour change
window.lines = function () {
  const src = window.__last, w = src.width, h = src.height;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const t = document.createElement("canvas"); t.width = w; t.height = h;
  const tg = t.getContext("2d"); tg.drawImage(src, 0, 0);
  const td = tg.getImageData(0, 0, w, h); for (let i = 3; i < td.data.length; i += 4) if (td.data[i] < 235) td.data[i] = 0; // only solid pixels
  tg.putImageData(td, 0, 0);
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(t, 0, 0);
  const d = g.getImageData(0, 0, w, h).data, E = new Uint8Array(w * h);
  for (let i = 0; i < d.length; i += 4) { const mn = Math.min(d[i], d[i + 1], d[i + 2]), mx = Math.max(d[i], d[i + 1], d[i + 2]); if (mn > 188 && mx - mn < 34) d[i] = d[i + 1] = d[i + 2] = 255; } // the white border (and its greyish edge) disappears
  const diff = (i, j) => Math.hypot(d[i] - d[j], d[i + 1] - d[j + 1], d[i + 2] - d[j + 2]);
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    const i = (y * w + x) * 4;
    if (diff(i - 8, i + 8) > 42 || diff(i - w * 8, i + w * 8) > 42) E[y * w + x] = 1;
  }
  // drop specks: edge pieces smaller than 40 px
  const seen = new Uint8Array(w * h), st = [];
  for (let p = 0; p < w * h; p++) {
    if (!E[p] || seen[p]) continue;
    const comp = [p]; seen[p] = 1; st.length = 0; st.push(p);
    while (st.length) { const q = st.pop(), qx = q % w; for (const n of [q - 1, q + 1, q - w, q + w, q - w - 1, q - w + 1, q + w - 1, q + w + 1]) { if (n < 0 || n >= w * h || Math.abs((n % w) - qx) > 1) continue; if (E[n] && !seen[n]) { seen[n] = 1; st.push(n); comp.push(n); } } }
    if (comp.length < 40) comp.forEach((q) => { E[q] = 0; });
  }
  const o = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const on = E[y * w + x];
    const k = (y * w + x) * 4, v = on ? 13 : 255; o.data[k] = v; o.data[k + 1] = on ? 17 : 255; o.data[k + 2] = on ? 40 : 255; o.data[k + 3] = 255;
  }
  g.putImageData(o, 0, 0);
  return c.toDataURL("image/png");
};
window.crop = function (x, y, size, out) {
  const c = document.createElement("canvas"); c.width = out; c.height = out;
  const g = c.getContext("2d"); g.imageSmoothingQuality = "high";
  g.drawImage(window.__last, x, y, size, size, 0, 0, out, out);
  return c.toDataURL("image/webp", 0.92);
};
</script>`;

const CANDIDATES = [process.env.BROWSER, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean);
const BROWSER = CANDIDATES.find((p) => fs.existsSync(p));
if (!BROWSER) { console.error("No Chromium browser found. Set BROWSER=/path/to/chrome"); process.exit(1); }

const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/__page") { res.writeHead(200, { "Content-Type": "text/html" }); res.end(PAGE); return; }
  const file = path.join(ROOT, decodeURIComponent(u.pathname));
  fs.readFile(file, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { "Content-Type": file.endsWith(".png") ? "image/png" : "image/jpeg" }); res.end(d); });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const port = 9400 + Math.floor(Math.random() * 400);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "medulla-cut-"));
const proc = spawn(BROWSER, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })); });
const write = (rel, dataUrl) => { fs.mkdirSync(path.dirname(path.join(ROOT, rel)), { recursive: true }); fs.writeFileSync(path.join(ROOT, rel), Buffer.from(dataUrl.split(",")[1], "base64")); };

try {
  let info; for (let i = 0; i < 60 && !info; i++) { try { info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(200); } }
  ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
  const { targetId } = await send("Target.createTarget", { url: base + "/__page" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }, sessionId); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500)); return r.result.value; };
  await sleep(800);
  // one body size per character, from all of its sheets
  const chars = [...new Set(SHEETS.map((s) => s.char))];
  for (const ch of chars) {
    const sheets = SHEETS.filter((s) => s.char === ch);
    for (const sh of sheets) {
      await ev(`window.__fix = ${JSON.stringify(sh.fix || {})}`);
      const info = await ev(`cut(${JSON.stringify("/" + SRC + sh.file)}, ${sh.poses.length}, ${S})`);
      if (info.error) throw new Error(sh.file + ": " + info.error + " " + JSON.stringify(info.sizes) + JSON.stringify(info.dbg));
      // body reference: median of the bodies' longer side on this sheet
      const sides = info.ok.map((o) => Math.max(o.bw, o.bh)).sort((a, b) => a - b);
      const ref = sides[sides.length >> 1];
      for (let i = 0; i < sh.poses.length; i++) {
        const pose = sh.poses[i];
        const r = await ev(`render(${i}, ${S}, ${ref})`);
        if (pose !== "idle") write(`assets/characters/poses/${ch}-${pose}.webp`, r.webp);
        if (pose === "hello") { // colouring page from the waving pose, at print size
          await ev(`render(${i}, 1024, ${ref})`);
          write(`assets/printables/${ch}-lines.png`, await ev("lines()"));
          await ev(`render(${i}, ${S}, ${ref})`);
        }
        if (pose === IDLE_FROM[ch]) {
          write(`assets/characters/${ch}.webp`, r.webp);
          write(`assets/characters/${ch}.png`, r.png);
          const f = FACE[ch];
          write(`assets/characters/faces/${ch}.webp`, await ev(`crop(${f[0]}, ${f[1]}, ${f[2]}, 160)`));
        }
        console.log("wrote", ch, pose);
      }
    }
  }
  // the normal (idle) image of every character comes from the team's line-up
  const LINEUP = ["dendi", "lumi", "memo", "octa", "syno"];
  await ev(`window.__fix = {}; window.__sd = []`);
  const li = await ev(`cut(${JSON.stringify("/" + SRC + "lineup.png")}, ${LINEUP.length}, ${S})`);
  if (li.error) throw new Error("lineup.png: " + li.error + " " + JSON.stringify(li.dbg));
  for (let i = 0; i < LINEUP.length; i++) {
    const ch = LINEUP[i], o = li.ok[i], ref = Math.max(o.bw, o.bh);
    const r = await ev(`render(${i}, ${S}, ${ref})`);
    write(`assets/characters/${ch}.webp`, r.webp);
    write(`assets/characters/${ch}.png`, r.png);
    const f = FACE[ch];
    write(`assets/characters/faces/${ch}.webp`, await ev(`crop(${f[0]}, ${f[1]}, ${f[2]}, 160)`));
    console.log("wrote", ch, "(line-up)");
  }
} catch (e) { console.error(e.message || e); process.exitCode = 1; }
finally { try { ws && ws.close(); } catch {} proc.kill(); server.close(); }
