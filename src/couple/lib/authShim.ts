// Auth shim for demo previews: an anonymous demo guest signs in locally, no
// network auth. On a real couple's app (adminMode 'real') CoupleApp calls
// enableRealAuth() as soon as it renders, and every shim call then forwards to
// the real Firebase SDK instead: admin sign-in, forgot password, password
// changes and the guest's anonymous sign-in all work for real. Outside demo
// mode everything re-exports the real SDK.
import { DEMO } from './demoMode';
import * as FA from 'firebase/auth';

let realAuth = false;
export const enableRealAuth = () => { realAuth = true; };
// Debug-only (behind ?authdebug=1): reports whether the shim flipped to real
// auth and which listener path the last onAuthStateChanged subscription took.
export const debugState = () => ({ realAuth, listenerMode: (debugState as any).listenerMode });

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

const demoAuthObj: any = { __demo: true };
const realAuthInstance = () => FA.getAuth((globalThis as any).__coupleFirebaseApp);
const demoRefusal = () => Promise.reject({ code: 'auth/operation-not-allowed', message: 'Admin sign-in is disabled on this preview.' });

// In demo mode `auth` reads through to the demo object until enableRealAuth()
// flips the flag, after which every property read comes from the real Auth
// instance (auth.currentUser and friends start working for real).
export const auth: any = new Proxy({}, {
  get: (_t, prop) => (realAuth ? (realAuthInstance() as any)[prop] : demoAuthObj[prop as string]),
});

function notifyIfChanged() {
  authListeners.forEach((cb) => {
    try { cb(current); } catch { /* ignore */ }
  });
}

function demoGuestSignIn() {
  if (!current) { current = demoUser; notifyIfChanged(); }
  return Promise.resolve({ user: current });
}

function localSignOut() {
  current = null;
  notifyIfChanged();
  return Promise.resolve();
}

function localOnAuthStateChanged(_auth: any, cb: (u: any) => void) {
  (debugState as any).listenerMode = 'local';
  authListeners.push(cb);
  setTimeout(() => cb(current), 0);
  return () => {
    const i = authListeners.indexOf(cb);
    if (i >= 0) authListeners.splice(i, 1);
  };
}

export const onAuthStateChanged: any = DEMO
  ? (...args: any[]) => {
      if (realAuth) { (debugState as any).listenerMode = 'real'; return FA.onAuthStateChanged(realAuthInstance(), args[1]); }
      return localOnAuthStateChanged(args[0], args[1]);
    }
  : FA.onAuthStateChanged;

export const signInAnonymously: any = DEMO
  ? () => (realAuth ? FA.signInAnonymously(realAuthInstance()) : demoGuestSignIn())
  : FA.signInAnonymously;

export const signOut: any = DEMO
  ? () => (realAuth ? FA.signOut(realAuthInstance()) : localSignOut())
  : FA.signOut;

export const createUserWithEmailAndPassword: any = DEMO
  ? (...args: any[]) => (realAuth ? FA.createUserWithEmailAndPassword(realAuthInstance(), args[1], args[2]) : demoRefusal())
  : FA.createUserWithEmailAndPassword;
export const signInWithEmailAndPassword: any = DEMO
  ? (...args: any[]) => (realAuth ? FA.signInWithEmailAndPassword(realAuthInstance(), args[1], args[2]) : demoRefusal())
  : FA.signInWithEmailAndPassword;
export const sendPasswordResetEmail: any = DEMO
  ? (...args: any[]) => (realAuth ? FA.sendPasswordResetEmail(realAuthInstance(), args[1]) : demoRefusal())
  : FA.sendPasswordResetEmail;
export const updatePassword: any = DEMO
  ? (...args: any[]) => (realAuth ? FA.updatePassword(args[0], args[1]) : demoRefusal())
  : FA.updatePassword;
