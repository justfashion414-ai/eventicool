// push: web push notifications for one couple's app. Subscriptions are stored
// per app (apps/<appId>/push_subs), tagged with the subscriber's role; the
// VAPID keys live in the platform/push doc. The couple app itself calls the
// two triggers, both fire and forget:
//   post-created  - counts new posts since the admins were last active; at
//                   ten, with every admin idle past 15 minutes, the admins get
//                   one push and the counter resets until ten more arrive.
//   post-approved - the author of an approved post gets their notification.
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import webpush from 'web-push'
import { createHash } from 'crypto'

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
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })

let vapid = null
async function getVapid() {
  if (vapid) return vapid
  const d = await getFirestore().collection('platform').doc('push').get()
  const data = d.exists ? d.data() : null
  if (!data?.vapidPublic || !data?.vapidPrivate) throw new Error('VAPID keys are not set up yet')
  vapid = data
  webpush.setVapidDetails('mailto:hello@eventicor.com', String(data.vapidPublic), String(data.vapidPrivate))
  return vapid
}

async function verifyAdmin(appId, token) {
  const dec = await getAuth().verifyIdToken(String(token))
  const adm = await getFirestore().collection('apps').doc(appId).collection('admins').doc(String(dec.email || '')).get()
  return adm.exists ? dec : null
}

// Sends to every subscription; expired ones (404/410) come back for cleanup.
async function sendToSubs(subs, { title, body, tag }) {
  const payload = JSON.stringify({ title, body, tag, data: { url: '/' } })
  const dead = []
  for (const s of subs) {
    if (!s?.endpoint || !s?.keys) continue
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload)
    } catch (e) {
      const code = e?.statusCode
      if (code === 404 || code === 410) dead.push(s.endpoint)
    }
  }
  return dead
}

async function appNames(db, appId) {
  const lead = await db.collection('leads').doc(appId).get().catch(() => null)
  const names = lead && lead.exists ? [lead.data()?.bride, lead.data()?.groom].filter(Boolean).join(' & ') : ''
  return names ? `${names} · Eventicor` : 'Eventicor'
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'POST only' })
  try {
    init()
    const body = await req.json().catch(() => ({}))
    const appId = String(body.appId || '')
    if (!appId) return json(400, { error: 'appId is required' })
    await getVapid()
    const db = getFirestore()
    const appRef = db.collection('apps').doc(appId)
    const subsRef = appRef.collection('push_subs')

    if (body.op === 'key') return json(200, { key: vapid.vapidPublic })

    if (body.op === 'subscribe') {
      const sub = body.subscription || {}
      if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return json(400, { error: 'invalid subscription' })
      if (body.role === 'admin') {
        if (!body.token) return json(401, { error: 'admin token required' })
        const dec = await verifyAdmin(appId, body.token).catch(() => null)
        if (!dec) return json(403, { error: 'not an admin of this app' })
      }
      const id = createHash('sha256').update(String(sub.endpoint)).digest('hex').slice(0, 40)
      await subsRef.doc(id).set({
        role: body.role === 'admin' ? 'admin' : 'guest',
        uid: String(body.uid || ''),
        email: String(body.email || ''),
        endpoint: String(sub.endpoint),
        keys: sub.keys,
        updatedAt: Date.now(),
      }, { merge: true })
      return json(200, { ok: true })
    }

    if (body.op === 'post-created') {
      const admins = await appRef.collection('admins').get()
      let lastSeen = 0
      admins.forEach((a) => {
        const la = a.data()?.lastActiveAt
        const ms = la?.toMillis ? la.toMillis() : (la?.seconds ? la.seconds * 1000 : Number(la) || 0)
        if (ms > lastSeen) lastSeen = ms
      })
      const st = await appRef.collection('app_config').doc('push').get()
      const lastPush = Number(st.exists ? st.data()?.lastAdminPushAt : 0) || 0
      const since = Math.max(lastSeen, lastPush)
      const snap = await appRef.collection('posts').where('timestamp', '>', new Date(since)).count().get()
      const n = snap.data().count
      const away = !lastSeen || (Date.now() - lastSeen) > 15 * 60 * 1000
      if (n >= 10 && away) {
        const subs = await subsRef.where('role', '==', 'admin').get()
        const dead = await sendToSubs(subs.docs.map((d) => d.data()), {
          title: await appNames(db, appId),
          body: `${n} new memories are waiting on your feed`,
          tag: 'ev-posts',
        })
        for (const d of subs.docs) if (dead.includes(d.data().endpoint)) await d.ref.delete().catch(() => {})
        await appRef.collection('app_config').doc('push').set({ lastAdminPushAt: Date.now() }, { merge: true })
        return json(200, { ok: true, sent: subs.size, count: n })
      }
      return json(200, { ok: true, sent: 0, count: n })
    }

    if (body.op === 'post-approved') {
      if (!body.token) return json(401, { error: 'admin token required' })
      const dec = await verifyAdmin(appId, body.token).catch(() => null)
      if (!dec) return json(403, { error: 'not an admin of this app' })
      const post = await appRef.collection('posts').doc(String(body.postId || '')).get()
      const uid = post.exists ? String(post.data()?.authorUid || '') : ''
      if (!uid) return json(200, { ok: true, sent: 0 })
      const subs = await subsRef.where('role', '==', 'guest').where('uid', '==', uid).get()
      const dead = await sendToSubs(subs.docs.map((d) => d.data()), {
        title: await appNames(db, appId),
        body: 'Your memory was approved. It is live on the feed now.',
        tag: 'ev-approved',
      })
      for (const d of subs.docs) if (dead.includes(d.data().endpoint)) await d.ref.delete().catch(() => {})
      return json(200, { ok: true, sent: subs.size })
    }

    return json(400, { error: 'unknown op' })
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) })
  }
}
