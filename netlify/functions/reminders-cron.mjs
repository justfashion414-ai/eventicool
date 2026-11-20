// Hourly reminder sweep endpoint, pinged by the GitHub Actions cron
// (.github/workflows/reminders-cron.yml). Key-gated so it can't be abused.
import { runSweep } from './_reminder_lib.mjs';
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };
  const q = event.queryStringParameters || {};
  if (q.key !== process.env.REMINDERS_CRON_SECRET) return { statusCode: 404, body: 'not found' };
  try {
    const log = await runSweep();
    return { statusCode: 200, body: JSON.stringify({ ok: true, log }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(e && e.message ? e.message : e) }) };
  }
};
