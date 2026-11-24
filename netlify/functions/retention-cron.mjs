// Daily retention sweep for the Eventicor platform, pinged by
// .github/workflows/retention-cron.yml. Key-gated like the reminders cron so
// the endpoint can't be abused; the key is baked in (private repo).
import { runRetentionCleanup } from './_storage_lib.mjs'

const KEY = '8c739c480c565fac44fd4fe421d76083'
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' }
  const q = event.queryStringParameters || {}
  if (q.key !== KEY) return { statusCode: 404, body: 'not found' }
  try {
    const log = await runRetentionCleanup()
    return { statusCode: 200, body: JSON.stringify({ ok: true, log }) }
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(e && e.message ? e.message : e) }) }
  }
}
