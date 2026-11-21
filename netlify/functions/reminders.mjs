// Eventicor — automatic trial reminder emails (Netlify scheduled function).
// Runs hourly and sends, per customer (landing lead):
//   h3:  3 hours before the 24-hour trial ends
//   d3:  3 days after expiry
//   d14: 14 days after expiry
//   d30: 30 days after expiry (final reminder, nothing after)
// Active, deleted and suspended apps never get mail. One email per lead per
// run; the shared state lives on the lead doc under `reminders`.
import { runSweep } from './_reminder_lib.mjs';

export const config = { schedule: '23 * * * *' };

export default async (event) => {
  if (event && event.httpMethod === 'GET') {
    return { statusCode: 200, body: JSON.stringify({ ok: true, service: 'reminders', schedule: 'hourly at :23' }) };
  }
  try {
    const log = await runSweep();
    return { statusCode: 200, body: JSON.stringify({ ok: true, log }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(e && e.message ? e.message : e) }) };
  }
};
