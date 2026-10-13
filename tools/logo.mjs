#!/usr/bin/env node
/*
 * Medulla logo files from the team's artwork (needs Edge or Chrome).
 *
 *   node tools/logo.mjs        then  node tools/export-png.mjs  (share image)
 *
 * Two sources, both used as drawn (trimmed, centred on a square, resized):
 *
 * 1. assets/source/logo-network.png: the team's wireframe brain wrapped in a
 *    network, white/lavender on transparent. On the purple-to-navy tile it is
 *    the site's logo: header, footer, sign-in page, About, app icons.
 *
 *      logo-mark.webp       the logo on transparent (384 px), for large places
 *      logo-mark-96.webp    small version for the header and footer: the fine
 *                           lines are made a little more opaque after resizing
 *                           so they stay visible at 32–40 px
 *      logo-tile.webp       512 px tile (purple-to-navy square, logo inside)
 *      icon-192.png, icon-512.png, icon-maskable-512.png,
 *      apple-touch-icon.png (180 px, full bleed)
 *
 * 2. assets/source/logo-original.png: the same logo as the team first drew
 *    it, a dark wireframe brain in a navy network on light paper. It is the
 *    browser-tab icon (2.5), on a rounded square of its own paper colour; the
 *    fine lines are darkened towards their own colour so they read at 16–32 px.
 *
 *      logo-tile.svg        tab icon (SVG); the drawing is embedded
 *      favicon-64.png       tab icon (PNG fallback)
 *
 * Set BROWSER=<path> to use another Chromium browser.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = "assets/source/logo-network.png";
const TAB_SRC = "assets/source/logo-original.png";
const OUT = path.join(ROOT, "assets/brand");
const CANDIDATES = [
  process.env.BROWSER,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/microsoft-edge"
].filter(Boolean);
const BROWSER = CANDIDATES.find((p) => fs.existsSync(p));
if (!BROWSER) { console.error("No Chromium browser found. Set BROWSER=/path/to/chrome"); process.exit(1); }

// Tile colours: purple (#6C5CE7) at the top left into navy (#0D1128) at the
// bottom right, so the white lines read on every part of the square.
const TILE = { from: "#7B6CF0", mid: "#5A4AD6", to: "#1B1F4F" };

// Shared helpers (run inside the page).
const HELPERS = `
  async function load(src) { const img = new Image(); img.src = src; await img.decode(); return img; }
  // Halve step by step (smoother than one big jump), then exact size.
  function resizer(master, side) {
    return function resized(size) {
      let src = master, s = side;
      while (s / 2 >= size * 1.5) {
        const n = Math.round(s / 2), c = new OffscreenCanvas(n, n), x = c.getContext("2d");
        x.imageSmoothingQuality = "high"; x.drawImage(src, 0, 0, n, n); src = c; s = n;
      }
      const c = new OffscreenCanvas(size, size), x = c.getContext("2d");
      x.imageSmoothingQuality = "high"; x.drawImage(src, 0, 0, size, size);
      return c;
    };
  }
  async function url(c, type, q) {
    const b = await c.convertToBlob({ type, quality: q });
    return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
  }
`;

// 1. The purple logo set. Returns { name: dataURL }.
const PURPLE_SCRIPT = `(async (TILE) => {
  ${HELPERS}
  const img = await load("/${SRC}");
  const W = img.width, H = img.height;
  const c0 = new OffscreenCanvas(W, H), x0 = c0.getContext("2d");
  x0.drawImage(img, 0, 0);
  const d = x0.getImageData(0, 0, W, H).data;
  let minx = W, miny = H, maxx = 0, maxy = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 8) {
    const p = (i - 3) / 4, px = p % W, py = (p / W) | 0;
    if (px < minx) minx = px; if (px > maxx) maxx = px; if (py < miny) miny = py; if (py > maxy) maxy = py;
  }
  const bw = maxx - minx + 1, bh = maxy - miny + 1, side = Math.max(bw, bh);
  // Square master: trimmed artwork centred on a transparent square.
  const master = new OffscreenCanvas(side, side);
  master.getContext("2d").drawImage(c0, minx, miny, bw, bh, (side - bw) / 2, (side - bh) / 2, bw, bh);
  const resized = resizer(master, side);
  // Make faint (thin) lines more opaque after a big reduction.
  function boost(c, k) {
    const x = c.getContext("2d"), im = x.getImageData(0, 0, c.width, c.height), p = im.data;
    for (let i = 3; i < p.length; i += 4) p[i] = Math.min(255, Math.round(255 * Math.pow(p[i] / 255, k)));
    x.putImageData(im, 0, 0);
    return c;
  }
  function tile(size, full) {
    const c = new OffscreenCanvas(size, size), x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, TILE.from); g.addColorStop(0.5, TILE.mid); g.addColorStop(1, TILE.to);
    x.fillStyle = g;
    if (full) x.fillRect(0, 0, size, size);
    else { x.beginPath(); x.roundRect(0, 0, size, size, size * 0.24); x.fill(); }
    // soft light in the top-left corner
    const h = x.createRadialGradient(size * 0.3, size * 0.18, 0, size * 0.3, size * 0.18, size * 0.7);
    h.addColorStop(0, "rgba(255,255,255,0.22)"); h.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = h;
    if (full) x.fillRect(0, 0, size, size);
    else { x.beginPath(); x.roundRect(0, 0, size, size, size * 0.24); x.fill(); }
    // logo: 86 % of a rounded tile, 66 % of a full-bleed (maskable safe zone)
    const m = Math.round(size * (full ? 0.66 : 0.86)), o = (size - m) / 2;
    const mark = size <= 96 ? boost(resized(m), 0.55) : size <= 200 ? boost(resized(m), 0.8) : resized(m);
    x.drawImage(mark, o, o, m, m);
    return c;
  }
  return {
    "logo-mark.webp": await url(resized(384), "image/webp", 0.8),
    "logo-mark-96.webp": await url(boost(resized(96), 0.55), "image/webp", 0.95),
    "logo-tile.webp": await url(tile(512, false), "image/webp", 0.85),
    "icon-192.png": await url(tile(192, false), "image/png"),
    "icon-512.png": await url(tile(512, false), "image/png"),
    "icon-maskable-512.png": await url(tile(512, true), "image/png"),
    "apple-touch-icon.png": await url(tile(180, true), "image/png")
  };
})`;

// 2. The browser-tab icon from the original drawing. Returns { paper, files }.
const TAB_SCRIPT = `(async () => {
  ${HELPERS}
  const img = await load("/${TAB_SRC}");
  const W = img.width, H = img.height;
  const c0 = new OffscreenCanvas(W, H), x0 = c0.getContext("2d", { willReadFrequently: true });
  x0.drawImage(img, 0, 0);
  const d = x0.getImageData(0, 0, W, H).data;
  // Paper colour: the median of the four borders.
  const rs = [], gs = [], bs = [];
  for (let i = 0; i < W; i++) for (const y of [0, H - 1]) { const k = (y * W + i) * 4; rs.push(d[k]); gs.push(d[k + 1]); bs.push(d[k + 2]); }
  for (let i = 0; i < H; i++) for (const x of [0, W - 1]) { const k = (i * W + x) * 4; rs.push(d[k]); gs.push(d[k + 1]); bs.push(d[k + 2]); }
  const med = (a) => a.sort((p, q) => p - q)[a.length >> 1];
  const paper = [med(rs), med(gs), med(bs)];
  // Drawing = pixels clearly darker than the paper.
  let minx = W, miny = H, maxx = 0, maxy = 0;
  for (let p = 0; p < W * H; p++) {
    const k = p * 4, dk = (paper[0] - d[k]) + (paper[1] - d[k + 1]) + (paper[2] - d[k + 2]);
    if (dk > 60) { const px = p % W, py = (p / W) | 0; if (px < minx) minx = px; if (px > maxx) maxx = px; if (py < miny) miny = py; if (py > maxy) maxy = py; }
  }
  const bw = maxx - minx + 1, bh = maxy - miny + 1, side = Math.round(Math.max(bw, bh) * 1.04);
  const master = new OffscreenCanvas(side, side), xm = master.getContext("2d");
  xm.fillStyle = "rgb(" + paper.join(",") + ")"; xm.fillRect(0, 0, side, side);
  xm.drawImage(c0, minx, miny, bw, bh, (side - bw) / 2, (side - bh) / 2, bw, bh);
  const resized = resizer(master, side);
  // Push every pixel further from the paper (k < 1): lines keep their colour but read darker.
  function deepen(c, k) {
    const x = c.getContext("2d"), im = x.getImageData(0, 0, c.width, c.height), p = im.data;
    for (let i = 0; i < p.length; i += 4) for (let j = 0; j < 3; j++) {
      const P = paper[j], v = Math.max(0, P - p[i + j]) / P;
      p[i + j] = Math.round(P - P * Math.pow(v, k));
    }
    x.putImageData(im, 0, 0);
    return c;
  }
  const fav = new OffscreenCanvas(64, 64), xf = fav.getContext("2d");
  xf.beginPath(); xf.roundRect(0, 0, 64, 64, 64 * 0.24); xf.clip();
  xf.drawImage(deepen(resized(64), 0.55), 0, 0);
  return {
    paper: "#" + paper.map((v) => v.toString(16).padStart(2, "0")).join(""),
    files: { "favicon-64.png": await url(fav, "image/png"), "svg-mark": await url(deepen(resized(128), 0.6), "image/webp", 0.92) }
  };
})`;

const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/") { res.writeHead(200, { "Content-Type": "text/html" }); res.end("<!doctype html><title>logo</title>"); return; }
  const file = path.join(ROOT, decodeURIComponent(u.pathname));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": "image/png" });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const port = 9400 + Math.floor(Math.random() * 400);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "medulla-logo-"));
const proc = spawn(BROWSER, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws, seq = 0;
const pending = new Map();
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const id = ++seq; pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params, sessionId }));
});

try {
  let info;
  for (let i = 0; i < 60 && !info; i++) { try { info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(200); } }
  ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const S = (m, p) => send(m, p, sessionId);
  await S("Page.enable");
  await S("Page.navigate", { url: base + "/" });
  await sleep(600);
  const run = async (expr) => {
    const r = await S("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const write = (name, dataUrl) => { fs.writeFileSync(path.join(OUT, name), Buffer.from(dataUrl.split(",")[1], "base64")); console.log("wrote assets/brand/" + name); };

  const purple = await run(`${PURPLE_SCRIPT}(${JSON.stringify(TILE)})`);
  for (const [name, dataUrl] of Object.entries(purple)) write(name, dataUrl);

  const tab = await run(`${TAB_SCRIPT}()`);
  write("favicon-64.png", tab.files["favicon-64.png"]);
  // SVG tab icon: rounded paper tile, drawing embedded (an SVG favicon cannot load other files).
  const mark = tab.files["svg-mark"];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100" width="100" height="100" role="img" aria-label="Medulla">` +
    `<defs><clipPath id="r"><rect width="100" height="100" rx="24"/></clipPath></defs>` +
    `<g clip-path="url(#r)"><rect width="100" height="100" fill="${tab.paper}"/>` +
    `<image width="100" height="100" href="${mark}" xlink:href="${mark}"/></g></svg>\n`;
  fs.writeFileSync(path.join(OUT, "logo-tile.svg"), svg, "utf8");
  console.log("wrote assets/brand/logo-tile.svg");
} catch (e) {
  console.error(e); process.exitCode = 1;
} finally {
  try { ws && ws.close(); } catch {}
  proc.kill(); server.close();
}
