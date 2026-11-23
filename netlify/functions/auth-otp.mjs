// auth-otp: password reset by emailed OTP code, plus server-mediated admin
// sign-in with a per-email lockout. Actions:
//   request {email}             send a 6-digit code to the email (one per the
//                               admin's resend window). The reply NEVER says
//                               whether the account exists.
//   verify  {email, code}       check the code. Wrong codes past the admin's
//                               limit lock the whole reset action for the
//                               admin's lock length. On success returns a
//                               short-lived single-use reset token.
//   reset   {email,token,password}  set the new password with that token.
//   login   {email, password}   the real password check happens HERE, not in
//                               the browser: wrong passwords past the admin's
//                               limit lock sign-in for that email. On success
//                               returns a Firebase custom token the browser
//                               exchanges for its session.
//   check   {email}             no-side-effect read of the lock state plus
//                               the live policy, for the screens' copy and
//                               disabled buttons.
// Every counter and lock lives in Firestore (authOtp, authLock) and is only
// ever written by this function, so a browser cannot weaken or reset them.
// The limits themselves are the Eventicor admin's: the platform/security doc
// is written only from the admin console (the proxy's platform-admin gate
// refuses everyone else) and is read FRESH here on every request, so a save
// takes hold on the very next attempt.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let ready = false;
function init() {
  if (ready) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON env var is not set');
  const svc = typeof raw === 'string' ? JSON.parse(raw) : raw;
  initializeApp({ credential: cert(svc), projectId: svc.project_id });
  ready = true;
}

// Public web API key (it ships in the client bundle anyway); overridable by env.
const WEB_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyDmme_nhjckYtzT9mEEt2GCKZFuPb0SmKM';

// ---- Login security policy: the Eventicor admin owns these numbers ----
const SEC_DEFAULTS = { loginMaxAttempts: 3, otpMaxAttempts: 5, lockMinutes: 60, codeExpiryMinutes: 10, resendMinutes: 10 };
const SEC_CLAMPS = {
  loginMaxAttempts: [1, 10],   // wrong passwords before sign-in locks
  otpMaxAttempts: [1, 10],     // wrong codes before the reset locks
  lockMinutes: [1, 1440],      // how long every lock lasts
  codeExpiryMinutes: [1, 60],  // a code, and the reset token, stop working after this
  resendMinutes: [1, 60],      // one code per email per this many minutes
};
async function loadSec(db) {
  const out = { ...SEC_DEFAULTS };
  try {
    const snap = await db.collection('platform').doc('security').get();
    const d = snap.exists ? (snap.data() || {}) : {};
    for (const k of Object.keys(SEC_DEFAULTS)) {
      const n = Math.floor(Number(d[k]));
      if (Number.isFinite(n)) {
        const [lo, hi] = SEC_CLAMPS[k];
        out[k] = Math.max(lo, Math.min(hi, n));
      }
    }
  } catch { /* the defaults stand on any read failure */ }
  return out;
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } });

function escS(v){return String(v==null?'':v).replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function otpRecoverEmail(code,mins){
  const digits=String(code).split('').join(' ');
  return `<!doctype html><html><body style="margin:0;background:#f6f5fa;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <div style="background:#ffffff;border:1px solid #e6e4ef;border-radius:16px;padding:32px 28px;text-align:center">
      <div style="font-size:22px;font-weight:bold;color:#141f4e;letter-spacing:.5px">Eventicor</div>
      <p style="margin:18px 0 6px;font-size:15px;color:#5a6970">Use this code to get the link to your app back. It works once and stops working in ${mins} minutes.</p>
      <div style="margin:22px auto;font-size:40px;font-weight:800;letter-spacing:10px;color:#141f4e">${digits}</div>
      <p style="margin:0 0 14px;font-size:13px;color:#8a90a6">If you did not ask for this code you can ignore this email; your app is unchanged.</p>
    </div>
  </div>
</body></html>`;
}
function recoverLinkEmail(base,apps){
  const rows=apps.length
    ? apps.map((a)=>'<p style="margin:0 0 18px"><a href="'+escS(base+a.url)+'" style="display:inline-block;background:#141f4e;color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:12px;font-weight:bold">'+escS(a.bride&&a.groom?a.bride+' & '+a.groom:'Open your app')+'</a></p>').join('')
    : '<p style="margin:0 0 18px;font-size:15px;color:#5a6970">We could not find an app created with this email yet. You can create one any time on the Eventicor landing page.</p>';
  return `<!doctype html><html><body style="margin:0;background:#f6f5fa;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <div style="background:#ffffff;border:1px solid #e6e4ef;border-radius:16px;padding:32px 28px;text-align:center">
      <div style="font-size:22px;font-weight:bold;color:#141f4e;letter-spacing:.5px">Eventicor</div>
      <p style="margin:18px 0 6px;font-size:15px;color:#5a6970">You asked us to send the link to the app you created with this email. Here ${apps.length===1?'it is':'they are'}:</p>
      ${rows}
      <p style="margin:0;font-size:13px;color:#8a90a6">Your login details are unchanged. If you forgot your password, use Forgot password on the sign-in page.</p>
    </div>
  </div>
</body></html>`;
}

// A stable per-deploy pepper so the stored hash is useless without it.
let pepperCache = null;
function pepper() {
  if (pepperCache) return pepperCache;
  const raw = process.env.OTP_SECRET || process.env.FIREBASE_SERVICE_ACCOUNT_JSON || 'eventicor';
  pepperCache = createHash('sha256').update('auth-otp-v1:' + raw).digest('hex');
  return pepperCache;
}
const codeHash = (email, code) =>
  createHash('sha256').update(pepper() + '|' + email + '|' + String(code).trim()).digest('hex');
const safeEq = (a, b) => {
  const A = Buffer.from(String(a || ''));
  const B = Buffer.from(String(b || ''));
  return A.length === B.length && timingSafeEqual(A, B);
};
const norm = (e) => String(e || '').trim().toLowerCase();

// ---- ZeptoMail (same account the credential emails use) ----
const authOf = (t) => (t.startsWith('Zoho-enczapikey') ? t : 'Zoho-enczapikey ' + t);
// Same send path the credential and invite emails use: both stored tokens are
// tried and the one ZeptoMail accepts is kept for the container's lifetime.
let zeptoTokenCache = null;
async function zeptoSend(to, subject, html) {
  const fromAddress = process.env.ZEPTOMAIL_FROM_ADDRESS || '';
  const candidates = [...new Set(
    [process.env.ZEPTOMAIL_SEND_MAIL_TOKEN, process.env.ZEPTOMAIL_API]
      .filter(Boolean).map(authOf)
  )];
  if (!candidates.length || !fromAddress) return { ok: false, why: 'not configured' };
  const payload = JSON.stringify({
    from: { address: fromAddress, name: process.env.ZEPTOMAIL_FROM_NAME || 'Eventicor' },
    to: [{ email_address: { address: to } }],
    subject,
    htmlbody: html,
  });
  let res;
  const order = zeptoTokenCache ? [zeptoTokenCache, ...candidates.filter((c) => c !== zeptoTokenCache)] : candidates;
  for (const tok of order) {
    try {
      res = await fetch('https://api.zeptomail.com/v1.1/email', {
        method: 'POST',
        headers: { Authorization: tok, 'Content-Type': 'application/json' },
        body: payload,
      });
    } catch (e) {
      return { ok: false, why: String((e && e.message) || e) };
    }
    if (res.status !== 401) { zeptoTokenCache = tok; break; }
  }
  if (res && res.ok) return { ok: true };
  let detail = 'status ' + (res ? res.status : 'no response');
  try { detail = (await res.json()).message || detail; } catch {}
  return { ok: false, why: detail };
}

function otpEmail(code, mins) {
  const digits = String(code).split('').join(' ');
  return `<!doctype html><html><body style="margin:0;background:#f6f5fa;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <div style="background:#ffffff;border:1px solid #e6e4ef;border-radius:16px;padding:32px 28px;text-align:center">
      <div style="font-size:22px;font-weight:bold;color:#141f4e;letter-spacing:.5px">Eventicor</div>
      <p style="margin:18px 0 6px;font-size:15px;color:#5a6970">Use this code to reset your password. It works once and stops working in ${mins} minutes.</p>
      <div style="margin:22px auto;font-size:40px;font-weight:800;letter-spacing:10px;color:#141f4e">${digits}</div>
      <p style="margin:0 0 14px;font-size:13px;color:#8a90a6">If you did not request a password reset you can ignore this email; your password is unchanged.</p>
    </div>
  </div>
</body></html>`;
}

const msLeft = (v) => Math.max(0, (v ? v.toMillis ? v.toMillis() : Number(v) : 0) - Date.now());

// ---- Firestore state helpers ----
async function getOtp(email) {
  const snap = await getFirestore().collection('authOtp').doc(email).get();
  return snap.exists ? snap.data() : null;
}
async function getLock(kind, email) {
  const snap = await getFirestore().collection('authLock').doc(kind + ':' + email).get();
  return snap.exists ? snap.data() : null;
}
const lockUntilOf = (d) => (d && d.lockedUntil ? (d.lockedUntil.toMillis ? d.lockedUntil.toMillis() : Number(d.lockedUntil)) : 0);
const lockStartOf = (d) => (d && d.at ? (d.at.toMillis ? d.at.toMillis() : Number(d.at)) : 0);
// The saved lock length applies to locks already in flight too: the effective
// expiry always derives from when the lock started plus the CURRENT policy, so
// a console save is live on every read, in both directions. A lock with no
// start time (or a miss) falls back to its stored expiry.
const effectiveLockLeft = (lock, LOCK_MS) => {
  if (!lock) return 0;
  const start = lockStartOf(lock);
  return msLeft(start > 0 ? start + LOCK_MS : lockUntilOf(lock));
};

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: cors });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'POST only' });

  let body = {};
  try { body = await req.json(); } catch { return json(400, { ok: false, error: 'bad body' }); }
  const op = String(body.op || '');
  const email = norm(body.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { ok: false, error: 'invalid-email' });

  try { init(); } catch (e) { return json(500, { ok: false, error: 'server not configured' }); }
  const db = getFirestore();
  const sec = await loadSec(db); // fresh every request: a console save is live immediately
  const LOGIN_MAX_ATTEMPTS = sec.loginMaxAttempts;
  const OTP_MAX_ATTEMPTS = sec.otpMaxAttempts;
  const LOCK_MS = sec.lockMinutes * 60000;
  const OTP_TTL_MS = sec.codeExpiryMinutes * 60000;
  const RESEND_WINDOW_MS = sec.resendMinutes * 60000;
  const TOKEN_TTL_MS = sec.codeExpiryMinutes * 60000;

  // ================= request =================
  if (op === 'request') {
    const lock = await getLock('otp', email);
    const lockLeft = effectiveLockLeft(lock, LOCK_MS);
    if (lockLeft > 0) return json(429, { ok: false, error: 'locked', retryAt: Date.now() + lockLeft });
    const prev = await getOtp(email);
    if (prev) {
      const wait = RESEND_WINDOW_MS - (Date.now() - (prev.lastSentAt ? (prev.lastSentAt.toMillis ? prev.lastSentAt.toMillis() : Number(prev.lastSentAt)) : 0));
      if (wait > 0) return json(429, { ok: false, error: 'rate', retryAfter: Math.ceil(wait / 1000) });
    }
    // Only a real account gets a code; the reply is identical either way.
    let exists = true;
    try { await getAuth().getUserByEmail(email); } catch (e) { exists = !(e && e.code === 'auth/user-not-found'); }
    if (exists) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const sent = await zeptoSend(email, 'Your Eventicor password reset code', otpEmail(code, sec.codeExpiryMinutes));
      if (!sent.ok) return json(502, { ok: false, error: 'send-failed', detail: String(sent.why || '').slice(0, 300) });
      await db.collection('authOtp').doc(email).set({
        email,
        hash: codeHash(email, code),
        attempts: 0,
        verified: false,
        token: '',
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        lastSentAt: FieldValue.serverTimestamp(),
      });
    }
    return json(200, { ok: true });
  }

  // ================= verify =================
  if (op === 'verify') {
    const lock = await getLock('otp', email);
    const lockLeft = effectiveLockLeft(lock, LOCK_MS);
    if (lockLeft > 0) return json(429, { ok: false, error: 'locked', retryAt: Date.now() + lockLeft });
    const doc = await getOtp(email);
    if (!doc) return json(400, { ok: false, error: 'none' });
    const exp = doc.expiresAt ? (doc.expiresAt.toMillis ? doc.expiresAt.toMillis() : Number(doc.expiresAt)) : 0;
    if (exp && exp < Date.now()) return json(400, { ok: false, error: 'expired' });
    const code = String(body.code || '').replace(/\D/g, '');
    if (code.length !== 6 || !safeEq(doc.hash, codeHash(email, code))) {
      const attempts = (Number(doc.attempts) || 0) + 1;
      if (attempts >= OTP_MAX_ATTEMPTS) {
        await db.collection('authLock').doc('otp:' + email).set({ email, lockedUntil: new Date(Date.now() + LOCK_MS), at: FieldValue.serverTimestamp() });
        await db.collection('authOtp').doc(email).delete();
        return json(429, { ok: false, error: 'locked', retryAt: Date.now() + LOCK_MS });
      }
      await db.collection('authOtp').doc(email).set({ attempts }, { merge: true });
      return json(400, { ok: false, error: 'wrong', attemptsLeft: OTP_MAX_ATTEMPTS - attempts });
    }
    const token = randomBytes(24).toString('hex');
    await db.collection('authOtp').doc(email).set({
      attempts: 0, verified: true, token, tokenExpiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    }, { merge: true });
    return json(200, { ok: true, token });
  }

  // ================= reset =================
  if (op === 'reset') {
    const lock = await getLock('otp', email);
    const lockLeft = effectiveLockLeft(lock, LOCK_MS);
    if (lockLeft > 0) return json(429, { ok: false, error: 'locked', retryAt: Date.now() + lockLeft });
    const doc = await getOtp(email);
    if (!doc || !doc.verified || !doc.token || !safeEq(doc.token, String(body.token || ''))) {
      return json(400, { ok: false, error: 'token' });
    }
    const texp = doc.tokenExpiresAt ? (doc.tokenExpiresAt.toMillis ? doc.tokenExpiresAt.toMillis() : Number(doc.tokenExpiresAt)) : 0;
    if (texp && texp < Date.now()) return json(400, { ok: false, error: 'token' });
    const password = String(body.password || '');
    if (password.length < 6) return json(400, { ok: false, error: 'weak' });
    try {
      const u = await getAuth().getUserByEmail(email);
      await getAuth().updateUser(u.uid, { password });
    } catch (e) {
      if (e && e.code === 'auth/user-not-found') return json(400, { ok: false, error: 'token' });
      return json(502, { ok: false, error: 'reset-failed', detail: String((e && (e.code + ' ' + e.message)) || e).slice(0, 300) });
    }
    // Single use: the token dies with the doc.
    await db.collection('authOtp').doc(email).delete();
    return json(200, { ok: true });
  }

  // ================= login =================
  if (op === 'login') {
    const lock = await getLock('login', email);
    const lockLeft = effectiveLockLeft(lock, LOCK_MS);
    if (lockLeft > 0) return json(429, { ok: false, error: 'locked', retryAt: Date.now() + lockLeft });
    const password = String(body.password || '');
    if (!password) return json(400, { ok: false, error: 'missing' });
    let payload;
    try {
      const res = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + WEB_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      });
      payload = await res.json();
      if (res.ok) {
        await db.collection('authLock').doc('login:' + email).set({ email, fails: 0, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        const user = await getAuth().getUserByEmail(email);
        const token = await getAuth().createCustomToken(user.uid, { email: user.email || email });
        return json(200, { ok: true, token });
      }
    } catch (e) {
      return json(502, { ok: false, error: 'auth-unreachable' });
    }
    const msg = (payload && payload.error && payload.error.message) || '';
    // Malformed input is not an attempt; everything else counts against the 3.
    if (msg === 'INVALID_EMAIL' || msg === 'MISSING_PASSWORD') return json(400, { ok: false, error: 'invalid-email' });
    if (msg === 'USER_DISABLED') return json(403, { ok: false, error: 'disabled' });
    if (msg === 'OPERATION_NOT_ALLOWED') return json(403, { ok: false, error: 'not-allowed' });
    const lockDoc = await getLock('login', email) || {};
    const fails = (Number(lockDoc.fails) || 0) + 1;
    if (fails >= LOGIN_MAX_ATTEMPTS) {
      await db.collection('authLock').doc('login:' + email).set({ email, fails: 0, lockedUntil: new Date(Date.now() + LOCK_MS), at: FieldValue.serverTimestamp() });
      return json(429, { ok: false, error: 'locked', retryAt: Date.now() + LOCK_MS });
    }
    await db.collection('authLock').doc('login:' + email).set({ email, fails, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return json(400, { ok: false, error: 'wrong', attemptsLeft: LOGIN_MAX_ATTEMPTS - fails });
  }

  // ================= recover-request =================
  // A visitor whose email already owns an account can recover the link to the
  // app they created. Same security as the password reset: one code per the
  // admin's resend window, wrong codes past the admin's limit lock the whole
  // action for the admin's lock length. State lives under recover: keys so it
  // never mixes with the password-reset counters.
  if (op === 'recover-request') {
    const lock = await getLock('recover', email);
    const lockLeft = effectiveLockLeft(lock, LOCK_MS);
    if (lockLeft > 0) return json(429, { ok: false, error: 'locked', retryAt: Date.now() + lockLeft });
    const prev = await db.collection('authOtp').doc('recover:' + email).get();
    const pd = prev.exists ? prev.data() : null;
    if (pd && pd.lastSentAt) {
      const sent = pd.lastSentAt.toMillis ? pd.lastSentAt.toMillis() : Number(pd.lastSentAt);
      const wait = RESEND_WINDOW_MS - (Date.now() - sent);
      if (wait > 0) return json(429, { ok: false, error: 'rate', retryAfter: Math.ceil(wait / 1000) });
    }
    // Only a real account gets a code; the reply is identical either way.
    let exists = true;
    try { await getAuth().getUserByEmail(email); } catch (e) { exists = !(e && e.code === 'auth/user-not-found'); }
    if (exists) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const sent = await zeptoSend(email, 'Your Eventicor code to get your app link back', otpRecoverEmail(code, sec.codeExpiryMinutes));
      if (!sent.ok) return json(502, { ok: false, error: 'send-failed', detail: String(sent.why || '').slice(0, 300) });
      await db.collection('authOtp').doc('recover:' + email).set({
        email,
        hash: codeHash(email, code),
        attempts: 0,
        verified: false,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        lastSentAt: FieldValue.serverTimestamp(),
      });
    }
    return json(200, { ok: true, resendAfter: sec.resendMinutes * 60 });
  }

  // ================= recover-verify =================
  if (op === 'recover-verify') {
    const lock = await getLock('recover', email);
    const lockLeft = effectiveLockLeft(lock, LOCK_MS);
    if (lockLeft > 0) return json(429, { ok: false, error: 'locked', retryAt: Date.now() + lockLeft });
    const snap = await db.collection('authOtp').doc('recover:' + email).get();
    const doc = snap.exists ? snap.data() : null;
    if (!doc) return json(400, { ok: false, error: 'none' });
    const exp = doc.expiresAt ? (doc.expiresAt.toMillis ? doc.expiresAt.toMillis() : Number(doc.expiresAt)) : 0;
    if (exp && exp < Date.now()) return json(400, { ok: false, error: 'expired' });
    const code = String(body.code || '').replace(/\D/g, '');
    if (code.length !== 6 || !safeEq(doc.hash, codeHash(email, code))) {
      const attempts = (Number(doc.attempts) || 0) + 1;
      if (attempts >= OTP_MAX_ATTEMPTS) {
        await db.collection('authLock').doc('recover:' + email).set({ email, lockedUntil: new Date(Date.now() + LOCK_MS), at: FieldValue.serverTimestamp() });
        await db.collection('authOtp').doc('recover:' + email).delete();
        return json(429, { ok: false, error: 'locked', retryAt: Date.now() + LOCK_MS });
      }
      await db.collection('authOtp').doc('recover:' + email).set({ attempts }, { merge: true });
      return json(400, { ok: false, error: 'wrong', attemptsLeft: OTP_MAX_ATTEMPTS - attempts });
    }
    // Verified: find the app this email created and email the link back.
    let apps = [];
    try {
      const q = await db.collection('leads').where('email', '==', email).limit(5).get();
      q.forEach((d) => {
        const l = d.data() || {};
        const p = new URLSearchParams();
        p.set('lead', d.id);
        if (l.template) p.set('tpl', String(l.template));
        if (l.accent) p.set('acc', String(l.accent));
        const exps = Number(l.expiresAt);
        if (exps > Date.now()) p.set('exp', String(Math.floor(exps / 1000)));
        apps.push({ url: '/install?' + p.toString(), bride: String(l.bride || ''), groom: String(l.groom || '') });
      });
    } catch { /* the fallback copy covers an empty list */ }
    const proto = String(req.headers.get('x-forwarded-proto') || 'https').split(',')[0].trim();
    const host = req.headers.get('host') || 'eventicor.name.ng';
    const base = proto + '://' + host;
    const sent = await zeptoSend(email, 'Your Eventicor app link', recoverLinkEmail(base, apps));
    if (!sent.ok) return json(502, { ok: false, error: 'send-failed', detail: String(sent.why || '').slice(0, 300) });
    // Single use: the code dies with the doc.
    await db.collection('authOtp').doc('recover:' + email).delete();
    return json(200, { ok: true, apps: apps.length });
  }

  // ================= check =================
  // No side effects: the forgot and sign-in screens read the lock state for an
  // email here, so the buttons can stay disabled for the WHOLE lock without a
  // wasted attempt, even after a refresh or a restart of the flow. The
  // 10-minute "one code per email" window rides on the same reply.
  if (op === 'check') {
    const otpLockLeft = effectiveLockLeft(await getLock('otp', email), LOCK_MS);
    const loginLockLeft = effectiveLockLeft(await getLock('login', email), LOCK_MS);
    let canRequest = true, retryAfter = 0;
    if (otpLockLeft > 0) {
      canRequest = false;
    } else {
      const prev = await getOtp(email);
      if (prev) {
        const wait = RESEND_WINDOW_MS - (Date.now() - (prev.lastSentAt ? (prev.lastSentAt.toMillis ? prev.lastSentAt.toMillis() : Number(prev.lastSentAt)) : 0));
        if (wait > 0) { canRequest = false; retryAfter = Math.ceil(wait / 1000); }
      }
    }
    return json(200, {
      ok: true,
      policy: { codeExpiryMinutes: sec.codeExpiryMinutes, resendMinutes: sec.resendMinutes, otpMaxAttempts: sec.otpMaxAttempts, loginMaxAttempts: sec.loginMaxAttempts, lockMinutes: sec.lockMinutes },
      otpLocked: otpLockLeft > 0, otpRetryAt: otpLockLeft > 0 ? Date.now() + otpLockLeft : 0,
      loginLocked: loginLockLeft > 0, loginRetryAt: loginLockLeft > 0 ? Date.now() + loginLockLeft : 0,
      canRequest, retryAfter,
    });
  }

  return json(400, { ok: false, error: 'unknown-op' });
};
