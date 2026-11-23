// Signs Cloudinary direct uploads from the couple app and the admin console
// (lead sample photos included). The client posts the file straight to
// Cloudinary with the returned signature; this function never sees the bytes.
import crypto from 'crypto'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Firebase admin, shared init pattern with the other functions.
let fbReady = false
function initFb() {
  if (fbReady) return
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) return
  const svc = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (!getApps().length) initializeApp({ credential: cert(svc), projectId: svc.project_id })
  fbReady = true
}

const PLAN_IDS = ['essential', 'complete', 'legacy']
const planId = (v) => {
  const k = String(v || '').trim().toLowerCase()
  return PLAN_IDS.includes(k) ? k : 'essential'
}
const GB = 1024 * 1024 * 1024

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })

function signCloudinaryParams(params, apiSecret) {
  const sortedQuery = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
  return crypto.createHash('sha1').update(sortedQuery + apiSecret).digest('hex')
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: cors })

  const url = new URL(req.url)
  const folder = url.searchParams.get('folder') || 'eventicor'

  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.VITE_CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY || process.env.VITE_CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET || process.env.VITE_CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    return json(500, {
      error: 'Cloudinary environment variables are missing in Netlify.',
      details: 'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in Netlify Site configuration -> Environment variables.',
    })
  }

  const timestamp = Math.round(Date.now() / 1000)

  // Storage gate for real couple apps: the app passes its id plus the size and
  // kind of the file it is about to upload. The limit per plan comes from the
  // platform settings doc (the Eventicor admin edits it in the console), the
  // app's plan from its own record, and the usage from the app's usage doc the
  // client keeps updated after every upload. Over the limit, the signature is
  // refused so the upload can never start.
  const appId = (url.searchParams.get('app') || '').slice(0, 80)
  const sizeBytes = Math.max(0, Math.round(Number(url.searchParams.get('size')) || 0))
  if (appId) {
    try {
      initFb()
      if (!fbReady) return json(500, { error: 'Storage checking is unavailable right now. Try again shortly.' })
      const fs = getFirestore()
      let storage = { essential: 5, complete: 10, legacy: 20 }
      try {
        const ps = await fs.collection('platform').doc('settings').get()
        if (ps.exists) {
          const st = (ps.data() || {}).storage || {}
          for (const k of PLAN_IDS) {
            const g = Number(st[k])
            if (Number.isFinite(g) && g > 0) storage[k] = g
          }
        }
      } catch {}
      let plan = ''
      try {
        const ev = await fs.collection('events').doc(appId).get()
        if (ev.exists) plan = planId((ev.data() || {}).plan)
      } catch {}
      if (!plan || plan === 'essential') {
        try {
          const ld = await fs.collection('leads').doc(appId).get()
          if (ld.exists) plan = planId((ld.data() || {}).plan)
        } catch {}
      }
      const limitBytes = (Number(storage[planId(plan)]) || 5) * GB
      let used = 0
      try {
        const us = await fs.collection('apps').doc(appId).collection('usage').doc('main').get()
        if (us.exists) {
          const u = us.data() || {}
          used = Math.max(0, Number(u.imagesBytes) || 0) + Math.max(0, Number(u.videosBytes) || 0) + Math.max(0, Number(u.audioBytes) || 0)
        }
      } catch {}
      if (used + sizeBytes > limitBytes) {
        return json(413, {
          error: 'storage-full',
          message: `Your storage is full. Your plan allows ${storage[planId(plan)]} GB and it is used up. Upgrade your plan to keep uploading photos and videos.`,
          usedBytes: used,
          limitBytes,
        })
      }
    } catch {
      // A gate failure must never block uploads silently forever: fall through
      // to signing so the platform stays usable while the check is degraded.
    }
  }

  const signature = signCloudinaryParams({ folder, timestamp }, apiSecret)

  return json(200, { signature, timestamp, cloudName, apiKey, folder })
}
