/*
 * Medulla service worker: offline support.
 *  - Precaches the app shell, the Lab and the facts (list below is written by
 *    node tools/build.js, which also bumps VERSION so old caches are cleared).
 *  - Pages: network first, then the cached copy, then offline.html.
 *  - JS, CSS and JSON: network first (so code always matches the page), cache when offline.
 *  - Other same-origin files (images): served from cache, refreshed in the background.
 *  - Google Fonts: cached after first use. Everything else: network only.
 */
const VERSION = "medulla-29682c118d";
const PRECACHE = [
  "./",
  "index.html",
  "learn.html",
  "lab.html",
  "explore.html",
  "offline.html",
  "manifest.webmanifest",
  "css/styles.css",
  "css/app.css",
  "css/polish.css",
  "js/prefs.js",
  "js/config.js",
  "js/i18n.js",
  "js/store.js",
  "js/backend.js",
  "js/sound.js",
  "js/motion.js",
  "js/main.js",
  "js/access.js",
  "js/home.js",
  "js/learn.js",
  "js/lab.js",
  "js/games.js",
  "js/explore.js",
  "js/fact-template.js",
  "js/fact.js",
  "js/lang/uz.js",
  "js/lang/ru.js",
  "js/lang/en.js",
  "data/facts.json",
  "data/kindness.json",
  "data/resources.json",
  "data/glossary.json",
  "glossary.html",
  "accessibility.html",
  "assets/brand/logo-96.webp",
  "assets/brand/logo-192.webp",
  "assets/brand/logo-white-96.webp",
  "assets/brand/favicon-64.png",
  "assets/img/brain-glass.webp",
  "assets/characters/dendi.webp",
  "assets/characters/memo.webp",
  "assets/characters/octa.webp",
  "assets/characters/syno.webp",
  "assets/characters/lumi.webp",
  "assets/characters/poses/dendi-correct.webp",
  "assets/characters/poses/dendi-tryagain.webp",
  "assets/characters/poses/dendi-win.webp",
  "assets/characters/poses/memo-correct.webp",
  "assets/characters/poses/memo-tryagain.webp",
  "assets/characters/poses/memo-win.webp",
  "assets/characters/poses/octa-correct.webp",
  "assets/characters/poses/octa-tryagain.webp",
  "assets/characters/poses/octa-win.webp",
  "assets/characters/poses/syno-correct.webp",
  "assets/characters/poses/syno-tryagain.webp",
  "assets/characters/poses/syno-win.webp",
  "assets/characters/poses/lumi-correct.webp",
  "assets/characters/poses/lumi-tryagain.webp",
  "assets/characters/poses/lumi-win.webp",
  "assets/characters/poses/lumi-curious.webp"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("medulla-") && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function fromNetworkAndCache(request, cacheName) {
  return fetch(request).then((res) => {
    if (res && res.ok && (res.type === "basic" || res.type === "cors")) {
      const copy = res.clone();
      caches.open(cacheName).then((c) => c.put(request, copy));
    }
    return res;
  });
}

// offline.html uses relative paths; a <base> keeps them working when the
// missing page was in a sub-folder such as facts/ or topics/.
function offlinePage() {
  return caches.match("offline.html").then((hit) => {
    if (!hit) return Response.error();
    return hit.text().then((html) => new Response(
      html.replace("<head>", '<head><base href="' + self.registration.scope + '">'),
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    ));
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (req.mode === "navigate") {
      event.respondWith(
        fromNetworkAndCache(req, VERSION).catch(() =>
          caches.match(req, { ignoreSearch: true })
            .then((hit) => hit || (url.pathname.endsWith("/") ? caches.match("index.html") : null))
            .then((hit) => hit || offlinePage())
        )
      );
      return;
    }
    // Code and data (JS, CSS, JSON) must match the page that loads them, so
    // they come from the network first; the cache is only the offline copy.
    // Images and other files: cache first, refreshed in the background.
    if (/\.(js|css|json|webmanifest)$/.test(url.pathname)) {
      event.respondWith(fromNetworkAndCache(req, VERSION).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || Response.error())));
      return;
    }
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then((hit) => {
        const refresh = fromNetworkAndCache(req, VERSION).catch(() => hit);
        return hit || refresh;
      })
    );
    return;
  }

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(caches.match(req).then((hit) => hit || fromNetworkAndCache(req, VERSION + "-fonts")));
  }
});
