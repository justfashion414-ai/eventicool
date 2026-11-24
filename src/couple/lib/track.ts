// App-level counters for the platform analytics. Every couple app reports an
// open on boot, a feed open when the feed tab opens and a post add when a
// guest posts. Reporting is best effort (it never blocks or breaks the app)
// and deduped so the counts stay meaningful: each kind counts once per
// browser session, and a visitor id lets the daily ledger tell repeat visits
// apart.
const APP_RE = /^[A-Za-z0-9_-]{1,80}$/
const SID_KEY = 'ev-visitor-id'
export type TrackKind = 'open' | 'feed_open' | 'post_add'

export function trackAppEvent(app: string, kind: TrackKind) {
  try {
    if (!APP_RE.test(app)) return;
    const key = `ev-trk-${app}-${kind}`
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1')
    let sid = localStorage.getItem(SID_KEY)
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36)
      try { localStorage.setItem(SID_KEY, sid) } catch { /* private mode */ }
    }
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app, kind, sid: sid.slice(0, 64) }),
      keepalive: true,
    }).catch(() => { /* analytics never breaks the app */ })
  } catch { /* analytics never breaks the app */ }
}
