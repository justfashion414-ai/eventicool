import { app, proxyCall } from './firebase'
import {
  getAuth,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  signInAnonymously,
  type User,
} from 'firebase/auth'

export const auth = getAuth(app)

// Admins stay signed in across visits: persist the session locally.
setPersistence(auth, browserLocalPersistence).catch(() => {})

/** Admin gate: a server-verified admins/{email} Firestore doc, checked through the proxy.
 * Throws when the check itself fails (network, proxy, token) so callers never
 * mistake a failed check for "not an admin" and sign the admin out. */
export async function getAdminDoc(user: User | null): Promise<Record<string, unknown> | null> {
  if (!user || !user.email) return null
  const doc = await proxyCall('get', { collection: 'admins', id: user.email.toLowerCase() })
  return (doc && typeof doc === 'object' ? doc : null) as Record<string, unknown> | null
}

export async function isAdmin(user: User | null): Promise<boolean> {
  try {
    return !!(await getAdminDoc(user))
  } catch {
    return false
  }
}

export function watchAuth(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb)
}

export async function signInAdmin(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
  const admin = await isAdmin(cred.user)
  if (!admin) {
    await fbSignOut(auth)
    const err: Error & { code?: string } = Object.assign(new Error('not-admin'), {
      code: 'eventicool/not-admin',
    })
    throw err
  }
  return cred.user
}

export async function signInGuest() {
  return signInAnonymously(auth)
}

export async function signOutEverywhere() {
  await fbSignOut(auth)
}
