import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore } from 'firebase/firestore';

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

// Use a named app so the couple app never collides with the Eventicor
// platform app ([DEFAULT]) initialized by the admin console on page load.
const app = getApps().some((a) => a.name === 'couple')
  ? getApp('couple')
  : initializeApp(firebaseConfig, 'couple');

// Persistent IndexedDB local cache for offline support
let firestoreDb;
try {
  firestoreDb = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    }
  );
} catch {
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;
export const auth = getAuth(app);

export default app;
