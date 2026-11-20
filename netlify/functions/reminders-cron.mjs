// Hourly reminder sweep endpoint, pinged by the GitHub Actions cron
// (.github/workflows/reminders-cron.yml). Key-gated so it can't be abused.
import { runSweep } from './_reminder_lib.mjs';

// Key baked in (private repo); the GitHub Actions workflow carries it in the
// REMINDERS_CRON_URL secret. Rotating it means editing this constant.
const KEY = '8ae61bdd82781d4f2e1f19dc61b1f0c4';
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };
  const q = event.queryStringParameters || {};
  if (q.key !== KEY) return { statusCode: 404, body: 'not found' };
  try {
    const log = await runSweep();
    return { statusCode: 200, body: JSON.stringify({ ok: true, log }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(e && e.message ? e.message : e) }) };
  }
};
