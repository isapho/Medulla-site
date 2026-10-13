#!/usr/bin/env node
/*
 * Avatar pictures from the character expressions (needs Edge or Chrome).
 *
 *   node tools/avatars.mjs
 *
 * For every character and every mood in MOODS, reads
 * assets/characters/poses/<character>-<mood>.webp (made by tools/cutout.mjs)
 * (and the normal image assets/characters/<character>.webp as "classic") and
 * writes a 160 × 160 avatar with the whole character in view to
 * assets/characters/avatars/<character>-<mood>.webp, used by the avatar
 * picker in "Men" (js/explore.js) and wherever the avatar is shown.
 *
 * The art is not changed, only cropped: the body is the largest solid shape
 * in the picture (sparkles and "zzz" are ignored when measuring), the crop is
 * a square around the body's centre, ZOOM[character] times its larger side
 * (a little more than 1, so the round avatar frame does not cut it off).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHARS = ["dendi", "memo", "octa", "syno", "lumi"];
// Keep in sync with AVATAR_MOODS in js/main.js.
const MOODS = ["hello", "correct", "win", "aha", "curious", "focus", "inhale", "asleep"];
// Square side as a multiple of the body's larger side, and how far the view
// is moved up from the body's centre (share of the side).
const ZOOM = { dendi: [1.16, 0.02], memo: [1.12, 0.0], octa: [1.14, 0.02], syno: [1.16, 0.02], lumi: [1.14, 0.0] };
const SIZE = 160;

const PAGE = String.raw`<!doctype html><meta charset="utf-8"><body><script>
window.avatar = async function (src, crop, lift, size) {
  const img = new Image(); img.src = src; await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight;
  const cv = new OffscreenCanvas(W, H), g = cv.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, W, H).data;
  // solid mask at quarter size, then the largest 4-connected shape
  const q = 4, w = Math.ceil(W / q), h = Math.ceil(H / q), m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = px[((y * q) * W + x * q) * 4 + 3] > 128 ? 1 : 0;
  const lab = new Int32Array(w * h); let best = null, id = 0;
  for (let s = 0; s < w * h; s++) {
    if (!m[s] || lab[s]) continue;
    id++; const st = [s]; lab[s] = id; let n = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    while (st.length) {
      const p = st.pop(), x = p % w, y = (p / w) | 0; n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const o of [p - 1, p + 1, p - w, p + w]) {
        if (o < 0 || o >= w * h || lab[o] || !m[o]) continue;
        if ((o === p - 1 && x === 0) || (o === p + 1 && x === w - 1)) continue;
        lab[o] = id; st.push(o);
      }
    }
    if (!best || n > best.n) best = { n, x0: x0 * q, y0: y0 * q, x1: (x1 + 1) * q, y1: (y1 + 1) * q };
  }
  const bw = best.x1 - best.x0, bh = best.y1 - best.y0;
  const side = Math.round(Math.max(bw, bh) * crop);
  const cx = (best.x0 + best.x1) / 2, top = (best.y0 + best.y1) / 2 - side / 2 - side * lift;
  const out = new OffscreenCanvas(size, size), o = out.getContext("2d");
  o.imageSmoothingQuality = "high";
  o.drawImage(img, cx - side / 2, top, side, side, 0, 0, size, size);
  const b = await out.convertToBlob({ type: "image/webp", quality: 0.9 });
  return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
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
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { "Content-Type": "image/webp" }); res.end(d); });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const port = 9400 + Math.floor(Math.random() * 400);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "medulla-av-"));
const proc = spawn(BROWSER, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })); });

try {
  let info; for (let i = 0; i < 60 && !info; i++) { try { info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(200); } }
  ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
  const { targetId } = await send("Target.createTarget", { url: base + "/__page" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }, sessionId); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500)); return r.result.value; };
  await sleep(800);
  const dir = path.join(ROOT, "assets/characters/avatars");
  fs.mkdirSync(dir, { recursive: true });
  for (const ch of CHARS) for (const mood of ["classic"].concat(MOODS)) {
    const [crop, lift] = ZOOM[ch];
    const src = mood === "classic" ? `/assets/characters/${ch}.webp` : `/assets/characters/poses/${ch}-${mood}.webp`;
    const data = await ev(`avatar(${JSON.stringify(src)}, ${crop}, ${lift}, ${SIZE})`);
    fs.writeFileSync(path.join(dir, `${ch}-${mood}.webp`), Buffer.from(data.split(",")[1], "base64"));
    console.log("wrote", ch, mood);
  }
} catch (e) { console.error(e.message || e); process.exitCode = 1; }
finally { try { ws && ws.close(); } catch {} proc.kill(); server.close(); }
