/* Simple offline-first service worker */
// Bump cache name to invalidate old entries after SW change.
const CACHE_NAME = "copilot-pwa-v2";
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isHttp = url.protocol === "http:" || url.protocol === "https:";
  if (!isHttp || url.protocol === "chrome-extension:") {
    // Ignore browser-extension, file:, data:, and other non-HTTP(s) requests.
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          // Only cache successful, same-origin/basic responses.
          if (response.ok && response.type === "basic") {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
