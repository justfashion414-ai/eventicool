import { app, proxyCall, firebaseConfig } from './firebase'
import { otpCall, lockTimeString } from './otpAuth'
import { initializeApp, deleteApp, getApps } from 'firebase/app'
import {
  getAuth,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signInWithCustomToken,
  signOut as fbSignOut,
  signInAnonymously,
  type User,
} from 'firebase/auth'

export const auth = getAuth(app)
export type { User } from 'firebase/auth'

// The platform's admin console (leads, customers, payments) runs on the same
// site as the couple apps, and the two must never share one login session.
// It gets its OWN Firebase app instance: Firebase keys each auth session's
// storage entry by app name, so the console's session lives beside the couple
// apps' session instead of replacing it. Signing into one never signs the
// other in or out.
let consoleAppRef = getApps().find((a) => a.name === 'eventicor-console') || null
if (!consoleAppRef) consoleAppRef = initializeApp(firebaseConfig, 'eventicor-console')
export const consoleApp = consoleAppRef
export const consoleAuth = getAuth(consoleApp)

// Admins stay signed in across visits: persist the session locally.
setPersistence(auth, browserLocalPersistence).catch(() => {})
setPersistence(consoleAuth, browserLocalPersistence).catch(() => {})

/** Admin gate: a server-verified admins/{email} Firestore doc, checked through the proxy.
 * Throws when the check itself fails (network, proxy, token) so callers never
 * mistake a failed check for "not an admin" and sign the admin out. A 403 from
 * the server IS a definite "not an admin" answer, so it returns null instead. */
export async function getAdminDoc(user: User | null): Promise<Record<string, unknown> | null> {
  if (!user || !user.email) return null
  const token = await user.getIdToken()
  let res: Response
  try {
    res = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ op: 'get', collection: 'admins', id: user.email.toLowerCase() }),
    })
  } catch (e) {
    throw e
  }
  if (res.status === 403 || res.status === 401) return null
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Proxy error ${res.status}`)
  }
  const doc = await res.json()
  return (doc && typeof doc === 'object' ? doc : null) as Record<string, unknown> | null
}

export async function isAdmin(user: User | null): Promise<boolean> {
  try {
    return !!(await getAdminDoc(user))
  } catch {
    return false
  }
}

/** Auth watcher for the platform admin console (its own session). */
export function watchAuth(cb: (user: User | null) => void) {
  return onAuthStateChanged(consoleAuth, cb)
}

/** Sign in to the platform admin console. The console session is separate
 * from the couple apps' session, so this never touches who is signed into a
 * couple app. A signed-in account without a platform admins doc is refused. */
export async function signInAdmin(email: string, password: string) {
  // The password check happens on the server (see netlify/functions/auth-otp.mjs):
  // three wrong passwords lock this email out of sign-in for an hour, counted
  // server-side, and the browser only ever learns what the server answers.
  const r = await otpCall('login', { email: email.trim(), password })
  if (r.status === 429 || r.body?.error === 'locked') {
    const err: Error & { code?: string; detail?: string; retryAt?: number } = Object.assign(new Error('locked'), {
      code: 'eventicor/locked',
      detail: lockTimeString(r.body?.retryAt),
      retryAt: Number(r.body?.retryAt) || Date.now() + 60 * 60 * 1000,
    })
    throw err
  }
  if (!r.status || !r.ok || !r.body?.token) {
    const err: Error & { code?: string; attemptsLeft?: number } = Object.assign(new Error(r.body?.error || 'wrong'), {
      code: r.body?.error === 'wrong' ? 'auth/invalid-credential' : 'eventicor/login-failed',
      attemptsLeft: r.body?.attemptsLeft,
    })
    throw err
  }
  const cred = await signInWithCustomToken(consoleAuth, r.body.token as string)
  const admin = await isAdmin(cred.user)
  if (!admin) {
    await fbSignOut(consoleAuth)
    const err: Error & { code?: string } = Object.assign(new Error('not-admin'), {
      code: 'eventicool/not-admin',
    })
    throw err
  }
  return cred.user
}

/** Guests of a couple app sign in anonymously on the couple apps' session. */
export async function signInGuest() {
  return signInAnonymously(auth)
}

/** Sign out of the platform admin console only. The couple apps' session is
 * never touched by this. */
export async function signOutEverywhere() {
  await fbSignOut(consoleAuth)
}

/** Resolves once the console's own session has settled: restored from a
 * previous visit on a refresh, or confirmed absent. Callers then check
 * consoleAuth.currentUser before acting, so data calls never fire against a
 * session that is still restoring. */
export function consoleAuthReady(): Promise<void> {
  return new Promise((resolve) => {
    const un = onAuthStateChanged(consoleAuth, () => { un(); resolve() })
  })
}
