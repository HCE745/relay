const CACHE = "relay-v1"
const OFFLINE_URL = "/offline.html"

// On install: cache the offline fallback page
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL))
  )
  self.skipWaiting()
})

// On activate: remove old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin GET requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return

  // Never cache API routes — always hit the network
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/data/")) return

  // Cache-first for Next.js static assets (they have content hashes)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone()
              caches.open(CACHE).then((cache) => cache.put(request, clone))
            }
            return response
          })
      )
    )
    return
  }

  // Cache static public assets (icons, images, fonts)
  if (
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|woff2?|ttf|ico)$/) ||
    url.pathname === "/offline.html"
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone()
              caches.open(CACHE).then((cache) => cache.put(request, clone))
            }
            return response
          })
      )
    )
    return
  }

  // Navigation requests: network-first, fallback to offline page
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    )
  }
})
