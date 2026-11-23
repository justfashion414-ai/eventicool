import { initializeApp, cert } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

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
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: cors })

  // Health check (no auth): proves the service account loads and Firestore is reachable.
  if (req.method === 'GET') {
    try {
      init()
      const snap = await getFirestore().collection('health').doc('ping').get()
      return json(200, { ok: true, project: getFirestore().projectId, healthDoc: snap.exists ? snap.data() : null })
    } catch (e) {
      return json(500, { ok: false, error: String(e?.message || e) })
    }
  }

  if (req.method !== 'POST') return json(405, { error: 'POST only' })

  let body
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  // Public, read-only access to the platform catalog: the landing page reads prices and
  // template settings without signing in. Only this one document, only reads.
  if (body.op === 'get' && body.collection === 'platform' && body.id === 'catalog') {
    try {
      init()
      const pub = await getFirestore().collection('platform').doc('catalog').get()
      return json(200, pub.exists ? { id: pub.id, ...pub.data() } : null)
    } catch (e) {
      return json(500, { error: String(e?.message || e) })
    }
  }


  // Public read of the platform-wide settings (feed pagination, the storage
  // included with each plan and the invitee cap per plan). The landing page
  // shows the admin-set storage and invitee numbers with every plan, so the
  // values must be readable without signing in. Only these three fields leave
  // the server, nothing else in the doc.
  if (body.op === 'get-settings') {
    try {
      init()
      const snap = await getFirestore().collection('platform').doc('settings').get()
      const d = snap.exists ? snap.data() || {} : {}
      const fps = Number(d.feedPageSize)
      const st = d.storage || {}
      const storage = { essential: 5, complete: 10, legacy: 20 }
      for (const k of ['essential', 'complete', 'legacy']) {
        const g = Number(st[k])
        if (Number.isFinite(g) && g > 0) storage[k] = g
      }
      const iv = d.invitees || {}
      const invitees = { essential: 0, complete: 0, legacy: 0 }
      for (const k of ['essential', 'complete', 'legacy']) {
        const n = Number(iv[k])
        if (Number.isFinite(n) && n > 0) invitees[k] = Math.floor(n)
      }
      return json(200, { feedPageSize: Number.isFinite(fps) && fps > 0 ? Math.floor(fps) : 0, storage, invitees })
    } catch (e) {
      return json(500, { error: String(e?.message || e) })
    }
  }

  // Public availability checks for the landing's self-serve flow: an email or a
// name-pair address can only be used once. An email that already owns an
// account (Firebase Auth, a landing signup or an onboarded couple) is refused
// so the visitor is told before they build anything.
  if (body.op === 'check-email') {
    try {
      init()
      const em = String(body.email || '').trim().toLowerCase()
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return json(400, { error: 'A valid email is required' })
      let taken = false
      try {
        await getAuth().getUserByEmail(em)
        taken = true
      } catch (e) {
        if (!e || e.code !== 'auth/user-not-found') throw e
      }
      if (!taken) {
        const q1 = await getFirestore().collection('leads').where('email', '==', em).limit(1).get()
        if (!q1.empty) taken = true
      }
      if (!taken) {
        const q2 = await getFirestore().collection('events').where('contact', '==', em).limit(1).get()
        if (!q2.empty) taken = true
      }
      return json(200, { taken })
    } catch (e) {
      return json(500, { error: String(e?.message || e) })
    }
  }
  if (body.op === 'check-slug') {
    try {
      init()
      const sl = String(body.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '')
      if (!sl) return json(400, { error: 'A slug is required' })
      const q1 = await getFirestore().collection('leads').where('slug', '==', sl).limit(1).get()
      const q2 = await getFirestore().collection('events').where('slug', '==', sl).limit(1).get()
      return json(200, { taken: !q1.empty || !q2.empty })
    } catch (e) {
      return json(500, { error: String(e?.message || e) })
    }
  }

  // Public feed gate for a couple app's private feed: a guest taps the entry
  // banner and types the access code. The check happens here, server-side, so
  // the answer never comes from the browser. The returned generation changes
  // every time a code is revoked or replaced, which kills every old grant.
  if (body.op === 'feed-gate') {
    try {
      init()
      // Firestore document ids are case-sensitive (auto ids are mixed case),
      // so the app id is sanitized but never lower-cased here.
      const appId = String(body.appId || '').trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80)
      const code = String(body.code || '').trim().toUpperCase().slice(0, 40)
      if (!appId) return json(400, { ok: false, error: 'invalid' })
      const cfgSnap = await getFirestore().collection('apps').doc(appId).collection('app_config').doc('main').get()
      const cfg = cfgSnap.exists ? cfgSnap.data() : null
      if (!cfg || !cfg.feedPrivate) return json(200, { ok: true, open: true, gen: 0 })
      const gen = Math.max(1, Number(cfg.feedGateGen) || 1)
      // One code everywhere: the guest access code opens the private feed too.
      const gate = String(cfg.activeAccessCode || '').trim().toUpperCase()
      if (!gate) return json(200, { ok: false, error: 'no-code' })
      if (code === gate) return json(200, { ok: true, gen })
      return json(200, { ok: false, error: 'invalid' })
    } catch (e) {
      return json(500, { ok: false, error: String(e?.message || e) })
    }
  }
// Public, add-only access for the landing page's self-serve flow: a visitor
  // who designs their app and publishes it creates a 24-hour trial lead. No
  // auth (the landing has no account yet), no reads, and every field is
  // clamped so a stranger cannot write anything else into the collection.
  if (body.op === 'create-lead') {
    try {
      init()
      const b = body.data || {}
      const bride = String(b.bride || '').trim().slice(0, 40)
      const groom = String(b.groom || '').trim().slice(0, 40)
      if (!bride || !groom) return json(400, { error: 'Bride and groom names are required' })
      const em = String(b.email || '').trim().toLowerCase().slice(0, 160)
      const slugv = String(b.slug || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || (bride + '-' + groom).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'our-event'
      if (em) {
        const qe = await getFirestore().collection('leads').where('email', '==', em).limit(1).get()
        if (!qe.empty) return json(409, { error: 'email-taken' })
        let authTaken = false
        try {
          await getAuth().getUserByEmail(em)
          authTaken = true
        } catch (e) {
          if (!e || e.code !== 'auth/user-not-found') throw e
        }
        if (authTaken) return json(409, { error: 'email-taken' })
        const qc = await getFirestore().collection('events').where('contact', '==', em).limit(1).get()
        if (!qc.empty) return json(409, { error: 'email-taken' })
      }
      const qs1 = await getFirestore().collection('leads').where('slug', '==', slugv).limit(1).get()
      const qs2 = await getFirestore().collection('events').where('slug', '==', slugv).limit(1).get()
      if (!qs1.empty || !qs2.empty) return json(409, { error: 'slug-taken' })
      const hero = Array.isArray(b.heroImages)
        ? b.heroImages.filter((u) => /^https:\/\//.test(String(u))).slice(0, 14)
        : []
      const trialHours = Math.min(Math.max(Number(b.trialHours) || 24, 1), 24 * 7)
      const expiresAt = Date.now() + trialHours * 3600 * 1000
      const ref = await getFirestore().collection('leads').add({
        bride,
        groom,
        email: em,
        slug: slugv,
        city: String(b.city || '').slice(0, 60),
        template: String(b.template || 'classic').slice(0, 20),
        accent: String(b.accent || '').slice(0, 20),
        plan: String(b.plan || '').slice(0, 20),
        source: 'landing',
        status: 'trial',
        heroImages: hero,
        weddingDate: String(b.wedding_date || b.weddingDate || '').slice(0, 20),
        trialHours,
        expiresAt,
        createdAt: FieldValue.serverTimestamp(),
      })
      return json(200, { id: ref.id, exp: Math.floor(expiresAt / 1000) })
    } catch (e) {
      return json(500, { error: String(e?.message || e) })
    }
  }

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return json(401, { error: 'Missing bearer token' })

  let decoded = null
  try {
    init()
    decoded = await getAuth().verifyIdToken(token)
    body.uid = decoded.uid
  } catch {
    return json(401, { error: 'Invalid or expired token' })
  }

  // add-invitee rides the same app-scoped admin gate as every other app
  // write: point the gate at the app's invites collection up front.
  if (body.op === 'add-invitee') body.collection = 'apps/' + String(body.appId || '').trim() + '/invites'

  // Server-side enforcement for per-app data. Every couple app's data lives
  // under apps/<app>/...; admins of that app are named in apps/<app>/admins.
  // Suspended admins are refused outright, admin sessions expire by the
  // length each admin set (enforced here, not just in the browser), vendors
  // (photographer / videographer) may touch only the vendor albums, and
  // non-admin users (guests) may only write posts and resident profiles.
  const APPS_RE = /^apps\/([^/]+)\//
  const colPath = String(body.collection || '')
  const appMatch = APPS_RE.exec(colPath)
  if (appMatch) {
    const email = String(decoded.email || '').toLowerCase()
    if (email) {
      let adminDoc = null
      try {
        adminDoc = await getFirestore().collection('apps').doc(appMatch[1]).collection('admins').doc(email).get()
      } catch {}
      if (adminDoc && adminDoc.exists) {
        const a = adminDoc.data() || {}
        if (a.status === 'suspended') return json(403, { error: 'This admin access is suspended.' })
        const mins = Math.max(5, Math.min(Number(a.sessionMinutes) || 30, 60 * 24 * 7))
        const authTime = Number(decoded.auth_time) || 0
        // Sliding idle window: lastActiveAt is stamped by the admin's own
        // dashboard while it is in use, so an active admin is never refused
        // mid-session; idle past the window, access ends.
        let startSec = authTime
        const la = a.lastActiveAt || null
        let laSec = 0
        if (la) {
          if (typeof la.toDate === 'function') laSec = Math.floor(la.toDate().getTime() / 1000)
          else laSec = Number(la.seconds ?? la._seconds ?? 0) || 0
        }
        const nowSec = Date.now() / 1000
        if (laSec && laSec <= nowSec + 120 && laSec >= startSec - 120) startSec = Math.max(startSec, laSec)
        if (startSec && nowSec > startSec + mins * 60) {
          return json(401, { error: 'Your admin session expired. Sign in again.' })
        }
        const restricted = ['photographer', 'videographer', 'vendor'].includes(a.role)
        if (restricted && !colPath.replace(/^apps\/[^/]+\//, '').startsWith('albums')) {
          return json(403, { error: 'Your role is limited to the vendor albums.' })
        }
      } else {
        // A signed-in user who is not an admin of this app is a guest: they may
        // add to the feed and keep their own profile, nothing else.
        const writeOp = ['add', 'set', 'update', 'delete'].includes(body.op)
        const tail = colPath.replace(APPS_RE, '')
        if (writeOp && !tail.startsWith('posts') && !tail.startsWith('residents')) {
          return json(403, { error: 'You do not have access to do that here.' })
        }
      }
    }
  } else if (colPath !== 'health') {
    // Outside app data (leads, events, platform settings, admins, platform
    // audit): only the platform's own admins (top-level admins docs) may touch
    // it. A couple app's admin is NOT a platform admin; their account only
    // reaches their own apps/<id>/ data. One narrow guest exception: reading a
    // single event doc by its access id, which is how the /guest entry screen
    // works.
    const email = String(decoded.email || '').toLowerCase()
    const guestEventRead = colPath === 'events' && body.op === 'get' && !!body.id
    if (!guestEventRead) {
      if (email) {
        let adm = null
        try {
          adm = await getFirestore().collection('admins').doc(email).get()
        } catch {}
        if (!adm || !adm.exists) return json(403, { error: 'You do not have access to do that here.' })
      } else {
        return json(403, { error: 'Sign in with an admin account to do that.' })
      }
    }
  }

  // The couple's invitee list is capped by plan: the cap lives in
  // platform/settings.invitees.<plan> (0 or missing = unlimited) and the
  // app's plan comes from its leads doc. Enforced here, not in the browser,
  // so editing the page cannot get past it. Admins of the app only.
  if (body.op === 'add-invitee') {
    try {
      const appId = String(body.appId || '').trim()
      const inviteId = String(body.inviteId || '').trim()
      const name = String(body.name || '').trim().slice(0, 120)
      const phone = String(body.phone || '').replace(/\D/g, '').slice(0, 20)
      if (!/^[A-Za-z0-9_-]{6,64}$/.test(appId) || !/^[A-Za-z0-9_-]{6,64}$/.test(inviteId)) return json(400, { error: 'Missing app or invitation' })
      const email = String(decoded.email || '').toLowerCase()
      let adm = null
      try { adm = await getFirestore().collection('apps').doc(appId).collection('admins').doc(email).get() } catch {}
      if (!adm || !adm.exists) return json(403, { error: 'You do not have access to do that here.' })
      let cap = 0
      try {
        const s = await getFirestore().collection('platform').doc('settings').get()
        const iv = (s.exists ? s.data().invitees : null) || {}
        const lead = await getFirestore().collection('leads').doc(appId).get()
        const plan = String(lead.exists ? (lead.data().plan || 'essential') : 'essential').toLowerCase()
        const n = Number(iv[plan])
        if (Number.isFinite(n) && n > 0) cap = Math.floor(n)
      } catch {}
      if (cap > 0) {
        const inv = await getFirestore().collection('apps').doc(appId).collection('invites').get()
        let count = 0
        for (const d of inv.docs) { count += (await d.ref.collection('guests').get()).size }
        if (count >= cap) return json(403, { error: 'invitee-limit', limit: cap })
      }
      const ref = await getFirestore().collection('apps').doc(appId).collection('invites').doc(inviteId).collection('guests').add({ name, phone, createdAt: FieldValue.serverTimestamp() })
      return json(200, { id: ref.id })
    } catch (e) {
      return json(500, { error: String(e?.message || e) })
    }
  }

  const { op, collection, id, data, field, value, limit } = body
  if (!collection || typeof collection !== 'string' || collection.startsWith('_')) {
    return json(400, { error: 'A collection name is required' })
  }
  const col = getFirestore().collection(collection)

  try {
    switch (op) {
      case 'list': {
        let q = col
        if (field) q = q.where(field, '==', value)
        if (limit) q = q.limit(Number(limit) || 50)
        const snap = await q.get()
        return json(200, { docs: snap.docs.map((d) => ({ id: d.id, ...d.data() })) })
      }
      case 'get': {
        if (!id) return json(400, { error: 'id required' })
        const doc = await col.doc(String(id)).get()
        return json(200, doc.exists ? { id: doc.id, ...doc.data() } : null)
      }
      case 'add': {
        if (!data) return json(400, { error: 'data required' })
        const ref = await col.add({ ...data, createdBy: body.uid, createdAt: FieldValue.serverTimestamp() })
        return json(200, { id: ref.id })
      }
      case 'set': {
        if (!id || !data) return json(400, { error: 'id and data required' })
        await col.doc(String(id)).set(data)
        return json(200, { id: String(id) })
      }
      case 'update': {
        if (!id || !data) return json(400, { error: 'id and data required' })
        await col.doc(String(id)).set(data, { merge: true })
        return json(200, { id: String(id) })
      }
      case 'delete': {
        if (!id) return json(400, { error: 'id required' })
        await col.doc(String(id)).delete()
        return json(200, { id: String(id), deleted: true })
      }
      default:
        return json(400, { error: 'Unknown op; use list, get, add, set, update or delete' })
    }
  } catch (e) {
    return json(500, { error: String(e?.message || e) })
  }
}

export const config = { path: '/api/proxy' }
