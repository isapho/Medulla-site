// Tests for website sign-in and sync (telegram/auth.mjs): real signatures, no network.
// Run: node --test telegram/auth.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { codeFor, verifyTelegramWidget, verifyTelegramWebApp, verifyGoogle, handleApi } from "./auth.mjs";

const BOT = "123456:TEST-TOKEN";
const NOW = 1800000000;
const SITE = "https://isapho.github.io/Medulla-site";

function widgetFields(extra = {}) {
  const f = Object.assign({ id: "42", first_name: "Aziza", username: "aziza", auth_date: String(NOW - 60) }, extra);
  const check = Object.keys(f).sort().map((k) => k + "=" + f[k]).join("\n");
  const secret = crypto.createHash("sha256").update(BOT).digest();
  f.hash = crypto.createHmac("sha256", secret).update(check).digest("hex");
  return f;
}
function webAppData(user = { id: 42, first_name: "A" }, authDate = NOW - 60) {
  const p = new URLSearchParams({ auth_date: String(authDate), query_id: "q", user: JSON.stringify(user) });
  const check = [...p.keys()].sort().map((k) => k + "=" + p.get(k)).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(BOT).digest();
  p.set("hash", crypto.createHmac("sha256", secret).update(check).digest("hex"));
  return p.toString();
}

test("the same person always gets the same well-formed code; others and other secrets differ", async () => {
  const a = await codeFor("s3cret", "telegram", "42");
  assert.match(a, /^(DENDI|MEMO|OCTA|SYNO|LUMI)(-[2-9A-HJKMNP-Z]{4}){3}$/);
  assert.equal(a, await codeFor("s3cret", "telegram", "42"));
  assert.notEqual(a, await codeFor("s3cret", "telegram", "43"));
  assert.notEqual(a, await codeFor("s3cret", "google", "42"));
  assert.notEqual(a, await codeFor("other", "telegram", "42"));
  await assert.rejects(codeFor("", "telegram", "42"));
});

test("Telegram widget: valid signature passes; tampering, wrong bot and old logins fail", async () => {
  assert.deepEqual(await verifyTelegramWidget(widgetFields(), BOT, NOW), { id: "42" });
  const tampered = widgetFields(); tampered.id = "43";
  assert.equal(await verifyTelegramWidget(tampered, BOT, NOW), null);
  assert.equal(await verifyTelegramWidget(widgetFields(), "999:OTHER", NOW), null);
  assert.equal(await verifyTelegramWidget(widgetFields({ auth_date: String(NOW - 90000) }), BOT, NOW), null, "older than a day");
  assert.equal(await verifyTelegramWidget({ id: "1" }, BOT, NOW), null);
  assert.equal(await verifyTelegramWidget(null, BOT, NOW), null);
});

test("Telegram Mini App initData is verified with the WebAppData key", async () => {
  assert.deepEqual(await verifyTelegramWebApp(webAppData(), BOT, NOW), { id: "42" });
  assert.equal(await verifyTelegramWebApp(webAppData().replace("auth_date=", "auth_date=1"), BOT, NOW), null);
  assert.equal(await verifyTelegramWebApp(webAppData({ id: 42 }, NOW - 90000), BOT, NOW), null);
  assert.equal(await verifyTelegramWebApp("", BOT, NOW), null);
});

// Google: a throwaway RSA key plays Google's signing key.
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = Object.assign(publicKey.export({ format: "jwk" }), { kid: "k1", alg: "RS256", use: "sig" });
const b64u = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
function idToken(claims = {}, header = {}) {
  const h = b64u(Object.assign({ alg: "RS256", kid: "k1", typ: "JWT" }, header));
  const p = b64u(Object.assign({ iss: "https://accounts.google.com", aud: "client-1.apps.googleusercontent.com", sub: "1234567890", exp: NOW + 3000 }, claims));
  const sig = crypto.sign("RSA-SHA256", Buffer.from(h + "." + p), privateKey).toString("base64url");
  return h + "." + p + "." + sig;
}
const fakeFetch = async () => ({ ok: true, json: async () => ({ keys: [jwk] }) });
const CID = "client-1.apps.googleusercontent.com";

test("Google ID token: signature, audience, issuer and expiry are all checked", async () => {
  const o = { fetchImpl: fakeFetch, nowSec: NOW };
  assert.deepEqual(await verifyGoogle(idToken(), CID, o), { id: "1234567890" });
  assert.equal(await verifyGoogle(idToken({ aud: "someone-else" }), CID, o), null);
  assert.equal(await verifyGoogle(idToken({ iss: "https://evil.example" }), CID, o), null);
  assert.equal(await verifyGoogle(idToken({ exp: NOW - 5 }), CID, o), null);
  assert.equal(await verifyGoogle(idToken({}, { kid: "unknown" }), CID, o), null);
  assert.equal(await verifyGoogle(idToken({}, { alg: "none" }), CID, o), null);
  const forged = idToken().split("."); forged[1] = b64u({ iss: "https://accounts.google.com", aud: CID, sub: "999", exp: NOW + 3000 });
  assert.equal(await verifyGoogle(forged.join("."), CID, o), null, "payload changed after signing");
  assert.equal(await verifyGoogle("not.a.jwt", CID, o), null);
  assert.equal(await verifyGoogle(idToken(), "", o), null);
});

// The HTTP layer, with an in-memory KV.
const kv = () => { const m = new Map(); return { m, get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => void m.set(k, v), delete: async (k) => void m.delete(k) }; };
const post = (path, body, origin = "https://isapho.github.io") => new Request("https://w.example" + path, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) });
const env = (o = {}) => Object.assign({ BOT_TOKEN: BOT, AUTH_SECRET: "s3cret", GOOGLE_CLIENT_ID: CID, SITE_URL: SITE + "/", SUBS: kv() }, o);
const api = (req, e) => handleApi(req, e, new URL(req.url).pathname, { fetchImpl: fakeFetch, now: () => NOW });

test("/auth returns only a code, from a verified identity, and is closed when not configured", async () => {
  const e = env();
  let r = await api(post("/auth/telegram", widgetFields()), e);
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.equal(j.code, await codeFor("s3cret", "telegram", "42"));
  assert.deepEqual(Object.keys(j).sort(), ["code", "ok"], "no name, username or id in the answer");
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), SITE.replace(/\/Medulla-site$/, ""));
  // the Mini App path gives the SAME code for the same Telegram user
  r = await api(post("/auth/telegram-webapp", { initData: webAppData() }), e);
  assert.equal((await r.json()).code, j.code);
  r = await api(post("/auth/google", { credential: idToken() }), e);
  assert.equal((await r.json()).code, await codeFor("s3cret", "google", "1234567890"));
  assert.equal((await api(post("/auth/telegram", { ...widgetFields(), id: "7" }), e)).status, 401);
  assert.equal((await api(post("/auth/google", { credential: idToken() }), env({ GOOGLE_CLIENT_ID: "" }))).status, 404);
  assert.equal((await api(post("/auth/telegram", widgetFields()), env({ AUTH_SECRET: "" }))).status, 503);
});

test("/sync saves, loads and deletes by hashed key, and refuses bad keys and big payloads", async () => {
  const e = env();
  const key = crypto.createHash("sha256").update("medulla:SYNOABCDEFGHJKMN").digest("hex");
  assert.equal((await (await api(post("/sync/load", { key }), e)).json()).reason, "not-found");
  assert.equal((await api(post("/sync/save", { key, payload: { xp: 5 } }), e)).status, 200);
  assert.deepEqual((await (await api(post("/sync/load", { key }), e)).json()).payload, { xp: 5 });
  assert.ok(e.SUBS.m.has("p:" + key));
  assert.equal((await api(post("/sync/save", { key: "short", payload: {} }), e)).status, 400);
  assert.equal((await api(post("/sync/save", { key, payload: { s: "x".repeat(30000) } }), e)).status, 413);
  await api(post("/sync/delete", { key }), e);
  assert.equal(e.SUBS.m.size, 0);
});

test("CORS: only the site (and localhost) may call from a browser", async () => {
  const e = env();
  const ok = await api(new Request("https://w.example/sync/load", { method: "OPTIONS", headers: { Origin: "https://isapho.github.io" } }), e);
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get("Access-Control-Allow-Origin"), "https://isapho.github.io");
  const local = await api(post("/sync/load", { key: "x" }, "http://localhost:5178"), e);
  assert.equal(local.headers.get("Access-Control-Allow-Origin"), "http://localhost:5178");
  const evil = await api(post("/sync/load", { key: "x" }, "https://evil.example"), e);
  assert.equal(evil.headers.get("Access-Control-Allow-Origin"), null);
});

import { issueLoginCode, newLoginCode } from "./auth.mjs";

test("bot login code: issued once, exchanged once, same account as the Telegram widget", async () => {
  const e = env();
  const code = await issueLoginCode(e.SUBS, 42);
  assert.match(code, /^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
  assert.equal(new Set(Array.from({ length: 50 }, newLoginCode)).size, 50, "codes don't repeat");
  const r = await api(post("/auth/telegram-code", { code: code.toLowerCase().replace("-", " ") }), e);
  const j = await r.json();
  assert.equal(j.code, await codeFor("s3cret", "telegram", "42"), "same sync code as the widget gives");
  assert.deepEqual(Object.keys(j).sort(), ["code", "ok"]);
  assert.equal((await api(post("/auth/telegram-code", { code }), e)).status, 401, "single use");
  assert.equal((await api(post("/auth/telegram-code", { code: "AAAA-AAAA" }), e)).status, 401, "unknown code");
  assert.equal((await api(post("/auth/telegram-code", { code: "12" }), e)).status, 401);
});
