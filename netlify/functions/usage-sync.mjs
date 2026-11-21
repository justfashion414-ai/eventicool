// Reconciles an app's storage usage against Cloudinary: walks the app's own
// Firestore media (posts, deleted posts, albums, hero images, avatars) and
// asks Cloudinary for the real byte size of every file it still stores. The
// result overwrites the app's usage doc, so the dashboard's storage reader
// shows what Cloudinary actually holds, not just the uploads made since
// client-side tracking started. Called by the couple dashboard when it opens
// and shortly after any upload.
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

let fbReady = false
function initFb() {
  if (fbReady) return
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) return
  const svc = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (!getApps().length) initializeApp({ credential: cert(svc), projectId: svc.project_id })
  fbReady = true
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}
const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } })

const cloudName = () => process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME || 'pnbw0sgp'
const cloudKey = () => process.env.CLOUDINARY_API_KEY || process.env.VITE_CLOUDINARY_API_KEY
const cloudSecret = () => process.env.CLOUDINARY_API_SECRET || process.env.VITE_CLOUDINARY_API_SECRET

const FULL_ROLES = ['owner', 'couple', 'admin', 'bride', 'groom']

// Pull Cloudinary public ids out of any document's media fields, whichever
// shape the data was stored in.
function mediaPublicIds(data) {
  const urls = []
  const push = (v) => {
    if (typeof v === 'string') urls.push(v)
    else if (Array.isArray(v)) v.forEach(push)
    else if (v && typeof v === 'object' && typeof v.url === 'string') urls.push(v.url)
  }
  push(data?.mediaUrls)
  push(data?.mediaUrl)
  push(data?.media)
  push(data?.heroImages)
  push(data?.photo)
  push(data?.authorPhoto)
  const out = new Map()
  for (const u of urls) {
    const m = String(u).match(/cloudinary\.com\/[^/]+\/(image|video)\/upload\/(?:v\d+\/)?([^?#]+?)(?:\.[a-zA-Z0-9]+)?(?:[?#].*)?$/)
    if (m && m[2]) out.set(`${m[1]}:${m[2]}`, { id: m[2], type: m[1] })
  }
  return [...out.values()]
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'GET') return json(405, { error: 'GET only' })
  try {
    const url = new URL(req.url)
    const appId = (url.searchParams.get('app') || '').slice(0, 80)
    if (!/^[A-Za-z0-9_-]{5,60}$/.test(appId)) return json(400, { error: 'Bad reference.' })
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) return json(401, { error: 'Sign in required.' })
    initFb()
    if (!fbReady) return json(500, { error: 'Storage checking is unavailable right now. Try again shortly.' })
    const fs = getFirestore()
    const decoded = await getAuth().verifyIdToken(token)
    const email = String(decoded.email || '').toLowerCase()
    if (!email) return json(403, { error: 'No email on this account.' })

    // Only the couple's full admins may reconcile their app's usage; the
    // platform's own admin login and restricted roles never reach this.
    let adminDoc = null
    try { adminDoc = await fs.collection('apps').doc(appId).collection('admins').doc(email).get() } catch {}
    const role = String(adminDoc && adminDoc.exists ? (adminDoc.data() || {}).role : '')
    if (!adminDoc || !adminDoc.exists || !FULL_ROLES.includes(role)) {
      return json(403, { error: "Only the couple's admins can do that." })
    }

    // Gather every Cloudinary reference the app still stores.
    const ids = new Map()
    const scan = (data) => mediaPublicIds(data).forEach((x) => ids.set(`${x.type}:${x.id}`, x))
    for (const col of ['posts', 'deleted_posts']) {
      try {
        const snap = await fs.collection('apps').doc(appId).collection(col).get()
        snap.forEach((d) => scan(d.data() || {}))
      } catch { /* skip a collection that will not read */ }
    }
    try {
      const alb = await fs.collection('apps').doc(appId).collection('albums').get()
      alb.forEach((d) => scan(d.data() || {}))
    } catch {}
    try {
      const cfg = await fs.collection('apps').doc(appId).collection('app_config').doc('main').get()
      if (cfg.exists) scan(cfg.data() || {})
    } catch {}
    try {
      const ev = await fs.collection('events').doc(appId).get()
      if (ev.exists) scan({ heroImages: (ev.data() || {}).heroImages })
    } catch {}

    if (!ids.size) {
      try {
        await fs.collection('apps').doc(appId).collection('usage').doc('main').set({
          imagesBytes: 0, videosBytes: 0, count: 0, source: 'cloudinary', syncedAt: FieldValue.serverTimestamp(),
        }, { merge: true })
      } catch {}
      return json(200, { imagesBytes: 0, videosBytes: 0, count: 0 })
    }

    if (!cloudKey() || !cloudSecret()) return json(500, { error: 'Cloudinary credentials are missing.' })
    const basic = 'Basic ' + Buffer.from(`${cloudKey()}:${cloudSecret()}`).toString('base64')
    let imagesBytes = 0
    let videosBytes = 0
    let found = 0
    for (const type of ['image', 'video']) {
      const list = [...ids.values()].filter((x) => x.type === type).map((x) => x.id)
      for (let i = 0; i < list.length; i += 60) {
        const chunk = list.slice(i, i + 60)
        const qs = chunk.map((id) => `public_ids[]=${encodeURIComponent(id)}`).join('&')
        let res
        try {
          res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName()}/resources/${type}?${qs}`, { headers: { Authorization: basic } })
        } catch { continue }
        if (!res.ok) continue
        const j = await res.json().catch(() => ({}))
        for (const r of (j.resources || [])) {
          const b = Math.max(0, Number(r.bytes) || 0)
          if (type === 'image') imagesBytes += b
          else videosBytes += b
          found++
        }
      }
    }

    try {
      await fs.collection('apps').doc(appId).collection('usage').doc('main').set({
        imagesBytes, videosBytes, count: found, source: 'cloudinary', syncedAt: FieldValue.serverTimestamp(),
      }, { merge: true })
    } catch { /* the reader still shows what was just measured */ }
    return json(200, { imagesBytes, videosBytes, count: found })
  } catch {
    return json(500, { error: 'Could not sync storage usage right now.' })
  }
}
