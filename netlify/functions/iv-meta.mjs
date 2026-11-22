// Serves the standalone invitation pages with social-share (Open Graph) tags
// injected, so a forwarded link previews as the couple's invite, not a bare
// link: their names as the title, their first photo as the image AND as the
// tab favicon. Regular visitors get the page too (title + favicon included);
// the tags are extra, so social apps' crawlers pick up a real preview.
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

async function inviteMeta(appId, ivId) {
  if (!init()) return null
  if (!ID_OK.test(ivId)) return null
  const scoped = ID_OK.test(appId)
  const ref = scoped
    ? getFirestore().collection('apps').doc(appId).collection('invites').doc(ivId)
    : getFirestore().collection('invites').doc(ivId)
  const d = (await ref.get()).data() || {}
  let date = ''
  try {
    if (d.wedDate && d.wedDate.toDate) date = d.wedDate.toDate().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    else if (d.wedDate) date = String(d.wedDate)
  } catch (e) { date = d.wedDate ? String(d.wedDate) : '' }
  const photo = Array.isArray(d.photos) && d.photos.length ? d.photos[0] : ''
  return {
    title: (d.bride && d.groom) ? `${d.bride} & ${d.groom} invite you to their wedding` : 'You are invited',
    desc: [date, d.venue, d.city].filter(Boolean).join(' · ') || 'Save the date',
    photo,
  }
}

// Cloudinary transforms: a share-card image and two favicon sizes. Nothing is
// done to URLs that are not Cloudinary uploads.
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

// Rewrites the page <title> to the couple's names, then adds the share tags
// and favicon links before </head>. Everything degrades to the plain page
// when the invite has no data.
function injectOg(html, m, pageUrl) {
  let out = String(html)
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
  try {
    const url = new URL(req.url)
    let file = ''
    if (url.pathname.startsWith('/iv/')) file = decodeURIComponent(url.pathname.slice(4))
    else {
      const splat = url.searchParams.get('splat')
      if (splat) file = decodeURIComponent(splat)
    }
    file = String(file || '').replace(/^\/+/, '')
    if (!/^iv-[a-z]+\.html$/.test(file)) return new Response('Not found', { status: 404 })
    const ivId = (url.searchParams.get('i') || '').trim()
    const appId = (url.searchParams.get('app') || '').trim()
    const proto = req.headers.get('x-forwarded-proto') || 'https'
    const host = req.headers.get('host')
    let html = ''
    let m = null
    if (ivId) {
      try { m = await inviteMeta(appId, ivId) } catch (e) { m = null }
    }
    const r = await fetch(`${proto}://${host}/ivsrc/${file}`, { cache: 'no-store' })
    if (!r.ok) return new Response('Not found', { status: 404 })
    html = await r.text()
    if (m) html = injectOg(html, m, url.origin + url.pathname + (url.search || ''))
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate' } })
  } catch (e) {
    return new Response('Not found', { status: 404 })
  }
}
