// auth-admin: team management for one couple's app. Actions:
//   invite      - create the login account, write their admins record, email
//                 them their login details and temporary password
//   suspend     - stop an invited admin from signing in (status suspended)
//   reinstate   - lift a suspension
//   remove      - delete their admins record and delete their login account
//   publishRules- re-apply the app's Firestore security rules (super admin only)
// The caller must be an admin of that app with a full-dashboard role
// (owner / bride / groom), or the platform owner. Requests carry the app id
// (the lead id) so every action is scoped to one project and never another.
import { randomBytes } from 'node:crypto';
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

let ready = false
function init() {
  if (ready) return
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON env var is not set')
  const svc = typeof raw === 'string' ? JSON.parse(raw) : raw
  initializeApp({ credential: cert(svc), projectId: svc.project_id })
  ready = true
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })

const SUPER_ADMIN = 'justfashion414@gmail.com'
const FULL_ROLES = ['owner', 'couple', 'admin', 'bride', 'groom']
const ROLES = ['bride', 'groom', 'photographer', 'videographer', 'owner', 'couple', 'admin', 'vendor']
const ROLE_LABEL = (r) =>
  r === 'bride' ? 'Bride' : r === 'groom' ? 'Groom' : r === 'photographer' ? 'Photographer'
  : r === 'videographer' ? 'Videographer' : r === 'owner' ? 'Owner' : r === 'couple' ? 'Owner' : 'Vendor'

const authOf = (t) => (t.startsWith('Zoho-enczapikey') ? t : 'Zoho-enczapikey ' + t)
async function zeptoSend(fromAddress, fromName, to, subject, html) {
  const candidates = [...new Set(
    [process.env.ZEPTOMAIL_SEND_MAIL_TOKEN, process.env.ZEPTOMAIL_API]
      .filter(Boolean).map(authOf)
  )]
  if (!candidates.length) return { ok: false, why: 'not configured' }
  const payload = JSON.stringify({
    from: { address: fromAddress, name: fromName || 'Eventicor' },
    to: [{ email_address: { address: to } }],
    subject,
    htmlbody: html,
  })
  let res = null
  for (const tok of candidates) {
    try {
      res = await fetch('https://api.zeptomail.com/v1.1/email', {
        method: 'POST',
        headers: { Authorization: tok, 'Content-Type': 'application/json' },
        body: payload,
      })
    } catch (e) {
      return { ok: false, why: String(e && e.message ? e.message : e) }
    }
    if (res.ok) return { ok: true }
    if (res.status !== 401) break
  }
  let detail = 'status ' + (res ? res.status : '?')
  try { detail = (await res.json()).message || detail } catch {}
  return { ok: false, why: detail }
}

const RULES = String.raw`rules_version = '2';
service cloud.firestore {
  function isSuper() {
    return request.auth != null && request.auth.token.email == 'justfashion414@gmail.com';
  }
  // The database wildcard is passed in explicitly: rules functions only see
  // the variables they are handed, so an unbound $(database) here would make
  // the exists() path invalid and silently deny every app admin (found live
  // Nov 21 2026 when oke@ was refused every admin action).
  function isAdminIn(db, app) {
    return isSuper() || (request.auth != null && request.auth.token.email != null
      && exists(/databases/$(db)/documents/apps/$(app)/admins/$(request.auth.token.email)));
  }
  match /databases/{database}/documents {
    match /platform/{doc=**} { allow read: if true; allow write: if false; }
    match /leads/{doc=**} { allow read: if false; allow write: if false; }
    match /events/{doc=**} { allow read: if false; allow write: if false; }
    match /health/{doc} { allow read: if true; allow write: if false; }
    // Legacy top-level couple data (pre-2026-11-19). Kept readable, never written.
    match /app_config/{doc=**} { allow read: if true; allow write: if false; }
    match /posts/{doc=**} { allow read: if true; allow write: if false; }
    match /residents/{doc=**} { allow read: if true; allow write: if false; }
    match /albums/{doc=**} { allow read: if true; allow write: if false; }
    match /deleted_posts/{doc=**} { allow read: if true; allow write: if false; }
    match /admins/{email} {
      allow read: if request.auth != null && request.auth.token.email == email;
      allow write: if request.auth != null && request.auth.token.email == email;
    }
    // Per-app scoped data: each couple's app gets its own namespace. The
    // platform owner and that app's admins write; guests can add pending
    // posts, their own reactions, comments and their own resident profile.
    match /apps/{app} {
      match /app_config/{doc=**} { allow read: if true; allow write: if isAdminIn(database, app); }
      match /posts/{postId} {
        // Single-document reads: a post waiting for approval is readable only
        // by its author and the app's signed-in admins; everyone else, a
        // signed-out admin included, reads only approved posts (user
        // direction Nov 21 2026).
        allow get: if !resource.data.get('pending', false)
          || (request.auth != null
              && (resource.data.get('authorUid', '') == request.auth.uid || isAdminIn(database, app)));
        // List queries must carry the filter that proves them. Admins may
        // list everything; a signed-in guest may only list approved posts or
        // their own pending ones. Any other guest list (unfiltered, or
        // probing for someone else's pending posts) is refused outright, so
        // an awaiting-approval post never reaches anyone else.
        allow list: if isAdminIn(database, app)
          || (request.auth != null
              && (resource.data.pending == false
                  || (resource.data.pending == true
                      && resource.data.get('authorUid', '') == request.auth.uid)));
        // New posts follow the app's Approve-guest-posts toggle: with it on,
        // guests may only create posts that wait for approval; with it off,
        // everything shows for everybody at once. Admins always write freely.
        allow create: if request.auth != null && (isAdminIn(database, app)
          || request.resource.data.get('pending', false) == true
          || (exists(/databases/$(database)/documents/apps/$(app)/app_config/main)
              && !get(/databases/$(database)/documents/apps/$(app)/app_config/main).data.get('approveGuestPosts', true)));
        allow update: if isAdminIn(database, app) || (request.auth != null && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['likeCount', 'loveCount', 'commentCount']));
        allow delete: if isAdminIn(database, app);
        match /reactions/{uid} { allow read: if true; allow write: if request.auth != null && request.auth.uid == uid; }
        match /comments/{cid} {
          allow read: if true;
          allow create: if request.auth != null;
          allow update, delete: if isAdminIn(database, app);
        }
      }
      match /residents/{uid} {
        allow read: if true;
        allow create, update: if request.auth != null && (request.auth.uid == uid || isAdminIn(database, app));
        allow delete: if isAdminIn(database, app);
      }
      match /albums/{doc=**} { allow read: if true; allow write: if isAdminIn(database, app); }
      match /deleted_posts/{doc=**} { allow read: if true; allow write: if isAdminIn(database, app); }
      match /admins/{email} {
        allow read: if request.auth != null && (request.auth.token.email == email || isAdminIn(database, app));
        allow create, update: if isAdminIn(database, app) || (request.auth != null && request.auth.token.email == email);
        allow delete: if isAdminIn(database, app);
      }
    }
  }
}`

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'POST only' })

  let body
  try { body = await req.json() } catch { return json(400, { error: 'Invalid JSON body' }) }

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return json(401, { error: 'Missing bearer token' })

  let decoded
  try {
    init()
    decoded = await getAuth().verifyIdToken(token)
  } catch {
    return json(401, { error: 'Invalid or expired token' })
  }
  const caller = String(decoded.email || '').toLowerCase()
  if (!caller) return json(403, { error: 'Sign in with an admin account first.' })

  const fs = getFirestore()
  const auth = getAuth()
  const action = String(body.action || '')

  if (action === 'publishRules') {
    if (caller !== SUPER_ADMIN) return json(403, { error: 'Only the platform owner can publish rules.' })
    try {
      const { releaseFirestoreRulesetFromSource } = await import('firebase-admin/firestore')
      await releaseFirestoreRulesetFromSource(fs, RULES)
      return json(200, { ok: true })
    } catch (e) {
      return json(500, { ok: false, error: String(e?.message || e) })
    }
  }

  const app = String(body.app || '').slice(0, 80)
  if (!app || !/^apps$/.test('apps') || app.includes('/')) return json(400, { error: 'The app id is required' })
  const adminsCol = fs.collection('apps').doc(app).collection('admins')

  let callerDoc = null
  try { callerDoc = await adminsCol.doc(caller).get() } catch {}
  const callerData = callerDoc && callerDoc.exists ? callerDoc.data() || {} : {}
  const isSuper = caller === SUPER_ADMIN
  const callerFull = isSuper || (callerDoc && callerDoc.exists && FULL_ROLES.includes(String(callerData.role || 'owner')))
  if (!callerFull) return json(403, { error: 'Only the owner and full-dashboard admins manage the team.' })
  if (callerData.status === 'suspended') return json(403, { error: 'This admin access is suspended.' })

  try {
    if (action === 'invite') {
      const email = String(body.email || '').trim().toLowerCase()
      const name = String(body.name || '').trim().slice(0, 80)
      const role = ROLES.includes(String(body.role || '')) ? String(body.role) : 'videographer'
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { error: 'A valid email is required' })
      // The temporary password is generated here and only ever emailed: it is
      // never returned to the app or shown in the admin UI.
      const password = 'Ev-' + randomBytes(9).toString('base64url')
      let created = false
      try {
        await auth.getUserByEmail(email)
        return json(409, { ok: false, error: 'That email already has an account. Use a different email.' })
      } catch (e) {
        if (e && e.code !== 'auth/user-not-found') throw e
      }
      const cu = await auth.createUser({ email, password, emailVerified: false, disabled: false })
      created = true
      const full = FULL_ROLES.includes(role)
      const permissions = full
        ? { canDeletePosts: true, canUploadImages: true, canSetAccessCode: true }
        : { canDeletePosts: false, canUploadImages: true, canSetAccessCode: false }
      await adminsCol.doc(email).set({
        email,
        name: name || null,
        role,
        mustSetPassword: true,
        status: 'invited',
        sessionMinutes: 30,
        permissions,
        addedAt: FieldValue.serverTimestamp(),
        addedBy: caller,
      }, { merge: true })
      const appUrl = String(body.appUrl || '').slice(0, 300)
      const html = `<div style="font-family:Arial,sans-serif;max-width:560px">
        <h2 style="color:#1e3a8a">You have been invited to ${ROLE_LABEL(role) === 'Photographer' || ROLE_LABEL(role) === 'Videographer' ? 'upload' : 'manage'} the couple's app</h2>
        <p>Hi ${name || 'there'},</p>
        <p>You were invited to the Eventicor app as <b>${ROLE_LABEL(role)}</b>.</p>
        <p>Sign in with:</p>
        <p style="background:#f4f4f6;padding:14px;border-radius:10px;font-size:15px">
          Email: <b>${email}</b><br>
          Temporary password: <b style="letter-spacing:1px">${password}</b>
        </p>
        <p>The first time you sign in you will be asked to choose your own password.</p>
        ${appUrl ? `<p><a href="${appUrl}" style="color:#1e3a8a">Open the app</a></p>` : ''}
        <p style="color:#888;font-size:13px">Eventicor - wedding memories, kept for life.</p>
      </div>`
      const mailed = await zeptoSend(
        process.env.ZEPTOMAIL_FROM_ADDRESS || '',
        process.env.ZEPTOMAIL_FROM_NAME || 'Eventicor',
        email,
        'Your Eventicor admin invite',
        html
      )
      return json(200, { ok: true, uid: cu.uid, emailed: mailed.ok, mailError: mailed.ok ? undefined : mailed.why })
    }

    if (action === 'resend') {
      const email = String(body.email || '').trim().toLowerCase()
      if (!email) return json(400, { error: 'The email is required' })
      const doc = await adminsCol.doc(email).get()
      if (!doc.exists) return json(404, { error: 'That admin is not on this app.' })
      // A fresh temporary password replaces the old one; the account keeps
      // its invited state until they sign in and set their own password.
      const password = 'Ev-' + randomBytes(9).toString('base64url')
      let uid = null
      try {
        const u = await auth.getUserByEmail(email)
        uid = u.uid
        await auth.updateUser(uid, { password, disabled: false })
      } catch (e) {
        if (e && e.code === 'auth/user-not-found') {
          const cu = await auth.createUser({ email, password, emailVerified: false, disabled: false })
          uid = cu.uid
        } else { throw e }
      }
      await adminsCol.doc(email).set({ mustSetPassword: true, status: 'invited' }, { merge: true })
      const appUrl = String(body.appUrl || '').slice(0, 300)
      const html = `<div style="font-family:Arial,sans-serif;max-width:560px">
        <h2 style="color:#1e3a8a">Your Eventicor invite (resent)</h2>
        <p>We are sending your login details again. Sign in with:</p>
        <p style="background:#f4f4f6;padding:14px;border-radius:10px;font-size:15px">
          Email: <b>${email}</b><br>
          Temporary password: <b style="letter-spacing:1px">${password}</b>
        </p>
        <p>The first time you sign in you will be asked to choose your own password.</p>
        ${appUrl ? `<p><a href="${appUrl}" style="color:#1e3a8a">Open the app</a></p>` : ''}
        <p style="color:#888;font-size:13px">Eventicor - wedding memories, kept for life.</p>
      </div>`
      const mailed = await zeptoSend(
        process.env.ZEPTOMAIL_FROM_ADDRESS || '',
        process.env.ZEPTOMAIL_FROM_NAME || 'Eventicor',
        email,
        'Your Eventicor admin invite',
        html
      )
      return json(200, { ok: true, uid, emailed: mailed.ok, mailError: mailed.ok ? undefined : mailed.why })
    }

    if (action === 'suspend' || action === 'reinstate') {
      const email = String(body.email || '').trim().toLowerCase()
      if (!email) return json(400, { error: 'The email is required' })
      const doc = await adminsCol.doc(email).get()
      if (!doc.exists) return json(404, { error: 'That admin is not on this app.' })
      await adminsCol.doc(email).set({ status: action === 'suspend' ? 'suspended' : 'active' }, { merge: true })
      if (action === 'suspend') {
        try {
          const u = await auth.getUserByEmail(email)
          await auth.updateUser(u.uid, { disabled: true })
        } catch (e) { if (e && e.code !== 'auth/user-not-found') throw e }
      } else {
        try {
          const u = await auth.getUserByEmail(email)
          await auth.updateUser(u.uid, { disabled: false })
        } catch (e) { if (e && e.code !== 'auth/user-not-found') throw e }
      }
      return json(200, { ok: true })
    }

    if (action === 'remove') {
      const email = String(body.email || '').trim().toLowerCase()
      if (!email) return json(400, { error: 'The email is required' })
      if (email === caller && !isSuper) return json(400, { error: 'You cannot remove yourself.' })
      const doc = await adminsCol.doc(email).get()
      if (!doc.exists) return json(404, { error: 'That admin is not on this app.' })
      if (String(doc.data().role || '') === 'owner' && !isSuper) return json(400, { error: 'The owner cannot be removed.' })
      await adminsCol.doc(email).delete()
      try {
        const u = await auth.getUserByEmail(email)
        await auth.deleteUser(u.uid)
      } catch (e) { if (e && e.code !== 'auth/user-not-found') throw e }
      return json(200, { ok: true })
    }

    return json(400, { error: 'Unknown action; use invite, suspend, reinstate, remove or publishRules' })
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) })
  }
}

export const config = { path: '/api/auth-admin' }
