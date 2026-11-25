// storage-overview: the Eventicor console's live storage console.
//   overview      - Cloudinary's live account usage plus the per-app
//                   breakdown (recounted when the cache is older than six
//                   hours, or on demand with force)
//   save-settings - retention days and the low-storage warning threshold
//   cleanup       - run the retention cleanup right now
// Only platform admins (top-level admins docs) may call any of it.
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { fbInit, cloudinaryUsage, recountUsage, readSettings, runRetentionCleanup, STALE_MS } from './_storage_lib.mjs'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } })

const clampInt = (v, lo, hi, dflt) => {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'POST only' })
  try {
    fbInit()
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) return json(401, { error: 'Sign in required.' })
    const decoded = await getAuth().verifyIdToken(token)
    const email = String(decoded.email || '').toLowerCase()
    if (!email) return json(403, { error: 'No email on this account.' })
    const adm = await getFirestore().collection('admins').doc(email).get().catch(() => null)
    if (!adm || !adm.exists) return json(403, { error: 'Only platform admins can do that.' })
    const body = await req.json().catch(() => ({}))
    const db = getFirestore()

    if (body.op === 'save-settings') {
      const settings = {
        retentionSampleDays: clampInt(body.retentionSampleDays, 1, 3650, 30),
        retentionRealDays: clampInt(body.retentionRealDays, 1, 3650, 90),
        warnPercent: clampInt(body.warnPercent, 1, 100, 80),
      }
      await db.collection('platform').doc('settings').set(settings, { merge: true })
      return json(200, { ok: true, settings })
    }

    if (body.op === 'cleanup') {
      const log = await runRetentionCleanup()
      return json(200, { ok: true, log })
    }

    if (body.op === 'overview') {
      let usage = null
      let usageError = ''
      try { usage = await cloudinaryUsage() } catch (e) { usageError = String(e && e.message ? e.message : e) }

      const cacheSnap = await db.collection('platform').doc('storage').get().catch(() => null)
      let cache = (cacheSnap && cacheSnap.exists && cacheSnap.data()) || {}
      let recomputed = false
      const cachedAt = cache.computedAt && cache.computedAt.toMillis ? cache.computedAt.toMillis() : Number(cache.computedAt) || 0
      if (!cachedAt || Date.now() - cachedAt > STALE_MS || body.force) {
        const fresh = await recountUsage()
        cache = { ...cache, apps: fresh.apps, sample: fresh.sample, computedAt: FieldValue.serverTimestamp() }
        await db.collection('platform').doc('storage').set(
          { apps: fresh.apps, sample: fresh.sample, computedAt: FieldValue.serverTimestamp() },
          { merge: true },
        )
        recomputed = true
      }

      const appsMap = cache.apps || {}
      const ids = Object.keys(appsMap).sort((a, b) => appsMap[b] - appsMap[a])
      const realTotal = ids.reduce((s, id) => s + (Number(appsMap[id]) || 0), 0)
      const sampleTotal = Number(cache.sample) || 0
      const top = ids.slice(0, 15)
      const leadSnaps = await Promise.all(top.map((id) => db.collection('leads').doc(id).get().catch(() => null)))
      const apps = top.map((id, i) => {
        const d = (leadSnaps[i] && leadSnaps[i].exists && leadSnaps[i].data()) || {}
        return {
          id,
          bytes: Number(appsMap[id]) || 0,
          name: String(d.title || [d.bride, d.groom].filter(Boolean).join(' & ') || id),
          plan: String(d.plan || ''),
          createdAt: Number(d.createdAt) || 0,
          paid: !!d.activatedAt,
        }
      })

      const settings = await readSettings()
      const storageBytes = usage ? usage.storageBytes : 0
      const other = usage ? Math.max(0, storageBytes - realTotal - sampleTotal) : 0
      const creditsUsed = usage ? usage.credits.usage : 0
      const creditsLimit = usage ? usage.credits.limit : 0
      const warn = !!(usage && creditsLimit > 0 && (creditsUsed / creditsLimit) * 100 >= settings.warnPercent)
      return json(200, {
        ok: true,
        usage,
        usageError,
        breakdown: { real: realTotal, sample: sampleTotal, other, total: storageBytes },
        apps,
        settings,
        recomputed,
        lastCleanup: cache.lastCleanup || null,
        warn,
        serverNow: Date.now(),
      })
    }

    return json(400, { error: 'Unknown op.' })
  } catch (e) {
    return json(500, { error: String(e && e.message ? e.message : e) })
  }
}
