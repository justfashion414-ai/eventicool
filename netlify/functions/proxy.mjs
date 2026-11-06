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
