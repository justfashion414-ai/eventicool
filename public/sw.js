// Minimal service worker: its only job is to make Eventicor installable.
// It caches nothing; every request goes straight to the network.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})
