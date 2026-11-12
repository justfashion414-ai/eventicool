import { app, proxyCall } from './firebase'
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  signInAnonymously,
  type User,
} from 'firebase/auth'

export const auth = getAuth(app)

/** Admin gate: a server-verified admins/{email} Firestore doc, checked through the proxy. */
export async function isAdmin(user: User | null): Promise<boolean> {
  if (!user || !user.email) return false
  try {
    const doc = await proxyCall('get', { collection: 'admins', id: user.email.toLowerCase() })
    return !!doc
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
