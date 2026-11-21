// Public endpoint for inbox invite cards: a guest's standalone invitation
// page reads its card here, each open is counted, and with a per-guest link
// (g=) the open marks THAT invitee as opened and their reply lands on them.
// No sign-in: guests open the link from anywhere. Only the card's own id and
// guest id reach it.
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
const PUBLIC = ['bride', 'groom', 'tpl', 'wedDate', 'month', 'day', 'year', 'venue', 'city', 'message', 'hashtag', 'dress', 'rsvpBy', 'whatsapp', 'schedule', 'music', 'photos', 'dressColors']
const ID_OK = /^[A-Za-z0-9_-]{6,40}$/

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: cors })
  try {
    init()
    const url = new URL(req.url)
    const id = String(url.searchParams.get('id') || '')
    if (!ID_OK.test(id)) return json(400, { error: 'A valid invite id is required' })
    const app = String(url.searchParams.get('app') || '').trim()
    const scoped = /^[A-Za-z0-9_-]{10,64}$/.test(app)
    const ref = scoped
      ? getFirestore().collection('apps').doc(app).collection('invites').doc(id)
      : getFirestore().collection('invites').doc(id)
    const gid = String(url.searchParams.get('g') || '').trim()
    const gref = scoped && ID_OK.test(gid)
      ? ref.collection('guests').doc(gid)
      : null

    if (req.method === 'GET') {
      const doc = await ref.get()
      if (!doc.exists) return json(404, { error: 'This invitation does not exist' })
      const d = doc.data() || {}
      const out = { id }
      PUBLIC.forEach((f) => { out[f] = d[f] ?? '' })
      if (gref) {
        const g = await gref.get()
        if (g.exists) {
          const gd = g.data() || {}
          out.guest = { id: gid, name: gd.name || '', opened: Boolean(gd.openedAt) }
        }
      }
      return json(200, out)
    }

    if (req.method === 'POST') {
      let body = {}
      try { body = await req.json() } catch { /* legacy ping with no body */ }
      const action = String(body.action || '')
      const doc = await ref.get()
      if (!doc.exists) return json(404, { error: 'This invitation does not exist' })

      if (action === 'reply') {
        if (!gref) return json(400, { error: 'A valid guest link is required' })
        const g = await gref.get()
        if (!g.exists) return json(404, { error: 'This invitation does not exist' })
        const attend = body.attend === 'no' ? 'no' : 'yes'
        const note = String(body.note || '').slice(0, 400)
        const name = String(body.name || '').slice(0, 60)
        await gref.set({ reply: { name, attend, note, at: FieldValue.serverTimestamp() } }, { merge: true })
        return json(200, { ok: true })
      }

      // Open: a tap anywhere on the card counts. With a per-guest link the
      // invitee's own doc is stamped once, so the couple sees "when it was
      // opened" and not-opened before that.
      if (gref) {
        const g = await gref.get()
        if (g.exists && !(g.data() || {}).openedAt) {
          await gref.set({ openedAt: FieldValue.serverTimestamp() }, { merge: true })
        }
      }
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
