// Serves the couple app shell (/app) with social-share (Open Graph) tags, the
// couple's names as the tab title and their first hero photo as the tab
// favicon, so a shared app link previews as the couple's app, not a bare
// link. The shell is unchanged otherwise: the app boots as normal from it.
// When the link carries no resolvable couple (a bare /app), the shell goes
// out as-is.
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const ID_OK = /^[A-Za-z0-9_-]{6,40}$/

let ready = false
function init() {
  if (ready) return true
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) return false
  const svc = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (!getApps().length) initializeApp({ credential: cert(svc), projectId: svc.project_id })
  ready = true
  return true
}

const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function cdnPhoto(u) {
  const t = String(u || '')
  if (/res\.cloudinary\.com\//.test(t) && /\/upload\//.test(t) && !/f_jpg/.test(t)) return t.replace('/upload/', '/upload/w_1200,q_auto,f_jpg/')
  return t
}
function cdnIcon(u, w) {
  const t = String(u || '')
  if (/res\.cloudinary\.com\//.test(t) && /\/upload\//.test(t) && !/f_png/.test(t)) return t.replace('/upload/', `/upload/f_png,w_${w},c_fill/`)
  return ''
}

// Resolves the couple the link points at. Apps are addressed by their events
// doc (?site=, also accepted as ?app=) or by a lead id (?lead=, sample apps).
// Only names and the first hero image are read here.
async function coupleMeta(sp) {
  if (!init()) return null
  const site = (sp.get('site') || sp.get('app') || '').trim()
  const leadId = (sp.get('lead') || '').trim()
  let d = null
  try {
    if (site && ID_OK.test(site)) {
      const s = await getFirestore().collection('events').doc(site).get()
      if (s.exists) d = s.data()
      else {
        const l = await getFirestore().collection('leads').doc(site).get()
        if (l.exists) d = l.data()
      }
    }
    if (!d && leadId && ID_OK.test(leadId)) {
      const l = await getFirestore().collection('leads').doc(leadId).get()
      if (l.exists) d = l.data()
    }
  } catch (e) { return null }
  if (!d) return null
  const bride = String(d.bride || '').trim()
  const groom = String(d.groom || '').trim()
  const photo = Array.isArray(d.heroImages) && d.heroImages.length ? d.heroImages[0] : ''
  if (!bride && !groom) return null
  return {
    title: bride && groom ? `${bride} & ${groom}` : (bride || groom),
    desc: 'Every photo, video and wish from their event, in one beautiful app.',
    photo,
  }
}

function injectAppMeta(html, m, pageUrl) {
  let out = String(html)
  // The couple's hero photo becomes the tab and touch icon, so a renamed or
  // restyled app never keeps a stale icon on a fresh open (server side; the
  // open tab is kept in step by CoupleApp's own effect).
  if (m.photo) {
    const raw = String(m.photo)
    const ic = cdnIcon(raw, 64) || raw
    const ap = cdnIcon(raw, 180) || raw
    out = out.replace(/<link rel="icon"[^>]*>/i, `<link rel="icon" type="image/png" href="${esc(ic)}">`)
    out = out.replace(/<link rel="apple-touch-icon"[^>]*>/i, `<link rel="apple-touch-icon" href="${esc(ap)}">`)
  }
  if (m.title) out = out.replace(/<title>[^<]*<\/title>/i, `<title>${esc(m.title)}</title>`)
  const tags = [
    `<meta property="og:title" content="${esc(m.title)}">`,
    `<meta property="og:description" content="${esc(m.desc)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${esc(pageUrl)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(m.title)}">`,
    `<meta name="twitter:description" content="${esc(m.desc)}">`,
  ]
  if (m.photo) {
    const img = cdnPhoto(m.photo)
    tags.push(`<meta property="og:image" content="${esc(img)}">`, `<meta property="og:image:alt" content="${esc(m.title)}">`, `<meta name="twitter:image" content="${esc(img)}">`)
    const fav = cdnIcon(m.photo, 64)
    if (fav) tags.push(`<link rel="icon" type="image/png" href="${esc(fav)}">`, `<link rel="apple-touch-icon" href="${esc(cdnIcon(m.photo, 180))}">`)
  }
  return out.replace('</head>', tags.join('\n') + '\n</head>')
}

export default async (req) => {
  let shell = null
  try {
    const url = new URL(req.url)
    const proto = req.headers.get('x-forwarded-proto') || 'https'
    const host = req.headers.get('host')
    const r = await fetch(`${proto}://${host}/index.html`, { cache: 'no-store' })
    if (!r.ok) return new Response('Not found', { status: 404 })
    shell = await r.text()
    const m = await coupleMeta(url.searchParams)
    if (m) shell = injectAppMeta(shell, m, url.origin + url.pathname + (url.search || ''))
    return new Response(shell, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate' } })
  } catch (e) {
    return new Response('Not found', { status: 404 })
  }
}
