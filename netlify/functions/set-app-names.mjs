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

// A rename carries the names through the words already saved: the story text
// (whole first names move to the new ones) and a hashtag or gift account name
// that still follows the couple's derived form. Anything the couple typed
// that is NOT the derived form stays untouched.
const capName = (v) => String(v || '').replace(/[^A-Za-z]/g, '').replace(/^./, (c) => c.toUpperCase())
const swapPairs = (fromB, fromG, toB, toG) => {
  const clean = (v) => String(v || '').replace(/[^A-Za-z]/g, '')
  const fb = clean(fromB), fg = clean(fromG), tb = clean(toB), tg = clean(toG)
  const pairs = []
  if (fb && tb && fb.toLowerCase() !== tb.toLowerCase()) pairs.push([fb, tb])
  if (fg && tg && fg.toLowerCase() !== tg.toLowerCase()) pairs.push([fg, tg])
  return pairs
}
const swapText = (text, pairs) => {
  let out = String(text || '')
  for (const [o, n] of pairs) out = out.replace(new RegExp('\\b' + o + '\\b', 'gi'), (m) => (m[0] === m[0].toUpperCase() ? n.charAt(0).toUpperCase() + n.slice(1) : n.toLowerCase()))
  return out
}
const swapHashtag = (tag, fromB, fromG, toB, toG) => {
  const t = String(tag || '').trim()
  const ob = capName(fromB), og = capName(fromG), nb = capName(toB), ng = capName(toG)
  if (!ob || !og || !nb || !ng) return t
  if (new RegExp('^#' + ob + 'And' + og + '$', 'i').test(t)) return '#' + nb + 'And' + ng
  return t
}
const swapAccountName = (name, fromB, fromG, toB, toG) => {
  const v = String(name || '').trim()
  const ob = String(fromB || '').replace(/[^A-Za-z]/g, ''), og = String(fromG || '').replace(/[^A-Za-z]/g, '')
  const nb = String(toB || '').replace(/[^A-Za-z]/g, ''), ng = String(toG || '').replace(/[^A-Za-z]/g, '')
  if (!ob || !og || !nb || !ng) return v
  if (new RegExp('^' + ob + '\\s*(&|and)\\s*' + og + '$', 'i').test(v)) return nb + ' & ' + ng
  return v
}
const swapDetails = (d, fromB, fromG, toB, toG) => {
  if (!d || typeof d !== 'object') return { d, changed: false }
  const out = { ...d }
  let changed = false
  const h1 = swapHashtag(out.hashtag, fromB, fromG, toB, toG)
  if (h1 !== out.hashtag) { out.hashtag = h1; changed = true }
  if (out.giftInfo && typeof out.giftInfo === 'object') {
    const a1 = swapAccountName(out.giftInfo.accountName, fromB, fromG, toB, toG)
    if (a1 !== out.giftInfo.accountName) { out.giftInfo = { ...out.giftInfo, accountName: a1 }; changed = true }
  }
  return { d: out, changed }
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'POST only' })

  let body
  try { body = await req.json() } catch { return json(400, { error: 'Invalid JSON body' }) }

  // The Admin SDK must be initialised before the first getAuth() call; the
  // token check below was reaching getAuth() with no default app, so every
  // caller got "Invalid or expired token" and no rename ever propagated.
  init()

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
    let fromBride = String(cur?.bride || '')
    let fromGroom = String(cur?.groom || '')
    const fromSlug = String(cur?.slug || '')
    const bodyFromBride = String((body.from && body.from.bride) || '').trim().slice(0, 40)
    const bodyFromGroom = String((body.from && body.from.groom) || '').trim().slice(0, 40)
    if ((!fromBride || !fromGroom || fromBride === bride || fromGroom === groom) && (bodyFromBride || bodyFromGroom)) {
      fromBride = fromBride && fromBride !== bride ? fromBride : (bodyFromBride || fromBride)
      fromGroom = fromGroom && fromGroom !== groom ? fromGroom : (bodyFromGroom || fromGroom)
    }
    if ((!fromBride || !fromGroom) && home) {
      try {
        const hs = await db.collection('apps').doc(appId).collection('name_history').orderBy('at', 'desc').limit(1).get()
        const h = hs.docs[0] && hs.docs[0].data()
        if (h) {
          const hb = String(h.fromBride || '')
          const hg = String(h.fromGroom || '')
          if (hb && hb.toLowerCase() !== bride.toLowerCase()) fromBride = fromBride || hb
          if (hg && hg.toLowerCase() !== groom.toLowerCase()) fromGroom = fromGroom || hg
        }
      } catch { /* history is best effort */ }
    }
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

    // app_config coupleIdentity (what the entry banner and home banner read)
    // follows the rename too, so the app document and the config can never
    // disagree and the banner never paints the old names first. The couple's
    // own words around the names (kicker, tagline) are preserved.
    if (home) {
      try {
        const cfgRef = db.collection('apps').doc(appId).collection('app_config').doc('main')
        const cfgSnap = await cfgRef.get()
        const cfg = cfgSnap.data() || {}
        const ci = cfg.coupleIdentity || {}
        const patch = { coupleIdentity: { ...ci, bride, groom } }
        const pairs = swapPairs(fromBride, fromGroom, bride, groom)
        const story0 = typeof cfg.story === 'string' ? cfg.story : ''
        if (pairs.length && story0) {
          const story1 = swapText(story0, pairs)
          if (story1 !== story0) patch.story = story1
        }
        if (pairs.length) {
          if (typeof cfg.det === 'string' && cfg.det.trim()) {
            try {
              const parsed = JSON.parse(cfg.det)
              const r = swapDetails(parsed, fromBride, fromGroom, bride, groom)
              if (r.changed) patch.det = JSON.stringify(r.d)
            } catch { /* det is a free JSON blob; leave it alone if it does not parse */ }
          }
          if (cfg.weddingDetails && typeof cfg.weddingDetails === 'object') {
            const r = swapDetails(cfg.weddingDetails, fromBride, fromGroom, bride, groom)
            if (r.changed) patch.weddingDetails = r.d
          }
        }
        await cfgRef.set({ ...patch, lastUpdated: FieldValue.serverTimestamp() }, { merge: true })
      } catch { /* config sync is best effort; the app document is the source of truth */ }
    }

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
      const pairs = swapPairs(fromBride, fromGroom, bride, groom)
      snap.forEach((d) => {
        const v = d.data() || {}
        const up = { bride, groom }
        if (pairs.length) {
          const h1 = swapHashtag(v.hashtag, fromBride, fromGroom, bride, groom)
          if (h1 !== v.hashtag) up.hashtag = h1
          const m1 = swapText(v.message, pairs)
          if (m1 !== v.message) up.message = m1
        }
        batch.set(d.ref, up, { merge: true }); invites++
      })
      if (invites) await batch.commit()
    } catch { /* invites stay on their old names rather than failing the rename */ }

    return json(200, { ok: true, appDoc: home, invites, slug: finalSlug, slugChanged })
  } catch (e) {
    return json(500, { error: String(e?.message || e) })
  }
}

export const config = { path: '/api/set-app-names' }
