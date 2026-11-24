// Shared Cloudinary storage + retention helpers for the Eventicor platform.
// The admin console's Storage tab (/api/storage-overview) and the daily
// retention cron (/api/retention-cron) both come through here, so the numbers
// on screen and what the cron deletes always follow one code path.
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { createHash } from 'crypto'

let fbReady = false
export function fbInit() {
  if (fbReady) return
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON env var is not set')
  const svc = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (!getApps().length) initializeApp({ credential: cert(svc), projectId: svc.project_id })
  fbReady = true
}

const cloudName = () => process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME || 'pnbw0sgp'
const cloudKey = () => process.env.CLOUDINARY_API_KEY || process.env.VITE_CLOUDINARY_API_KEY
const cloudSecret = () => process.env.CLOUDINARY_API_SECRET || process.env.VITE_CLOUDINARY_API_SECRET

const TYPES = ['image', 'video', 'raw']
export const STALE_MS = 6 * 60 * 60 * 1000

const clampInt = (v, lo, hi, dflt) => {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt
}

// Retention settings live in platform/settings so the console can edit them:
// how long sample apps and real apps keep their files, and at what share of
// the plan's credits the low-storage warning fires.
export async function readSettings() {
  const dflt = { retentionSampleDays: 30, retentionRealDays: 90, warnPercent: 80 }
  try {
    const s = await getFirestore().collection('platform').doc('settings').get()
    const d = (s.exists && s.data()) || {}
    return {
      retentionSampleDays: clampInt(d.retentionSampleDays, 1, 3650, dflt.retentionSampleDays),
      retentionRealDays: clampInt(d.retentionRealDays, 1, 3650, dflt.retentionRealDays),
      warnPercent: clampInt(d.warnPercent, 1, 100, dflt.warnPercent),
    }
  } catch {
    return dflt
  }
}

function authHeader() {
  return 'Basic ' + Buffer.from(`${cloudKey()}:${cloudSecret()}`).toString('base64')
}

// Live account usage straight from Cloudinary: the master number the console
// shows beside the per-folder recount.
export async function cloudinaryUsage() {
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName()}/usage`, { headers: { Authorization: authHeader() } })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error && j.error.message ? j.error.message : `Cloudinary usage ${res.status}`)
  return {
    plan: j.plan || '',
    lastUpdate: j.last_update || '',
    storageBytes: Number((j.storage && j.storage.usage) || 0),
    bandwidthBytes: Number((j.bandwidth && j.bandwidth.usage) || 0),
    objects: Number((j.objects && j.objects.usage) || 0),
    credits: { usage: Number((j.credits && j.credits.usage) || 0), limit: Number((j.credits && j.credits.limit) || 0) },
  }
}

// List every resource under a prefix, one resource type at a time (Cloudinary
// keeps image / video / raw separate), following cursors.
async function listByPrefix(type, prefix) {
  const out = []
  let cursor = ''
  for (let page = 0; page < 40; page++) {
    const url = `https://api.cloudinary.com/v1_1/${cloudName()}/resources/${type}/upload?max_results=500&prefix=${encodeURIComponent(prefix)}${cursor ? `&next_cursor=${cursor}` : ''}`
    const res = await fetch(url, { headers: { Authorization: authHeader() } })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error && j.error.message ? j.error.message : `Cloudinary list ${res.status}`)
    for (const r of j.resources || []) out.push({ id: r.public_id, bytes: Number(r.bytes) || 0, createdAt: r.created_at || '' })
    cursor = j.next_cursor || ''
    if (!cursor) break
  }
  return out
}

// Recount: real apps upload into apps/<appId>/... folders, sample apps share
// the eventicor-leads-<kind> folders, so bytes are summed by folder segment.
export async function recountUsage() {
  const apps = {}
  let sample = 0
  for (const type of TYPES) {
    for (const r of await listByPrefix(type, 'apps/')) {
      const parts = String(r.id).split('/')
      if (parts.length >= 2 && parts[0] === 'apps' && parts[1]) apps[parts[1]] = (apps[parts[1]] || 0) + r.bytes
    }
    for (const r of await listByPrefix(type, 'eventicor-leads-')) sample += r.bytes
  }
  return { apps, sample, computedAt: Date.now() }
}

function sign(params) {
  const sortedQuery = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  return createHash('sha1').update(sortedQuery + cloudSecret()).digest('hex')
}

async function destroyCall(type, params) {
  const ts = Math.floor(Date.now() / 1000)
  const body = { ...params, timestamp: ts, api_key: cloudKey() }
  const sig = sign(body)
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName()}/${type}/destroy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...body, signature: sig }).toString(),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || !(j.result === 'ok' || j.result === 'not found')) return 0
  const n = Object.values(j.deleted || {}).filter((v) => v === 'deleted').length
  return n
}

// Delete everything under one folder prefix (one app's whole Cloudinary tree).
// Cloudinary's delete-by-prefix is a DELETE on the resource list endpoint,
// paginated: partial: true means more of the same prefix remained.
async function destroyPrefix(prefix) {
  let deleted = 0
  for (const type of TYPES) {
    for (let round = 0; round < 40; round++) {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName()}/resources/${type}/upload?prefix=${encodeURIComponent(prefix)}`, { method: 'DELETE', headers: { Authorization: authHeader() } })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) break
      deleted += Object.values(j.deleted || {}).filter((v) => v === 'deleted').length
      if (!j.partial) break
    }
  }
  return deleted
}

// Delete individual files (used for sample apps: they share folders, so the
// safe cut is by upload age, not by folder).
async function destroyIds(items) {
  let ok = 0
  for (let i = 0; i < items.length; i += 8) {
    await Promise.all(items.slice(i, i + 8).map((it) => destroyCall(it.type, { public_id: it.id }).then((n) => { ok += n }).catch(() => {})))
  }
  return ok
}

// Firestore timestamps arrive as ms numbers, seconds objects or Timestamps.
export function tsMs(v) {
  try {
    if (!v) return 0
    if (typeof v === 'number') return v < 1e12 ? v * 1000 : v
    if (typeof v === 'string') { const t = Date.parse(v); return Number.isFinite(t) ? t : 0 }
    if (typeof v.toMillis === 'function') return v.toMillis()
    if (typeof v.seconds === 'number') return v.seconds * 1000
  } catch {}
  return 0
}

// Delete a document and every subcollection under it (posts, bins, admins,
// invitees, ...), shallow trees included.
async function deleteTree(ref, depth, log) {
  if (depth > 5) return
  const cols = await ref.listCollections()
  for (const c of cols) {
    for (let round = 0; round < 60; round++) {
      const snap = await c.limit(300).get()
      if (!snap.size) break
      await Promise.all(snap.docs.map((d) => deleteTree(d.ref, depth + 1, log).catch((e) => log.errors.push(String(e && e.message ? e.message : e)))))
    }
  }
  await ref.delete()
}

const appTitle = (d) => String(d.title || [d.bride, d.groom].filter(Boolean).join(' & ') || '').trim()

// The retention sweep: delete every sample app past its retention day and
// every real (trial) app past its longer retention, including their Firestore
// records and every Cloudinary file they own. Paid (activated) apps are never
// auto-deleted: freeing a paying customer's app is a business decision, so
// they are reported back instead.
export async function runRetentionCleanup(nowMs = Date.now()) {
  fbInit()
  const db = getFirestore()
  const settings = await readSettings()
  const sampleCutoff = nowMs - settings.retentionSampleDays * 86400000
  const realCutoff = nowMs - settings.retentionRealDays * 86400000
  const log = {
    ranAt: new Date(nowMs).toISOString(),
    retentionSampleDays: settings.retentionSampleDays,
    retentionRealDays: settings.retentionRealDays,
    sampleApps: [],
    sampleFilesDeleted: 0,
    realApps: [],
    realFilesDeleted: 0,
    skippedPaid: [],
    errors: [],
  }

  // Every app, sample or real, is a doc in the leads collection; real ones
  // carry the couple's email, samples deliberately have none.
  const expiredSamples = []
  const expiredReals = []
  try {
    const leads = await db.collection('leads').get()
    for (const d of leads.docs) {
      const data = d.data() || {}
      const created = tsMs(data.createdAt)
      if (!created) continue
      const isReal = !!String(data.email || '').trim()
      const title = appTitle(data) || d.id
      if (isReal) {
        if (data.activatedAt) { log.skippedPaid.push({ id: d.id, title }) ; continue }
        if (created < realCutoff) expiredReals.push({ id: d.id, title, created })
      } else if (created < sampleCutoff) {
        expiredSamples.push({ id: d.id, title })
      }
    }
  } catch (e) {
    log.errors.push('leads listing: ' + String(e && e.message ? e.message : e))
  }

  // Sample files first: shared folders, so files are picked by age.
  try {
    const items = []
    for (const type of TYPES) {
      for (const r of await listByPrefix(type, 'eventicor-leads-')) {
        const t = Date.parse(r.createdAt)
        if (Number.isFinite(t) && t < sampleCutoff) items.push({ id: r.id, type })
      }
    }
    log.sampleFilesDeleted = await destroyIds(items)
  } catch (e) {
    log.errors.push('sample files: ' + String(e && e.message ? e.message : e))
  }

  for (const s of expiredSamples) {
    try {
      await db.collection('leads').doc(s.id).delete()
      log.sampleApps.push({ id: s.id, title: s.title })
    } catch (e) {
      log.errors.push(`sample ${s.id}: ` + String(e && e.message ? e.message : e))
    }
  }

  for (const r of expiredReals) {
    try {
      log.realFilesDeleted += await destroyPrefix(`apps/${r.id}/`)
      // Archive the business record before the app record goes: payments and
      // plan history outlive the app itself.
      const leadSnap = await db.collection('leads').doc(r.id).get()
      const lead = (leadSnap.exists && leadSnap.data()) || {}
      await db.collection('platform').collection('deleted_apps').doc(r.id).set({
        title: r.title, email: lead.email || '', plan: lead.plan || '', createdAt: lead.createdAt || null,
        activatedAt: lead.activatedAt || null, renewsAt: lead.renewsAt || null, lastPayment: lead.lastPayment || null,
        deletedAt: FieldValue.serverTimestamp(), reason: 'retention',
      }).catch(() => {})
      await deleteTree(db.collection('apps').doc(r.id), 0, log)
      await db.collection('leads').doc(r.id).delete()
      log.realApps.push({ id: r.id, title: r.title })
    } catch (e) {
      log.errors.push(`app ${r.id}: ` + String(e && e.message ? e.message : e))
    }
  }

  try {
    await db.collection('platform').doc('storage').set({
      lastCleanup: {
        at: FieldValue.serverTimestamp(),
        sampleApps: log.sampleApps.length,
        sampleFiles: log.sampleFilesDeleted,
        realApps: log.realApps.length,
        realFiles: log.realFilesDeleted,
        skippedPaid: log.skippedPaid.length,
        errors: log.errors.slice(0, 5),
      },
    }, { merge: true })
  } catch {}

  return log
}
