// Public, read-only couple-app binding for the self-serve apps. The couple app
// link carries ?site=<events doc id>; this endpoint returns ONLY the fields
// the app needs to show the couple's own setup: names, wedding date, city and
// the images seeded at onboarding. Contact details, the guest access code and
// billing fields never leave the server.
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

let ready = false
function init() {
  if (ready) return
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON env var is not set')
  const svc = typeof raw === 'string' ? JSON.parse(raw) : raw
  initializeApp({ credential: cert(svc), projectId: svc.project_id })
  ready = true
}

const cors = { 'Access-Control-Allow-Origin': '*' }
const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } })

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: cors })
  const url = new URL(req.url)
  const siteId = (url.searchParams.get('site') || '').slice(0, 80)
  if (!siteId) return json(400, { error: 'site is required' })
  try {
    init()
    // Apps are addressed either by their events doc (onboarded couples,
    // ?site=<events id>) or by their lead id (?lead=<lead id>, sample apps and
    // self-serve apps). The leads collection carries the couple's email and is
    // not readable from the client, so lead resolution happens HERE and only
    // the fields the app shows ever leave the server.
    let snap = await getFirestore().collection('events').doc(siteId).get()
    let leadMode = false
    if (!snap.exists) {
      snap = await getFirestore().collection('leads').doc(siteId).get()
      leadMode = true
      if (!snap.exists) return json(404, { error: 'not found' })
    } else if (!snap.exists) return json(404, { error: 'not found' })
    const d = snap.data()
    const asMs = (v) => {
      if (v == null) return undefined
      if (typeof v === 'object' && 'seconds' in v) return Number(v.seconds) * 1000
      const n = Number(v)
      return Number.isFinite(n) ? n : undefined
    }
    let cfg = {}
    try {
      const cfgSnap = await getFirestore().collection('apps').doc(siteId).collection('app_config').doc('main').get()
      if (cfgSnap.exists) cfg = cfgSnap.data() || {}
    } catch {}
    return json(200, {
      adminWhatsapp: typeof cfg.adminWhatsapp === 'string' ? cfg.adminWhatsapp : '',
      bride: d.bride || '',
      groom: d.groom || '',
      city: d.city || '',
      status: d.status || '',
      source: leadMode ? (d.source || '') : 'landing',
      weddingDate: d.weddingDate || '',
      weddingTime: d.weddingTime || '',
      heroImages: Array.isArray(d.heroImages) ? d.heroImages : [],
      footerImages: Array.isArray(d.footerImages) ? d.footerImages : [],
      feedImages: Array.isArray(d.feedImages) ? d.feedImages : [],
      expiresAt: leadMode ? asMs(d.expiresAt) : undefined,
      activatedAt: leadMode ? asMs(d.activatedAt) : undefined,
    })
  } catch (e) {
    return json(500, { error: String(e?.message || e) })
  }
}
