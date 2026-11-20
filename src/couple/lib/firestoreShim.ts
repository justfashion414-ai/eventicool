// Firestore shim: in demo mode every read returns generic demo fixtures and
// every write applies to the in-memory demo store, so the wedding app runs
// unchanged. Outside demo mode everything re-exports the real SDK.
import { DEMO, DEMO_COUPLE, DEMO_DETAILS, DEMO_GUESTS, DEMO_CAPTIONS, DEMO_PHOTOS, DEMO_REELS, DEMO_WEDDING_DATE, DEMO_WEDDING_TIME, demoEvents, DEMO_STORY } from './demoMode';
import * as FS from 'firebase/firestore';

function ts(d: Date) {
  return { toDate: () => d, toMillis: () => d.getTime(), seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 };
}

const PHOTOS = DEMO_PHOTOS;

class DocSnap {
  constructor(public id: string, public _data: any, public _exists: boolean) {}
  exists() { return this._exists; }
  data() { return this._data; }
}
class QuerySnap {
  constructor(public docs: DocSnap[]) {}
  get empty() { return this.docs.length === 0; }
  get size() { return this.docs.length; }
  forEach(cb: (d: DocSnap) => void) { this.docs.forEach(cb); }
  docChanges() { return []; }
}

const store: { config: any; posts: any[]; residents: any[]; albums: any[] } = {
  config: {
    activeAccessCode: 'AMARADANIEL',
    heroImages: PHOTOS,
    footerImages: [],
    heroImageLabels: {},
    events: demoEvents(),
    story: DEMO_STORY,
    weddingDetails: DEMO_DETAILS,
    archiveMode: false,
    blockedUids: [],
    vendors: [],
    approveGuestPosts: false,
    feedActionMode: 'share',
    pushEnabled: false,
    postAds: [],
    reelAds: [],
    bride: DEMO_COUPLE.bride,
    groom: DEMO_COUPLE.groom,
  },
  posts: [],
  albums: [],
  residents: DEMO_GUESTS.map((name, i) => ({ uid: 'g' + (i + 1), name, role: 'guest' })),
};

// Seed the demo feed: photo posts, portrait reels and one text wish.
(function seed() {
  const now = Date.now();
  PHOTOS.forEach((img, i) => {
    store.posts.push({
      id: 'demo-p' + i,
      authorName: DEMO_GUESTS[i % DEMO_GUESTS.length],
      uid: 'g' + ((i % DEMO_GUESTS.length) + 1),
      text: DEMO_CAPTIONS[i % DEMO_CAPTIONS.length],
      mediaUrls: [img],
      mediaTypes: ['image'],
      timestamp: ts(new Date(now - (i * 30 + 4) * 36e5)),
      likeCount: [42, 38, 57, 61, 24, 33, 45][i % 7],
      commentCount: [1, 0, 2, 3, 0, 1, 0][i % 7],
      pending: false,
    });
  });
  DEMO_REELS.forEach((r, i) => {
    store.posts.push({
      id: 'demo-r' + i,
      authorName: r.by,
      uid: 'g' + ((i % DEMO_GUESTS.length) + 1),
      text: r.cap,
      mediaUrls: [r.src],
      mediaTypes: ['video'],
      videoOrientation: 'portrait',
      timestamp: ts(new Date(now - (i * 9 + 2) * 36e5)),
      likeCount: [27, 19, 58, 33][i % 4],
      commentCount: 0,
      pending: false,
    });
  });
  store.posts.push({
    id: 'demo-w0',
    authorName: 'Ngozi',
    uid: 'g7',
    text: 'Daniel, my guy. Amara, thank you for making him smile like this. Cheers to forever.',
    timestamp: ts(new Date(now - 5 * 36e5)),
    likeCount: 9,
    commentCount: 0,
    pending: false,
  });
  store.posts.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
})();

// Real apps address their data under apps/<app>/...; the demo store matches
// on the tail collection name, so strip the app prefix before comparing.
const normPath = (p: string) => String(p || '').replace(/^apps\/[^/]+\//, '');

const listeners: { ref: any; cb: (s: any) => void }[] = [];

function sortedPosts() {
  return store.posts.slice().sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
}

function emit(ref: any, cb: (s: any) => void) {
  const path = normPath(ref.path);
  if (ref.kind === 'doc') {
    if (path === 'app_config/main') { cb(new DocSnap('main', { ...store.config }, true)); return; }
    const parts = path.split('/');
    if (parts[0] === 'residents') {
      const r = store.residents.find((x) => x.uid === parts[1]);
      cb(new DocSnap(parts[1], r ? { ...r } : null, !!r));
    } else if (parts[0] === 'posts') {
      const p = store.posts.find((x) => x.id === parts[1]);
      cb(new DocSnap(parts[1], p ? { ...p } : null, !!p));
    } else if (parts[0] === 'albums') {
      const a = store.albums.find((x) => x.id === parts[1]);
      cb(new DocSnap(parts[1], a ? { ...a } : null, !!a));
    } else {
      cb(new DocSnap(path, null, false));
    }
    return;
  }
  // Collection (or query on one)
  if (path === 'posts') {
    cb(new QuerySnap(sortedPosts().map((p) => new DocSnap(p.id, { ...p }, true))));
  } else if (path === 'residents') {
    cb(new QuerySnap(store.residents.map((r) => new DocSnap(r.uid, { ...r }, true))));
  } else if (path === 'albums') {
    const sorted = store.albums.slice().sort((a, b) => (b.uploadedAt?.toMillis?.() || 0) - (a.uploadedAt?.toMillis?.() || 0));
    cb(new QuerySnap(sorted.map((a) => new DocSnap(a.id, { ...a }, true))));
  } else {
    cb(new QuerySnap([]));
  }
}

function emitAll() {
  listeners.forEach((l) => emit(l.ref, l.cb));
}

function applyMerge(target: any, data: any) {
  Object.keys(data || {}).forEach((k) => {
    const v = data[k];
    if (v && typeof v === 'object' && '__inc' in v) target[k] = (target[k] || 0) + v.__inc;
    else if (v && typeof v === 'object' && '__sv' in v) target[k] = ts(new Date());
    else target[k] = v;
  });
}

// Every export branches at CALL time on the live DEMO binding: previews keep
// the demo store, and once goLive() flips DEMO the same calls forward to the
// real Firebase SDK with the same signatures, so the couple app's reads and
// writes hit the platform project for real.
export const collection: any = (db: any, ...segs: any[]) => DEMO ? { kind: 'col', path: segs.join('/') } : (FS.collection as any)(db, ...segs);
export const doc: any = (db: any, ...segs: string[]) => DEMO ? { kind: 'doc', path: segs.join('/') } : (FS.doc as any)(db, ...segs);
export const query: any = (col: any, ...clauses: any[]) => DEMO ? { ...col, clauses } : FS.query(col, ...clauses);
export const orderBy: any = (f: string, d?: string) => DEMO ? { t: 'order' } : FS.orderBy(f, d);
export const where: any = (f: string, o: string, v: any) => DEMO ? { t: 'where' } : (FS as any).where(f, o, v);
export const limit: any = (n: number) => DEMO ? { t: 'limit' } : FS.limit(n);
export const serverTimestamp: any = () => DEMO ? { __sv: 1 } : FS.serverTimestamp();
export const increment: any = (n: number) => DEMO ? { __inc: n } : FS.increment(n);

export const onSnapshot: any = (ref: any, cb: (s: any) => void, errCb?: any) => {
  if (!DEMO) return FS.onSnapshot(ref, cb, errCb);
  const entry = { ref, cb };
  listeners.push(entry);
  emit(ref, cb);
  return () => {
    const i = listeners.indexOf(entry);
    if (i >= 0) listeners.splice(i, 1);
  };
};

export const getDoc: any = async (ref: any) => {
  if (!DEMO) return FS.getDoc(ref);
  let out: any;
  emit(ref, (s) => { out = s; });
  return out;
};
export const getDocs: any = async (ref: any) => {
  if (!DEMO) return FS.getDocs(ref);
  let out: any;
  emit(ref, (s) => { out = s; });
  return out;
};

async function demoSet(docRef: any, data: any, opts?: any) {
  const path = normPath(docRef.path);
  if (path === 'app_config/main') {
    if (opts && opts.merge) applyMerge(store.config, data);
    else Object.assign(store.config, data);
  } else if (path.startsWith('posts/')) {
    const id = path.split('/')[1];
    const i = store.posts.findIndex((p) => p.id === id);
    if (i >= 0) applyMerge(store.posts[i], data);
    else store.posts.unshift({ ...data, id, timestamp: data.timestamp || ts(new Date()) });
  } else if (path.startsWith('residents/')) {
    const uid = path.split('/')[1];
    const r = store.residents.find((x) => x.uid === uid);
    if (r) applyMerge(r, data);
    else store.residents.push({ uid, ...data });
  } else if (path.startsWith('albums/')) {
    const id = path.split('/')[1];
    const i = store.albums.findIndex((x) => x.id === id);
    if (i >= 0) applyMerge(store.albums[i], data);
    else store.albums.unshift({ id, ...data, uploadedAt: data.uploadedAt?.__sv ? ts(new Date()) : (data.uploadedAt || ts(new Date())) });
  }
  emitAll();
}

async function demoUpdate(docRef: any, data: any) {
  const path = normPath(docRef.path);
  if (path === 'app_config/main') applyMerge(store.config, data);
  else if (path.startsWith('posts/')) {
    const i = store.posts.findIndex((p) => p.id === path.split('/')[1]);
    if (i >= 0) applyMerge(store.posts[i], data);
  } else if (path.startsWith('residents/')) {
    const r = store.residents.find((x) => x.uid === path.split('/')[1]);
    if (r) applyMerge(r, data);
  }
  emitAll();
}

async function demoDelete(docRef: any) {
  const path = normPath(docRef.path);
  if (path.startsWith('posts/')) {
    const i = store.posts.findIndex((p) => p.id === path.split('/')[1]);
    if (i >= 0) store.posts.splice(i, 1);
  } else if (path.startsWith('albums/')) {
    const i = store.albums.findIndex((a) => a.id === path.split('/')[1]);
    if (i >= 0) store.albums.splice(i, 1);
  }
  emitAll();
}

export const setDoc: any = (ref: any, data: any, opts?: any) => DEMO ? demoSet(ref, data, opts) : FS.setDoc(ref, data, opts);
export const updateDoc: any = (ref: any, data: any) => DEMO ? demoUpdate(ref, data) : FS.updateDoc(ref, data);
export const deleteDoc: any = (ref: any) => DEMO ? demoDelete(ref) : FS.deleteDoc(ref);
export const addDoc: any = async (colRef: any, data: any) => {
  if (!DEMO) return FS.addDoc(colRef, data);
  const id = 'demo-' + Math.random().toString(36).slice(2, 8);
  // serverTimestamp() arrives as the { __sv } marker: turn it into a real
  // timestamp object so orderBy/sorting and date formatting just work.
  const clean: any = { ...data, id };
  Object.keys(clean).forEach((k) => { if (clean[k] && typeof clean[k] === 'object' && '__sv' in clean[k]) clean[k] = ts(new Date()); });
  if (!clean.timestamp) clean.timestamp = ts(new Date());
  if (normPath(colRef.path) === 'posts') store.posts.unshift(clean);
  else if (normPath(colRef.path) === 'albums') store.albums.unshift(clean);
  emitAll();
  return { kind: 'doc', path: `${colRef.path || 'posts'}/${id}` };
};
export const writeBatch: any = (db?: any) => {
  if (!DEMO) return FS.writeBatch(db);
  const ops: { kind: string; ref: any; data?: any; opts?: any }[] = [];
  return {
    set: (ref: any, data: any, opts?: any) => { ops.push({ kind: 'set', ref, data, opts }); },
    update: (ref: any, data: any) => { ops.push({ kind: 'update', ref, data }); },
    delete: (ref: any) => { ops.push({ kind: 'delete', ref }); },
    commit: async () => {
      for (const op of ops) {
        if (op.kind === 'set') await demoSet(op.ref, op.data, op.opts);
        else if (op.kind === 'update') await demoUpdate(op.ref, op.data);
        else await demoDelete(op.ref);
      }
    },
  };
};
