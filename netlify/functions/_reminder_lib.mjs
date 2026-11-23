// Eventicor — trial reminder emails (user direction Nov 20 2026).
// Customers (landing leads only) get four automatic emails:
//   3 hours before the 24-hour trial ends, then 3, 14 and 30 days after it
//   expired. Nothing after 30 days. Each email carries a button that opens
//   their own app. Active (paid), deleted and suspended apps never get mail.

let fbReady = false;
export async function fbInit() {
  if (fbReady) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON env var is not set');
  const svc = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const { initializeApp, cert } = await import('firebase-admin/app');
  initializeApp({ credential: cert(svc), projectId: svc.project_id });
  fbReady = true;
}

const authOf = (t) => (t.startsWith('Zoho-enczapikey') ? t : 'Zoho-enczapikey ' + t);
async function zeptoSend(payload) {
  const candidates = [...new Set(
    [process.env.ZEPTOMAIL_SEND_MAIL_TOKEN, process.env.ZEPTOMAIL_API]
      .filter(Boolean).map(authOf)
  )];
  if (!candidates.length) throw new Error('ZeptoMail is not configured');
  let res;
  for (const tok of candidates) {
    try {
      res = await fetch('https://api.zeptomail.com/v1.1/email', {
        method: 'POST',
        headers: { Authorization: tok, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      throw new Error('Could not reach ZeptoMail: ' + String(e && e.message ? e.message : e));
    }
    if (res.status !== 401) return res;
  }
  return res;
}

const SITE_URL = process.env.REMINDER_SITE_URL || 'https://eventicor.name.ng';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ng = (n) => '₦' + Number(n || 0).toLocaleString('en-NG');
const fmtTime = (ts) => new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function appLink(l) {
  const q = new URLSearchParams();
  if (l.template) q.set('tpl', l.template);
  if (l.accent) q.set('acc', l.accent);
  q.set('lead', l.id);
  return `${SITE_URL}/app?${q.toString()}`;
}

// Shared email shell: same look as the welcome emails (navy header, cream
// body, gold accents), with one big button and the plan note under it.
function shell({ names, heading, body, cta, url, footNote, community }) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f2ec;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f2ec;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 1px 4px rgba(20,18,43,.08);">
<tr><td style="background:#14122b;padding:26px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#ffffff;"><span style="color:#d8b06a;">&#9679;</span> Eventicor</td>
<td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#b9b4d6;">Wedding apps for every tradition</td>
</tr></table>
</td></tr>
<tr><td style="padding:36px 36px 8px;font-family:Arial,Helvetica,sans-serif;">
<p style="margin:0 0 14px;font-size:15px;color:#55506e;">Hi ${esc(names)},</p>
<p style="margin:0 0 12px;font-size:26px;line-height:1.25;color:#14122b;font-family:Georgia,'Times New Roman',serif;">${esc(heading)}</p>
${body}
</td></tr>
<tr><td style="padding:8px 36px 26px;" align="center">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="background:#2f3fb8;border-radius:12px;">
<a href="${esc(url)}" style="display:inline-block;padding:15px 30px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">${esc(cta)}</a>
</td></tr></table>
<p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8b87a3;word-break:break-all;">${esc(url)}</p>
</td></tr>
<tr><td style="padding:0 36px 30px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fdf3e3;border:1px solid #f0dcb4;border-radius:12px;">
<tr><td style="padding:16px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#7a5c1e;">
${footNote}
</td></tr></table>
<p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:#55506e;">Questions or enquiries? Everything is handled in the <a href="https://chat.whatsapp.com/KfSanIyOEU75q1bBvpqH31?s=sh&p=a&iam=2" style="color:#2f3fb8;">Eventicor community on WhatsApp</a>. This inbox does not take replies.</p>
</td></tr>
<tr><td style="background:#14122b;padding:18px 32px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#b9b4d6;text-align:center;">Eventicor &middot; Every photo, video and wish, in one beautiful place.</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function para(t, opts = {}) {
  return `<p style="margin:0 0 ${opts.gap || 14}px;font-size:15px;line-height:1.6;color:#55506e;">${t}</p>`;
}
function strong(t) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fdf3e3;border:1px solid #f0dcb4;border-radius:12px;"><tr><td style="padding:16px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#7a5c1e;"><strong>${t}</strong></td></tr></table>`;
}

// The four stages. Keyed by the expiry they belong to, so a trial the admin
// extends reschedules its reminders naturally: each flag stores the expiresAt
// it was sent for and a new expiry re-arms the stage.
const STAGES = [
  {
    key: 'h3',
    due: (exp, now) => now >= exp - 3 * 3600e3 && now < exp,
    subject: (n) => `3 hours left: your wedding app goes offline soon`,
    heading: () => '3 hours left on your free trial.',
    body: ({ names, exp }) => para(`Your free trial ends at <strong>${fmtTime(exp)}</strong>. After that your app goes quiet: guests who open your link will see a paused notice instead of your wedding.`) +
      para(`Nothing you uploaded is going anywhere. The moment you pay, everything comes back exactly as you left it: your names, your countdown, your guest wall, your photos and reels.`),
    cta: () => 'Keep my app live',
    footNote: () => `One payment keeps your app live for a full year. Plans start at <strong>${ng(30000)}</strong>.`,
  },
  {
    key: 'd3',
    due: (exp, now) => now >= exp + 3 * 86400e3,
    subject: (n) => `Your wedding app is paused, ${n}`,
    heading: () => 'Your app is paused. Your memories are not.',
    body: () => para(`Three days ago your 24-hour free trial ended and your app went offline. Your guests cannot post, view or share right now.`) +
      para(`Everything you built is still sitting safe and untouched: the wall, the feed, the countdown, every photo your guests dropped in. One payment brings it all back instantly.`),
    cta: () => 'Bring my app back',
    footNote: () => `Plans start at <strong>${ng(30000)}</strong> for a full year of your app.`,
  },
  {
    key: 'd14',
    due: (exp, now) => now >= exp + 14 * 86400e3,
    subject: (n) => `Two weeks gone, your wedding memories are still waiting`,
    heading: () => 'Two weeks offline, everything still here.',
    body: () => para(`It has been two weeks since your wedding app went offline. Your family and friends still ask about it, and your photos, guest wishes and countdown are exactly where you left them.`) +
      para(`They are waiting for you, not for a rebuild. One payment restores the whole app for a full year, no setup, nothing starts over.`),
    cta: () => 'Restore my app',
    footNote: () => `Plans start at <strong>${ng(30000)}</strong>. Your uploads are already paid for in the work you put in. Make it live again.`,
  },
  {
    key: 'd30',
    due: (exp, now) => now >= exp + 30 * 86400e3,
    subject: (n) => `Last reminder: bring your wedding app back`,
    heading: () => 'Our last reminder about your app.',
    body: () => para(`This is the last email we will send you about your Eventicor app. After this we step back and stop reminding you.`) +
      para(`Your app is still paused and everything in it is still safe: your photos, your guest wall, your names and countdown. Whenever you are ready, one payment brings it back for a full year.`),
    cta: () => 'Pay and restore my app',
    footNote: () => `Plans start at <strong>${ng(30000)}</strong>. This is the final reminder for this app.`,
  },
];

// One sweep over every landing lead. Returns a per-lead log for the caller.
export async function runSweep(now = Date.now()) {
  await fbInit();
  const { getFirestore } = await import('firebase-admin/firestore');
  const { FieldValue } = await import('firebase-admin/firestore');
  const db = getFirestore();
  const log = [];
  let docs = [];
  let after = null;
  for (;;) {
    let q = db.collection('leads').where('source', '==', 'landing').orderBy('__name__').limit(300);
    if (after) q = q.startAfter(after);
    const snap = await q.get();
    if (snap.empty) break;
    docs.push(...snap.docs);
    if (snap.size < 300) break;
    after = snap.docs[snap.docs.length - 1];
  }
  for (const doc of docs) {
    const l = doc.data();
    const id = doc.id;
    const skip = (why) => { log.push({ id, names: `${l.bride || ''} & ${l.groom || ''}`, skipped: why }); };
    const exp = Number(l.expiresAt);
    const flags = l.reminders || {};
    const names = `${l.bride || 'Bride'} & ${l.groom || 'Groom'}`;
    if (!l.email) { skip('no email'); continue; }
    if (l.activatedAt) { skip('active'); continue; }
    if (l.status === 'deleted') { skip('deleted'); continue; }
    if (l.status === 'suspended') { skip('suspended'); continue; }
    if (!l.expiresAt) { skip('no expiresAt'); continue; }
    for (const st of STAGES) {
      if (flags[st.key] === exp) continue;           // already sent for this expiry
      if (!st.due(exp, now)) continue;
      const url = appLink({ ...l, id });
      const html = shell({
        names,
        heading: st.heading(),
        body: st.body({ names, exp }),
        cta: st.cta(),
        url,
        footNote: st.footNote(),
      });
      const res = await zeptoSend({
        from: { address: process.env.ZEPTOMAIL_FROM_ADDRESS, name: process.env.ZEPTOMAIL_FROM_NAME || 'Eventicor' },
        to: [{ email_address: { address: l.email, name: names } }],
        subject: st.subject(names),
        htmlbody: html,
      });
      const ok = res.status >= 200 && res.status < 300;
      log.push({ id, stage: st.key, email: l.email, status: res.status, ok });
      if (ok) await doc.ref.set({ reminders: { ...flags, [st.key]: exp } }, { merge: true });
      break; // one email per lead per sweep, the next stage fires on a later run
    }
  }
  return log;
}
