// Eventicor — sends the "your wedding app is ready" credential email via Zoho ZeptoMail.
// Required Netlify env vars:
//   ZEPTOMAIL_SEND_MAIL_TOKEN  — the Send Mail token from your ZeptoMail mail agent
//   ZEPTOMAIL_FROM_ADDRESS     — your verified sender address on the ZeptoMail bounce domain
//   ZEPTOMAIL_FROM_NAME        — optional, defaults to "Eventicor"
//
// POST /api/send-credentials
// body: { email, name?, bride?, groom?, wedding_date?, city?, preview_url, source: "landing" | "admin" }
// landing links expire in 24 hours; admin dashboard (outbound leads) links expire in 30 days.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const VARIANTS = {
  landing: { file: 'preview-credentials-24h.html', subject: 'Your Eventicor wedding app is ready', hours: 24 },
  admin: { file: 'preview-credentials-30d.html', subject: 'A live wedding app preview, made just for you', hours: 24 * 30 },
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fill(tpl, data) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in data ? esc(data[k]) : ''));
}

const json = (code, body) => ({ statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const handler = async (event) => {
  if (event.httpMethod === 'GET') return json(200, { ok: true, service: 'send-credentials' });
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Use POST' });

  let p;
  try { p = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false, error: 'Invalid JSON body' }); }

  const email = String(p.email || '').trim();
  const previewUrl = String(p.preview_url || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { ok: false, error: 'A valid recipient email is required' });
  if (!/^https?:\/\//.test(previewUrl)) return json(400, { ok: false, error: 'preview_url is required' });

  const src = p.source === 'admin' ? 'admin' : 'landing';
  const variant = VARIANTS[src];
  const token = process.env.ZEPTOMAIL_SEND_MAIL_TOKEN || '';
  const fromAddress = process.env.ZEPTOMAIL_FROM_ADDRESS || '';
  const fromName = process.env.ZEPTOMAIL_FROM_NAME || 'Eventicor';
  if (!token || !fromAddress) {
    return json(500, { ok: false, error: 'ZeptoMail is not configured: set ZEPTOMAIL_SEND_MAIL_TOKEN and ZEPTOMAIL_FROM_ADDRESS in the Netlify environment' });
  }

  const bride = String(p.bride || '').trim() || 'the couple';
  const groom = String(p.groom || '').trim() || '';
  const names = groom ? `${bride} & ${groom}` : bride;
  const expiresOn = new Date(Date.now() + variant.hours * 3600 * 1000).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short' }) + ' WAT';

  const data0 = {
    wedding_date: String(p.wedding_date || '').trim(),
    city: String(p.city || '').trim(),
  };
  const dateLine = data0.wedding_date ? ` for ${data0.wedding_date}` : '';
  const placeLine = data0.city ? ` in ${data0.city}` : '';
  const data = {
    date_line: dateLine,
    place_line: placeLine,
    bride_name: bride,
    groom_name: groom,
    names,
    wedding_date: String(p.wedding_date || '').trim(),
    city: String(p.city || '').trim(),
    preview_url: previewUrl,
    expires_on: expiresOn,
    hours: String(variant.hours),
  };

  let html;
  try { html = fill(readFileSync(path.join(HERE, 'templates', variant.file), 'utf8'), data); }
  catch { return json(500, { ok: false, error: `Template file missing: ${variant.file}` }); }

  const text =
    `Hi ${names},\n\n` +
    `Your Eventicor wedding app preview is ready.\n` +
    `Open it here: ${previewUrl}\n\n` +
    `Inside you can see your names, your date (${data.wedding_date || 'your wedding date'})` +
    `${data.city ? ` in ${data.city}` : ''}, your stages, the memory wall, gifts and more, all live on your own link.\n\n` +
    `This preview link is open until ${expiresOn}, after which it closes. ` +
    `To keep it forever, publish your app from the preview page.\n\n` +
    `With love,\nEventicor`;

  const auth = token.startsWith('Zoho-enczapikey') ? token : `Zoho-enczapikey ${token}`;
  let res;
  try {
    res = await fetch('https://api.zeptomail.com/v1.1/email', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: { address: fromAddress, name: fromName },
        to: [{ email_address: { address: email, name: String(p.name || names) } }],
        subject: variant.subject,
        htmlbody: html,
        textbody: text,
      }),
    });
  } catch (e) {
    return json(502, { ok: false, error: 'Could not reach ZeptoMail: ' + String(e && e.message ? e.message : e) });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return json(502, { ok: false, error: `ZeptoMail rejected the send (${res.status})`, detail: detail.slice(0, 500) });
  }
  return json(200, { ok: true, source: src, expires_in_hours: variant.hours, expires_on: expiresOn });
};
