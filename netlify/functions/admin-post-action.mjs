// admin-post-action: delete / restore / erase a guest post from one couple's
// app. The dashboard's feed Remove button, Recycle bin restore and permanent
// erase all come through here with the caller's Firebase ID token. Requests
// carry the app id, so every action is scoped to one project and never another.
//   delete  - move the post into the app's deleted_posts bin (recoverable)
//   restore - move it back to the feed exactly as it was
//   erase   - delete it from the bin for good and purge its Cloudinary files
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { createHash } from 'crypto'

let ready = false
function init() {
  if (ready) return
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON env var is not set')
  const svc = typeof raw === 'string' ? JSON.parse(raw) : raw
  initializeApp({ credential: cert(svc), projectId: svc.project_id })
  ready = true
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })

const cloudName = () => process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME || 'pnbw0sgp'
const cloudKey = () => process.env.CLOUDINARY_API_KEY || process.env.VITE_CLOUDINARY_API_KEY
const cloudSecret = () => process.env.CLOUDINARY_API_SECRET || process.env.VITE_CLOUDINARY_API_SECRET

// Cloudinary destroy for one public id; video files use the video endpoint.
// Missing credentials or a network hiccup never blocks the delete itself:
// the post is always removed, the file purge is best effort.
async function cloudinaryDestroy(publicId, resourceType) {
  const key = cloudKey()
  const secret = cloudSecret()
  if (!key || !secret) return false
  const ts = Math.floor(Date.now() / 1000)
  const sig = createHash('sha1').update(`public_id=${publicId}&timestamp=${ts}${secret}`).digest('hex')
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName()}/${resourceType}/destroy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ public_id: publicId, timestamp: String(ts), api_key: key, signature: sig }),
    })
    const j = await res.json().catch(() => ({}))
    return res.ok && (j.result === 'ok' || j.result === 'not found')
  } catch {
    return false
  }
}

// Pull Cloudinary public ids out of a post's media fields, whichever shape
// the post stored them in.
function mediaPublicIds(data) {
  const urls = []
  const push = (v) => {
    if (typeof v === 'string') urls.push(v)
    else if (Array.isArray(v)) v.forEach(push)
    else if (v && typeof v === 'object' && typeof v.url === 'string') urls.push(v.url)
  }
  push(data?.mediaUrls)
  push(data?.mediaUrl)
  push(data?.thumbnailUrl)
  push(data?.media?.urls)
  const ids = []
  for (const u of urls) {
    const m = String(u).match(/cloudinary\.com\/[^/]+\/(image|video)\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?(?:[?#].*)?$/)
    if (m) ids.push({ id: m[2], type: m[1] })
  }
  return ids
}


export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'POST only' })
  try {
    init()
    const db = getFirestore()
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) return json(401, { error: 'Sign in required.' })
    const decoded = await getAuth().verifyIdToken(token)
    const email = String(decoded.email || '').toLowerCase()
    if (!email) return json(403, { error: 'No email on this account.' })
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || '')
    const postId = String(body.postId || '')
    const appId = String(body.appId || '')
    if (!['delete', 'restore', 'erase'].includes(action)) return json(400, { error: 'Unknown action.' })
    if (!/^[A-Za-z0-9_-]{5,60}$/.test(postId) || !/^[A-Za-z0-9_-]{5,60}$/.test(appId)) return json(400, { error: 'Bad reference.' })

    // Only the admins THIS app lists may act on its posts, and only full
    // dashboard roles: the platform's own admin login stays inside the
    // Eventicor console and never reaches a couple's app (user direction
    // Nov 21 2026). Restricted roles (photographer / videographer / vendor)
    // may touch only the vendor albums, like the proxy.
    let adminDoc = null
    try { adminDoc = await db.collection('apps').doc(appId).collection('admins').doc(email).get() } catch {}
    const adminRole = String(adminDoc && adminDoc.exists ? (adminDoc.data() || {}).role : '')
    if (!adminDoc || !adminDoc.exists || !['owner', 'couple', 'admin', 'bride', 'groom'].includes(adminRole)) {
      return json(403, { error: "Only the couple's admins can do that." })
    }

    const posts = db.collection('apps').doc(appId).collection('posts')
    const bin = db.collection('apps').doc(appId).collection('deleted_posts')

    if (action === 'delete') {
      const snap = await posts.doc(postId).get()
      if (!snap.exists) return json(404, { error: 'Post not found.' })
      const data = snap.data() || {}
      await bin.doc(postId).set({ ...data, deletedAt: FieldValue.serverTimestamp(), deletedBy: email })
      await posts.doc(postId).delete()
      return json(200, { id: postId, deleted: true, media: { purged: 0 } })
    }

    const snap = await bin.doc(postId).get()
    if (!snap.exists) return json(404, { error: 'Post not found.' })
    const data = snap.data() || {}

    if (action === 'restore') {
      const { deletedAt, deletedBy, ...rest } = data
      await posts.doc(postId).set(rest)
      await bin.doc(postId).delete()
      return json(200, { id: postId, restored: true, media: { purged: 0 } })
    }

    // erase: permanent delete plus a best-effort Cloudinary purge
    let purged = 0
    for (const it of mediaPublicIds(data)) {
      if (await cloudinaryDestroy(it.id, it.type)) purged++
    }
    await bin.doc(postId).delete()
    return json(200, { id: postId, erased: true, media: { purged } })
  } catch (e) {
    return json(500, { error: String(e?.message || e) })
  }
}

export const config = { path: '/api/admin-post-action' }
