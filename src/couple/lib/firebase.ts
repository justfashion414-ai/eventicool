import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore } from 'firebase/firestore';
import { DEMO } from './demoMode';

// The couple app runs against its own Firebase project (wedding-gallery-9187b),
// independent of Eventicor's platform project. Config is public web-app config.
const firebaseConfig = {
  apiKey: 'AIzaSyBcY0RK6oQuP6n_sG3PEWvpFaSM2uxyfIE',
  authDomain: 'wedding-gallery-9187b.firebaseapp.com',
  projectId: 'wedding-gallery-9187b',
  storageBucket: 'wedding-gallery-9187b.firebasestorage.app',
  messagingSenderId: '911650912020',
  appId: '1:911650912020:web:4aaa35c9006eaa4f7b7401',
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
