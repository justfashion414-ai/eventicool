// Per-app isolation. Every couple app carries its own namespace so no two
// projects ever share data, media or cached settings. The app identity is the
// lead id on the app link (?lead=); onboarded couples use ?site=. Cached
// settings keys and Firestore paths are both namespaced with it.
const params = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search)
  : new URLSearchParams();
export const APP_ID = ((params.get('lead') || params.get('site') || 'main').slice(0, 80) || 'main');

// Namespaced local-storage key: caches never leak between two apps on one origin.
export const lsKey = (k: string) => `ann-${APP_ID}-${k}`;

// Firestore path for one of the couple app's own collections, scoped to this app.
export const scopedPath = (name: string) => `apps/${APP_ID}/${name}`;
