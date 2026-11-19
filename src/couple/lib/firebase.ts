import { getAuth } from 'firebase/auth';
// The couple app runs against the Eventicor platform project
// (eventicool-3887d): couple and trial accounts are created there by
// /api/send-credentials, and the admins docs live in the same project's
// Firestore, so sign-in and the admin gate must use the same project.
// src/firebase.ts already initializes that app, its auth and its Firestore,
// so the couple app shares them instead of spinning up a second app.
import { app as platformApp, db as platformDb } from '../../firebase';

export const db = platformDb;
export const auth = getAuth(platformApp);

export default platformApp;
