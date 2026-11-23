// Minimal service worker: its only job is to make Eventicor installable.
// It caches nothing; every request goes straight to the network.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (e) => {
  if (e.request.method === 'GET') e.respondWith(fetch(e.request))
})

// Web push: notifications arrive through this worker even when every
// Eventicor tab is closed. The payload carries title/body/data from /api/push.
self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { /* opaque payload */ }
  e.waitUntil(self.registration.showNotification(d.title || 'Eventicor', {
    body: d.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: d.tag || undefined,
    data: d.data || {},
  }))
})
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/'
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) { if ('focus' in c) { c.focus(); return } }
    return clients.openWindow(url)
  }))
})
