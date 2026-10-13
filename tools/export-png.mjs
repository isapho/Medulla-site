#!/usr/bin/env node
/*
 * Share image export (needs Microsoft Edge or Google Chrome).
 *
 *   node tools/export-png.mjs
 *
 * Writes the share image assets/brand/og-image.jpg (from tools/og.html). Run it
 * after `node tools/logo.mjs` or `node tools/cutout.mjs` if the art changes.
 * (Favicons and app icons come from tools/logo.mjs; character PNGs for the
 * Telegram bot from tools/cutout.mjs.)
 * Set BROWSER=<path> to use another Chromium browser.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
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

const JOBS = [
  { page: "tools/og.html", w: 1200, h: 630, out: "assets/brand/og-image.jpg", jpeg: true }
];

const TYPES = { ".html": "text/html; charset=utf-8", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".css": "text/css", ".js": "text/javascript" };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/__render") {
    const src = u.searchParams.get("src"), s = +u.searchParams.get("s");
    res.writeHead(200, { "Content-Type": TYPES[".html"] });
    res.end(`<!doctype html><style>html,body{margin:0;background:transparent}img{display:block;width:${s}px;height:${s}px}</style><img src="/${src}">`);
    return;
  }
  const file = path.join(ROOT, decodeURIComponent(u.pathname));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const port = 9400 + Math.floor(Math.random() * 400);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "medulla-export-"));
const proc = spawn(BROWSER, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
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
  for (const job of JOBS) {
    const w = job.w || job.size, h = job.h || job.size;
    await S("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await S("Emulation.setDefaultBackgroundColorOverride", { color: job.jpeg ? { r: 13, g: 17, b: 40, a: 1 } : { r: 0, g: 0, b: 0, a: 0 } });
    const url = job.page ? `${base}/${job.page}` : `${base}/__render?src=${encodeURIComponent(job.svg)}&s=${job.size}`;
    await S("Page.navigate", { url });
    await sleep(job.page ? 2500 : 500);
    const shot = await S("Page.captureScreenshot", job.jpeg ? { format: "jpeg", quality: 88 } : { format: "png" });
    fs.writeFileSync(path.join(ROOT, job.out), Buffer.from(shot.data, "base64"));
    console.log("wrote", job.out);
  }
} catch (e) {
  console.error(e); process.exitCode = 1;
} finally {
  try { ws && ws.close(); } catch {}
  proc.kill(); server.close();
}
