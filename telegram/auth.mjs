/*
 * Sign in with Telegram or Google, and cloud sync, for the Cloudflare Worker.
 * No packages; uses WebCrypto (Workers, browsers and Node 18+).
 *
 * How it fits the site's no-accounts design (README decisions 2 and 14):
 *   - The site's sync already works with a "sync code": only its SHA-256 hash
 *     is sent and progress is stored under that hash.
 *   - Signing in with Telegram or Google just hands the person a sync code that
 *     the server derives from their identity with a secret:
 *         code = format( HMAC-SHA256(AUTH_SECRET, "telegram:<id>" | "google:<sub>") )
 *     so the same person gets the same code on every device, nobody can work
 *     it out without AUTH_SECRET, and the stored data is keyed by the code's
 *     hash, not by the Telegram id, name or e-mail.
 *   - Name, username, photo and e-mail are verified and then dropped: never
 *     stored, never logged.
 *
 * Routes (see worker.mjs): POST /auth/telegram, /auth/telegram-webapp,
 * /auth/google, /sync/save, /sync/load, /sync/delete.
 */

const ENC = new TextEncoder();
const WORDS = ["DENDI", "MEMO", "OCTA", "SYNO", "LUMI"];
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // same as js/backend.js

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmac(keyBytes, message) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, typeof message === "string" ? ENC.encode(message) : message));
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/* The sync code for an identity, e.g. "SYNO-7K3F-92QX-M4TZ" (same shape the site expects). */
export async function codeFor(secret, provider, id) {
  if (!secret) throw new Error("AUTH_SECRET is not set");
  const b = await hmac(ENC.encode(secret), provider + ":" + id);
  let out = WORDS[b[0] % WORDS.length];
  for (let g = 0; g < 3; g++) {
    out += "-";
    for (let i = 0; i < 4; i++) out += ALPHABET[b[1 + g * 4 + i] % ALPHABET.length];
  }
  return out;
}

/* Telegram Login Widget: https://core.telegram.org/widgets/login#checking-authorization */
export async function verifyTelegramWidget(fields, botToken, nowSec = Math.floor(Date.now() / 1000), maxAge = 86400) {
  if (!fields || typeof fields !== "object" || !fields.hash || !fields.id || !fields.auth_date) return null;
  const check = Object.keys(fields).filter((k) => k !== "hash").sort().map((k) => k + "=" + fields[k]).join("\n");
  const secretKey = new Uint8Array(await crypto.subtle.digest("SHA-256", ENC.encode(botToken)));
  const expected = hex(await hmac(secretKey, check));
  if (!safeEqual(expected, String(fields.hash).toLowerCase())) return null;
  if (nowSec - Number(fields.auth_date) > maxAge || Number(fields.auth_date) - nowSec > 300) return null;
  return { id: String(fields.id) };
}

/* Telegram Mini App initData: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app */
export async function verifyTelegramWebApp(initData, botToken, nowSec = Math.floor(Date.now() / 1000), maxAge = 86400) {
  const params = new URLSearchParams(String(initData || ""));
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const check = [...params.keys()].sort().map((k) => k + "=" + params.get(k)).join("\n");
  const secretKey = await hmac(ENC.encode("WebAppData"), botToken);
  const expected = hex(await hmac(secretKey, check));
  if (!safeEqual(expected, hash.toLowerCase())) return null;
  const at = Number(params.get("auth_date"));
  if (!at || nowSec - at > maxAge) return null;
  let user = null;
  try { user = JSON.parse(params.get("user") || "null"); } catch (e) { user = null; }
  return user && user.id ? { id: String(user.id) } : null;
}

/* "Sign in with Google" ID token (a JWT signed with RS256). */
const b64urlToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
let certCache = null;

export async function verifyGoogle(credential, clientId, { fetchImpl = fetch, nowSec = Math.floor(Date.now() / 1000) } = {}) {
  if (!clientId || typeof credential !== "string") return null;
  const parts = credential.split(".");
  if (parts.length !== 3) return null;
  let header, claims;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
    claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  } catch (e) { return null; }
  if (header.alg !== "RS256" || !header.kid) return null;
  if (!certCache || nowSec - certCache.at > 3600) {
    const r = await fetchImpl("https://www.googleapis.com/oauth2/v3/certs");
    if (!r.ok) return null;
    certCache = { at: nowSec, keys: (await r.json()).keys || [] };
  }
  const jwk = certCache.keys.find((k) => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(parts[2]), ENC.encode(parts[0] + "." + parts[1]));
  if (!ok) return null;
  if (claims.aud !== clientId) return null;
  if (claims.iss !== "https://accounts.google.com" && claims.iss !== "accounts.google.com") return null;
  if (!claims.exp || claims.exp < nowSec || !claims.sub) return null;
  return { id: String(claims.sub) };
}

/* ------------------------------------------------------------ the routes */

const KEY = /^[0-9a-f]{64}$/;
const MAX_PAYLOAD = 20000; // characters of JSON; real progress is well under 5 KB

const json = (obj, status = 200, headers = {}) =>
  new Response(JSON.stringify(obj), { status, headers: Object.assign({ "Content-Type": "application/json" }, headers) });

/* Which pages may call these routes from a browser. */
export function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const site = String(env.SITE_URL || "").replace(/\/[^/]*$/, "") || "";
  let allowed = false;
  try { allowed = origin === new URL(env.SITE_URL || "https://invalid.invalid").origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin); } catch (e) { allowed = false; }
  return allowed
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", Vary: "Origin" }
    : {};
}

export async function handleApi(request, env, path, { fetchImpl = fetch, now = () => Math.floor(Date.now() / 1000) } = {}) {
  const cors = corsHeaders(request, env);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json({ ok: false, reason: "method" }, 405, cors);
  let body;
  try { body = await request.json(); } catch (e) { return json({ ok: false, reason: "bad-json" }, 400, cors); }
  const reply = (obj, status) => json(obj, status || 200, cors);

  if (path.startsWith("/auth/")) {
    if (!env.AUTH_SECRET) return reply({ ok: false, reason: "off" }, 503);
    let who = null, provider = null;
    if (path === "/auth/telegram" && env.BOT_TOKEN) { provider = "telegram"; who = await verifyTelegramWidget(body, env.BOT_TOKEN, now()); }
    else if (path === "/auth/telegram-webapp" && env.BOT_TOKEN) { provider = "telegram"; who = await verifyTelegramWebApp(body.initData, env.BOT_TOKEN, now()); }
    else if (path === "/auth/google" && env.GOOGLE_CLIENT_ID) { provider = "google"; who = await verifyGoogle(body.credential, env.GOOGLE_CLIENT_ID, { fetchImpl, nowSec: now() }); }
    else return reply({ ok: false, reason: "off" }, 404);
    if (!who) return reply({ ok: false, reason: "invalid" }, 401);
    return reply({ ok: true, code: await codeFor(env.AUTH_SECRET, provider, who.id) });
  }

  if (!env.SUBS) return reply({ ok: false, reason: "off" }, 503);
  if (!KEY.test(String(body.key || ""))) return reply({ ok: false, reason: "bad-key" }, 400);
  const kvKey = "p:" + body.key;
  if (path === "/sync/save") {
    const text = JSON.stringify(body.payload === undefined ? null : body.payload);
    if (text.length > MAX_PAYLOAD) return reply({ ok: false, reason: "too-big" }, 413);
    await env.SUBS.put(kvKey, text);
    return reply({ ok: true });
  }
  if (path === "/sync/load") {
    const v = await env.SUBS.get(kvKey);
    return v ? reply({ ok: true, payload: JSON.parse(v) }) : reply({ ok: false, reason: "not-found" }, 404);
  }
  if (path === "/sync/delete") {
    await env.SUBS.delete(kvKey);
    return reply({ ok: true });
  }
  return reply({ ok: false, reason: "not-found" }, 404);
}
