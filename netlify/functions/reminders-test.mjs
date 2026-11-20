// TEMPORARY test route for the reminder sweep; deleted after E2E.
import { runSweep } from './_reminder_lib.mjs';
export const handler = async (event) => {
  const url = new URL('https://x' + (event.path || '') + '?' + (event.queryStringParameters ? new URLSearchParams(event.queryStringParameters).toString() : ''));
  if (url.searchParams.get('key') !== 'rhTsRzmU2JDQMlS') return { statusCode: 404, body: 'not found' };
  try {
    const log = await runSweep();
    return { statusCode: 200, body: JSON.stringify({ ok: true, log }, null, 1) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(e && e.message ? e.message : e) }) };
  }
};
