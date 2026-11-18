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

  try {
    init()
    const decoded = await getAuth().verifyIdToken(token)
    body.uid = decoded.uid
  } catch {
    return json(401, { error: 'Invalid or expired token' })
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
