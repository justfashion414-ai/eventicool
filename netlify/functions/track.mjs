// track: one counter for the whole platform. Every couple app reports an
// open on boot, a feed open when the feed is opened and a post add when a
// guest posts; a sample link's opens land in the same ledger, so the
// dashboard can show when a sample app was opened and how often. Two
// ledgers: apps/<app>/meta/stats (per app: counters, first and last open)
// and analytics_daily/<date> (per day: totals, per-app counters, countries
// and visitor ids). No auth: these are counters, not private data, and every
// field is clamped.
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'

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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } })

const APP_RE = /^[A-Za-z0-9_-]{1,80}$/
const SID_RE = /^[A-Za-z0-9_-]{1,64}$/
// kind -> the stats-doc counter it bumps
const KINDS = { open: 'open', feed_open: 'feedOpen', post_add: 'postAdd' }
// Landing-page traffic, kept in its own daily ledger (landing_daily/<date>):
// land = a visit, land_leave = time on page with it, land_lead = a visitor
// went on to create their app.
const LAND_KINDS = { land: 1, land_leave: 1, land_lead: 1 }

// The visitor's country, from the platform's geo data when it is there and
// from the request headers as fallback. Absent country simply records no
// country; nothing else depends on it.
function countryOf(req, context) {
  try {
    const g = context?.geo?.country?.code || context?.geo?.countryCode
    if (g && /^[A-Za-z]{2}$/.test(String(g))) return String(g).toUpperCase()
  } catch {}
  try {
    const raw = req.headers.get('x-nf-geo')
    if (raw) {
      const j = JSON.parse(raw)
      const c = j?.country?.code || j?.countryCode
      if (c && /^[A-Za-z]{2}$/.test(String(c))) return String(c).toUpperCase()
    }
  } catch {}
  for (const h of ['cf-ipcountry', 'x-vercel-ip-country', 'x-country']) {
    const v = req.headers.get(h)
    if (v && /^[A-Za-z]{2}$/.test(v)) return v.toUpperCase()
  }
  return null
}

export default async (req, context) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'POST only' })

  let body
  try { body = await req.json() } catch { return json(400, { ok: false }) }
  const app = String(body.app || '').trim()
  const kind = String(body.kind || '').trim()
  const sid = String(body.sid || '').trim()
  if (sid && !SID_RE.test(sid)) return json(400, { ok: false })
  const isLand = !!LAND_KINDS[kind]
  if (!isLand && (!APP_RE.test(app) || !KINDS[kind])) return json(400, { ok: false })

  try {
    init()
    const db = getFirestore()
    const now = Date.now()
    const at = Timestamp.fromMillis(now)

    if (isLand) {
      const day = new Date(now).toISOString().slice(0, 10)
      const inc = { updatedAt: at }
      if (kind === 'land') {
        inc.visits = FieldValue.increment(1)
        if (sid) inc.v = FieldValue.arrayUnion(sid)
      } else if (kind === 'land_leave') {
        const secs = Math.max(0, Math.min(7200, Math.round(Number(body.s) || 0)))
        inc.seconds = FieldValue.increment(secs)
        inc.left = FieldValue.increment(1)
      } else {
        inc.signups = FieldValue.increment(1)
      }
      await db.collection('landing_daily').doc(day).set(inc, { merge: true })
      return json(200, { ok: true })
    }

    const field = KINDS[kind]
    const cap = field.charAt(0).toUpperCase() + field.slice(1)

    // Per-app ledger. firstOpenAt is stamped once, at the app's first open.
    const statRef = db.collection('apps').doc(app).collection('meta').doc('stats')
    await db.runTransaction(async (tx) => {
      const cur = await tx.get(statRef)
      const patch = { [field]: FieldValue.increment(1), [`last${cap}At`]: at }
      if (!cur.exists) patch.firstOpenAt = at
      tx.set(statRef, patch, { merge: true })
    })

    // Daily ledger for the whole project.
    const day = new Date(now).toISOString().slice(0, 10)
    const cc = countryOf(req, context)
    const patch = {
      total: FieldValue.increment(1),
      [kind]: FieldValue.increment(1),
      [`apps.${app}.${field}`]: FieldValue.increment(1),
      ...(cc ? { [`countries.${cc}`]: FieldValue.increment(1) } : {}),
      ...(sid && kind === 'open' ? { [`apps.${app}.v`]: FieldValue.arrayUnion(sid) } : {}),
    }
    await db.collection('analytics_daily').doc(day).set(patch, { merge: true })

    return json(200, { ok: true })
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) })
  }
}

export const config = { path: '/api/track' }
