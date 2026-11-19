import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore } from 'firebase/firestore';
import { DEMO } from './demoMode';

// The couple app runs against the Eventicor platform project
// (eventicool-3887d): couple and trial accounts are created there by
// /api/send-credentials, and the admins docs live in the same project's
// Firestore, so sign-in and the admin gate must use the same project.
// Config is public web-app config.
const firebaseConfig = {
  apiKey: 'AIzaSyDmme_nhjckYtzT9mEEt2GCKZFuPb0SmKM',
  authDomain: 'eventicool-3887d.firebaseapp.com',
  projectId: 'eventicool-3887d',
  storageBucket: 'eventicool-3887d.firebasestorage.app',
  messagingSenderId: '877783304560',
  appId: '1:877783304560:web:9ccdd643aca256384527b5',
};

// Demo previews render generic fixtures and never touch Firebase: no app is
// initialized, so no network or IndexedDB cache is spun up for a preview.
const app = DEMO ? null : (getApps().some((a) => a.name === 'couple') ? getApp('couple') : initializeApp(firebaseConfig, 'couple'));

let firestoreDb: any;
try {
  firestoreDb = app ? initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }) : { __demo: true };
} catch {
  firestoreDb = app ? getFirestore(app) : { __demo: true };
}

export const db = firestoreDb;
export const auth = app ? getAuth(app) : { __demo: true };

export default app;
