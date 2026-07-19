const CACHE_NAME = "life-log-calendar-20260719-formal-v1";
const PRECACHE = [
  "./",
  "./index.html",
  "./styles.css?v=20260719-formal",
  "./app.js?v=20260719-formal",
  "./manifest.webmanifest?v=20260719-formal",
  "./mark.svg?v=20260719-formal",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && (key.startsWith("life-log-calendar-") || key.startsWith("vitality-journal-")))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true }));
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      networkFirst(event.request)
        .then((response) => response || caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(networkFirst(event.request));
});