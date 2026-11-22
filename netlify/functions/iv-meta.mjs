// Serves the standalone invitation pages with social-share (Open Graph) tags
// injected, so a forwarded link previews as the couple's invite, not a bare
// link. Regular visitors get the page unchanged; social apps' crawlers get
// the same page plus og:title/description/image built from the invite doc.
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const CRAWLERS = ['facebookexternalhit', 'twitterbot', 'whatsapp', 'telegrambot', 'slackbot', 'linkedinbot', 'discordbot', 'tiktok', 'bytespider', 'embedly', 'vkshare', 'skypeuripreview', 'ia_archiver', 'pins']
const ID_OK = /^[A-Za-z0-9_-]{6,40}$/

let ready = false
function init() {
  if (ready) return
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

function cdnPhoto(u) {
  const t = String(u || '')
  if (/res\.cloudinary\.com\//.test(t) && /\/upload\//.test(t) && !/f_jpg/.test(t)) return t.replace('/upload/', '/upload/w_1200,q_auto,f_jpg/')
  return t
}

function injectOg(html, m, pageUrl) {
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
  }
  return html.replace('</head>', tags.join('\n') + '\n</head>')
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
    const ua = String(req.headers.get('user-agent') || '').toLowerCase()
    const isCrawler = CRAWLERS.some((c) => ua.includes(c))
    const ivId = (url.searchParams.get('i') || '').trim()
    const appId = (url.searchParams.get('app') || '').trim()
    let html
    const proto = req.headers.get('x-forwarded-proto') || 'https'
    const host = req.headers.get('host')
    const r = await fetch(`${proto}://${host}/ivsrc/${file}`)
    if (!r.ok) return new Response('Not found', { status: 404 })
    html = await r.text()
    if (ivId) {
      try {
        const m = await inviteMeta(appId, ivId)
        if (m) html = injectOg(html, m, url.origin + url.pathname + (url.search || ''))
      } catch (e) { /* serve the page without tags */ }
    }
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' } })
  } catch (e) {
    return new Response('Not found', { status: 404 })
  }
}
