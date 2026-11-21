const CACHE_NAME = `printer-party-v2:${self.registration.scope}`
const SHELL_ASSETS = ['./', './index.html']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key === 'printer-party-v1' && self.registration.scope === `${self.location.origin}/`)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  // Only cache same-origin GET requests
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope) ||
      new URL(request.url).pathname.includes('/api/')) {
    return
  }
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => caches.match(request))
  )
})
