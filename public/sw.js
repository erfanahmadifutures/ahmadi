/* Minimal PWA service worker: installable + offline shell for static assets.
   Never caches API calls, auth routes or OAuth redirects. */
const CACHE = "ahmadi-v1";
const ASSETS = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/~oauth") || url.pathname.startsWith("/auth"))
    return;
  if (!ASSETS.includes(url.pathname)) return;
  event.respondWith(caches.match(event.request).then((hit) => hit || fetch(event.request)));
});
