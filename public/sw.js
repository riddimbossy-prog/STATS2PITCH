const CACHE = "stats2pitch-shell-v5.20.0";
const PRECACHE = ["/offline.html", "/assets/s2p-pitch-mark.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const path = url.pathname;
  const skipCache = path === "/" || /\.(html?|js|css|webmanifest)(\?|$)/i.test(path) || path.startsWith("/apk/");
  if (skipCache) {
    e.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }
  e.respondWith(fetch(req).catch(() => caches.match(req)));
});
