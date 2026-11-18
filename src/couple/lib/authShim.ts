// Auth shim for demo previews: an anonymous demo guest signs in locally, no
// network auth. Outside demo mode everything re-exports the real SDK.
import { DEMO } from './demoMode';
import * as FA from 'firebase/auth';

const demoUser: any = {
  uid: 'demo-guest',
  email: null,
  displayName: null,
  photoURL: null,
  isAnonymous: true,
  metadata: {},
};
let current: any = null;
const authListeners: ((u: any) => void)[] = [];

export const auth: any = DEMO ? { __demo: true } : FA.getAuth((globalThis as any).__coupleFirebaseApp);

function notifyIfChanged() {
  authListeners.forEach((cb) => {
    try { cb(current); } catch { /* ignore */ }
  });
}

export const onAuthStateChanged: any = DEMO
  ? (_auth: any, cb: (u: any) => void) => {
      authListeners.push(cb);
      setTimeout(() => cb(current), 0);
      return () => {
        const i = authListeners.indexOf(cb);
        if (i >= 0) authListeners.splice(i, 1);
      };
    }
  : FA.onAuthStateChanged;

export const signInAnonymously: any = DEMO
  ? async () => {
      if (!current) { current = demoUser; notifyIfChanged(); }
      return { user: current };
    }
  : FA.signInAnonymously;

export const signOut: any = DEMO
  ? async () => { current = null; notifyIfChanged(); }
  : FA.signOut;

const demoRefusal = () => Promise.reject({ code: 'auth/operation-not-allowed', message: 'Demo preview: admin sign-in is disabled.' });
export const createUserWithEmailAndPassword: any = DEMO ? demoRefusal : FA.createUserWithEmailAndPassword;
export const signInWithEmailAndPassword: any = DEMO ? demoRefusal : FA.signInWithEmailAndPassword;
export const sendPasswordResetEmail: any = DEMO ? demoRefusal : FA.sendPasswordResetEmail;
export const updatePassword: any = DEMO ? demoRefusal : FA.updatePassword;
