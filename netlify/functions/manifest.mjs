// Dynamic web-app manifest for the self-serve and lead apps. The install page
// and the couple app inject <link rel="manifest" href="/api/manifest?lead=...">
// so the browser installs the app under the couple's own names, with their
// first hero photo as the app icon and their app link as the start URL.
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

const ACCENTS = {
  midnight: '#14122b', blush: '#8f1c42', emerald: '#07301f',
  royal: '#151f63', sunset: '#2b1a12', sage: '#1f2b25',
}

export default async (req) => {
  const url = new URL(req.url)
  const leadId = (url.searchParams.get('lead') || '').slice(0, 80)
  const siteId = (url.searchParams.get('site') || '').slice(0, 80)
  const tpl = (url.searchParams.get('tpl') || 'classic').slice(0, 20)
  const acc = (url.searchParams.get('acc') || '').slice(0, 20)
  const exp = (url.searchParams.get('exp') || '').replace(/[^0-9]/g, '').slice(0, 12)

  let name = 'Eventicor'
  let short = 'Eventicor'
  let icon = null
  const nameFrom = (d) => {
    name = `${d.bride || 'Our'} & ${d.groom || 'Event'}`
    short = `${d.bride || 'Our'} & ${(d.groom || '').slice(0, 1)}.`
    icon = Array.isArray(d.heroImages) && d.heroImages[0] ? String(d.heroImages[0]) : null
  }
  if (leadId) {
    try {
      init()
      const doc = await getFirestore().collection('leads').doc(leadId).get()
      if (doc.exists) nameFrom(doc.data())
    } catch { /* fall through to the generic manifest */ }
  } else if (siteId) {
    try {
      init()
      const doc = await getFirestore().collection('events').doc(siteId).get()
      if (doc.exists) nameFrom(doc.data())
    } catch { /* fall through to the generic manifest */ }
  }

  const params = new URLSearchParams()
  params.set('tpl', tpl)
  if (acc) params.set('acc', acc)
  if (exp) params.set('exp', exp)
  if (leadId) params.set('lead', leadId)
  if (siteId) params.set('site', siteId)

  // The app's install identity. Excluded from `exp` so extending a trial
  // updates the same app rather than creating a second one, but every
  // different lead (couple) is a distinct app with its own launcher entry.
  const idParams = new URLSearchParams()
  idParams.set('tpl', tpl)
  if (acc) idParams.set('acc', acc)
  if (leadId) idParams.set('lead', leadId)
  if (siteId) idParams.set('site', siteId)
  const appId = url.origin + '/app?' + idParams.toString()

  const cdn = (w, u) =>
    u.includes('/upload/') ? u.replace('/upload/', `/upload/w_${w},h_${w},c_fill,q_auto,f_jpg/`) : u

  const icons = []
  if (icon && /^https:\/\//.test(icon)) {
    for (const w of [192, 512]) {
      icons.push({ src: cdn(w, icon), sizes: `${w}x${w}`, type: 'image/jpeg', purpose: 'any' })
      icons.push({ src: cdn(w, icon), sizes: `${w}x${w}`, type: 'image/jpeg', purpose: 'maskable' })
    }
  } else {
    for (const w of [192, 512]) icons.push({ src: '/demo/photo1.jpg', sizes: `${w}x${w}`, type: 'image/jpeg' })
  }
  // Local PNG fallbacks: installability never depends on a remote image loading.
  icons.push({ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' })
  icons.push({ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' })

  // Lets the install page detect an already-installed app via getInstalledRelatedApps().
  const manifestUrl = url.origin + '/api/manifest' + (url.search || '')
  const manifest = {
    name,
    short_name: short.slice(0, 12),
    description: `${name}: every photo, video and wish from their event, in one beautiful place.`,
    start_url: `/app?${params.toString()}`,
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: ACCENTS[acc] || '#14122b',
    icons,
    id: appId,
    related_applications: [{ platform: 'webapp', url: manifestUrl, id: appId }],
  }
  return new Response(JSON.stringify(manifest), {
    status: 200,
    headers: { 'Content-Type': 'application/manifest+json', 'Access-Control-Allow-Origin': '*' },
  })
}

export const config = { path: '/api/manifest' }
