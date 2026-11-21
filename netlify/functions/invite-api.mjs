// Public endpoint for inbox invite cards: a guest's standalone invitation
// page reads its card here and each open is counted. No sign-in: guests open
// the link from anywhere. Only the card's own id reaches it.
import { initializeApp, cert } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

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
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } })

// The only fields a guest's card needs. Nothing else leaves the doc.
const PUBLIC = ['bride', 'groom', 'tpl', 'wedDate', 'month', 'day', 'year', 'venue', 'city', 'message', 'hashtag', 'dress', 'rsvpBy', 'whatsapp', 'schedule', 'music']

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: cors })
  try {
    init()
    const url = new URL(req.url)
    const id = String(url.searchParams.get('id') || '')
    if (!/^[A-Za-z0-9_-]{6,40}$/.test(id)) return json(400, { error: 'A valid invite id is required' })
    const app = String(url.searchParams.get('app') || '').trim()
    const ref = /^[A-Za-z0-9_-]{10,64}$/.test(app)
      ? getFirestore().collection('apps').doc(app).collection('invites').doc(id)
      : getFirestore().collection('invites').doc(id)

    if (req.method === 'GET') {
      const doc = await ref.get()
      if (!doc.exists) return json(404, { error: 'This invitation does not exist' })
      const d = doc.data() || {}
      const out = { id }
      PUBLIC.forEach((f) => { out[f] = d[f] ?? '' })
      return json(200, out)
    }

    if (req.method === 'POST') {
      const doc = await ref.get()
      if (!doc.exists) return json(404, { error: 'This invitation does not exist' })
      await ref.set({ opens: FieldValue.increment(1), lastOpenAt: FieldValue.serverTimestamp() }, { merge: true })
      const after = await ref.get()
      return json(200, { ok: true, opens: (after.data() || {}).opens ?? 0 })
    }

    return json(405, { error: 'GET or POST only' })
  } catch (e) {
    return json(500, { error: String(e?.message || e) })
  }
}

export const config = { path: '/api/invite' }
