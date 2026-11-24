// set-app-names: carries a couple's rename to every surface that reads the
// names from the app's own documents. The dashboard's Events & photos card
// saves the new names to app_config; this call then updates the events doc
// (customer apps) or the leads doc (trial and sample apps) plus every invite
// doc, so the share card (app-meta), invite pages, the install manifest and
// reminder emails all show the new names without waiting on anything else.
// The caller must be an admin of THIS app (or a platform admin); vendors are
// refused outright.
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } })

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'POST only' })

  let body
  try { body = await req.json() } catch { return json(400, { error: 'Invalid JSON body' }) }

  const appId = String(body.appId || '').trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80)
  const bride = String(body.bride || '').trim().slice(0, 40)
  const groom = String(body.groom || '').trim().slice(0, 40)
  if (!appId || !bride || !groom) return json(400, { error: 'appId, bride and groom are required' })

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return json(401, { error: 'Missing bearer token' })
  let decoded = null
  try { decoded = await getAuth().verifyIdToken(token) } catch { return json(401, { error: 'Invalid or expired token' }) }
  const email = String(decoded.email || '').toLowerCase()
  if (!email) return json(403, { error: 'You do not have access to do that here.' })

  try {
    init()
    const db = getFirestore()
    let adminDoc = null
    try { adminDoc = await db.collection('apps').doc(appId).collection('admins').doc(email).get() } catch {}
    let platformAdmin = null
    if (!adminDoc || !adminDoc.exists) {
      try { platformAdmin = await db.collection('admins').doc(email).get() } catch {}
    }
    if (!adminDoc?.exists && !platformAdmin?.exists) return json(403, { error: 'You do not have access to do that here.' })
    if (adminDoc?.exists) {
      const a = adminDoc.data() || {}
      if (a.status === 'suspended') return json(403, { error: 'This admin access is suspended.' })
      if (['photographer', 'videographer', 'vendor'].includes(String(a.role || ''))) {
        return json(403, { error: 'Your role is limited to the vendor albums.' })
      }
    }

    // The app's own document: events for customer apps, leads for trials and
    // samples. Only one of them holds this app.
    let home = null
    let cur = null
    const ev = await db.collection('events').doc(appId).get()
    if (ev.exists) { home = 'events'; cur = ev.data() || {} }
    else {
      const ld = await db.collection('leads').doc(appId).get()
      if (ld.exists) { home = 'leads'; cur = ld.data() || {} }
    }
    const fromBride = String(cur?.bride || '')
    const fromGroom = String(cur?.groom || '')
    const fromSlug = String(cur?.slug || '')
    // The address follows the names when the new one is free. A taken address
    // keeps the old one; the caller is told which happened so the dashboard
    // can say the truth.
    let finalSlug = fromSlug
    let slugChanged = false
    const wantSlug = String(body.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '').slice(0, 60)
    if (home && wantSlug && wantSlug !== fromSlug) {
      let free = false
      try {
        const q1 = await db.collection('leads').where('slug', '==', wantSlug).limit(3).get()
        const q2 = await db.collection('events').where('slug', '==', wantSlug).limit(3).get()
        free = !q1.docs.some((d) => d.id !== appId) && !q2.docs.some((d) => d.id !== appId)
      } catch {}
      if (free) { finalSlug = wantSlug; slugChanged = true }
    }
    if (home) await db.collection(home).doc(appId).set(slugChanged ? { bride, groom, slug: finalSlug } : { bride, groom }, { merge: true })

    // The name-change history: what it was, what it became, when and by whom.
    // The admin console's Manage dialog reads this list.
    if (home) {
      try {
        await db.collection('apps').doc(appId).collection('name_history').add({
          at: FieldValue.serverTimestamp(),
          by: email,
          fromBride,
          fromGroom,
          toBride: bride,
          toGroom: groom,
          fromSlug,
          toSlug: finalSlug,
        })
      } catch { /* history is best effort */ }
    }

    // Invite docs carry a copied pair of names for the invite page; every one
    // of this app's invites follows the rename.
    let invites = 0
    try {
      const snap = await db.collection('apps').doc(appId).collection('invites').get()
      const batch = db.batch()
      snap.forEach((d) => { batch.set(d.ref, { bride, groom }, { merge: true }); invites++ })
      if (invites) await batch.commit()
    } catch { /* invites stay on their old names rather than failing the rename */ }

    return json(200, { ok: true, appDoc: home, invites, slug: finalSlug, slugChanged })
  } catch (e) {
    return json(500, { error: String(e?.message || e) })
  }
}

export const config = { path: '/api/set-app-names' }
