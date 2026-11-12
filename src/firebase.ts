import { initializeApp } from 'firebase/app'

// Eventicor web app — Firebase project eventicool-3887d.
// Values come from Netlify environment variables (FIREBASE_*), with the
// web-app config as fallback so local dev works without a .env file.
const env = import.meta.env

export const firebaseConfig = {
  apiKey: env.FIREBASE_API_KEY || 'AIzaSyDmme_nhjckYtzT9mEEt2GCKZFuPb0SmKM',
  authDomain: env.FIREBASE_AUTH_DOMAIN || 'eventicool-3887d.firebaseapp.com',
  projectId: env.FIREBASE_PROJECT_ID || 'eventicool-3887d',
  storageBucket: env.FIREBASE_STORAGE_BUCKET || 'eventicool-3887d.firebasestorage.app',
  messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID || '877783304560',
  appId: env.FIREBASE_APP_ID || '1:877783304560:web:9ccdd643aca256384527b5',
}

export const app = initializeApp(firebaseConfig)

// Helper for the Firestore proxy (server-side service account, no client keys).
export async function proxyCall(op, payload = {}) {
  const { getAuth, onAuthStateChanged } = await import('firebase/auth')
  const auth = getAuth(app)
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')
  const token = await user.getIdToken()
  const res = await fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ op, ...payload }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Proxy error ${res.status}`)
  }
  return res.json()
}
