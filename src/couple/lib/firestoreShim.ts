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

const store: { config: any; posts: any[]; residents: any[] } = {
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

const listeners: { ref: any; cb: (s: any) => void }[] = [];

function sortedPosts() {
  return store.posts.slice().sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
}

function emit(ref: any, cb: (s: any) => void) {
  const path = ref.path || '';
  if (ref.kind === 'doc') {
    if (path === 'app_config/main') { cb(new DocSnap('main', { ...store.config }, true)); return; }
    const parts = path.split('/');
    if (parts[0] === 'residents') {
      const r = store.residents.find((x) => x.uid === parts[1]);
      cb(new DocSnap(parts[1], r ? { ...r } : null, !!r));
    } else if (parts[0] === 'posts') {
      const p = store.posts.find((x) => x.id === parts[1]);
      cb(new DocSnap(parts[1], p ? { ...p } : null, !!p));
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

export const collection: any = DEMO
  ? (_db: any, name: string) => ({ kind: 'col', path: name })
  : FS.collection;
export const doc: any = DEMO
  ? (_db: any, ...segs: string[]) => ({ kind: 'doc', path: segs.join('/') })
  : FS.doc;
export const query: any = DEMO
  ? (col: any, ..._clauses: any[]) => ({ ...col, clauses: _clauses })
  : FS.query;
export const orderBy: any = DEMO ? (_f: string, _d?: string) => ({ t: 'order' }) : FS.orderBy;
export const where: any = DEMO ? (_f: string, _o: string, _v: any) => ({ t: 'where' }) : FS.where;
export const limit: any = DEMO ? (_n: number) => ({ t: 'limit' }) : FS.limit;
export const serverTimestamp: any = DEMO ? () => ({ __sv: 1 }) : FS.serverTimestamp;
export const increment: any = DEMO ? (n: number) => ({ __inc: n }) : FS.increment;

export const onSnapshot: any = DEMO
  ? (ref: any, cb: (s: any) => void, _errCb?: any) => {
      const entry = { ref, cb };
      listeners.push(entry);
      emit(ref, cb);
      return () => {
        const i = listeners.indexOf(entry);
        if (i >= 0) listeners.splice(i, 1);
      };
    }
  : FS.onSnapshot;

export const getDoc: any = DEMO
  ? async (ref: any) => { let out: any; emit(ref, (s) => { out = s; }); return out; }
  : FS.getDoc;
export const getDocs: any = DEMO
  ? async (ref: any) => { let out: any; emit(ref, (s) => { out = s; }); return out; }
  : FS.getDocs;

async function demoSet(docRef: any, data: any, opts?: any) {
  const path = docRef.path || '';
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
  }
  emitAll();
}

async function demoUpdate(docRef: any, data: any) {
  const path = docRef.path || '';
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
  const path = docRef.path || '';
  if (path.startsWith('posts/')) {
    const i = store.posts.findIndex((p) => p.id === path.split('/')[1]);
    if (i >= 0) store.posts.splice(i, 1);
  }
  emitAll();
}

export const setDoc: any = DEMO ? demoSet : FS.setDoc;
export const updateDoc: any = DEMO ? demoUpdate : FS.updateDoc;
export const deleteDoc: any = DEMO ? demoDelete : FS.deleteDoc;
export const addDoc: any = DEMO
  ? async (colRef: any, data: any) => {
      const id = 'demo-' + Math.random().toString(36).slice(2, 8);
      const item = { ...data, id, timestamp: data.timestamp || ts(new Date()) };
      if ((colRef.path || '') === 'posts') store.posts.unshift(item);
      emitAll();
      return { kind: 'doc', path: `${colRef.path || 'posts'}/${id}` };
    }
  : FS.addDoc;
export const writeBatch: any = DEMO
  ? () => {
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
    }
  : FS.writeBatch;
