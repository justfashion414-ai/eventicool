import { initializeApp } from 'firebase/app'
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'

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

// App Check: every client request carries a token minted from the project's
// reCAPTCHA Enterprise key, so scripts and bots hitting Firestore directly
// are distinguishable from the real app. Enforcement is switched server-side
// (Firebase console), the client only stamps requests. The site key is
// public by design.
const AC_SITE_KEY = env.FIREBASE_APPCHECK_SITE_KEY || '6LeF1S0uAAAAACQRTwKWGNSviBkyZP5TbF8J-9SB'
try {
  const w = window as any
  if (!w.__evAppCheck) {
    w.__evAppCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(AC_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    })
  }
} catch { /* a token failure never stops the app from loading */ }

// Firestore client used for public reads only (sample-app lead lookup).
// Every write still goes through the server-side proxy.
// Firestore client used for public reads only (sample-app lead lookup).
// Every write still goes through the server-side proxy.
// Persistent local cache: repeat visits read mostly from the device
// (IndexedDB), which keeps Firestore's daily read bill down on launch scale.
// Falls back to the default memory cache where IndexedDB is unavailable
// (private browsing), and never blocks the app from loading.
export const db: Firestore = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch {
    return getFirestore(app)
  }
})()

// Helper for the Firestore proxy (server-side service account, no client keys).
export async function proxyCall(op, payload = {}, authInstance?) {
  const { getAuth } = await import('firebase/auth')
  // authInstance is already an Auth instance (the console's own session), so it
  // is used as-is; feeding it back into getAuth throws and every call failed.
  const user = (authInstance || getAuth(app)).currentUser
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
