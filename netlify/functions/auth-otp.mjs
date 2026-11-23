// auth-otp: password reset by emailed OTP code, plus server-mediated admin
// sign-in with a per-email lockout. Actions:
//   request {email}             send a 6-digit code to the email (one per
//                               10 minutes per email). The reply NEVER says
//                               whether the account exists.
//   verify  {email, code}       check the code. 5 wrong codes lock the whole
//                               reset action for 1 hour. On success returns a
//                               short-lived single-use reset token.
//   reset   {email,token,password}  set the new password with that token.
//   login   {email, password}   the real password check happens HERE, not in
//                               the browser: 3 wrong attempts lock sign-in for
//                               that email for 1 hour. On success returns a
//                               Firebase custom token the browser exchanges
//                               for its session.
// Every counter and lock lives in Firestore (authOtp, authLock) and is only
// ever written by this function, so a browser cannot weaken or reset them.
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

const OTP_TTL_MS = 10 * 60 * 1000;        // a code stops working after 10 minutes
const RESEND_WINDOW_MS = 10 * 60 * 1000;  // one code per email per 10 minutes
const OTP_MAX_ATTEMPTS = 5;               // wrong codes before the reset locks
const LOGIN_MAX_ATTEMPTS = 3;             // wrong passwords before sign-in locks
const LOCK_MS = 60 * 60 * 1000;           // every lock lasts 1 hour
const TOKEN_TTL_MS = 10 * 60 * 1000;      // the reset token after a good code

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } });

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
async function zeptoSend(to, subject, html) {
  const token = process.env.ZEPTOMAIL_SEND_MAIL_TOKEN || process.env.ZEPTOMAIL_API;
  const fromAddress = process.env.ZEPTOMAIL_FROM_ADDRESS || '';
  if (!token || !fromAddress) return { ok: false, why: 'not configured' };
  const payload = JSON.stringify({
    from: { address: fromAddress, name: process.env.ZEPTOMAIL_FROM_NAME || 'Eventicor' },
    to: [{ email_address: { address: to } }],
    subject,
    htmlbody: html,
  });
  let res;
  try {
    res = await fetch('https://api.zeptomail.com/v1.1/email', {
      method: 'POST',
      headers: { Authorization: authOf(token), 'Content-Type': 'application/json' },
      body: payload,
    });
  } catch (e) {
    return { ok: false, why: String((e && e.message) || e) };
  }
  if (res.ok) return { ok: true };
  let detail = 'status ' + res.status;
  try { detail = (await res.json()).message || detail; } catch {}
  return { ok: false, why: detail };
}

function otpEmail(code) {
  const digits = String(code).split('').join(' ');
  return `<!doctype html><html><body style="margin:0;background:#f6f5fa;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <div style="background:#ffffff;border:1px solid #e6e4ef;border-radius:16px;padding:32px 28px;text-align:center">
      <div style="font-size:22px;font-weight:bold;color:#141f4e;letter-spacing:.5px">Eventicor</div>
      <p style="margin:18px 0 6px;font-size:15px;color:#5a6970">Use this code to reset your password. It works once and stops working in 10 minutes.</p>
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

  // ================= request =================
  if (op === 'request') {
    const lock = await getLock('otp', email);
    const lockLeft = msLeft(lockUntilOf(lock));
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
      const sent = await zeptoSend(email, 'Your Eventicor password reset code', otpEmail(code));
      if (!sent.ok) return json(502, { ok: false, error: 'send-failed' });
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
    const lockLeft = msLeft(lockUntilOf(lock));
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
    const lockLeft = msLeft(lockUntilOf(lock));
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
      await getAuth().updateUserByEmail(email, { password });
    } catch (e) {
      if (e && e.code === 'auth/user-not-found') return json(400, { ok: false, error: 'token' });
      return json(502, { ok: false, error: 'reset-failed' });
    }
    // Single use: the token dies with the doc.
    await db.collection('authOtp').doc(email).delete();
    return json(200, { ok: true });
  }

  // ================= login =================
  if (op === 'login') {
    const lock = await getLock('login', email);
    const lockLeft = msLeft(lockUntilOf(lock));
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

  return json(400, { ok: false, error: 'unknown-op' });
};
