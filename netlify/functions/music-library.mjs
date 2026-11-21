// Public read of the platform music library: the tracks the admin curates in
// the console, which couple apps offer in the Inbox invite form. The audio
// lives on Cloudinary, so the URLs are public already; no auth needed to list.
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

let fbReady = false
function initFb() {
  if (fbReady) return
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) return
  const svc = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (!getApps().length) initializeApp({ credential: cert(svc), projectId: svc.project_id })
  fbReady = true
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}
const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: cors })
  if (req.method !== 'GET') return json(405, { error: 'GET only' })
  try {
    initFb()
    if (!fbReady) return json(500, { error: 'unavailable' })
    const snap = await getFirestore().collection('music_library').limit(100).get()
    const rows = snap.docs.map((d) => ({
      id: d.id,
      name: String(d.data().name || ''),
      url: String(d.data().url || ''),
      at: Number(d.data().at) || Number(d.data().createdAt?.seconds || 0) * 1000 || 0,
    }))
    rows.sort((a, b) => b.at - a.at)
    return json(200, { docs: rows.filter((r) => r.url).map(({ id, name, url }) => ({ id, name, url })) })
  } catch {
    return json(500, { error: 'unavailable' })
  }
}
