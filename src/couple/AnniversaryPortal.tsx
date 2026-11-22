import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence, animate, useAnimationFrame, useMotionValue } from 'motion/react';
import { 
  Home, 
  Globe, 
  Plus, 
  Settings, 
  X, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  ThumbsUp,
  Heart, 
  Share2, 
  Trash2, 
  Flag, 
  MapPin, 
  Calendar, 
  Clock, 
  Phone,
  Film,
  PartyPopper,
  Volume2,
  VolumeX,
  Play,
  Square,
  Pause,
  ChevronLeft,
  Menu,
  ChevronRight,
  ArrowUp,
  ChevronDown,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Send,
  User,
  Camera,
  Check,
  Trash,
  Megaphone,
  Edit3,
  Download,
  Maximize2,
  Minimize2,
  Mail,
  Images
, Handshake, Banknote, Copy } from 'lucide-react';
import { db, auth } from './lib/firebase';
import { db as platformDb } from '../firebase';
import { APP_ID, lsKey, scopedPath } from './lib/appScope';
import { disableNetwork, enableNetwork, Timestamp } from 'firebase/firestore';
import { where } from './lib/firestoreShim';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { getCouplePlan, getCouplePlatform } from './lib/platformInfo';
import PaymentFlow from './PaymentFlow';
import { DEMO, DEMO_COUPLE, DEMO_WEDDING_DATE, DEMO_WEDDING_TIME, DEMO_STORY, DEMO_DETAILS, DEMO_ACCESS_CODE, nameCode, DEMO_POSTS, DEMO_PHOTOS, demoEvents, demoHeader, demoText, demoBride, demoGroom, demoCity, demoHeroImages, demoFooterImages, demoFeedImages, leadOverride, demoWeddingTime } from './lib/demoMode';

// The installation page (animated phone + steps), opened over the app when
// the header Install button is tapped. guideOnly strips the WhatsApp and web
// link info so guests see nothing but the pure install guide.
const InstallGuide = lazy(() => import('../components/InstallPage'));
import { HaloHero, DeckHero, BookHero } from './heroes';
import { get, set, del } from 'idb-keyval';
import { signInAnonymously, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updatePassword, signOut, debugState } from './lib/authShim';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc,
  serverTimestamp,
  writeBatch,
  increment,
  updateDoc,
  getDocs
} from './lib/firestoreShim';



import { 
  LogIn, 
  LogOut, 
  Lock, 
  ShieldCheck, 
  RefreshCw,
  Save,
  Eye,
  EyeOff,
  KeyRound,
  MessageCircle,
} from 'lucide-react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // We don't necessarily want to crash the whole app for a user, 
  // but we want this info in the logs for debugging.
  return errInfo;
}

interface AnniversaryPortalProps {
  onBackToMain: () => void;
  previewMode?: boolean;
  installable?: boolean;
  adminMode?: 'none' | 'preview' | 'real';
  template?: 'classic' | 'halo' | 'hero' | 'book';
  // When set, the app holds at the entry banner and the tap hands control back
  // to the caller instead of entering (the expired-trial payment flow shows
  // the banner first so the couple sees the app is theirs).
  paywallEnter?: () => void;
}

export interface AdItem {
  id: string;
  sponsorName: string;
  headline: string;
  description?: string;
  mediaUrl: string;
  mediaUrls?: string[];
  mediaType: 'image' | 'video';
  mediaTypes?: ('image' | 'video')[];
  ctaText?: string;
  ctaUrl?: string;
  createdAt?: number;
}

interface WeddingEvent {
  id: string;
  name: string;
  type: string;
  date: string; // YYYY-MM-DD
  time?: string; // 24h HH:MM
  desc: string;
  venue?: string;
  status?: 'done' | 'next' | 'up';
  images?: string[]; // up to 2 photos the couple attaches to this journey step
}

const WED_FALLBACK_DATE = DEMO ? DEMO_WEDDING_DATE : '2026-12-12';
const WED_FALLBACK_TIME = DEMO ? DEMO_WEDDING_TIME : '11:00';

// Everything that displays the wedding date derives from these LIVE values.
// They start on the seeded date and are recomputed the moment the couple's
// saved config loads (or they change a date in their dashboard), so the date
// shown, the countdown and the hero never stay on the seeded placeholder
// after the couple picks their own day.
const p2 = (x: number) => (x < 10 ? '0' : '') + x;
let WEDDING_DATE = WED_FALLBACK_DATE;
let WEDDING_TIME = WED_FALLBACK_TIME;
let WED_DT = new Date(`${WEDDING_DATE}T12:00:00`);
let WED_DAY_SHORT = WED_DT.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
let WED_YEAR = String(WED_DT.getFullYear());
let WED_FULL = WED_DT.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
let WED_LONG = WED_DT.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
let WED_DOT = `${p2(WED_DT.getDate())}.${p2(WED_DT.getMonth() + 1)}.${WED_DT.getFullYear()}`;
let WED_DOT_SPACED = WED_DOT.split('.').join(' · ');
function recomputeWed(date?: string, time?: string) {
  WEDDING_DATE = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : WED_FALLBACK_DATE;
  WEDDING_TIME = time || WED_FALLBACK_TIME;
  WED_DT = new Date(`${WEDDING_DATE}T12:00:00`);
  WED_DAY_SHORT = WED_DT.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  WED_YEAR = String(WED_DT.getFullYear());
  WED_FULL = WED_DT.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  WED_LONG = WED_DT.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  WED_DOT = `${p2(WED_DT.getDate())}.${p2(WED_DT.getMonth() + 1)}.${WED_DT.getFullYear()}`;
  WED_DOT_SPACED = WED_DOT.split('.').join(' · ');
}

// Journey events are generic until the couple edits them in the dashboard.
// demoEvents() substitutes the bound couple's names at call time, so a real
// app never shows placeholder names baked in at module load.
const eventsData = (): WeddingEvent[] => demoEvents() as any[];

// The seed feed sample apps and pre-setup real apps show: the couple's own
// names and hero photos across the posts, with the demo reels on the Reels tab.
const demoSeedPosts = () => {
  const fi = demoFeedImages();
  return fi === DEMO_PHOTOS ? DEMO_POSTS : (DEMO_POSTS as any[]).map((sp, i) => (String(sp.id || '').startsWith('demo-seed-p') ? { ...sp, mediaUrls: [fi[i % fi.length]], text: demoText(String(sp.text || '')) } : sp));
};

// Journey status is SET BY THE COUPLE in the dashboard (Done / Next up / Upcoming).
// This helper only seeds statuses the first time the config is written; it is
// never used to compute what guests see at render time.
const seedEventStatuses = (events: WeddingEvent[]): Record<string, 'done' | 'next' | 'up'> => {
  const now = Date.now();
  let nextFound = false;
  const out: Record<string, 'done' | 'next' | 'up'> = {};
  events.forEach((e) => {
    const t = new Date(`${e.date}T${e.time || '12:00'}:00`).getTime();
    if (t < now) { out[e.id] = 'done'; return; }
    if (!nextFound) { nextFound = true; out[e.id] = 'next'; return; }
    out[e.id] = 'up';
  });
  return out;
};

const fmtEventDate = (e: { date: string; time?: string }) =>
  new Date(`${e.date}T${e.time || '12:00'}:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

// The story text is computed at call time: a bound couple's names replace
// the placeholder ones before anything is shown or seeded into their config.
const demoStory = () => demoText(DEMO_STORY);

// Details are generic until the couple edits them. Under a bound couple the
// venue lines point at THEIR city (no invented hall names) and the hashtag
// renders through demoText, so their names win everywhere.
// Gift defaults for any details object: the section is on by default, and a
// config saved before the gifts section existed gets the demo's placeholder
// account details in demo mode (real apps stay empty until the couple saves
// their own details in Settings).
const withGiftDefaults = (base: any): any => {
  const seed = DEMO ? ((DEMO_DETAILS as any).giftInfo || {}) : {};
  const gi: any = { enabled: true, bank: '', accountNumber: '', accountName: '', note: '', ...seed, ...((base && base.giftInfo) || {}) };
  // In demo mode a config saved before the gifts section existed carries empty
  // fields; fall back to the demo placeholder details so the section shows.
  if (DEMO && !gi.accountNumber && !gi.accountName) {
    gi.bank = gi.bank || seed.bank || '';
    gi.accountNumber = seed.accountNumber || '';
    gi.accountName = seed.accountName || '';
    gi.note = gi.note || seed.note || '';
  }
  return { ...base, giftInfo: gi };
};

const detailsData = (): any => {
  const d = { ...DEMO_DETAILS };
  const ov = leadOverride();
  if (ov && ov.city) {
    d.churchVenue = 'Venue to be confirmed \u00b7 ' + ov.city;
    d.receptionVenue = 'Venue to be confirmed \u00b7 ' + ov.city;
  }
  d.hashtag = derivedHashtag();
  return d;
};

// The couple's own hashtag, derived from their names (#SolAndOkx), is the
// default everywhere a hashtag shows. The details field stays editable, so a
// hashtag they type themselves always wins over the derived one.
const derivedHashtag = (): string => {
  const cap = (v: string) => (v || '').replace(/[^a-zA-Z]/g, '').replace(/^./, (c) => c.toUpperCase());
  const b = cap(demoBride()) || 'Amara';
  const g = cap(demoGroom()) || 'Daniel';
  return `#${b}And${g}`;
};
// A saved hashtag that is still the demo placeholder (or empty) falls back to
// the couple's own derived one; anything they typed themselves stays.
const withDerivedHashtag = (d: any): any => {
  if (!d || typeof d !== 'object') return d;
  if (!d.hashtag || /^#AmaraAndDaniel$/i.test(String(d.hashtag))) return { ...d, hashtag: derivedHashtag() };
  return d;
};

// Local placeholder photos used until real ones are uploaded (hero + footer grid)
const PLACEHOLDER_IMAGES = [
  '/placeholder-1.svg',
  '/placeholder-2.svg',
  '/placeholder-3.svg',
  '/placeholder-4.svg',
  '/placeholder-5.svg',
  '/placeholder-6.svg',
];

const normalizeCode = (v: string) => v.trim().toUpperCase();

// Helper to convert small image files to compressed data URLs if cloud upload is unavailable
const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
};

// Demo previews have no upload backend: downscale to a data URL so journey
// step photos survive a refresh inside the preview itself.
const hsvToHex = (h: number, s: number, v: number): string => {
  const S = s / 100, V = v / 100;
  const f = (n: number) => { const k = (n + h / 60) % 6; const x = V - V * S * Math.max(0, Math.min(k, 4 - k, 1)); return Math.round(255 * x).toString(16).padStart(2, '0'); };
  return '#' + f(5) + f(3) + f(1);
};
const hexToHsv = (hex: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return [210, 80, 90];
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) { if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, max ? (d / max) * 100 : 0, max * 100];
};

// Dress colours of the day: a branded gradient picker (no native control),
// two slots by default and as many more as the couple adds. Whatever they
// pick here shows as colour chips on the invitation card and on the home page.
const BrandedColorPicker = ({ initial, onDone, onClose, isDarkMode }: { initial: string; onDone: (hex: string) => void; onClose: () => void; isDarkMode: boolean }) => {
  const start = hexToHsv(initial);
  const [h, setH] = useState(start[0]);
  const [s, setS] = useState(start[1]);
  const [v, setV] = useState(start[2]);
  const padRef = useRef<HTMLDivElement | null>(null);
  const hueRef = useRef<HTMLDivElement | null>(null);
  const mode = useRef<'pad' | 'hue' | null>(null);
  const hex = hsvToHex(h, s, v);
  const movePad = (e: any) => {
    const r = padRef.current?.getBoundingClientRect(); if (!r) return;
    setS(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
    setV(Math.min(100, Math.max(0, (1 - (e.clientY - r.top) / r.height) * 100)));
  };
  const moveHue = (e: any) => {
    const r = hueRef.current?.getBoundingClientRect(); if (!r) return;
    setH(Math.min(359.9, Math.max(0, ((e.clientX - r.left) / r.width) * 360)));
  };
  useEffect(() => {
    const mv = (e: PointerEvent) => { if (mode.current === 'pad') movePad(e); else if (mode.current === 'hue') moveHue(e); };
    const up = () => { mode.current = null; };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  }, []);
  return (
    <div className="fixed inset-0 z-[650] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`w-[300px] max-w-full p-4 rounded-3xl border shadow-2xl ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
        <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-2">Pick the colour</span>
        <div ref={padRef} onPointerDown={(e: any) => { mode.current = 'pad'; movePad(e); }} style={{ height: 168, borderRadius: 14, position: 'relative', touchAction: 'none', background: `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, hsl(${h},100%,50%))` }}>
          <span style={{ position: 'absolute', left: `calc(${s}% - 9px)`, top: `calc(${100 - v}% - 9px)`, width: 18, height: 18, borderRadius: '50%', border: '3px solid #fff', boxShadow: '0 1px 5px rgba(0,0,0,.45)', background: hex, pointerEvents: 'none' }} />
        </div>
        <div ref={hueRef} onPointerDown={(e: any) => { mode.current = 'hue'; moveHue(e); }} style={{ height: 14, marginTop: 14, borderRadius: 999, position: 'relative', touchAction: 'none', background: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }}>
          <span style={{ position: 'absolute', left: `calc(${(h / 360) * 100}% - 8px)`, top: -4, width: 16, height: 22, borderRadius: 6, border: '3px solid #fff', boxShadow: '0 1px 5px rgba(0,0,0,.45)', background: `hsl(${h},100%,50%)`, pointerEvents: 'none' }} />
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest opacity-70"><span className="w-4 h-4 rounded-full border border-black/10" style={{ background: hex }} />{hex}</span>
          <button type="button" onClick={() => onDone(hex)} className="px-4 py-1.5 rounded-full bg-[var(--ann-accent)] text-white text-[0.65rem] font-black uppercase tracking-widest">Done</button>
        </div>
      </div>
    </div>
  );
};

const ColorSwatchesRow = ({ colors, onChange, isDarkMode }: { colors: string[]; onChange: (next: string[]) => void; isDarkMode: boolean }) => {
  const [pick, setPick] = useState<number | null>(null);
  const slots = Math.max(2, colors.length + (colors.length ? 1 : 0));
  const rows: (string | null)[] = [];
  for (let i = 0; i < slots; i++) rows.push(colors[i] || null);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {rows.map((c, i) => c ? (
          <div key={i} className="relative">
            <button type="button" aria-label={'Change colour ' + (i + 1)} onClick={() => setPick(i)} className="w-11 h-11 rounded-full border-2 shadow-sm" style={{ background: c, borderColor: isDarkMode ? '#22363E' : '#DAD8E3' }} />
            <button type="button" aria-label="Remove colour" onClick={() => onChange(colors.filter((_: string, j: number) => j !== i))} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black/70 text-white text-[11px] leading-none flex items-center justify-center">×</button>
          </div>
        ) : (
          <button key={i} type="button" aria-label="Pick a colour" onClick={() => setPick(i)} className={`w-11 h-11 rounded-full border-2 border-dashed flex items-center justify-center text-lg ${isDarkMode ? 'border-[#22363E] text-white/40' : 'border-[#C9C6D6] text-slate-400'}`}>+</button>
        ))}
      </div>
      <p className="text-[10px] opacity-50 mt-2">Tap a circle to pick its colour. Tap + to add another.</p>
      {pick !== null && (
        <BrandedColorPicker initial={rows[pick] || '#B57D2C'} onDone={(hex: string) => {
          const next = colors.slice();
          if (pick < next.length) next[pick] = hex; else next.push(hex);
          onChange(next.filter(Boolean));
          setPick(null);
        }} onClose={() => setPick(null)} isDarkMode={isDarkMode} />
      )}
    </div>
  );
};

const demoImageDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read the photo.'));
  reader.onload = () => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const max = 900;
          const scale = Math.min(1, max / Math.max(img.width || 1, img.height || 1));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * scale));
          c.height = Math.max(1, Math.round(img.height * scale));
          const ctx = c.getContext('2d');
          if (!ctx) { resolve(String(reader.result)); return; }
          ctx.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.82));
        } catch { resolve(String(reader.result)); }
      };
      img.onerror = () => resolve(String(reader.result));
      img.src = String(reader.result);
    } catch (e) { reject(e); }
  };
  reader.readAsDataURL(file);
});

// Helper for centralized file uploads (Direct signed Cloudinary upload + Server proxy + Fallback)
// Same signed Cloudinary upload as uploadToCloudinary, but reports live
// progress (0-100) through onProgress so the feed card can show a percentage.
// Big files go up in chunks (Cloudinary's chunked-upload protocol), so a
// 200MB or 500MB video neither trips a single-request size cap nor leaves
// the bar frozen while the connection or the server takes its time.
const CLOUDINARY_CHUNK_BYTES = 10 * 1024 * 1024;

// ---- Storage gate (Eventicor platform settings) ----
// Every app runs on a plan whose photo + video storage is set by the
// Eventicor admin in the console (platform/settings). Uploads are refused
// before any bytes leave the device once the app's media reaches the limit,
// and every accepted upload records its size on the app's usage record so
// the dashboard's storage chart stays live.
export const STORAGE_FULL_MESSAGE = 'Your storage is full. Upgrade your plan to keep uploading photos and videos.';
const GB = 1073741824;

// Partners: the people, brands and businesses a couple wants their guests to
// know, managed in the dashboard's Partners tab and shown on the app's home
// page. Demo previews show these two.
const DEMO_PARTNERS = [
  { id: 'demo-lens', name: 'Lens & Light Studio', category: 'Photography', description: 'The studio shooting the wedding day. Their full album lands here first.' },
  { id: 'demo-kiln', name: 'Kiln Films', category: 'Videography', description: 'Every highlight reel and the wedding film come from Kiln Films.' },
];
interface UsageRec { imagesBytes: number; videosBytes: number; count: number; updatedAt?: number }
let platSettings: { feedPageSize: number; storage: Record<string, number> } = { feedPageSize: 0, storage: { essential: 5, complete: 10, legacy: 20 } };
let usageRec: UsageRec | null = null;
let usagePlan = 'essential';
export function setPlatformSettingsClient(next: { feedPageSize: number; storage: Record<string, number> }) {
  platSettings = next;
}
export function setUsageClient(u: UsageRec | null, plan: string) {
  usageRec = u;
  usagePlan = ['essential', 'complete', 'legacy'].includes(plan) ? plan : 'essential';
}
export function usageLimitGB(): number { return platSettings.storage[usagePlan] || 5; }
export function usageUsedGB(): number { return usageRec ? (usageRec.imagesBytes + usageRec.videosBytes) / GB : 0; }
export function storageBlocked(): boolean { return usageRec ? usageRec.imagesBytes + usageRec.videosBytes >= usageLimitGB() * GB : false; }
async function recordMediaUsage(bytes: number, isVideo: boolean) {
  if (DEMO || !auth?.currentUser || !bytes) return;
  try {
    const ref = doc(db, scopedPath('usage'), 'main');
    const patch: any = { count: increment(1), updatedAt: serverTimestamp() };
    patch[isVideo ? 'videosBytes' : 'imagesBytes'] = increment(bytes);
    await setDoc(ref, patch, { merge: true });
    try { window.dispatchEvent(new Event('ann-usage-dirty')); } catch {}
  } catch { /* the chart catches up on the next snapshot */ }
}

const uploadToCloudinaryWithProgressInner = async (file: Blob, folder: string, onProgress: (pct: number) => void): Promise<string> => {
  const fileName = (file as File).name || (file.type?.startsWith('video/') ? 'upload.mp4' : 'upload.jpg');
  const isVideo = Boolean(file.type && file.type.startsWith('video/')) || /\.(mp4|mov|webm|mkv)$/i.test(fileName);
  const idToken = await auth?.currentUser?.getIdToken().catch(() => null);

  const signatureEndpoints = [
    `/api/upload-signature?folder=${encodeURIComponent(folder)}`,
    `/.netlify/functions/upload-signature?folder=${encodeURIComponent(folder)}`
  ];

  let sigData: any = null;
  for (const sigEndpoint of signatureEndpoints) {
    try {
      const sigRes = await fetch(sigEndpoint, {
        method: 'GET',
        credentials: sigEndpoint.startsWith('http') ? 'omit' : 'include',
        headers: {
          'Accept': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        }
      });
      if (sigRes.ok) {
        const sigJson = await sigRes.json().catch(() => null);
        if (sigJson && sigJson.signature && sigJson.cloudName && sigJson.apiKey) { sigData = sigJson; break; }
      }
    } catch { /* try the next signature endpoint */ }
  }

  if (!sigData) {
    onProgress(99);
    return await uploadToCloudinary(file, folder);
  }

  const resourceType = isVideo ? 'video' : 'auto';
  const endpoint = `https://api.cloudinary.com/v1_1/${sigData.cloudName}/${resourceType}/upload`;
  const report = (doneBytes: number) => {
    // 99 is the top while bytes are still moving; 100 only when the asset
    // is actually accepted, so the wait after the last byte never reads as
    // a stuck bar.
    if (onProgress && file.size > 0) onProgress(Math.min(99, Math.round((doneBytes / file.size) * 100)));
  };

  if (file.size > CLOUDINARY_CHUNK_BYTES) {
    try {
      const uniqueId = `evc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      let offset = 0;
      let lastJson: any = null;
      while (offset < file.size) {
        const end = Math.min(offset + CLOUDINARY_CHUNK_BYTES, file.size);
        let attempt = 0;
        for (;;) {
          attempt += 1;
          try {
            const form = new FormData();
            form.append('file', file.slice(offset, end), fileName);
            // Every chunk needs the signed auth params: Cloudinary treats a
            // chunk without them as unsigned and rejects it with a 400.
            form.append('api_key', sigData.apiKey);
            form.append('timestamp', String(sigData.timestamp));
            form.append('signature', sigData.signature);
            form.append('folder', sigData.folder || folder);
            const chunkJson: any = await new Promise<any>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('POST', endpoint);
              xhr.setRequestHeader('X-Unique-Upload-Id', uniqueId);
              xhr.setRequestHeader('Content-Range', `bytes ${offset}-${end - 1}/${file.size}`);
              xhr.upload.onprogress = (e) => { if (e.lengthComputable) report(offset + e.loaded); };
              xhr.onload = () => {
                try {
                  const j = JSON.parse(xhr.responseText);
                  if (xhr.status >= 200 && xhr.status < 300) resolve(j);
                  else reject(new Error(`Cloudinary chunk failed (${xhr.status})`));
                } catch { reject(new Error('Bad chunk response')); }
              };
              xhr.onerror = () => reject(new Error('Network error during chunk upload'));
              xhr.send(form);
            });
            report(end);
            lastJson = chunkJson;
            break;
          } catch (chunkErr) {
            // A dropped chunk retries twice more before the whole upload
            // falls back, so a flaky mobile connection does not throw away
            // everything already on the server.
            if (attempt >= 3) throw chunkErr;
            await new Promise((r) => setTimeout(r, 800 * attempt));
          }
        }
        if (lastJson?.secure_url) { onProgress(100); return lastJson.secure_url; }
        offset = end;
      }
      if (lastJson?.secure_url) { onProgress(100); return lastJson.secure_url; }
      throw new Error('Chunked upload finished without a URL');
    } catch (chunkedErr) {
      console.warn('Chunked upload failed, falling back to a single request:', chunkedErr);
    }
  }

  const result = await new Promise<string>((resolve, reject) => {
    const form = new FormData();
    form.append('file', file, fileName);
    form.append('api_key', sigData.apiKey);
    form.append('timestamp', String(sigData.timestamp));
    form.append('signature', sigData.signature);
    form.append('folder', sigData.folder || folder);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100))); };
    xhr.onload = () => {
      try {
        const j = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && j.secure_url) resolve(j.secure_url);
        else reject(new Error('Cloudinary upload failed'));
      } catch { reject(new Error('Bad upload response')); }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(form);
  });
  onProgress(100);
  return result;
};

// A video is known by its MIME type, or by its extension when the phone's
// file picker hands the file over with an empty type (common on Android).
const isVideoFile = (f: any): boolean =>
  Boolean(f?.type && String(f.type).startsWith('video/')) || /\.(mp4|mov|webm|mkv|avi|m4v|3gp)$/i.test(f?.name || '');

// The six Eventicor accents (the landing page's palette). The dashboard's
// accent picker under the hero style switches the whole app's color.
const ACCENT_CHOICES: [string, string, string][] = [
  ['midnight', 'Midnight', '#14122b'],
  ['blush', 'Blush', '#d6285f'],
  ['emerald', 'Emerald', '#0c4a36'],
  ['royal', 'Royal', '#2236b4'],
  ['sunset', 'Sunset', '#e07a4f'],
  ['sage', 'Sage', '#2e5c45'],
];
const ACCENT_VARS: Record<string, { accent: string; hero: string; soft: string }> = {
  midnight: { accent: '#14122b', hero: '#0a0917', soft: '#e9e6f2' },
  blush: { accent: '#d6285f', hero: '#8f1c42', soft: '#fbe1e8' },
  emerald: { accent: '#0c4a36', hero: '#07301f', soft: '#e4efe7' },
  royal: { accent: '#2236b4', hero: '#151f63', soft: '#e6eaf9' },
  sunset: { accent: '#e07a4f', hero: '#2b1a12', soft: '#fdeedd' },
  sage: { accent: '#2e5c45', hero: '#1f2b25', soft: '#eef5ef' },
};
const TPL_DEFAULT_ACCENT: Record<string, string> = { classic: 'midnight', halo: 'blush', hero: 'emerald', book: 'royal' };

// Public wrapper: checks the app's storage before a single byte moves, then
// records what was accepted once Cloudinary confirms the upload.
const uploadToCloudinaryWithProgress = async (file: Blob, folder: string, onProgress: (pct: number) => void): Promise<string> => {
  if (!DEMO && storageBlocked()) throw new Error(STORAGE_FULL_MESSAGE);
  const url = await uploadToCloudinaryWithProgressInner(file, folder, onProgress);
  const fileName = (file as File).name || (file.type?.startsWith('video/') ? 'upload.mp4' : 'upload.jpg');
  const isVideo = Boolean(file.type && file.type.startsWith('video/')) || /\.(mp4|mov|webm|mkv)$/i.test(fileName);
  await recordMediaUsage(file.size || 0, isVideo);
  return url;
};

const uploadToCloudinary = async (file: Blob, folder: string): Promise<string> => {
  if (!DEMO && storageBlocked()) throw new Error(STORAGE_FULL_MESSAGE);
  const url = await uploadToCloudinaryWithProgressInner(file, folder, () => {});
  const fileName = (file as File).name || (file.type?.startsWith('video/') ? 'upload.mp4' : 'upload.jpg');
  const isVideo = Boolean(file.type && file.type.startsWith('video/')) || /\.(mp4|mov|webm|mkv)$/i.test(fileName);
  await recordMediaUsage(file.size || 0, isVideo);
  return url;
};
export default function AnniversaryPortal({ onBackToMain, previewMode, template, adminMode = 'real', installable = false, paywallEnter }: AnniversaryPortalProps) {
  // ?nochrome=1 (the dashboard's preview mockup): the Home page only, with no
  // splash, no header buttons, no bottom nav and no admin shortcut.
  const noChrome = (() => { try { return new URLSearchParams(window.location.search).has('nochrome'); } catch { return false; } })();
  const [activeTab, setActiveTab] = useState<string>(() => {
    // ?home=1 (the dashboard's preview popup) always opens Home, whatever tab
    // the visitor last viewed.
    try {
      if (new URLSearchParams(window.location.search).has('home')) return 'home';
      return localStorage.getItem(lsKey('last-tab')) || 'home';
    } catch { return 'home'; }
  });
  // In the preview mockup the app stays on Home: any navigation attempt is
  // bounced straight back so the mockup only ever shows the homepage.
  useEffect(() => { if (noChrome && activeTab !== 'home') setActiveTab('home'); }, [activeTab, noChrome]);
  const [feedSubTab, setFeedSubTab] = useState<'post' | 'reels'>(() => {
    try { return (localStorage.getItem(lsKey('last-feedtab')) as 'post' | 'reels') || 'post'; } catch { return 'post'; }
  });
  const [videoOrientations, setVideoOrientations] = useState<Record<string, 'portrait' | 'landscape'>>({});
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [fontSize, setFontSize] = useState<'m' | 'l' | 'xl'>('l');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [footerImages, setFooterImages] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(lsKey('footer-images'));
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [footerLightbox, setFooterLightbox] = useState<string | null>(null);
  // The small thank-you line every giant footer style shows above the couple's
  // names; editable in the dashboard's Giant footer style card.
  const [footerThanks, setFooterThanks] = useState<string>(() => { try { return localStorage.getItem(lsKey('footer-thanks')) || ''; } catch { return ''; } });
  // Journey dropdown: which event card is expanded (one at a time).
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  // Giant footer look, chosen by the couple in the dashboard. A brand-new app
  // gets one of the two styles at random (stored once), so users do not all
  // land on the same look; a choice saved in the dashboard always wins.
  const [footerStyle, setFooterStyle] = useState<'wall' | 'marquee' | 'tunnel' | 'globe'>(() => {
    try {
      // ?fs=<style> (the admin console's giant footer Preview): forces the look
      // for that visit, over the couple's saved choice.
      const fsParam = new URLSearchParams(window.location.search).get('fs');
      if (fsParam === 'wall' || fsParam === 'marquee' || fsParam === 'tunnel' || fsParam === 'globe') return fsParam;
      const saved = localStorage.getItem(lsKey('footer-style'));
      if (saved === 'wall' || saved === 'marquee' || saved === 'tunnel' || saved === 'globe') return saved;
      const pick = Math.random() < 0.5 ? 'wall' : 'marquee';
      localStorage.setItem(lsKey('footer-style'), pick);
      return pick;
    } catch { return Math.random() < 0.5 ? 'wall' : 'marquee'; }
  });
  // Hero style: which of the four hero designs the app shows. The link's
  // template decides the starting look; a choice saved in the dashboard always
  // wins and persists like the footer style does.
  const [heroTpl, setHeroTpl] = useState<'classic' | 'halo' | 'hero' | 'book'>(() => {
    try {
      const saved = localStorage.getItem(lsKey('hero-tpl'));
      if (saved === 'classic' || saved === 'halo' || saved === 'hero' || saved === 'book') return saved;
    } catch { /* ignore */ }
    return (template || 'classic') as 'classic' | 'halo' | 'hero' | 'book';
  });
  const [avatarZoom, setAvatarZoom] = useState<string | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [newPostEvent, setNewPostEvent] = useState<string>('');
  const [accessCode, setAccessCode] = useState('');
  // The optimistic post shown in the feed while its media uploads, with the
  // upload percentage rendered on the card itself.
  const [uploadingPost, setUploadingPost] = useState<any | null>(null);
  const [attachedMedia, setAttachedMedia] = useState<{url: string, id: string, type?: 'image' | 'video', orientation?: 'portrait' | 'landscape'}[]>([]);

  // Email/password admin auth state
  const [authScreen, setAuthScreen] = useState<null | 'signin' | 'forgot' | 'sent'>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [mustSetPassword, setMustSetPassword] = useState(false);
  const [adminSync, setAdminSync] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [setPasswordBusy, setSetPasswordBusy] = useState(false);

  
  // Firebase & Profile State
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [displayName, setDisplayName] = useState(localStorage.getItem(lsKey('profile-name')) || '');
  const [avatar, setAvatar] = useState(localStorage.getItem(lsKey('profile-avatar')) || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAdminModalOpen, setIsAdminDashboardOpen] = useState(false);
  const [route, setRoute] = useState<string>(() => (window.location.hash === '#admin' ? '/admin' : window.location.pathname));
  // The admin dashboard lives on #admin: the address never leaves /app, so a
  // refresh always reopens inside the couple app, never the landing page.
  const goAdminPage = () => {
    if (window.location.hash !== '#admin') {
      try { window.history.pushState({}, '', window.location.pathname + window.location.search + '#admin'); } catch {}
    }
    setRoute('/admin');
    setIsAdminDashboardOpen(true);
  };
  // The round admin shortcut: one tap on a preview, always sign-in on a real
  // app. A real couple's app NEVER opens the dashboard directly: the tap opens
  // the admin sign-in, and the dashboard opens only after a successful sign-in
  // (or after the forced permanent-password step). Lead sample apps never
  // respond at all (adminMode === 'none').
  const shortcutLoginRef = useRef(false);
  // On a real couple's app the admin area opens on THREE taps of the round
  // button (taps within 2 seconds count together), so a stray guest tap never
  // opens it. Console previews stay one-tap for the admin's own convenience.
  const adminTapCountRef = useRef(0);
  const adminTapAtRef = useRef(0);
  const onAdminShortcutTap = () => {
    if (adminMode === 'preview') { goAdminPage(); return; }
    const now = Date.now();
    if (now - adminTapAtRef.current > 2000) adminTapCountRef.current = 0;
    adminTapAtRef.current = now;
    adminTapCountRef.current += 1;
    if (adminTapCountRef.current < 3) return;
    adminTapCountRef.current = 0;
    // A signed-in admin goes straight back into the dashboard without signing
    // in again; the session timeout (the Security section) is what protects it.
    if (user && !user.isAnonymous && isAdmin) { goAdminPage(); return; }
    shortcutLoginRef.current = true;
    setAuthScreen('signin');
  };
  const leaveAdminPage = () => {
    // Deliberately leaving the dashboard (View app) ends the boot-restore gate:
    // without this, the "Opening your dashboard" loader would flip back on and
    // cover the app the moment isAdminModalOpen goes false (user report Nov 20).
    wasAdminOpenOnLoadRef.current = false;
    setIsAdminDashboardOpen(false);
    if (window.location.hash === '#admin') {
      try { window.history.replaceState({}, '', window.location.pathname + window.location.search); } catch {}
    }
    setRoute('/');
  };
  useEffect(() => {
    const onPop = () => {
      const adminRoute = window.location.hash === '#admin' || window.location.pathname === '/admin';
      setRoute(adminRoute ? '/admin' : window.location.pathname);
      if (!adminRoute) setIsAdminDashboardOpen(false);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const [activeAccessCode, setActiveAccessCode] = useState<string | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isAdminSessionValid, setIsAdminSessionValid] = useState(false);
  // True once the auth listener has reported for this page load, so a refresh
  // never flashes the sign-in screen while the session is being restored.
  const [authChecked, setAuthChecked] = useState(false);
  // True once the signed-in user's admins-doc lookup has answered (either
  // verdict). The /admin gate must wait for it too, or a refreshing admin
  // glimpses the sign-in screen in the gap before isAdmin resolves.
  const [adminStatusChecked, setAdminStatusChecked] = useState(false);
  // The preview mockup's iframe boots a second copy of this app on the same
  // Firebase auth. Its initialization can broadcast a transient signed-out
  // state to this tab; never tear a live admin session down for that.
  const lastRealAdminRef = useRef(false);
  const explicitSignOutRef = useRef(false);
  const [authTransient, setAuthTransient] = useState(false);
  const doSignOut = () => { explicitSignOutRef.current = true; signOut(auth); };
  // Eventicor admin contact + payment details saved in app_config.
  const [cfgContact, setCfgContact] = useState<any>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // sticky=true keeps the toast on screen until the next toast replaces it,
  // which is how the install flow holds "Installing" until the app lands.
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success', sticky = false) => {
    setToast({ message, type });
    if (toastTimer.current) { clearTimeout(toastTimer.current); toastTimer.current = null; }
    if (!sticky) toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const [cfgEvents, setCfgEvents] = useState<WeddingEvent[] | null>(null);
  const [cfgStory, setCfgStory] = useState<string | null>(null);
  const [cfgDetails, setCfgDetails] = useState<any>(null);
  const [archiveMode, setArchiveMode] = useState<boolean>(false);
  const [blockedUids, setBlockedUids] = useState<string[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  // Partners: live from this app's Firestore, managed in the dashboard's
  // Partners tab. Demo previews show the demo partners.
  const [partners, setPartners] = useState<any[]>(() => DEMO ? DEMO_PARTNERS : []);
  useEffect(() => {
    if (DEMO) return;
    try {
      const unsub = onSnapshot(query(collection(db, scopedPath('partners')), orderBy('createdAt', 'asc')), (snap: any) => {
        setPartners(snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) })));
      }, () => {});
      return () => { try { unsub(); } catch {} };
    } catch { return; }
  }, []);
  const [residents, setResidents] = useState<any[]>([]);
  const [approveGuestPosts, setApproveGuestPosts] = useState<boolean>(true);
  // Private feed gate: when the admin turns the feed private, every non-admin
  // viewer is held at the entry banner and must type the access code (checked
  // on the server) before posts and reels show again. feedGateGen changes
  // every time the code is revoked or replaced, which sends every device that
  // was granted under the old code back to the banner.
  const [feedPrivate, setFeedPrivate] = useState<boolean>(() => {
    try { const g = JSON.parse(localStorage.getItem(lsKey('feed-gate-cfg')) || 'null'); return !!(g && g.private); } catch { return false; }
  });
  const [feedGateGen, setFeedGateGen] = useState<number>(() => {
    try { const g = JSON.parse(localStorage.getItem(lsKey('feed-gate-cfg')) || 'null'); const n = Number(g && g.gen); return n > 0 ? Math.floor(n) : 1; } catch { return 1; }
  });
  const [feedGranted, setFeedGranted] = useState<number>(() => {
    try { return Number(localStorage.getItem(lsKey('feed-gate'))) || 0; } catch { return 0; }
  });
  const [gateInput, setGateInput] = useState<string>('');
  const [gateBusy, setGateBusy] = useState<boolean>(false);
  const [feedPageSize, setFeedPageSize] = useState(0); // 0 = show every post (no pagination)
  const [feedPage, setFeedPage] = useState(1);
  const [pushEnabled, setPushEnabled] = useState<boolean>(true);
  // Feed action button mode: 'share' opens the share sheet, 'download' saves the
  // media straight to the guest's device. Chosen by the admin in the console
  // Settings tab and stored on app_config/main as feedActionMode.
  const [feedActionMode, setFeedActionMode] = useState<'share' | 'download'>('share');
  const [adminPermissions, setAdminPermissions] = useState<any>(null);
  const [selfAdminRole, setSelfAdminRole] = useState('');
  const [deletedPosts, setDeletedPosts] = useState<any[]>([]);
  const [allAdmins, setAllAdmins] = useState<any[]>([]);
  // Label attached to each hero photo (url -> event name), set in the console's
  // Hero photos tab and stored on app_config/main.
  const [heroImageLabels, setHeroImageLabels] = useState<Record<string, string>>({});
  const [heroImages, setHeroImages] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem(lsKey('hero-images'));
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch {
      // Ignore parse error
    }
    // Until the couple saves hero photos of their own, the uploads they made
    // on the landing page show in the hero on real apps too.
    return demoHeroImages();
  });
  const [postAds, setPostAds] = useState<AdItem[]>([]);
  const [reelAds, setReelAds] = useState<AdItem[]>([]);
  const [shuffledPostAds, setShuffledPostAds] = useState<AdItem[]>([]);
  const [shuffledReelAds, setShuffledReelAds] = useState<AdItem[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  // True once Firestore reports at least one real post. Then every placeholder
  // leaves the feed, posts and reels alike. Once an app has made a real post,
  // that fact is remembered on the device (feed-real): a later empty snapshot,
  // a slow connection or a listener error must never bring the sample
  // placeholders back on that account.
  const [feedReal, setFeedReal] = useState<boolean>(() => {
    try { return typeof window !== 'undefined' && localStorage.getItem(lsKey('feed-real')) === '1'; } catch { return false; }
  });

  // Sample-mode markers: the demo preview (and any app with no real posts yet)
  // carries a permanent sample notice and chips; they disappear the moment the
  // first real post exists.
  const sampleMode = DEMO || (!feedReal && !(posts || []).some((p: any) => !p.localDemo && !String(p.id || '').startsWith('sample-')));
  const [isPostsLoading, setIsPostsLoading] = useState(true);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);

  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(lsKey('bookmarks')) || '[]');
    } catch {
      return [];
    }
  });

  const [sessionExpiry, setSessionExpiry] = useState<number | null>(null);
  const sessionWarningRef = useRef(false);
  // Session length (minutes) for THIS admin; the value lives on their admins
  // record on the server and is enforced there too. Default 30 minutes.
  const sessionMinutesRef = useRef(30);
  // Sliding session window: the timeout counts from the admin's last real
  // activity, so a signed-in admin who returns is never booted by a clock
  // that never restarted since the original sign-in.
  const lastActivityRef = useRef(Date.now());
  const authTimeMsRef = useRef(0);
  const lastKnownLaRef = useRef(0);
  const [userLikes, setUserLikes] = useState<Record<string, boolean>>({});
  const [userLoves, setUserLoves] = useState<Record<string, boolean>>({});
  const [reactionsLoading, setReactionsLoading] = useState(true);
  const [sharingPost, setSharingPost] = useState<any>(null);
  const [commentsPost, setCommentsPost] = useState<any>(null);
  const [sampleLiked, setSampleLiked] = useState<Record<string, boolean>>({});
  const [activeMediaIndex, setActiveMediaIndex] = useState<{postId: string, index: number} | null>(null);

  // PWA Install, Launch Follow-up Splash & Offline State
  const [showLaunchSplash, setShowLaunchSplash] = useState<boolean>(() => {
    if (paywallEnter) return true;
    if (previewMode || noChrome) return false;
    // The entry banner (couple's names + Eventicor branding + Tap to enter) shows
    // on every fresh open of the app, new session included; within one session a
    // refresh keeps the visitor where they were instead of re-showing it.
    // The dashboard was open when the app last closed: skip the entry banner
    // so the reopening admin lands in the dashboard, not the public app.
    try {
      const storedAdminUi = JSON.parse(localStorage.getItem(lsKey('admin-ui')) || 'null');
      if (storedAdminUi && storedAdminUi.open) return false;
    } catch { /* fall through */ }
    try { return sessionStorage.getItem('ev-entered') !== '1'; } catch { return true; }
  });
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(() => (typeof window !== 'undefined' ? (window as any).__deferredPwaPrompt || null : null));
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [pendingAndroidInstall, setPendingAndroidInstall] = useState(false);
  const [showIOSInstallModal, setShowIOSInstallModal] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // The private feed holds only the feed page: a non-admin viewer without a
  // grant for the current gate generation sees the entry banner on the feed
  // tab, while home, settings and the bottom nav stay open.
  const feedLocked = feedPrivate && adminMode !== 'preview' && !isAdmin && feedGranted !== feedGateGen;

  const enterApp = () => {
    if (paywallEnter) { paywallEnter(); return; }
    try { sessionStorage.setItem('ev-entered', '1'); } catch { /* private mode */ }
    setShowLaunchSplash(false);
  };

  // Keep the visitor where they were across refreshes
  useEffect(() => {
    try { localStorage.setItem(lsKey('last-tab'), activeTab); } catch {}
  }, [activeTab]);
  // The phone's back button walks the app's own history instead of quitting the app.
  const viewStackRef = useRef<string[]>([]);
  const prevSigRef = useRef<string | null>(null);
  const restoringRef = useRef(false);
  const viewSig = `${activeTab}|${isAdminModalOpen ? 'a' : ''}|${activeMediaIndex ? 'm' : ''}`;
  useEffect(() => {
    if (restoringRef.current) { restoringRef.current = false; prevSigRef.current = viewSig; return; }
    if (prevSigRef.current && prevSigRef.current !== viewSig) viewStackRef.current.push(prevSigRef.current);
    prevSigRef.current = viewSig;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewSig]);
  useEffect(() => {
    try { window.history.pushState({ evApp: 1 }, ''); } catch {}
    const onPop = () => {
      const prev = viewStackRef.current.pop();
      if (prev !== undefined) {
        restoringRef.current = true;
        const parts = prev.split('|');
        setActiveTab((cur: string) => (parts[0] !== cur ? parts[0] : cur));
        setIsAdminDashboardOpen(parts[1] === 'a');
        if (parts[2] !== 'm') setActiveMediaIndex(null);
        try { window.history.pushState({ evApp: 1 }, ''); } catch {}
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try { localStorage.setItem(lsKey('last-feedtab'), feedSubTab); } catch {}
  }, [feedSubTab]);

  // Reopen the admin dashboard where it was left after a refresh
  const adminUiFirstRunRef = useRef(true);
  const adminAutoOpenedRef = useRef(false);
  useEffect(() => {
    if (adminUiFirstRunRef.current) {
      adminUiFirstRunRef.current = false;
      return;
    }
    try {
      const storedAdminUi = JSON.parse(localStorage.getItem(lsKey('admin-ui')) || 'null') || {};
      localStorage.setItem(lsKey('admin-ui'), JSON.stringify({ ...storedAdminUi, open: isAdminModalOpen }));
    } catch {}
  }, [isAdminModalOpen]);
  useEffect(() => {
    if (adminMode === 'preview' && route === '/admin') setIsAdminDashboardOpen(true);
    else if (adminMode === 'none' && route === '/admin') {
      // Sample apps never expose the admin area: put the guest back in the app.
      if (window.location.hash === '#admin') {
        try { window.history.replaceState({}, '', window.location.pathname + window.location.search); } catch {}
      }
      setRoute('/');
    }
    else if (route === '/admin' && user && !user.isAnonymous && isAdmin) setIsAdminDashboardOpen(true);
  }, [route, user, isAdmin]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    try {
      const storedAdminUi = JSON.parse(localStorage.getItem(lsKey('admin-ui')) || 'null');
      if (storedAdminUi && storedAdminUi.open) {
        setIsAdminDashboardOpen(true);
        setRoute('/admin');
        if (window.location.hash !== '#admin') {
          try { window.history.replaceState({}, '', window.location.pathname + window.location.search + '#admin'); } catch {}
        }
      }
    } catch {}
  }, [user, isAdmin]);

  // A refresh with the dashboard open lands straight back in the dashboard:
  // never the public guest app, never the sign-in screen while the session is
  // being restored. A boot gate holds a full-screen loader until the admin
  // role is confirmed; only a genuinely signed-out or non-admin session drops
  // to the sign-in screen, and a network hiccup on the admins lookup retries
  // instead of kicking the admin out.
  const wasAdminOpenOnLoadRef = useRef((() => { try { const s = JSON.parse(localStorage.getItem(lsKey('admin-ui')) || 'null'); return !!(s && s.open); } catch { return false; } })());
  const adminRetryCountRef = useRef(0);
  const [adminRetryNonce, setAdminRetryNonce] = useState(0);
  // Bounded boot gate: the "Opening your dashboard" loader must never hold
  // forever. On a very slow or offline network the auth session or the admins
  // lookup can hang without erroring, which used to leave a spinner until the
  // admin refreshed by hand. After 12 seconds the gate releases itself; the
  // dashboard-reopen effect still opens the dashboard the moment the role
  // actually confirms.
  const [bootGateTimedOut, setBootGateTimedOut] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setBootGateTimedOut(true), 12000);
    return () => window.clearTimeout(t);
  }, []);
  const adminLookupErrored = adminSync.startsWith('err:');
  const adminRestorePending = !noChrome && adminMode === 'real'
    && wasAdminOpenOnLoadRef.current
    && !bootGateTimedOut
    && !(
      authChecked && (
        (user && !user.isAnonymous && isAdmin && isAdminModalOpen) ||
        (!user || !!user.isAnonymous) ||
        (adminStatusChecked && !adminLookupErrored && !isAdmin)
      )
    );
  // The dashboard and the admin loader stay up while a transient auth
  // broadcast from the preview mockup's iframe is settling.
  const adminGateOk = adminMode === 'preview' || (user && !user.isAnonymous && isAdmin) || (!!authTransient && isAdmin);
  useEffect(() => {
    if (adminMode !== 'real' || !wasAdminOpenOnLoadRef.current) return;
    if (authChecked && !authTransient && (!user || !!user.isAnonymous || (adminStatusChecked && !adminLookupErrored && !isAdmin))) {
      wasAdminOpenOnLoadRef.current = false;
      try {
        const storedAdminUi = JSON.parse(localStorage.getItem(lsKey('admin-ui')) || 'null') || {};
        localStorage.setItem(lsKey('admin-ui'), JSON.stringify({ ...storedAdminUi, open: false }));
      } catch {}
    }
  }, [authChecked, user, isAdmin, adminStatusChecked, adminLookupErrored, adminMode]);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsPWAInstalled(isStandalone);
    const relApps = (navigator as any).getInstalledRelatedApps;
    if (typeof relApps === 'function') relApps.call(navigator).then((l: any[]) => { if (Array.isArray(l) && l.length) setIsPWAInstalled(true); }).catch(() => {});

    const ua = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOSDevice(isIOS);

    if ((window as any).__deferredPwaPrompt) {
      setDeferredInstallPrompt((window as any).__deferredPwaPrompt);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).__deferredPwaPrompt = e;
      setDeferredInstallPrompt(e);
    };

    const handlePwaPromptReady = (e: Event) => {
      const promptEvent = (e as CustomEvent).detail || (window as any).__deferredPwaPrompt;
      if (promptEvent) {
        setDeferredInstallPrompt(promptEvent);
      }
    };

    const handleAppInstalled = () => {
      setIsPWAInstalled(true);
      setDeferredInstallPrompt(null);
      setPendingAndroidInstall(false);
      setShowIOSInstallModal(false);
      (window as any).__deferredPwaPrompt = null;
      showToast('App installed!');
    };

    const params = new URLSearchParams(window.location.search);
    if (params.get('autoinstall') === '1' && !isIOS) {
      setPendingAndroidInstall(true);
      window.history.replaceState({}, '', window.location.pathname);
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-prompt-ready', handlePwaPromptReady);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-prompt-ready', handlePwaPromptReady);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Automatically trigger native Android install if user tapped Install while service worker was still registering
  useEffect(() => {
    if (pendingAndroidInstall && deferredInstallPrompt) {
      setPendingAndroidInstall(false);
      (async () => {
        try {
          await deferredInstallPrompt.prompt();
          const { outcome } = await deferredInstallPrompt.userChoice;
          if (outcome === 'accepted') {
            setIsPWAInstalled(true);
            setDeferredInstallPrompt(null);
            (window as any).__deferredPwaPrompt = null;
          } else {
            setToast(null); // the Chrome dialog was dismissed: drop the sticky download toast
          }
        } catch (err) {
          console.error('Deferred install prompt error:', err);
        }
      })();
    }
  }, [pendingAndroidInstall, deferredInstallPrompt]);

  // The header Install button opens the embedded install guide for everyone
  // (guests included): the native Android install button, or the iPhone steps.
  const handleInstallClick = () => {
    setShowIOSInstallModal(true);
  };

  const handleAndroidInstall = async () => {
    const promptEvent = deferredInstallPrompt || (window as any).__deferredPwaPrompt;
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
          setIsPWAInstalled(true);
          setDeferredInstallPrompt(null);
          (window as any).__deferredPwaPrompt = null;
          setShowIOSInstallModal(false);
        } else {
          setToast(null); // the Chrome dialog was dismissed: drop the sticky download toast
        }
      } catch (err) {
        console.error('Install prompt error:', err);
      }
      return;
    }

    // If Android/Chromium user is inside an iframe where top-level window is required for native WebAPK download:
    if (window.self !== window.top) {
      const targetUrl = new URL(window.location.href);
      targetUrl.searchParams.set('autoinstall', '1');
      const a = document.createElement('a');
      a.href = targetUrl.toString();
      a.target = '_top';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    setPendingAndroidInstall(true);
    showToast('Installing\u2026', 'info', true);
    setShowIOSInstallModal(false);
  };

  // 1. Handle Auth & Session
  useEffect(() => {
    if (DEMO && adminMode !== 'real') return; // Previews and sample apps run fully offline; a real couple's app runs the real auth flow (guest anonymous sign-in, admin sign-in state)
    const unsub = onAuthStateChanged(auth, async (currUser) => {
      try { setAuthChecked(true);
      // The preview mockup's iframe is only a look: it reads the signed-in
      // user and never mutates auth, so opening it can never disturb the
      // admin's real session.
      if (noChrome) { setUser(currUser || null); return; }
      if (currUser) {
        setUser(currUser);
        setAuthTransient(false);
        
        // Admin Session Management
        if (!currUser.isAnonymous) {
          lastRealAdminRef.current = true;
          explicitSignOutRef.current = false;
          const idToken = await currUser.getIdTokenResult();
          const authTime = (idToken.claims.auth_time as any) || Math.floor(new Date(currUser.metadata.lastSignInTime || Date.now()).getTime() / 1000);
          authTimeMsRef.current = Number(authTime) * 1000;
          const sessionMinutes = Math.max(5, Math.min(Number(sessionMinutesRef.current) || 30, 10080));
          const expiresAt = (Number(authTime) + sessionMinutes * 60) * 1000;
          const now = Date.now();
          
          const idleExpiresAt = lastActivityRef.current + sessionMinutes * 60000;
          if (now >= idleExpiresAt) {
            doSignOut();
            setIsAdminSessionValid(false);
            showToast("Your admin session expired. Please sign in again.", "info");
          } else {
            setSessionExpiry(expiresAt);
            setIsAdminSessionValid(true);
            sessionWarningRef.current = false;
          }
        } else {
          setSessionExpiry(null);
          setIsAdminSessionValid(false);
        }
      } else if (lastRealAdminRef.current && !explicitSignOutRef.current) {
        // A second context booting on the same Firebase auth (the preview
        // mockup's iframe) can broadcast a transient signed-out state. Never
        // tear a live admin session down for it: hold, and only accept the
        // sign-out if it really persists.
        setAuthTransient(true);
        window.setTimeout(() => {
          if ((auth as any).currentUser) return; // the admin is back
          setAuthTransient(false);
          setUser(null);
          setIsAdmin(false);
          setAdminPermissions(null);
          setSessionExpiry(null);
          setIsAdminSessionValid(false);
          signInAnonymously(auth).catch(err => console.error("Anonymous auth error:", err));
        }, 3000);
      } else {
        setAuthTransient(false);
        setUser(null);
        setIsAdmin(false);
        setAdminPermissions(null);
        setSessionExpiry(null);
        signInAnonymously(auth).catch(err => console.error("Anonymous auth error:", err));
      }
      } catch (eAuth) { console.error('Auth state listener error:', eAuth); }
    });
    return () => unsub();
  }, [adminMode]);

  // 1b. Session Expiry Timers & Visibility Checks
  useEffect(() => {
    if (!sessionExpiry || !user) return;

    const checkExpiry = () => {
      const now = Date.now();
      // The window slides with use: the timeout counts from the last real
      // interaction, not from the original sign-in.
      const idleMins = Math.max(5, Math.min(Number(sessionMinutesRef.current) || 30, 10080));
      const timeLeft = lastActivityRef.current + idleMins * 60000 - now;

      if (timeLeft <= 0) {
        doSignOut();
        setIsAdminDashboardOpen(false);
        if (window.location.hash === '#admin') {
          try { window.history.replaceState({}, '', window.location.pathname + window.location.search); } catch {}
        }
        setRoute('/');
        setIsAdminSessionValid(false);
        showToast("Your admin session expired. Please sign in again.", "error");
      } else if (timeLeft < 120000 && !sessionWarningRef.current) {
        showToast("Admin session expiring in 2 minutes.", "error");
        sessionWarningRef.current = true;
      }
    };

    const timer = setInterval(checkExpiry, 10000);
    window.addEventListener('visibilitychange', checkExpiry);
    window.addEventListener('focus', checkExpiry);

    return () => {
      clearInterval(timer);
      window.removeEventListener('visibilitychange', checkExpiry);
      window.removeEventListener('focus', checkExpiry);
    };
  }, [sessionExpiry, user]);

  // 1c. Keep the server's idle marker current: a visible dashboard writes the
  // admin's last activity onto their own admins record every few minutes, so
  // the server's idle check agrees with what the admin experiences.
  useEffect(() => {
    if (!user || user.isAnonymous) return;
    const email = user.email || '';
    if (!email) return;
    const bump = () => { lastActivityRef.current = Date.now(); };
    const ACT = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];
    ACT.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    let lastWrite = lastKnownLaRef.current || Date.now();
    const writeBeat = () => {
      const when = lastActivityRef.current;
      lastWrite = Math.max(lastWrite, when);
      setDoc(doc(db, scopedPath('admins'), email), { lastActiveAt: Timestamp.fromMillis(when) }, { merge: true }).catch(() => {});
    };
    const beat = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (lastActivityRef.current <= lastWrite) return; // nothing new since the last write
      writeBeat();
    }, 4 * 60 * 1000);
    return () => {
      ACT.forEach((e) => window.removeEventListener(e, bump));
      window.clearInterval(beat);
    };
  }, [user?.uid, user?.email]);

  // 1c. Live Profile, Admin & Reactions Sync
  useEffect(() => {
    if (noChrome) return; // the preview mockup never touches admin state
    if (!user) return;


    // Sync profile (real wedding apps only: the demo stub db has no residents)
    const profileUnsub = DEMO ? null : onSnapshot(doc(db, scopedPath('residents'), user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.displayName) setDisplayName(data.displayName);
        if (data.photoUrl) setAvatar(data.photoUrl);
      } else {
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `residents/${user.uid}`);
    });

    // Guests sign in anonymously: the profile above is theirs. Everything from
    // here on (admin status, provisioning) only applies to signed-in,
    // non-anonymous accounts.
    if (user.isAnonymous) {
      return () => { if (profileUnsub) profileUnsub(); };
    }
    setAdminStatusChecked(false);

    // Sync admin status
    setAdminSync('sub:' + (user.email || 'anonymous'));
    getDoc(doc(platformDb, scopedPath('admins'), user.email || 'anonymous')).then((d) => { setAdminSync((prev) => prev + '|get:' + (d.exists() ? 'exists' : 'missing')); setAdminStatusChecked(true); }, (e: any) => { setAdminSync((prev) => prev + '|getErr:' + (e?.code || String(e))); setAdminStatusChecked(true); });
    const adminUnsub = onSnapshot(doc(platformDb, scopedPath('admins'), user.email || 'anonymous'), (snap) => {
      setAdminStatusChecked(true);
      if (snap.exists()) {
        setAdminSync('exists');
        setIsAdmin(true);
        // Owner, couple, admin, bride and groom always keep full dashboard
        // rights: a stale or damaged permissions object on their doc must not
        // hide the Hero photos and Giant footer cards again.
        const admDoc = snap.data() as any;
        setSelfAdminRole(String(admDoc.role || 'owner'));
        const admPerms = admDoc.permissions || {};
        const admFullRole = ['owner', 'couple', 'admin', 'bride', 'groom'].includes(String(admDoc.role || 'owner'));
        setAdminPermissions(admFullRole
          ? { canDeletePosts: true, canUploadImages: true, canSetAccessCode: true }
          : { canDeletePosts: !!admPerms.canDeletePosts, canUploadImages: admPerms.canUploadImages !== false, canSetAccessCode: !!admPerms.canSetAccessCode });
        setMustSetPassword(!!admDoc.mustSetPassword);
        const mins = Number(snap.data().sessionMinutes);
        if (mins >= 5) sessionMinutesRef.current = Math.min(mins, 10080);
        // Idle session window: lastActiveAt (written while the admin works)
        // extends the window past the original sign-in. Opening the app counts
        // as activity only when the session is still inside its window, so an
        // idle-expired session ends here and cannot be revived by returning.
        const admLa: any = admDoc.lastActiveAt;
        const laMs = admLa?.toDate ? admLa.toDate().getTime() : (Number(admLa?.seconds || 0) * 1000 || 0);
        lastKnownLaRef.current = laMs;
        const idleMins = mins >= 5 ? Math.min(mins, 10080) : (Number(sessionMinutesRef.current) || 30);
        const idleStart = Math.max(authTimeMsRef.current || 0, laMs || 0);
        if (idleStart && Date.now() - idleStart > idleMins * 60000 + 60000) {
          doSignOut();
          setIsAdminSessionValid(false);
          setIsAdminDashboardOpen(false);
          if (window.location.hash === '#admin') {
            try { window.history.replaceState({}, '', window.location.pathname + window.location.search); } catch {}
          }
          setRoute('/');
          showToast('Your admin session expired. Please sign in again.', 'info');
        } else if (!laMs || Date.now() - laMs > 60000) {
          // First read of this visit (or a cold record): stamp this visit's
          // start as activity.
          setDoc(doc(db, scopedPath('admins'), user.email || ''), { lastActiveAt: Timestamp.fromMillis(lastActivityRef.current) }, { merge: true }).catch(() => {});
        }
        if (!adminAutoOpenedRef.current) { adminAutoOpenedRef.current = true; goAdminPage(); }
      } else {
        // Every account is checked against THIS app's admins list only: the
        // platform's own login stays inside the Eventicor console and never
        // opens a couple's app admin (user direction Nov 21 2026).
        setAdminSync('missing');
        setSelfAdminRole('');
        setIsAdmin(false);
        setAdminPermissions(null);
        adminAutoOpenedRef.current = false;
      }
    }, (err) => {
      setAdminSync('err:' + ((err as any).code || String(err)));
      setAdminStatusChecked(true);
      handleFirestoreError(err, OperationType.GET, `admins/${user.email}`);
      // A network hiccup on the admins lookup must never land a returning
      // admin on the sign-in screen: retry the lookup while the boot restore
      // is still holding the screen.
      if (wasAdminOpenOnLoadRef.current && adminRetryCountRef.current < 3) {
        adminRetryCountRef.current += 1;
        setTimeout(() => setAdminRetryNonce((n) => n + 1), 1500);
      }
    });

    return () => {
      if (profileUnsub) profileUnsub();
      adminUnsub();
    };
  }, [user, adminRetryNonce]);

  // Handle Reactions Logic
  const handleToggleReaction = async (postId: string, type: 'like' | 'love') => {
    if (DEMO || String(postId).startsWith('demo-seed-')) {
      if (type === 'like') setUserLikes((prev) => ({ ...prev, [postId]: !prev[postId] }));
      else setUserLoves((prev) => ({ ...prev, [postId]: !prev[postId] }));
      return;
    }
    // Guests authenticate anonymously; if that session has not landed yet,
    // wait for it here instead of failing the write.
    let uid = user?.uid as string | undefined;
    if (!uid) {
      try {
        await signInAnonymously(auth);
        uid = auth.currentUser?.uid || undefined;
      } catch {}
    }
    if (!uid) {
      showToast("Still connecting you. Try again in a moment.", "error");
      return;
    }

    // Guests must save a profile (a residents doc with a display name) before
    // they can react; admins signed into the dashboard can always react.
    const isAdminCaller = !!(user && !user.isAnonymous && isAdmin);
    if (!isAdminCaller) {
      const resSnap = await getDoc(doc(db, scopedPath('residents'), uid));
      if (!resSnap.exists() || !resSnap.data()?.displayName) {
        showToast('Save your profile first: add your name in Settings, then you can react to posts.', 'error');
        return;
      }
    }
    const isActive = type === 'like' ? !!userLikes[postId] : !!userLoves[postId];
    const otherTypeActive = type === 'like' ? !!userLoves[postId] : !!userLikes[postId];
    
    const batch = writeBatch(db);
    const reactionRef = doc(db, scopedPath('posts'), postId, 'reactions', uid);
    const postRef = doc(db, scopedPath('posts'), postId);

    try {
      // 1. Update the reaction document (merge)
      batch.set(reactionRef, { 
        [type]: !isActive,
        updatedAt: serverTimestamp() 
      }, { merge: true });

      // 2. Update the post counter
      batch.update(postRef, { 
        [`${type}Count`]: increment(isActive ? -1 : 1) 
      });
      
      // Optimistic UI Update
      if (type === 'like') {
        setUserLikes(prev => ({ ...prev, [postId]: !isActive }));
      } else {
        setUserLoves(prev => ({ ...prev, [postId]: !isActive }));
      }
      
      await batch.commit();
      showToast(isActive ? 'Reaction removed' : 'Reaction added');
    } catch (err) {
      console.error("Reaction error:", err);
      showToast("Reaction failed. Please try again.", "error");
      // Revert optimistic
      if (type === 'like') setUserLikes(prev => ({ ...prev, [postId]: isActive }));
      else setUserLoves(prev => ({ ...prev, [postId]: isActive }));
    }
  };

  // 1d. Deep Linking for Sharing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const postId = params.get('post');
    if (postId && activeTab === 'feed') {
      setTimeout(() => {
        const el = document.getElementById(`post-${postId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-[var(--ann-accent)]', 'ring-offset-4', 'rounded-2xl');
          setTimeout(() => el.classList.remove('ring-2', 'ring-[var(--ann-accent)]', 'ring-offset-4'), 3000);
        }
      }, 1000);
    }
  }, [activeTab, posts]);

  // 2. Sync Global Config (Access Code)
  useEffect(() => {
    if (DEMO) {
      // Previews run offline: hydrate anything saved in this preview session.
      try {
        const saved = JSON.parse(localStorage.getItem(lsKey('demo-cfg')) || 'null');
        if (saved && Array.isArray(saved.events) && saved.events.length) setCfgEvents(saved.events);
        if (saved && typeof saved.story === 'string' && saved.story.trim()) setCfgStory(saved.story);
        if (saved && saved.weddingDetails && typeof saved.weddingDetails === 'object') setCfgDetails(saved.weddingDetails);
      } catch {}
      try {
        const demoCode = localStorage.getItem(lsKey('demo-code'));
        setActiveAccessCode(normalizeCode(demoCode || DEMO_ACCESS_CODE));
      } catch { setActiveAccessCode(normalizeCode(DEMO_ACCESS_CODE)); }
      setConfigLoaded(true);
      return;
    }
    const unsub = onSnapshot(doc(db, scopedPath('app_config'), 'main'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        // The guest code comes from the couple's own names unless they saved
        // one of their own: the AMARA26 placeholder never reaches the gate, and
        // a code the couple changed always wins.
        if (data.codeRevoked === true) {
          // The code was revoked: it works nowhere (posting or the private
          // feed) until the admin sets a new one.
          setActiveAccessCode('');
        } else if (data.activeAccessCode && (data.accessCodeCustom || data.activeAccessCode !== DEMO_ACCESS_CODE)) {
          setActiveAccessCode(normalizeCode(data.activeAccessCode));
        } else {
          const derivedCode = nameCode(demoBride(), demoGroom());
          if (derivedCode) setActiveAccessCode(normalizeCode(derivedCode));
        }
        if (!DEMO && Array.isArray(data.heroImages)) {
          setHeroImages(data.heroImages);
          try {
            localStorage.setItem(lsKey('hero-images'), JSON.stringify(data.heroImages));
          } catch {
            // Ignore storage quota error
          }
        }
        if (Array.isArray(data.footerImages)) {
          setFooterImages(data.footerImages);
          try {
            localStorage.setItem(lsKey('footer-images'), JSON.stringify(data.footerImages));
          } catch {
            // Ignore storage quota error
          }
        }
        if (!(() => { try { return new URLSearchParams(window.location.search).get('fs'); } catch { return null; } })() && (data.footerStyle === 'wall' || data.footerStyle === 'marquee' || data.footerStyle === 'tunnel' || data.footerStyle === 'globe')) {
          setFooterStyle(data.footerStyle);
          try { localStorage.setItem(lsKey('footer-style'), data.footerStyle); } catch {}
        }
        if (typeof data.footerThanks === 'string') {
          setFooterThanks(data.footerThanks);
          try { localStorage.setItem(lsKey('footer-thanks'), data.footerThanks); } catch {}
        }
        if (data.heroTemplate === 'classic' || data.heroTemplate === 'halo' || data.heroTemplate === 'hero' || data.heroTemplate === 'book') {
          setHeroTpl(data.heroTemplate);
          try { localStorage.setItem(lsKey('hero-tpl'), data.heroTemplate); } catch {}
        }
        if (data.accent && ACCENT_VARS[data.accent]) {
          setAccentKey(data.accent);
          try { localStorage.setItem(lsKey('accent'), data.accent); } catch {}
        }
        if (data.heroImageLabels && typeof data.heroImageLabels === 'object') setHeroImageLabels(data.heroImageLabels);
        if (Array.isArray(data.events) && data.events.length) setCfgEvents(data.events);
        if (typeof data.story === 'string' && data.story.trim()) setCfgStory(data.story);
        if (data.weddingDetails && typeof data.weddingDetails === 'object') setCfgDetails(data.weddingDetails);
        setCfgContact({
          adminWhatsapp: typeof data.adminWhatsapp === 'string' ? data.adminWhatsapp : '',
          payBankName: typeof data.payBankName === 'string' ? data.payBankName : '',
          payAccountNumber: typeof data.payAccountNumber === 'string' ? data.payAccountNumber : '',
          payAccountName: typeof data.payAccountName === 'string' ? data.payAccountName : ''
        });
        if (typeof data.archiveMode === 'boolean') setArchiveMode(data.archiveMode);
        if (Array.isArray(data.blockedUids)) setBlockedUids(data.blockedUids);
        if (Array.isArray(data.vendors)) setVendors(data.vendors);
        if (typeof data.approveGuestPosts === 'boolean') setApproveGuestPosts(data.approveGuestPosts);
        if (typeof data.feedPrivate === 'boolean') setFeedPrivate(data.feedPrivate);
        const gateGenRaw = Number(data.feedGateGen);
        setFeedGateGen(Number.isFinite(gateGenRaw) && gateGenRaw > 0 ? Math.floor(gateGenRaw) : 1);
        try { localStorage.setItem(lsKey('feed-gate-cfg'), JSON.stringify({ private: data.feedPrivate === true, gen: Number.isFinite(gateGenRaw) && gateGenRaw > 0 ? Math.floor(gateGenRaw) : 1 })); } catch {}
        if (data.feedActionMode === 'download' || data.feedActionMode === 'share') setFeedActionMode(data.feedActionMode);
        if (typeof data.pushEnabled === 'boolean') setPushEnabled(data.pushEnabled);
        if (Array.isArray(data.postAds)) {
          setPostAds(data.postAds);
          const copy = [...data.postAds];
          for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
          }
          setShuffledPostAds(copy);
        }
        if (Array.isArray(data.reelAds)) {
          setReelAds(data.reelAds);
          const copy = [...data.reelAds];
          for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
          }
          setShuffledReelAds(copy);
        }
      }
      setConfigLoaded(true);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'app_config/main');
      console.error("Config sync error:", err);
      setConfigLoaded(true); // Still set loaded to stop spinners, but activeAccessCode will remain null
    });
    return () => unsub();
  }, []);

  // 2c. Residents (guest profiles + vendor requests). Public read per rules.
  useEffect(() => {
    const unsub = onSnapshot(collection(db, scopedPath('residents')), (snap) => {
      const arr: any[] = [];
      snap.forEach((d) => arr.push({ uid: d.id, ...d.data() }));
      setResidents(arr);
    }, (err) => {
      console.error('Residents sync error:', err);
      setResidents([]);
    });
    return () => unsub();
  }, []);

  // 2b. Initialize Config (Admin only)
  useEffect(() => {
    if (DEMO) return;
    if (!isAdmin || !isAdminSessionValid) return;
    
    const initConfig = async () => {
      try {
        const snap = await getDoc(doc(db, scopedPath('app_config'), 'main'));
        const derived = (demoBride() && demoGroom()) ? nameCode(demoBride(), demoGroom()) : '';
        // Seed or repair the guest code from the couple's own names whenever it
        // is still the AMARA26 placeholder or missing; a code the couple saved
        // (accessCodeCustom) or an earlier derived code is left untouched.
        if (snap.exists() && !snap.data().accessCodeCustom && !snap.data().codeRevoked && derived
            && (snap.data().activeAccessCode === DEMO_ACCESS_CODE || !snap.data().activeAccessCode)) {
          await setDoc(doc(db, scopedPath('app_config'), 'main'), { activeAccessCode: derived }, { merge: true });
        }
        if (!snap.exists()) {
          await setDoc(doc(db, scopedPath('app_config'), 'main'), {
            activeAccessCode: derived || DEMO_ACCESS_CODE,
            createdAt: serverTimestamp(),
            events: eventsData().map((e) => ({ ...e, status: seedEventStatuses(eventsData())[e.id] })),
            story: demoStory(),
            weddingDetails: detailsData(),
            heroImages: demoHeroImages()
          });
        } else if (!Array.isArray(snap.data().events)) {
          await setDoc(doc(db, scopedPath('app_config'), 'main'), {
            events: eventsData().map((e) => ({ ...e, status: seedEventStatuses(eventsData())[e.id] })),
            story: snap.data().story || demoStory(),
            weddingDetails: snap.data().weddingDetails || detailsData()
          }, { merge: true });
        }

      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'app_config/main');
        console.error("Config initialization error:", err);
      }
    };
    
    initConfig();

    // Also sync all admins if super admin
    if (user?.email === "justfashion414@gmail.com") {
      const unsubAdmins = onSnapshot(collection(db, scopedPath('admins')), (snap) => {
        setAllAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      const unsubDeleted = onSnapshot(collection(db, scopedPath('deleted_posts')), (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setDeletedPosts(docs);
        
        // Auto-purge posts older than 3 days
        const now = Date.now();
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        docs.forEach(async (dp: any) => {
          const deletedAt = dp.deletedAt?.toDate?.() || new Date(dp.deletedAt);
          if (now - deletedAt.getTime() > threeDaysMs) {
            try {
              await deleteDoc(doc(db, scopedPath('deleted_posts'), dp.id));
              console.log("Auto-purged old deleted post:", dp.id);
            } catch (err) {
              console.error("Purge error:", err);
            }
          }
        });
      });

      return () => {
        unsubAdmins();
        unsubDeleted();
      };
    } else if (isAdmin) {
      // Every admin of this app needs the admins collection, not just the
      // platform owner: it carries their own role doc (which locks a
      // restricted role like a photographer down to the Vendor albums tab)
      // and the team list the owner reads from.
      const unsubAdmins = onSnapshot(collection(db, scopedPath('admins')), (snap) => {
        setAllAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      const unsubDeleted = onSnapshot(collection(db, scopedPath('deleted_posts')), (snap) => {
        setDeletedPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => { unsubAdmins(); unsubDeleted(); };
    }
  }, [isAdmin, isAdminSessionValid, user]);

  // Handle Admin Login (email & password)
  const handleAdminLogin = async (email: string, password: string) => {
    setAuthError('');
    setAuthBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      // Only an administrator of THIS app may enter its dashboard. Anyone
      // else (the Eventicor console owner, a couple from another app, a
      // stray account) is signed straight back out and gets the same
      // message a wrong password gets, so valid-but-unauthorized
      // credentials can never hang at a loader or reveal that they exist.
      const mail = String(cred.user?.email || email.trim()).trim();
      const candidates: string[] = Array.from(new Set([mail, mail.toLowerCase()].filter(Boolean)));
      let admitted = false;
      let lookupErr: any = null;
      for (const cand of candidates) {
        try {
          const adm = await getDoc(doc(db, scopedPath('admins'), cand));
          if (adm.exists()) { admitted = true; break; }
        } catch (e: any) {
          // The rules refuse an admins read to anyone who is not an admin of
          // this app: that denial is itself the answer. Anything else
          // (offline, throttled) leaves the check unproven.
          if (String(e?.code || '').includes('permission-denied')) continue;
          lookupErr = e; break;
        }
      }
      if (!admitted) {
        doSignOut();
        if (lookupErr) setAuthError('Network problem. Check your connection and try again.');
        else setAuthError('Email or password is incorrect.');
        return;
      }
      setAuthScreen(null);
      setAuthPassword('');
      setAuthEmail('');
      if (shortcutLoginRef.current) { shortcutLoginRef.current = false; goAdminPage(); }
    } catch (err: any) {
      const code = err?.code || '';
      if (code.includes('wrong-password') || code.includes('user-not-found') || code.includes('invalid-credential')) {
        setAuthError('Email or password is incorrect.');
      } else if (code.includes('too-many-requests')) {
        setAuthError('Too many attempts. Try again in a moment.');
      } else if (code.includes('invalid-email') || code.includes('missing-password')) {
        setAuthError('Enter the email and password exactly as they appear in your login email.');
      } else if (code.includes('network')) {
        setAuthError('Network problem. Check your connection and try again.');
      } else {
        setAuthError(`Could not sign in${code ? ` (${code})` : ''}. Please try again.`);
      }
    } finally {
      setAuthBusy(false);
    }
  };


  const handleForgotPassword = async (email: string) => {
    setAuthError('');
    setAuthBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setAuthScreen('sent');
    } catch (err: any) {
      const code = err?.code || '';
      setAuthError(code.includes('user-not-found') ? 'No account found for that email.' : 'Could not send the reset email. Please try again.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSetPermanentPassword = async () => {
    if (newPassword.length < 6) { setAuthError('Use at least 6 characters.'); return; }
    if (newPassword !== confirmNewPassword) { setAuthError('The two passwords do not match.'); return; }
    setAuthError('');
    setSetPasswordBusy(true);
    try {
      if (user) await updatePassword(user, newPassword);
      if (user?.email) await setDoc(doc(platformDb, scopedPath('admins'), user.email), { mustSetPassword: false, status: 'active' }, { merge: true });
      setMustSetPassword(false);
      setNewPassword('');
      setConfirmNewPassword('');
      showToast('Permanent password saved. Welcome in!', 'success');
      if (shortcutLoginRef.current) { shortcutLoginRef.current = false; goAdminPage(); }
    } catch (err) {
      console.error('Set password error:', err);
      setAuthError('Could not update the password. Sign out, sign in again, then try.');
    } finally {
      setSetPasswordBusy(false);
    }
  };

  const handleLogout = () => doSignOut();

  // Derived wedding content: Firestore values when the couple has saved them,
  // seeded defaults before their first save.
  // Stable identities: these wrap in useMemo so the dashboard draft-sync
  // effects only re-run when saved data actually changes. A fresh object per
  // render used to reset the details form while the couple was still typing,
  // so edits in Events & details snapped back before they could save.
  const EVENTS: WeddingEvent[] = useMemo(() => (cfgEvents && cfgEvents.length ? cfgEvents : eventsData()), [cfgEvents]);
  const STORY: string = cfgStory && cfgStory.trim() ? cfgStory : demoStory();
  const DETAILS: any = useMemo(() => withDerivedHashtag(withGiftDefaults(cfgDetails || detailsData())), [cfgDetails]);
  const EVENTS_VIS: WeddingEvent[] = EVENTS.filter((e: any) => !e.hidden);
  const HIDDEN_SECTIONS: string[] = (DETAILS && DETAILS.hiddenSections) || [];

  // The couple's chosen wedding day wins: the church service, else the
  // reception, else the latest saved event date. Until they save anything,
  // the seeded date shows.
  {
    const ov = DEMO ? leadOverride() : null;
    const church = EVENTS.find((e: any) => e.id === 'church');
    const reception = EVENTS.find((e: any) => e.id === 'reception');
    const latestDate = EVENTS.map((e: any) => e.date).filter(Boolean).sort().pop() as string | undefined;
    // The couple's chosen wedding day wins: the date they picked when their
    // app was created, then the church service, else the reception, else the
    // latest saved event date. Before anything is saved, the seeded date shows.
    const wed = ((ov?.weddingDate || church?.date || reception?.date || latestDate) as string | undefined);
    recomputeWed(wed, ov?.weddingTime || church?.time || reception?.time || undefined);
  }
  const heroTemplate = heroTpl || template || 'classic';
  const _heroWed = new Date(`${WEDDING_DATE}T12:00:00`);
  const heroDateShort = _heroWed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const _hpd = (x: number) => (x < 10 ? '0' : '') + x;
  const heroDotDate = `${_hpd(_heroWed.getDate())} · ${_hpd(_heroWed.getMonth() + 1)} · ${_heroWed.getFullYear()}`;
  const vendorRequests = residents.filter((r: any) => r?.vendorRequest && r.vendorRequest.status === 'pending');

  const updateAccessCode = async (newCode: string) => {
    if (DEMO) {
      const normalizedDemo = normalizeCode(newCode);
      if (!normalizedDemo || normalizedDemo.length < 4) return;
      setActiveAccessCode(normalizedDemo);
      try { localStorage.setItem(lsKey('demo-code'), normalizedDemo); } catch {}
      showToast('Access code saved for this preview.');
      return;
    }
    if (!isAdmin || !adminPermissions?.canSetAccessCode) return;
    const normalized = normalizeCode(newCode);
    if (!normalized || normalized.length < 4) return;

    try {
      await setDoc(doc(db, scopedPath('app_config'), 'main'), {
        activeAccessCode: normalized,
        accessCodeCustom: true,
        codeRevoked: false,
        feedGateGen: feedGateGen + 1,
        lastUpdated: serverTimestamp()
      }, { merge: true });
      
      showToast('Access code updated successfully!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'app_config/main');
      console.error("Update code error:", err);
      showToast('Failed to update access code.', 'error');
    }
  };

  const updateWedding = async (events: WeddingEvent[], story: string, details: any) => {
    if (DEMO) {
      try { localStorage.setItem(lsKey('demo-cfg'), JSON.stringify({ events, story, weddingDetails: details })); } catch {}
      setCfgEvents(events); setCfgStory(story); setCfgDetails(details);
      showToast('Saved for this preview.');
      return;
    }
    if (!isAdmin || !isAdminSessionValid) {
      showToast('Sign in again to save your changes.', 'error');
      return;
    }
    try {
      await setDoc(doc(db, scopedPath('app_config'), 'main'), {
        events,
        story,
        weddingDetails: details,
        lastUpdated: serverTimestamp()
      }, { merge: true });
      setCfgEvents(events);
      setCfgStory(story);
      setCfgDetails(details);
      showToast('Saved. Guests see this on the Home screen.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'app_config/main');
      console.error('Update wedding details error:', err);
      showToast('Failed to save changes.', 'error');
    }
  };

  const updatePeople = async (patch: { vendors?: string[]; blockedUids?: string[] }) => {
    if (!isAdmin || !adminPermissions?.canSetAccessCode) { showToast('You do not have permission for that.', 'error'); return; }
    try {
      await setDoc(doc(db, scopedPath('app_config'), 'main'), { ...patch, lastUpdated: serverTimestamp() }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'app_config/main');
      showToast('Failed to update.', 'error');
    }
  };

  const handleVendorRequest = async (uid: string, name: string, approve: boolean) => {
    if (!isAdmin || !adminPermissions?.canSetAccessCode) { showToast('You do not have permission for that.', 'error'); return; }
    try {
      const next = approve ? Array.from(new Set([...(vendors || []), uid])) : (vendors || []).filter((u: any) => u !== uid);
      await setDoc(doc(db, scopedPath('app_config'), 'main'), { vendors: next, lastUpdated: serverTimestamp() }, { merge: true });
      try {
        await updateDoc(doc(db, scopedPath('residents'), uid), { vendorRequest: { status: approve ? 'approved' : 'declined', decidedAt: serverTimestamp() } });
      } catch (err: any) {
        console.error('Vendor request status update needs superadmin:', err?.message || err);
      }
      showToast(approve ? `${name} is now an official vendor.` : 'Request declined.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'app_config/main');
      showToast('Could not update the vendor request.', 'error');
    }
  };

  const updateAppConfigFlags = async (patch: Record<string, any>, okMsg = 'Setting saved.') => {
    if (DEMO) { showToast('Saved for this preview.'); return; }
    if (!isAdmin || !adminPermissions?.canSetAccessCode) { showToast('You do not have permission for that.', 'error'); return; }
    try {
      await setDoc(doc(db, scopedPath('app_config'), 'main'), { ...patch, lastUpdated: serverTimestamp() }, { merge: true });
      if (patch.approveGuestPosts === false) {
        // Approval switched off: every post becomes visible to everybody, so
        // clear the waiting flag on anything still pending right away.
        try {
          const waiting = await getDocs(query(collection(db, scopedPath('posts')), where('pending', '==', true)));
          if (!waiting.empty) {
            const batch = writeBatch(db);
            waiting.forEach((d) => batch.update(d.ref, { pending: false }));
            await batch.commit();
          }
        } catch (sweepErr) { console.error('approve-off sweep failed', sweepErr); }
      }
      showToast(okMsg);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'app_config/main');
      showToast('Failed to save the setting.', 'error');
    }
  };

  // Private feed: the admin's private/public toggle. The feed page shows the
  // entry banner live on every guest device; the banner asks for the guest
  // access code and the server confirms it.
  const updateFeedPrivacy = async (publicNow: boolean) => {
    const makePrivate = !publicNow;
    if (DEMO) {
      setFeedPrivate(makePrivate);
      if (makePrivate) setFeedGateGen(g => g + 1);
      showToast(makePrivate ? 'Going forward, the feed and the settings in the app will not be visible to the guest anymore.' : 'Your feed is public again. Every guest can see it.');
      return;
    }
    if (!isAdmin || !adminPermissions?.canSetAccessCode) { showToast('You do not have permission for that.', 'error'); return; }
    try {
      // Toggling the feed private disconnects EVERY device that was granted
      // access, live, whether the access code was revoked before or not: the
      // gen bump sends them all back to the banner the moment it lands.
      const patch: Record<string, any> = { feedPrivate: makePrivate, lastUpdated: serverTimestamp() };
      if (makePrivate) patch.feedGateGen = feedGateGen + 1;
      await setDoc(doc(db, scopedPath('app_config'), 'main'), patch, { merge: true });
      showToast(makePrivate ? 'Going forward, the feed and the settings in the app will not be visible to the guest anymore.' : 'Your feed is public again. Every guest can see it.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'app_config/main');
      showToast('Failed to save the setting.', 'error');
    }
  };

  // Revoke wipes the one shared guest access code everywhere at once: it stops
  // working for posting AND for entering the private feed, every device that
  // was granted goes back to the feed banner live, and the field is cleared so
  // the admin must set a new code before anything code-gated works again.
  const revokeAccessCode = async () => {
    if (DEMO) { setActiveAccessCode(''); showToast('Access code revoked for this preview. Set a new one.'); return; }
    if (!isAdmin || !adminPermissions?.canSetAccessCode) { showToast('You do not have permission for that.', 'error'); return; }
    try {
      await setDoc(doc(db, scopedPath('app_config'), 'main'), {
        activeAccessCode: '',
        accessCodeCustom: true,
        codeRevoked: true,
        feedGateGen: feedGateGen + 1,
        lastUpdated: serverTimestamp()
      }, { merge: true });
      showToast('Access code revoked. It no longer works for posting or the private feed. Set a new code.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'app_config/main');
      showToast('Failed to revoke the access code.', 'error');
    }
  };

  // The guest side of the gate: the banner tap opens this, and the code is
  // confirmed on the server, never in the browser.
  const submitGateCode = async () => {
    const code = gateInput.trim().toUpperCase();
    if (!code) { showToast('Enter the access code.', 'error'); return; }
    setGateBusy(true);
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'feed-gate', appId: APP_ID, code })
      });
      const gateData = await res.json().catch(() => null);
      if (res.ok && gateData && gateData.ok) {
        const gen = Number(gateData.gen) || 0;
        try { localStorage.setItem(lsKey('feed-gate'), String(gen)); } catch { /* private mode */ }
        setFeedGranted(gen);
        setShowLaunchSplash(false);
        try { sessionStorage.setItem('ev-entered', '1'); } catch { /* private mode */ }
      } else if (gateData && gateData.error === 'no-code') {
        showToast('The couple has not set an access code yet. Ask them for one.', 'error');
      } else {
        showToast('Access code is incorrect or invalid.', 'error');
      }
    } catch {
      showToast('We could not check that code right now. Try again.', 'error');
    } finally {
      setGateBusy(false);
    }
  };

  // Saves the label attached to each hero photo (url -> event name).
  const updateHeroLabels = async (map: Record<string, string>) => {
    setHeroImageLabels(map);
    try {
      await setDoc(doc(db, scopedPath('app_config'), 'main'), { heroImageLabels: map, lastUpdated: serverTimestamp() }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'app_config/main');
      showToast('Could not save the label.', 'error');
    }
  };

  // Saves one section of the wedding details (story, details or events) on its
  // own, used by the per-section Save buttons in the console's Events & details tab.
  const updateWeddingSection = async (patch: Record<string, any>) => {
    if (DEMO) {
      try {
        const cur = JSON.parse(localStorage.getItem(lsKey('demo-cfg')) || '{}');
        localStorage.setItem(lsKey('demo-cfg'), JSON.stringify({ ...cur, ...patch }));
      } catch {}
      if ('events' in patch) setCfgEvents(patch.events);
      if ('story' in patch) setCfgStory(patch.story);
      if ('weddingDetails' in patch) setCfgDetails(patch.weddingDetails);
      showToast('Saved for this preview.');
      return;
    }
    if (!isAdmin || !isAdminSessionValid) {
      showToast('Sign in again to save your changes.', 'error');
      return;
    }
    try {
      await setDoc(doc(db, scopedPath('app_config'), 'main'), { ...patch, lastUpdated: serverTimestamp() }, { merge: true });
      if ('events' in patch) setCfgEvents(patch.events);
      if ('story' in patch) setCfgStory(patch.story);
      if ('weddingDetails' in patch) setCfgDetails(patch.weddingDetails);
      showToast('Saved. Guests see this on the Home screen.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'app_config/main');
      showToast('Could not save. Please try again.', 'error');
    }
  };

  // Giant footer style (dashboard setting; couples pick the look).
  const updateFooterStyle = async (style: 'wall' | 'marquee' | 'tunnel' | 'globe', quiet = false, thanks?: string) => {
    setFooterStyle(style);
    try { localStorage.setItem(lsKey('footer-style'), style); } catch {}
    if (typeof thanks === 'string') {
      setFooterThanks(thanks);
      try { localStorage.setItem(lsKey('footer-thanks'), thanks); } catch {}
    }
    if (DEMO) { if (!quiet) showToast('Giant footer style saved for this preview.'); return; }
    if (!isAdmin) return;
    try {
      await setDoc(doc(db, scopedPath('app_config'), 'main'), { footerStyle: style, ...(typeof thanks === 'string' ? { footerThanks: thanks } : {}), lastUpdated: serverTimestamp() }, { merge: true });
      if (!quiet) showToast('Giant footer style saved.');
    } catch (err) {
      console.error('Update footer style error:', err);
      showToast('Failed to save the footer style.', 'error');
    }
  };

  // Hero style (dashboard setting): which of the four hero designs the app
  // shows. The four templates differ only by their hero, so this switches the
  // look without touching anything else.
  const updateHeroTemplate = async (t: 'classic' | 'halo' | 'hero' | 'book', quiet = false) => {
    setHeroTpl(t);
    try { localStorage.setItem(lsKey('hero-tpl'), t); } catch {}
    if (DEMO) { if (!quiet) showToast('Hero style saved for this preview.'); return; }
    if (!isAdmin) return;
    try {
      await setDoc(doc(db, scopedPath('app_config'), 'main'), { heroTemplate: t, lastUpdated: serverTimestamp() }, { merge: true });
      if (!quiet) showToast('Hero style saved.');
    } catch (err) {
      console.error('Update hero style error:', err);
      showToast('Failed to save the hero style.', 'error');
    }
  };

  // Accent color (dashboard setting): which of the six Eventicor accents the
  // app is dressed in. Same pattern as the hero style: chosen live, saved to
  // app_config for real apps, local for demo previews.
  const [accentKey, setAccentKey] = useState<string>(() => {
    try { const sv = localStorage.getItem(lsKey('accent')); if (sv && ACCENT_VARS[sv]) return sv; } catch { /* ignore */ }
    return TPL_DEFAULT_ACCENT[(template as any) || 'classic'] || 'midnight';
  });
  const updateAccent = async (k: string, quiet = false) => {
    if (!ACCENT_VARS[k]) return;
    setAccentKey(k);
    try { localStorage.setItem(lsKey('accent'), k); } catch { /* ignore */ }
    if (DEMO) { if (!quiet) showToast('Accent color saved for this preview.'); return; }
    if (!isAdmin) return;
    try {
      await setDoc(doc(db, scopedPath('app_config'), 'main'), { accent: k, lastUpdated: serverTimestamp() }, { merge: true });
      if (!quiet) showToast('Accent color saved.');
    } catch (err) {
      console.error('Update accent error:', err);
      showToast('Failed to save the accent color.', 'error');
    }
  };

  // Journey step photos: the couple attaches up to 2 photos per event step,
  // from the dropdown on Home or from the dashboard journey settings.
  const saveEventStepPhotos = async (eventId: string, images: string[]) => {
    const next = (EVENTS as any[]).map((e: any) => (e.id === eventId ? { ...e, images } : e));
    setCfgEvents(next as any);
    if (DEMO) {
      try {
        const cur = JSON.parse(localStorage.getItem(lsKey('demo-cfg')) || '{}');
        localStorage.setItem(lsKey('demo-cfg'), JSON.stringify({ ...cur, events: next }));
      } catch {}
      showToast('Saved for this preview.');
      return;
    }
    try {
      await setDoc(doc(db, scopedPath('app_config'), 'main'), { events: next, lastUpdated: serverTimestamp() }, { merge: true });
      showToast('Event photos saved.');
    } catch (err) {
      console.error('Update event photos error:', err);
      showToast('Failed to save the event photos.', 'error');
    }
  };


  const approvePost = async (postId: string) => {
    try {
      await updateDoc(doc(db, scopedPath('posts'), postId), { pending: false });
      showToast('Approved. Guests can now see it', 'success');
    } catch (err) {
      console.error(err);
      showToast('Could not approve the post.', 'error');
    }
  };

  /**
   * Shares a post through the device's native share sheet where one exists,
   * falling back to the in-app ShareSheet (WhatsApp / copy link / X).
   */
  const sharePost = async (p: any) => {
    const url = `${window.location.origin}${window.location.pathname}?post=${p.id}`;
    const title = p.text || p.caption || demoText('A memory from Amara & Daniel');
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try { await (navigator as any).share({ title: demoHeader(), text: title, url }); return; } catch { return; }
    }
    setSharingPost(p);
  };

  /**
   * Downloads a post's or reel's media files straight to the guest's device,
   * one file at a time. This backs the "Download" mode of the feed action
   * button, which the admin turns on in the console Settings tab
   * (app_config/main.feedActionMode). Cloudinary files are served with open
   * CORS headers, so a plain fetch works for both images and videos; a short
   * pause between files keeps mobile browsers from blocking the batch.
   */
  const downloadMediaFiles = async (urls: string[], types: any[] | undefined, baseName = 'dara-femi-memory') => {
    const list = Array.isArray(urls) ? urls.filter(Boolean) : [];
    if (!list.length) { showToast('There is no photo or video on this post to download.', 'error'); return; }
    showToast(list.length > 1 ? 'Downloading files…' : 'Downloading…');
    let ok = 0;
    for (let i = 0; i < list.length; i++) {
      try {
        const res = await fetch(list[i]);
        if (!res.ok) continue;
        const blob = await res.blob();
        const u = list[i];
        const isVideo = types?.[i] === 'video' || u.toLowerCase().includes('.mp4') || u.toLowerCase().includes('.webm') || u.toLowerCase().includes('.mov') || u.includes('/video/');
        const ext = isVideo ? 'mp4' : (u.split('?')[0].split('.').pop() || 'jpg').slice(0, 5);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${baseName}${list.length > 1 ? `-${i + 1}` : ''}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        ok += 1;
        if (list.length > 1) await new Promise((r) => setTimeout(r, 400));
      } catch (err) {
        console.error('Media download failed:', err);
      }
    }
    showToast(ok ? `Saved ${ok} ${ok === 1 ? 'file' : 'files'} to your device.` : 'Could not download the files. Please try again.', ok ? 'success' : 'error');
  };


  const deleteAllGuestData = async () => {
    if (!isAdmin || adminPermissions?.canDeletePosts === false) { showToast('You do not have permission to delete posts.', 'error'); return; }
    try {
      const snap = await getDocs(collection(db, scopedPath('posts')));
      let n = 0;
      for (const d of snap.docs) {
        await deleteDoc(doc(db, scopedPath('posts'), d.id));
        n += 1;
      }
      showToast(`Deleted ${n} ${n === 1 ? 'post' : 'posts'}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'posts');
      showToast('Could not delete everything.', 'error');
    }
  };

  const downloadEverything = async () => {
    if (!posts.length) { showToast('Nothing to download yet.'); return; }
    try {
      showToast('Preparing your zip…');
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      let n = 0;
      for (const p of posts) {
        const evName = (EVENTS.find((e) => e.id === p.eventId)?.name || 'Other memories').replace(/[^\w -]/g, '').trim() || 'Other memories';
        const folder = zip.folder(evName) || zip;
        const urls: string[] = Array.isArray(p.mediaUrls) ? p.mediaUrls : (p.mediaUrl ? [p.mediaUrl] : []);
        for (const u of urls) {
          try {
            const res = await fetch(u);
            if (!res.ok) continue;
            const blob = await res.blob();
            const ext = (u.split('?')[0].split('.').pop() || 'jpg').slice(0, 5);
            folder.file(`${(p.authorName || 'guest').replace(/[^\w -]/g, '') || 'guest'}-${p.id}-${n}.${ext}`, blob);
            n += 1;
          } catch { /* skip a file that will not fetch */ }
        }
        if (!urls.length && (p.text || p.caption)) folder.file(`${p.id}.txt`, String(p.text || p.caption));
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'dara-femi-memories.zip';
      a.click();
      URL.revokeObjectURL(a.href);
      showToast(`Downloaded ${n} ${n === 1 ? 'file' : 'files'}.`);
    } catch (err) {
      console.error('Download everything failed:', err);
      showToast('Could not build the zip. Try again on a desktop browser.', 'error');
    }
  };

  const createMemoryBook = () => {
    const win = window.open('', '_blank');
    if (!win) { showToast('Allow pop-ups to create the memory book.', 'error'); return; }
    const esc = (s: any) => String(s || '').replace(/[&<>"]/g, (c: string) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    const cards = posts.slice(0, 200).map((p: any) => {
      const evName = EVENTS.find((e) => e.id === p.eventId)?.name || '';
      const img = p.mediaUrls && p.mediaUrls[0] ? `<img src="${esc(p.mediaUrls[0])}" alt="" />` : '';
      const txt = p.text || p.caption || '';
      return `<section class="card"><header><b>${esc(p.authorName || 'A guest')}</b><span>${esc(evName)}</span></header>${img}<p>${esc(txt)}</p></section>`;
    }).join('');
    win.document.write(`<!doctype html><html><head><title>${esc(demoHeader())} memory book</title><style>body{font-family:Georgia,serif;max-width:720px;margin:0 auto;padding:32px;color:#14262D}h1{font-size:34px;margin:0}p.sub{color:#5A6970;font-family:Arial,sans-serif;margin:6px 0 28px}.card{border:1px solid #DAD8E3;border-radius:14px;padding:16px;margin-bottom:18px;page-break-inside:avoid}.card header{display:flex;justify-content:space-between;font-family:Arial,sans-serif;margin-bottom:8px}.card header span{color:var(--ann-accent);font-size:12px;text-transform:uppercase;letter-spacing:1px}.card img{width:100%;border-radius:10px;margin-bottom:8px}.card p{margin:0;line-height:1.5}</style></head><body><h1>${esc(demoHeader())}</h1><p class="sub">Wedding memories &middot; ${esc(DETAILS.hashtag)}</p>${cards}</body></html>`);
    win.document.close();
  };

  // Post lifecycle (delete / restore / erase) runs through the server admin
  // endpoint, which verifies the caller's admins doc, then moves or removes
  // the Firestore docs and purges the post's Cloudinary files.
  const adminPostAction = async (action: 'delete' | 'restore' | 'erase', postId: string) => {
    if (!user) throw new Error('Sign in required.');
    const idToken = await user.getIdToken();
    const res = await fetch('/api/admin-post-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ action, postId, appId: APP_ID })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Action failed.');
    return data;
  };

  // Delete Post (Move to Recycle Bin)
  const handleDeletePost = async (postId: string) => {
    if (!isAdmin) {
      showToast("Permission denied for deletion.", "error");
      return;
    }
    try {
      const data = await adminPostAction('delete', postId);
      const purged = data?.media?.purged || 0;
      showToast(purged > 0 ? `Post moved to recycle bin (${purged} file${purged === 1 ? '' : 's'} removed from Cloudinary)` : 'Post moved to recycle bin');
    } catch (err: any) {
      console.error("Delete error:", err);
      showToast(err?.message || "Failed to move post to bin.", "error");
    }
  };

  // Restore Post
  const handleRestorePost = async (postId: string) => {
    if (!isAdmin) return;
    try {
      await adminPostAction('restore', postId);
      showToast('Post restored to feed');
    } catch (err: any) {
      console.error("Restore error:", err);
      showToast(err?.message || "Failed to restore post.", "error");
    }
  };

  // Permanent Delete
  const handlePermanentDelete = async (postId: string) => {
    if (!isAdmin) return;
    try {
      const data = await adminPostAction('erase', postId);
      const purged = data?.media?.purged || 0;
      showToast(purged > 0 ? `Post permanently erased (${purged} file${purged === 1 ? '' : 's'} removed from Cloudinary)` : 'Post permanently erased');
    } catch (err: any) {
      console.error("Erase error:", err);
      showToast(err?.message || "Failed to erase post.", "error");
    }
  };

  // 3. Handle Posts Sync
  useEffect(() => {
    if (DEMO) {
      setPosts(demoSeedPosts() as any); setIsPostsLoading(false); return;
    } // Previews read seeded demo posts only
    // The seed content stays ONLY until the couple's first real post; after
    // that it is gone for good. Three layers hold that:
    //   1. a real post is remembered per device (lsKey('feed-real')), so a
    //      stale, failed or empty snapshot can never resurrect the samples;
    //   2. a cache-only empty snapshot is ignored (the loader stays up) until
    //      the server answers, so a slow connection never flashes placeholders;
    //   3. ordering happens on the client, so a post without a timestamp field
    //      still shows instead of silently vanishing from an ordered query.
    // A post waiting for approval is visible only to its author and to admins
    // signed into this app (user direction Nov 21 2026). The security rules
    // enforce that in the database and refuse any query they cannot prove, so
    // the feed listens with provable queries: signed-in admins read everything
    // unfiltered; everyone else reads approved posts plus their own waiting one.
    let haveServer = false;
    const seededAtBoot = (() => { try { return localStorage.getItem(lsKey('feed-real')) === '1'; } catch { return false; } })();
    const realDocs = (docs: any[]) => docs.filter((p: any) => !p.localDemo && !String(p.id || '').startsWith('demo-seed-') && !String(p.id || '').startsWith('sample-'));
    const apply = (docs: any[], answered: boolean, fromCache: boolean) => {
      if (realDocs(docs).length > 0) {
        haveServer = true;
        try { localStorage.setItem(lsKey('feed-real'), '1'); } catch { /* private mode */ }
        setFeedReal(true);
        setPosts(docs.slice().sort((a: any, b: any) => ((b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0))));
        setIsPostsLoading(false);
      } else if (answered && !fromCache) {
        // The server itself says there is nothing real here.
        haveServer = true;
        if (seededAtBoot) {
          // This account posted before. Sample content never returns.
          setFeedReal(true);
          setPosts([]);
        } else {
          // Until the couple's first real post, a real app shows the same lively
          // seed content sample apps get: their names, their hero photos and the
          // demo reels. The first real post replaces all of it.
          setFeedReal(false);
          setPosts(demoSeedPosts() as any);
        }
        setIsPostsLoading(false);
      }
      // A cache-only snapshot with nothing real keeps the loader up and waits
      // for the server; a stale cached empty view must never become the feed.
    };
    const bail = window.setTimeout(() => {
      if (haveServer) return;
      if (seededAtBoot) { setFeedReal(true); setPosts([]); }
      else { setPosts(demoSeedPosts() as any); }
      setIsPostsLoading(false);
    }, 10000);
    const onErr = (err: any) => {
      handleFirestoreError(err, OperationType.LIST, 'posts');
      if (seededAtBoot) setFeedReal(true);
      if (!haveServer) {
        setPosts((prev: any[]) => (realDocs(prev).length > 0 ? prev : (seededAtBoot ? [] : (demoSeedPosts() as any))));
      }
      setIsPostsLoading(false);
    };
    const unsubs: Array<() => void> = [];
    if (isAdmin && user && !user.isAnonymous) {
      const unsub = onSnapshot(collection(db, scopedPath('posts')), (snapshot) => {
        apply(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })), true, !!(snapshot as any).metadata?.fromCache);
      }, onErr);
      unsubs.push(unsub);
    } else {
      // Two provable queries: everything approved, plus this viewer's own
      // post that is still waiting for approval (shown with the tag).
      const myUid = user?.uid || '';
      let docsApproved: any[] = [];
      let docsMine: any[] = [];
      let gotApproved = false;
      let gotMine = myUid ? false : true;
      let cacheApproved = false; let cacheMine = false;
      const flush = () => {
        const seen = new Set<string>();
        const merged: any[] = [];
        for (const d of [...docsApproved, ...docsMine]) { if (seen.has(d.id)) continue; seen.add(d.id); merged.push(d); }
        apply(merged, gotApproved && gotMine, cacheApproved || cacheMine);
      };
      unsubs.push(onSnapshot(query(collection(db, scopedPath('posts')), where('pending', '==', false)), (snapshot) => {
        docsApproved = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        cacheApproved = !!(snapshot as any).metadata?.fromCache;
        if (!cacheApproved) gotApproved = true;
        flush();
      }, onErr));
      if (myUid) {
        unsubs.push(onSnapshot(query(collection(db, scopedPath('posts')), where('pending', '==', true), where('authorUid', '==', myUid)), (snapshot) => {
          docsMine = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          cacheMine = !!(snapshot as any).metadata?.fromCache;
          if (!cacheMine) gotMine = true;
          flush();
        }, onErr));
      }
    }
    return () => { window.clearTimeout(bail); unsubs.forEach((u) => { try { u(); } catch { /* already closed */ } }); };
  }, [isAdmin, user?.uid]);

  // Wake refresh: when the app has sat in the background a long while and the
  // visitor comes back, the Firestore connection can be dormant with every
  // live listener showing stale data. Cycling the network re-opens it and
  // every onSnapshot re-emits fresh data, so the app updates itself instead
  // of waiting for a manual refresh.
  useEffect(() => {
    if (DEMO) return;
    let hiddenAt = 0;
    const wake = () => {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      const away = hiddenAt ? Date.now() - hiddenAt : 0;
      hiddenAt = 0;
      if (away > 30000) {
        try {
          disableNetwork(db as any).then(() => enableNetwork(db as any)).catch(() => {});
          disableNetwork(platformDb as any).then(() => enableNetwork(platformDb as any)).catch(() => {});
        } catch { /* the wake cycle is best effort */ }
      }
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
    };
  }, []);

  // Footer grid: newest posted images replace the placeholder cells first,
  // then admin-set images, then the placeholders.
  const postFeedImages = useMemo(() => {
    const imgs: string[] = [];
    for (const p of posts as any[]) {
      if (p.pending) continue;
      const urls: string[] = Array.isArray(p.mediaUrls) ? p.mediaUrls : (p.mediaUrl ? [p.mediaUrl] : []);
      urls.forEach((u: string, i: number) => {
        if (typeof u === 'string' && (u.startsWith('http') || u.startsWith('/')) && (p.mediaTypes?.[i] || 'image') !== 'video' && !imgs.includes(u)) imgs.push(u);
      });
    }
    return imgs;
  }, [posts]);
  // The giant footer is never hand-picked: it starts as placeholders of the
  // hero images, and the newest approved feed images (guests and couple alike)
  // replace tiles one after another, newest first, rolling forward as more
  // posts arrive until every tile has come from the feed.
  const footerPool = useMemo(
    () => {
      let feed: string[] = [];
      if (DEMO) {
        feed = demoFeedImages();
      } else {
        const newestFirst = [...(posts as any[])].sort((a, b) => {
          const ta = a?.createdAt?.seconds ?? (typeof a?.timestamp === 'number' ? a.timestamp : (a?.timestamp?.seconds ?? 0));
          const tb = b?.createdAt?.seconds ?? (typeof b?.timestamp === 'number' ? b.timestamp : (b?.timestamp?.seconds ?? 0));
          return tb - ta;
        });
        for (const p of newestFirst) {
          if (feed.length >= 40) break;
          if (p.pending) continue;
          const urls: string[] = Array.isArray(p.mediaUrls) ? p.mediaUrls : (p.mediaUrl ? [p.mediaUrl] : []);
          urls.forEach((u: string, i: number) => {
            if (feed.length < 40 && typeof u === 'string' && (u.startsWith('http') || u.startsWith('/')) && (p.mediaTypes?.[i] || 'image') !== 'video' && !feed.includes(u)) feed.push(u);
          });
        }
      }
      const placeholders = heroImages.length > 0 ? heroImages : (DEMO ? DEMO_PHOTOS : PLACEHOLDER_IMAGES);
      const out: string[] = [...feed];
      for (let i = 0; out.length < 40; i++) out.push(placeholders[i % placeholders.length]);
      return out;
    },
    [postFeedImages, heroImages, footerImages]
  );

  // 3b. Detect video orientation for existing posts without explicit orientation metadata
  useEffect(() => {
    posts.forEach((p) => {
      if (p.id === 'jubilee_documentary') return;
      if (p.videoOrientation) {
        setVideoOrientations((prev) => (prev[p.id] === p.videoOrientation ? prev : { ...prev, [p.id]: p.videoOrientation }));
        return;
      }
      if (videoOrientations[p.id]) return;

      const media: string[] = p.mediaUrls || (p.mediaUrl ? [p.mediaUrl] : []);
      const videoUrl = media.find((u, idx) =>
        p.mediaTypes?.[idx] === 'video' ||
        u.toLowerCase().includes('.mp4') ||
        u.toLowerCase().includes('.webm') ||
        u.toLowerCase().includes('.mov') ||
        u.includes('/video/')
      );

      if (videoUrl) {
        const vid = document.createElement('video');
        vid.preload = 'metadata';
        vid.onloadedmetadata = () => {
          const isPortrait = vid.videoHeight > vid.videoWidth;
          setVideoOrientations((prev) => ({
            ...prev,
            [p.id]: isPortrait ? 'portrait' : 'landscape'
          }));
        };
        vid.onerror = () => {
          setVideoOrientations((prev) => ({
            ...prev,
            [p.id]: 'landscape'
          }));
        };
        vid.src = videoUrl;
      }
    });
  }, [posts, videoOrientations]);

  // 3. Handle Local Persistence
  useEffect(() => {
    localStorage.setItem(lsKey('profile-name'), displayName);
  }, [displayName]);

  useEffect(() => {
    localStorage.setItem(lsKey('profile-avatar'), avatar);
  }, [avatar]);

  // Handle profile save to Firestore
  const saveProfile = async () => {
    if (DEMO) { showToast('Profile saved for this preview.'); return; }
    if (!user) return;
    setIsSavingProfile(true);
    try {
      let finalAvatarUrl = avatar;

      // Check if we have a temporary file to upload
      const tempFile = await get('temp_profile_avatar');
      if (tempFile && avatar?.startsWith('blob:')) {
        const url = await uploadToCloudinary(tempFile, 'residents');
        finalAvatarUrl = url;
      }

      await setDoc(doc(db, scopedPath('residents'), user.uid), {
        displayName,
        photoUrl: finalAvatarUrl,
        updatedAt: serverTimestamp()
      }, { merge: true });

      await del('temp_profile_avatar');
      showToast('Profile saved successfully!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `residents/${user.uid}`);
      console.error("Error saving profile:", err);
      showToast('Error saving profile. Try again.', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle theme
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const applyTheme = (t: string) => {
      const isDark = t === 'dark' || (t === 'system' && mediaQuery.matches);
      setIsDarkMode(isDark);
      if (isDark) {
        root.classList.add('dark');
        root.setAttribute('data-theme', 'dark');
      } else {
        root.classList.remove('dark');
        root.setAttribute('data-theme', 'light');
      }
    };

    applyTheme(theme);
    const listener = () => { if (theme === 'system') applyTheme('system'); };
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, [theme]);

  // Handle font size
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-size', fontSize);
    if (fontSize === 'l') {
      root.style.fontSize = '112.5%';
    } else if (fontSize === 'xl') {
      root.style.fontSize = '125%';
    } else {
      root.style.fontSize = '100%';
    }
  }, [fontSize]);
  // Feed pagination: changing the page size sends every visitor back to the
  // first page so nobody lands mid-list on a size they didn't pick.
  useEffect(() => { setFeedPage(1); }, [feedPageSize]);

  // Feed pagination and storage come from the Eventicor console
  // (platform/settings), not from this app's config: Eventicor manages the
  // feed for every app. Picked up live, so an admin change lands mid-session.
  useEffect(() => {
    try { setFeedPageSize(getCouplePlatform().feedPageSize); } catch {}
    setPlatformSettingsClient(getCouplePlatform());
    const unsub = onSnapshot(doc(platformDb as any, 'platform', 'settings'), (snap: any) => {
      try {
        const d = snap.exists() ? snap.data() : {};
        const st: Record<string, number> = { ...getCouplePlatform().storage };
        for (const k of ['essential', 'complete', 'legacy'] as const) {
          const v = Number((d as any)?.storage?.[k]);
          if (Number.isFinite(v) && v > 0) st[k] = v;
        }
        const fps = Number((d as any)?.feedPageSize);
        const next = { feedPageSize: Number.isFinite(fps) && fps > 0 ? Math.floor(fps) : 0, storage: st };
        setFeedPageSize(next.feedPageSize);
        setPlatformSettingsClient(next);
      } catch {}
    }, () => {});
    return () => { try { unsub() } catch {} };
  }, []);

  useEffect(() => {
    localStorage.setItem(lsKey('bookmarks'), JSON.stringify(bookmarks));
  }, [bookmarks]);

  const toggleBookmark = (id: string) => {
    setBookmarks(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]);
  };

  const getDayPhase = () => {
    const now = new Date();
    const start = new Date(`${WEDDING_DATE}T${WEDDING_TIME}:00`);
    const end = new Date('2026-12-14T00:00:00');
    if (now < start) return 'before';
    if (now > end) return 'after';
    return 'during';
  };

  const phase = getDayPhase();
  const daysToGo = Math.max(0, Math.ceil((new Date(`${WEDDING_DATE}T${WEDDING_TIME}:00`).getTime() - Date.now()) / 86400000));

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-[#0B171C] text-[#E8EEF0]' : 'bg-[#EEEDF3] text-[#14262D]'} font-sans ${noChrome ? 'pb-4' : 'pb-32'}`} style={{ ['--ann-accent' as any]: (ACCENT_VARS[accentKey] || ACCENT_VARS.midnight).accent, ['--ann-hero' as any]: (ACCENT_VARS[accentKey] || ACCENT_VARS.midnight).hero, ['--ann-soft' as any]: (ACCENT_VARS[accentKey] || ACCENT_VARS.midnight).soft }}>
      {/* BOOT RESTORE: a refresh with the dashboard open shows this loader
          instead of the public app until the admin session is confirmed. */}
      {adminRestorePending && (
        <div className="fixed inset-0 z-[600] flex flex-col items-center justify-center bg-[#0B171C]">
          <p className="font-serif-display italic text-white text-[1.4rem]">{demoHeader()}</p>
          <div className="mt-7 w-9 h-9 rounded-full border-4 border-[var(--ann-accent)] border-t-transparent animate-spin" />
          <p className="mt-7 text-[0.65rem] font-black uppercase tracking-widest text-white/40">Opening your dashboard</p>
        </div>
      )}
      {/* FOLLOW-UP LAUNCH SPLASH SCREEN AFTER PWA ICON SPLASH */}
      <AnimatePresence>
        {showLaunchSplash && (
          <motion.section
            key="launch-followup-splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => enterApp()}
            className="fixed inset-0 z-[500] overflow-hidden flex items-center justify-center bg-[var(--ann-hero)] cursor-pointer select-none"
          >
            {/* SPLASH: DARA & FEMI */}
            <div className="relative z-10 flex flex-col items-center max-w-full px-6 text-center pointer-events-none">
              <motion.div
                initial={{ scale: 0.94, opacity: 0, y: 14 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ duration: 0.75, ease: "circOut" }}
              >
                <p className="text-[0.95rem] font-medium tracking-wide text-[#BCD4D8] m-0 mb-4">Together with their families</p>
                <h1 className="font-serif-display text-white text-[clamp(3.4rem,17vw,5.6rem)] leading-[0.95] m-0">
                  {demoBride()}
                  <span className="block italic text-[clamp(1.5rem,7.5vw,2.1rem)] text-[#C8932A] my-3">and</span>
                  {demoGroom()}
                </h1>
                <p className="text-[#BCD4D8] text-[1rem] mt-6 mb-0">Wedding memories, kept for life.</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.6 }}
                className="mt-10"
              >
                <span className="inline-flex items-center px-8 py-3.5 rounded-full bg-white/15 border border-white/35 text-white text-[0.75rem] font-black uppercase tracking-[0.28em]">Tap to enter</span>
              </motion.div>
            </div>
            {/* EVENTICOR BRANDING, BOTTOM OF THE ENTRY BANNER */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.9 }}
              transition={{ delay: 1.1, duration: 0.8 }}
              className="absolute bottom-8 left-0 right-0 z-10 flex flex-col items-center pointer-events-none"
            >
              <span className="font-serif-display italic text-white text-[1.4rem]">Eventicor</span>
            </motion.div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Simplified Header - CLEAN DESIGN (Hidden when viewing full-portrait Reels) */}
      {!(activeTab === 'feed' && feedSubTab === 'reels') && (
        <header className={`sticky top-0 z-[60] backdrop-blur-md px-5 py-3.5 border-b transition-colors ${isDarkMode ? 'bg-[#0B171C]/80 border-[#22363E]' : 'bg-[#EEEDF3]/80 border-[#DAD8E3]'}`}>
          <div className="max-w-[520px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-[1.25rem] font-serif-display italic font-medium tracking-[0] leading-none text-[var(--ann-accent)]">{demoHeader()}</h1>
              {!isOnline && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 text-[10px] font-black uppercase tracking-wider">
                  Offline
                </span>
              )}
            </div>
            <div className={`flex items-center gap-2.5${noChrome ? ' hidden' : ''}`}>
              {!isPWAInstalled && (
                <button
                  onClick={handleInstallClick}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--ann-accent)] text-white text-[0.72rem] font-black uppercase tracking-wider shadow-sm hover:scale-105 active:scale-95 transition-all"
                  title="Install App"
                >
                  <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Install</span>
                </button>
              )}
              <div className={`w-8 h-8 rounded-full overflow-hidden border ${isDarkMode ? 'border-[#22363E]' : 'border-[#DAD8E3]'} bg-[var(--ann-accent)] flex items-center justify-center text-[0.65rem] text-white font-black`}>
                {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <span>{displayName ? displayName[0].toUpperCase() : 'Y'}</span>}
              </div>
            </div>
          </div>
        </header>
      )}

      {route !== '/admin' && (
      <main className="max-w-[520px] mx-auto px-4 pt-1.5">
        {/* PERSISTENT HERO SECTION - Kept laid out in the background even when on other tabs so offsetHeight is never 0 and pairs continue scrolling seamlessly */}
        <div
          className={
            activeTab === 'home'
              ? 'block'
              : 'fixed top-0 left-0 w-full opacity-0 pointer-events-none -z-50 overflow-hidden'
          }
          aria-hidden={activeTab !== 'home'}
        >
           {heroTemplate === 'classic' && (
              <FloatingHeroSection isDarkMode={isDarkMode} images={heroImages} eventNames={EVENTS_VIS.map((e) => e.name)} />
            )}
            {heroTemplate === 'halo' && <HaloHero images={heroImages} names={demoHeader()} eventNames={EVENTS_VIS.map((e) => e.name)} />}
            {heroTemplate === 'hero' && <DeckHero images={heroImages} names={demoHeader()} eventNames={EVENTS_VIS.map((e) => e.name)} />}
            {heroTemplate === 'book' && <BookHero images={heroImages} bride={demoBride()} groom={demoGroom()} dotDate={heroDotDate} city={demoCity()} hashtag={demoText(DETAILS.hashtag)} eventNames={EVENTS_VIS.map((e) => e.name)} />}
        </div>


        {/* PROFILE SETUP MODAL */}
        <ProfilePromptModal 
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          onGoToSettings={() => {
            setActiveTab('settings');
            setShowProfileModal(false);
          }}
          isDarkMode={isDarkMode}
        />

        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key={`home-tab-${activeTab}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-0"
            >
              {/* COUPLE BANNER - DARA & FEMI */}
              <div className="rounded-[28px] p-[26px_22px_26px] text-[#F2F7F8] relative overflow-hidden shadow-xl" style={{
                background: 'linear-gradient(135deg, var(--ann-hero) 0%, #3A2F63 100%)'
              }}>
                <p className="m-0 text-center text-[0.92rem] font-medium text-[#C8932A]">Together with their families</p>
                <h2 className="text-center font-serif-display text-white text-[clamp(2.7rem,13vw,3.6rem)] leading-[1] mt-3 mb-0">
                  {demoBride()}
                  <span className="block italic text-[clamp(1.3rem,6vw,1.6rem)] text-[#C8932A] my-2">and</span>
                  {demoGroom()}
                </h2>
                <p className="text-center text-[0.95rem] opacity-[0.85] mt-4 mb-0 max-w-[34ch] mx-auto leading-snug">are getting married. Share every moment with us, from the first introduction to the last dance.</p>

                {phase === 'before' && (
                  <div className="mt-5 mx-auto bg-white/10 border border-white/25 rounded-[18px] py-3.5 backdrop-blur-md">
                    <div className="flex items-stretch justify-center divide-x divide-white/25">
                      <div className="px-5 text-center">
                        <b className="block text-[1.5rem] font-serif-display leading-none">{WED_DAY_SHORT}</b>
                        <span className="block text-[0.68rem] uppercase tracking-wider opacity-75 mt-1.5">{WED_YEAR}</span>
                      </div>
                      <div className="px-5 text-center">
                        <b className="block text-[1.5rem] font-serif-display leading-none">{demoCity()}</b>
                        <span className="block text-[0.68rem] uppercase tracking-wider opacity-75 mt-1.5">Nigeria</span>
                      </div>
                    </div>
                    <CountdownRow date={WEDDING_DATE} time={WEDDING_TIME} />
                  </div>
                )}

                {phase === 'during' && (
                  <div className="mt-5 bg-white/10 border border-white/14 rounded-[18px] p-[14px_16px]">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="w-2 h-2 rounded-full bg-[#7CF2B0]" />
                      <b className="text-[1.05rem] font-serif-display">It&apos;s the wedding day</b>
                    </div>
                    <p className="text-[0.9rem] opacity-[0.9] m-0">Share what you are seeing. We are keeping it all.</p>
                  </div>
                )}

                {phase === 'after' && (
                  <div className="mt-5 bg-white/10 border border-white/14 rounded-[18px] p-[14px_16px]">
                    <b className="text-[1.05rem] font-serif-display">The memories are here to stay</b>
                    <p className="text-[0.9rem] opacity-[0.9] m-0">Every moment from the weekend, kept for life.</p>
                  </div>
                )}

                              </div>


              {/* OUR STORY */}
              {!HIDDEN_SECTIONS.includes('story') && (
              <section className="mt-8">
                <h2 className="text-[1.25rem] font-black font-display tracking-[-0.01em] m-[30px_4px_12px] leading-[1.25]">Our story</h2>
                <p className={`text-[0.95rem] leading-relaxed m-[0_4px_14px] ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>
                  {STORY}
                </p>
              </section>
              )}

              {/* THE JOURNEY — expandable dropdowns, one open at a time */}
              <section id="journey" className="mt-8">
                <h2 className="text-[1.25rem] font-black font-display tracking-[-0.01em] m-[30px_4px_4px] leading-[1.25]">The journey</h2>
                <p className={`text-[0.9rem] m-[0_4px_14px] ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>Tap an event to open it.</p>
                <div className="ml-[10px] pl-[20px] border-l-[3px] border-[#DAD8E3] dark:border-[#22363E] space-y-3">
                  {EVENTS_VIS.map((e, ji) => {
                    const st = e.status || 'up';
                    const open = openEventId === e.id;
                    const stepImgs: string[] = ((e as any).images || []);
                    const daysTo = Math.ceil((new Date(`${e.date}T${e.time || '12:00'}:00`).getTime() - Date.now()) / 86400000);
                    const tagCls = st === 'done'
                      ? 'bg-[var(--ann-accent)]/10 text-[var(--ann-accent)] border-[var(--ann-accent)]/30'
                      : st === 'next'
                        ? 'bg-[#C8932A]/15 text-[#C8932A] border-[#C8932A]/40'
                        : (isDarkMode ? 'bg-white/5 text-[#93A4AB] border-[#22363E]' : 'bg-[#EEEDF3] text-[#5A6970] border-[#DAD8E3]');
                    const dotCls = st === 'done'
                      ? 'bg-[var(--ann-accent)] border-[var(--ann-accent)]'
                      : st === 'next'
                        ? 'bg-[#C8932A] border-[#C8932A] shadow-[0_0_0_5px_rgba(200,147,42,0.18)]'
                        : (isDarkMode ? 'bg-[#0B171C] border-[#93A4AB]' : 'bg-[#EEEDF3] border-[#5A6970]');
                    return (
                      <motion.div key={e.id} initial={{ opacity: 0, x: -26 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.35 }} transition={{ duration: 0.55, delay: Math.min(ji * 0.07, 0.35), ease: 'easeOut' }} className="relative">
                        <span className={`absolute -left-[30px] top-[20px] w-[14px] h-[14px] rounded-full border-[3px] ${dotCls}`} />
                        <div className={`rounded-[18px] border overflow-hidden transition-colors ${st === 'next' ? 'border-[#C8932A]/60 ring-1 ring-[#C8932A]/15' : isDarkMode ? 'border-[#22363E]' : 'border-[#DAD8E3]'} ${isDarkMode ? 'bg-[#13232A]' : 'bg-white'}`}>
                          <button type="button" onClick={() => setOpenEventId(open ? null : e.id)} className="w-full text-left border-0 bg-transparent p-[14px_16px] flex items-start justify-between gap-2 cursor-pointer">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <b className="text-[1rem] font-serif-display leading-tight">{e.name}</b>
                                <span className={`flex-shrink-0 px-2.5 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wider ${tagCls}`}>
                                  {st === 'done' ? 'Done' : st === 'next' ? 'Next up' : 'Upcoming'}
                                </span>
                              </div>
                              <small className={`block text-[0.78rem] mt-0.5 ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>{e.type ? `${e.type} · ` : ''}{fmtEventDate(e)}</small>
                            </div>
                            <ChevronDown className={`w-4 h-4 flex-shrink-0 mt-1 opacity-60 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
                          </button>
                          {open && (
                            <div className={`px-[16px] pb-[16px] pt-3 border-t space-y-2.5 ${isDarkMode ? 'border-[#22363E]' : 'border-[#DAD8E3]'}`}>
                              <p className={`text-[0.9rem] m-0 leading-snug ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>{e.desc}</p>
                              <div className="flex gap-2 flex-wrap">
                                <span className={`px-3 py-1.5 rounded-full text-[0.72rem] font-bold ${isDarkMode ? 'bg-white/5 text-[#93A4AB] border border-[#22363E]' : 'bg-[#EEEDF3] text-[#5A6970] border border-[#DAD8E3]'}`}>{fmtEventDate(e)}</span>
                                <span className={`px-3 py-1.5 rounded-full text-[0.72rem] font-bold ${isDarkMode ? 'bg-white/5 text-[#93A4AB] border border-[#22363E]' : 'bg-[#EEEDF3] text-[#5A6970] border border-[#DAD8E3]'}`}>{e.venue ? e.venue : 'Venue to be announced'}</span>
                              </div>
                              {st === 'next' && daysTo >= 0 && (
                                <div className="rounded-[10px] bg-[#C8932A]/15 border border-[#C8932A]/30 px-3 py-2 text-[0.78rem] font-black uppercase tracking-wider text-[#C8932A]">
                                  {daysTo === 0 ? 'Happening today' : `In ${daysTo} day${daysTo === 1 ? '' : 's'}`}
                                </div>
                              )}
                              {stepImgs.length > 0 && (
                                <div className="flex gap-2 flex-wrap pt-0.5">
                                  {stepImgs.map((u, ii) => (
                                    <div key={ii} className="relative w-[92px] h-[92px] rounded-[12px] overflow-hidden">
                                      <img src={u} alt={`${e.name} photo ${ii + 1}`} loading="lazy" onClick={() => setFooterLightbox(u)} className="w-full h-full object-cover cursor-zoom-in" />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </section>

                            {/* WEDDING DAY DETAILS */}
              {!HIDDEN_SECTIONS.includes('details') && (
              <section className="mt-8">
                <h2 className="text-[1.25rem] font-black font-display tracking-[-0.01em] m-[30px_4px_12px] leading-[1.25]">Wedding day</h2>
                <p className={`text-[0.9rem] m-[0_4px_14px] ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>{WED_FULL}</p>
                <div className={`p-[16px_18px] rounded-[20px] border space-y-3.5 ${isDarkMode ? 'bg-[#13232A] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                  <div>
                    <strong className="block text-[0.93rem]">Church wedding · {DETAILS.churchTime}</strong>
                    <p className={`m-0 text-[0.9rem] ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>{DETAILS.churchVenue}</p>
                  </div>
                  <div className={`border-t ${isDarkMode ? 'border-[#22363E]' : 'border-[#DAD8E3]'}`} />
                  <div>
                    <strong className="block text-[0.93rem]">Reception · {DETAILS.receptionTime}</strong>
                    <p className={`m-0 text-[0.9rem] ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>{DETAILS.receptionVenue}</p>
                  </div>
                  <div className={`border-t ${isDarkMode ? 'border-[#22363E]' : 'border-[#DAD8E3]'}`} />
                  <div>
                    <strong className="block text-[0.93rem] flex items-center gap-2 flex-wrap">Aso-ebi:{(DETAILS.dressColors || []).filter(Boolean).length ? <span className="inline-flex gap-1.5">{(DETAILS.dressColors || []).filter(Boolean).map((c: string, i: number) => <span key={i} className="inline-block w-4 h-4 rounded-full border border-black/10 shadow-sm" style={{ background: c }} />)}</span> : ` ${DETAILS.asoEbi || ''}`}</strong>
                    <p className={`m-0 text-[0.9rem] ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>Share your looks with <span className="font-bold text-[var(--ann-accent)] dark:text-[#2FB3BF]">{demoText(DETAILS.hashtag)}</span></p>
                  </div>
                </div>
              </section>
              )}

              

              {/* CTA */}
              <section className="mt-8 mb-2">
                <h2 className="text-[1.25rem] font-black font-display tracking-[-0.01em] m-[30px_4px_12px] leading-[1.25]">Say something to the couple</h2>
                <button
                  onClick={() => setActiveTab('feed')}
                  className="w-full border-0 rounded-[16px] py-3.5 font-bold bg-[var(--ann-accent)] text-white text-[0.95rem] hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Open the feed
                </button>
              </section>

              {/* GIFTS & SUPPORT — the couple's account details, edited in Settings */}
              {DETAILS && DETAILS.giftInfo && (DETAILS.giftInfo.accountNumber || DETAILS.giftInfo.accountName) && !((DETAILS.hiddenSections || []).includes('gifts')) && (
                <section className="mt-8">
                  <div className={`relative overflow-hidden rounded-[24px] border p-6 ${isDarkMode ? 'bg-[#13232A] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                    <div className="absolute -top-14 -right-14 w-44 h-44 rounded-full bg-[var(--ann-accent)]/15 blur-2xl pointer-events-none" />
                    <span className="block text-[0.65rem] font-black uppercase tracking-widest text-[var(--ann-accent)] mb-1.5">Gift the couple</span>
                    <h2 className="text-[1.25rem] font-black font-display tracking-[-0.01em] leading-[1.25]">Say it with a gift</h2>
                    <p className={`text-[0.9rem] mt-1.5 mb-4 ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>{DETAILS.giftInfo.note || 'Your presence means everything. If you would also love to gift us, it is deeply appreciated.'}</p>
                    <div className="space-y-2.5">
                      {DETAILS.giftInfo.bank && (
                        <div className={`p-[14px_16px] rounded-[18px] border flex items-center justify-between gap-3 ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-[#EEEDF3] border-transparent'}`}>
                          <div className="min-w-0">
                            <span className="block text-[0.6rem] font-black uppercase tracking-widest opacity-50">Bank</span>
                            <b className="block text-[0.95rem] font-serif-display truncate">{DETAILS.giftInfo.bank}</b>
                          </div>
                          <Banknote className="w-5 h-5 opacity-40 shrink-0" />
                        </div>
                      )}
                      {DETAILS.giftInfo.accountNumber && (
                        <button type="button" onClick={() => { try { navigator.clipboard?.writeText(DETAILS.giftInfo.accountNumber || ''); showToast('Account number copied.'); } catch {} }} className={`w-full text-left p-[14px_16px] rounded-[18px] border flex items-center justify-between gap-3 ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-[#EEEDF3] border-transparent'}`}>
                          <div className="min-w-0">
                            <span className="block text-[0.6rem] font-black uppercase tracking-widest opacity-50">Account number · tap to copy</span>
                            <b className="block text-[1.05rem] font-display tracking-[0.08em]">{DETAILS.giftInfo.accountNumber}</b>
                          </div>
                          <Copy className="w-5 h-5 opacity-50 shrink-0" />
                        </button>
                      )}
                      {DETAILS.giftInfo.accountName && (
                        <div className={`p-[14px_16px] rounded-[18px] border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-[#EEEDF3] border-transparent'}`}>
                          <span className="block text-[0.6rem] font-black uppercase tracking-widest opacity-50">Account name</span>
                          <b className="block text-[0.95rem] font-serif-display">{DETAILS.giftInfo.accountName}</b>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}

{/* OUR PARTNERS — set in Events & photos, under Gifts & support; the eye toggle hides it */}
              {(partners || []).length > 0 && !HIDDEN_SECTIONS.includes('partners') && (
              <section className="mt-8">
                <h2 className="text-[1.25rem] font-black font-display tracking-[-0.01em] m-[30px_4px_4px] leading-[1.25]">Our partners</h2>
                <p className={`text-[0.9rem] m-[0_4px_14px] ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>The people and brands behind this celebration.</p>
                <div className="flex flex-col gap-3">
                  {(partners || []).map((p: any) => (
                      <PartnerHomeCard key={p.id || p.name} p={p} isDarkMode={isDarkMode} />
                    ))}
                </div>
              </section>
              )}

              {/* GIANT FOOTER — the couple picks the style in the dashboard */}
              {footerStyle === 'marquee' ? (
                <GiantFooterMarquee images={footerPool} isDarkMode={isDarkMode} thanks={footerThanks} paused={!!footerLightbox} onTap={(src: string) => setFooterLightbox(src)} />
              ) : footerStyle === 'tunnel' ? (
                <GiantFooterTunnel images={footerPool} thanks={footerThanks} paused={!!footerLightbox} onTap={(src: string) => setFooterLightbox(src)} />
              ) : footerStyle === 'globe' ? (
                <GiantFooterGlobe images={footerPool} thanks={footerThanks} paused={!!footerLightbox} onTap={(src: string) => setFooterLightbox(src)} />
              ) : (
                <GiantFooterWall images={footerPool} isDarkMode={isDarkMode} thanks={footerThanks} paused={!!footerLightbox} onTap={(src: string) => setFooterLightbox(src)} />
              )}

                            <footer className="py-10 text-center border-t border-[#DAD8E3] dark:border-[#22363E] mt-12 bg-white/50 dark:bg-black/20 backdrop-blur-sm rounded-[32px] mx-4">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex flex-col items-center">
                    <h4 className="text-[1.1rem] font-serif-display italic text-[var(--ann-accent)] mb-1">{demoHeader()}</h4>
                    <p className={`text-xs ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>{(DETAILS as any)?.footer?.message || `Happy Wedding · ${WED_LONG}`}</p>
                  </div>
                  <div className="pt-2 opacity-40">
                    <p className="text-[0.65rem] font-bold uppercase tracking-widest">{(DETAILS as any)?.footer?.caption || 'Wedding memories, kept for life'}</p>
                  </div>
                </div>
              </footer>

            </motion.div>
          )}

          {activeTab === 'feed' && (
            <motion.div
              key={`feed-tab-${activeTab}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-0 pt-3"
            >
              {/* PRIVATE FEED GATE: when the feed is private, only the feed page
                  is held at the entry banner. Home, settings and the bottom nav
                  stay open so a guest can always move around. The banner asks
                  for the guest access code and the server confirms it. */}
              {feedLocked && (
                <div
                  className={`fixed left-1/2 -translate-x-1/2 w-full max-w-[520px] z-[56] flex items-center justify-center px-6 ${isDarkMode ? 'bg-[#0B171C]' : 'bg-[#EEEDF3]'}`}
                  style={{ top: feedSubTab === 'reels' ? '0px' : '61px', bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
                >
                  <div className={`w-full max-w-sm rounded-[24px] p-6 text-center ${isDarkMode ? 'bg-[#13232A] border border-[#22363E]' : 'bg-white'}`}>
                    <h2 className="font-black font-display text-xl mb-2 text-[var(--ann-accent)]">Private feed</h2>
                    <p className={`text-sm mb-5 ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>The couple made their memories private. Enter the access code to continue.</p>
                    <form onSubmit={(e) => { e.preventDefault(); submitGateCode(); }}>
                      <input
                        type="text"
                        value={gateInput}
                        maxLength={20}
                        onChange={(e) => setGateInput(e.target.value.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase())}
                        placeholder="Access code"
                        autoCapitalize="characters"
                        className={`w-full p-4 rounded-xl border-none outline-none font-black tracking-widest text-center uppercase transition-colors ${isDarkMode ? 'bg-[#0B171C] text-[var(--ann-accent)] placeholder-[#5A6970] ring-1 ring-[#22363E]' : 'bg-[#EEEDF3] text-[var(--ann-accent)] placeholder-[#93A4AB] ring-1 ring-[#DAD8E3]'}`}
                      />
                      <button
                        type="submit"
                        disabled={gateBusy || !gateInput.trim()}
                        className="mt-4 w-full py-3.5 rounded-full bg-[var(--ann-accent)] text-white text-[0.75rem] font-black uppercase tracking-widest disabled:opacity-50"
                      >
                        {gateBusy ? 'Checking…' : 'Enter'}
                      </button>
                    </form>
                    <p className={`text-[0.7rem] mt-4 ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'} opacity-50`}>Only the feed is locked. Home and settings stay open.</p>
                  </div>
                </div>
              )}
              {/* Segmented Control: Post vs Reels (pinned at the top of the Feed on both tabs so users can always switch back) */}
              {(
                <div className={`flex items-center p-1.5 rounded-2xl mb-4 border ${isDarkMode ? 'bg-[#13232A] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                  <button
                    onClick={() => setFeedSubTab('post')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                      feedSubTab === 'post'
                        ? 'bg-[var(--ann-accent)] text-white shadow-md'
                        : isDarkMode ? 'text-[#93A4AB] hover:text-white' : 'text-[#5A6970] hover:text-[#14262D]'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Post</span>
                  </button>
                  <button
                    onClick={() => setFeedSubTab('reels')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                      feedSubTab === 'reels'
                        ? 'bg-[var(--ann-accent)] text-white shadow-md'
                        : isDarkMode ? 'text-[#93A4AB] hover:text-white' : 'text-[#5A6970] hover:text-[#14262D]'
                    }`}
                  >
                    <Film className="w-4 h-4" />
                    <span>Reels</span>
                  </button>
                </div>
              )}

              {sampleMode && (
                <div
                  className="sticky z-[55] mx-3 mt-3 flex items-start gap-2.5 rounded-2xl border border-dashed border-[var(--ann-accent)] bg-[var(--ann-soft)] px-3.5 py-2.5"
                  style={{ top: activeTab === 'feed' && feedSubTab === 'reels' ? '0px' : '61px' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.8rem] font-bold leading-snug">Everything here is placeholder data</p>
                    <p className="text-[0.72rem] leading-snug text-[#5A6970]">As the admin, you can post and your post takes effect immediately. Your guests can post too, and their posts take effect immediately, but guests need the access code shown in your admin dashboard. This notice stays until the first real post.</p>
                  </div>
                </div>
              )}
              {isPostsLoading ? (
                <div className="py-24 flex flex-col items-center justify-center gap-3 border-t border-[#DAD8E3] dark:border-[#22363E]">
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[var(--ann-accent)] animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-3 h-3 rounded-full bg-[var(--ann-accent)] animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-3 h-3 rounded-full bg-[var(--ann-accent)] animate-bounce" />
                  </div>
                </div>
              ) : feedSubTab === 'post' ? (
                <div className="border-t-[6px] border-[#D0CEDB] dark:border-[#1E323A]">
                  {uploadingPost && <UploadingPostCard up={uploadingPost} isDarkMode={isDarkMode} />}
                  {(() => {
                    const regularPosts = posts.filter((p) => {
                      if (p.id === 'jubilee_documentary') return false;
                      if (p.pending && !(isAdmin || p.authorUid === user?.uid || (DEMO && p.localDemo))) return false;
                      const media: string[] = p.mediaUrls || (p.mediaUrl ? [p.mediaUrl] : []);
                      const hasVideo = media.some((u, idx) =>
                        p.mediaTypes?.[idx] === 'video' ||
                        u.toLowerCase().includes('.mp4') ||
                        u.toLowerCase().includes('.webm') ||
                        u.toLowerCase().includes('.mov') ||
                        u.includes('/video/')
                      );
                      const orientation = p.videoOrientation || videoOrientations[p.id];
                      const hasImage = media.some((u, idx) =>
                        !(p.mediaTypes?.[idx] === 'video' ||
                          u.toLowerCase().includes('.mp4') ||
                          u.toLowerCase().includes('.webm') ||
                          u.toLowerCase().includes('.mov') ||
                          u.includes('/video/'))
                      );
                      const isPortraitReel = hasVideo && orientation === 'portrait' && !hasImage;
                      return !isPortraitReel;
                    });

                    if (regularPosts.length === 0 && feedReal) {
                      return (
                        <p className={`py-10 text-center text-[0.8rem] font-bold ${isDarkMode ? 'text-[#5A6970]' : 'text-[#93A4AB]'}`}>No posts yet · be the first to share a memory</p>
                      );
                    }

                    if (regularPosts.length === 0) {
                      return (
                        <>
                          <p className={`py-6 text-center text-[0.7rem] font-black uppercase tracking-widest ${isDarkMode ? 'text-[#5A6970]' : 'text-[#93A4AB]'}`}>Sample memories · real guest posts appear here</p>
                          {SAMPLE_POSTS.filter((sp) => sp.mediaType !== 'reel').map((sp) => (
                            <SamplePostCard key={sp.id} post={{ ...sp, text: sampleCoupleText(sp.text) }} isDarkMode={isDarkMode} liked={!!sampleLiked[sp.id]} onLike={() => setSampleLiked((m) => ({ ...m, [sp.id]: !m[sp.id] }))} onComment={() => setCommentsPost(sp)} onShare={() => setSharingPost(sp)} />
                          ))}
                        </>
                      );
                    }

                    const pagedPosts = feedPageSize > 0 ? regularPosts.slice(0, feedPage * feedPageSize) : regularPosts;
                    const activePostAds = shuffledPostAds.length > 0 ? shuffledPostAds : postAds;
                    const feedElements: React.ReactNode[] = [];

                    pagedPosts.forEach((p, idx) => {
                      const formattedDate = p.timestamp?.toDate
                        ? new Intl.DateTimeFormat('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }).format(p.timestamp.toDate())
                        : 'Just now';

                      feedElements.push(
                        <Post 
                          key={p.id}
                          id={p.id}
                          isDarkMode={isDarkMode}
                          name={p.authorName || 'Guest'}
                          text={p.text}
                          time={formattedDate}
                          mediaUrls={p.mediaUrls}
                          mediaTypes={p.mediaTypes}
                          likeCount={p.likeCount}
                          loveCount={p.loveCount}
                          avatar={p.authorPhoto}
                          onAvatarClick={(u: string) => setAvatarZoom(u)}
                          isAdmin={isAdmin}
                          user={user}
                          onDelete={() => setPostToDelete(p.id)}
                          onLike={() => handleToggleReaction(p.id, 'like')}
                          onLove={() => handleToggleReaction(p.id, 'love')}
                          onShare={() => sharePost(p)}
                          onOpenMedia={(mIdx: number) => setActiveMediaIndex({ postId: p.id, index: mIdx })}
                          onComment={() => setCommentsPost(p)}
                          commentCount={p.commentCount || 0}
                          eventName={p.eventName || ''}
                          authorRole={postRole(p)}
                          authorUid={p.authorUid}
                          pending={p.pending}
                          onApprove={() => approvePost(p.id)}
                          sample={sampleMode}
                        />
                      );

                      // Place a shuffled Post Ad after every 5 posts
                      if ((idx + 1) % 5 === 0 && activePostAds.length > 0) {
                        const adSlotIndex = Math.floor((idx + 1) / 5) - 1;
                        const ad = activePostAds[adSlotIndex % activePostAds.length];
                        feedElements.push(
                          <PostAdCard
                            key={`post-ad-${ad.id}-${idx}`}
                            ad={ad}
                            isDarkMode={isDarkMode}
                          />
                        );
                      }
                    });

                    if (feedPageSize > 0 && regularPosts.length > pagedPosts.length) {
                      feedElements.push(
                        <div key="feed-next-page" className="flex w-full justify-center">
                          <button onClick={() => setFeedPage((v: number) => v + 1)} className="my-6 px-6 py-3 rounded-full border border-[var(--ann-accent)] text-[var(--ann-accent)] text-[0.7rem] font-black uppercase tracking-widest active:scale-95 transition-transform">Older posts</button>
                        </div>
                      );
                    }
                    return feedElements;
                  })()}
                </div>
                            ) : (
                <ReelsFeed
                  sample={sampleMode}
                  bannerSpace={sampleMode ? 80 : 0}
                  onAvatarClick={(u: string) => setAvatarZoom(u)}
                  reels={(() => {
                    const filteredReels = posts.filter((p) => {
                      if (p.id === 'jubilee_documentary') return false;
                      if (p.pending && !(isAdmin || p.authorUid === user?.uid || (DEMO && p.localDemo))) return false;
                      const media: string[] = p.mediaUrls || (p.mediaUrl ? [p.mediaUrl] : []);
                      const hasVideo = media.some((u, idx) =>
                        p.mediaTypes?.[idx] === 'video' ||
                        u.toLowerCase().includes('.mp4') ||
                        u.toLowerCase().includes('.webm') ||
                        u.toLowerCase().includes('.mov') ||
                        u.includes('/video/')
                      );
                      const orientation = p.videoOrientation || videoOrientations[p.id];
                      const hasImage = media.some((u, idx) =>
                        !(p.mediaTypes?.[idx] === 'video' ||
                          u.toLowerCase().includes('.mp4') ||
                          u.toLowerCase().includes('.webm') ||
                          u.toLowerCase().includes('.mov') ||
                          u.includes('/video/'))
                      );
                      return hasVideo && orientation === 'portrait' && !hasImage;
                    });

                    const finalReels = filteredReels.length > 0
                      ? filteredReels
                      : feedReal
                        ? []
                        : SAMPLE_POSTS.filter((sp) => sp.mediaType === 'reel').map((sp) => ({ ...sp, text: sampleCoupleText(sp.text) }));
                    // ReelsFeed maps over this prop, so an empty result must
                    // come back as [] and let its own empty state render.
                    if (finalReels.length === 0) return [];

                    const activeReelAds = shuffledReelAds.length > 0 ? shuffledReelAds : reelAds;
                    if (activeReelAds.length === 0) return finalReels;

                    const combinedReels: any[] = [];
                    finalReels.forEach((r, idx) => {
                      combinedReels.push(r);
                      // Place a video ad after every 3 reels
                      if ((idx + 1) % 3 === 0) {
                        const adIdx = Math.floor((idx + 1) / 3) - 1;
                        const ad = activeReelAds[adIdx % activeReelAds.length];
                        combinedReels.push({
                          ...ad,
                          id: `reel-ad-${ad.id}-${idx}`,
                          isAd: true
                        });
                      }
                    });
                    return combinedReels;
                  })()}
                  isDarkMode={isDarkMode}
                  isAdmin={isAdmin}
                  user={user}
                  onSwitchToPost={() => setFeedSubTab('post')}
                  onDelete={(id: string) => setPostToDelete(id)}
                  onLike={(id: string) => handleToggleReaction(id, 'like')}
                  onLove={(id: string) => handleToggleReaction(id, 'love')}
                  onShare={(p: any) => sharePost(p)}
                  onComment={(p: any) => setCommentsPost(p)}
                />
              )}
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-0"
            >
              <TabErrorBoundary label="Settings (guest page)" isDarkMode={isDarkMode}>
              <h2 className="text-[1.25rem] font-black font-display tracking-[-0.01em] m-[14px_4px_12px] leading-[1.25]">Guest Profile</h2>
              <div className={`p-[24px_18px] rounded-[24px] border mb-6 flex flex-col items-center gap-6 ${isDarkMode ? 'bg-[#13232A] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                <div className="relative group">
                  <div className={`w-28 h-24 rounded-full overflow-hidden border-4 ${isDarkMode ? 'border-[#0B171C]' : 'border-[#EEEDF3]'} bg-[var(--ann-accent)] flex items-center justify-center text-white text-3xl font-black`}>
                    {avatar ? (
                      <img src={avatar} className="w-full h-full object-cover" alt="Profile" />
                    ) : (
                      <User className="w-10 h-10" />
                    )}

                  </div>
                  <input 
                    type="file" 
                    id="profile-upload" 
                    className="hidden" 
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file && user) {
                        setIsUploading(true);
                        try {
                          // Store in IndexedDB
                          await set('temp_profile_avatar', file);
                          
                          // Create local preview URL
                          const localUrl = URL.createObjectURL(file as any);
                          setAvatar(localUrl);
                        } catch (err) {
                          console.error("Local storage error:", err);
                        } finally {
                          setIsUploading(false);
                        }
                      }
                    }}
                  />
                  <label 
                    htmlFor="profile-upload"
                    className="absolute bottom-0 right-0 p-2.5 bg-[var(--ann-accent)] text-white rounded-full shadow-lg cursor-pointer hover:scale-110 active:scale-95 transition-all"
                  >
                    <Camera className="w-4 h-4" />
                  </label>
                </div>
                
                <div className="w-full space-y-4">
                  <div>
                    <label className={`block text-[0.7rem] uppercase tracking-widest font-black mb-2 opacity-50 ${isDarkMode ? 'text-white' : 'text-[#14262D]'}`}>Display Name</label>
                    <input 
                      type="text"
                      placeholder="e.g. Tolu (the bride's cousin)"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className={`w-full p-4 rounded-xl border-none outline-none font-bold transition-colors ${isDarkMode ? 'bg-[#0B171C] text-white placeholder-[#5A6970]' : 'bg-[#EEEDF3] text-[#14262D] placeholder-[#93A4AB]'}`}
                    />
                  </div>
                  
<button 
                    onClick={saveProfile}
                    disabled={isSavingProfile}
                    className={`w-full py-3.5 rounded-full font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
                      isSavingProfile ? 'bg-slate-200 text-slate-400' : 'bg-[var(--ann-accent)] text-white shadow-lg shadow-[var(--ann-accent)]/20 hover:scale-[1.02] active:scale-95'
                    }`}
                  >
                    {isSavingProfile ? 'Saving...' : (
                      <>
                        <Check className="w-4 h-4" />
                        Save profile
                      </>
                    )}
                  </button>
                </div>
              </div>

              
              {!DEMO && cfgContact && (cfgContact.adminWhatsapp || cfgContact.payBankName || cfgContact.payAccountNumber) && (
                <>
                  <h2 className="text-[1.25rem] font-black font-display tracking-[-0.01em] m-[14px_4px_12px] leading-[1.25]">Payments & support</h2>
                  <div className={`p-[24px_18px] rounded-[24px] border mb-6 ${isDarkMode ? 'bg-[#13232A] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                    {cfgContact.payBankName ? (
                      <div className="space-y-1.5 text-sm">
                        <p className="font-black font-display text-base">Pay Eventicor</p>
                        <p>Bank: <b>{cfgContact.payBankName}</b></p>
                        <p>Account number: <b>{cfgContact.payAccountNumber}</b></p>
                        <p>Account name: <b>{cfgContact.payAccountName}</b></p>
                      </div>
                    ) : null}
                    {cfgContact.adminWhatsapp ? (
                      <a href={`https://wa.me/${String(cfgContact.adminWhatsapp).replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-3 px-4 py-2.5 rounded-full bg-[#25d366] text-white text-[0.7rem] font-black uppercase tracking-widest">WhatsApp the admin</a>
                    ) : null}
                  </div>
                </>
              )}
              <h2 className="text-[1.25rem] font-black font-display tracking-[-0.01em] m-[14px_4px_12px] leading-[1.25]">Appearance</h2>
              <div className={`p-[4px_0] rounded-[20px] border ${isDarkMode ? 'bg-[#13232A] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                <div className="p-[14px_18px] flex items-center justify-between gap-4">
                  <div>
                    <strong className="block text-[1rem]">Theme</strong>
                    <small className={`block text-[0.85rem] leading-[1.35] ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>Light, dark, or follow your phone</small>
                  </div>
                  <div className={`inline-flex p-[3px] rounded-full border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-[#EEEDF3] border-[#DAD8E3]'}`}>
                    {['light', 'dark', 'system'].map(t => (
                      <button 
                        key={t}
                        onClick={() => setTheme(t as any)}
                        className={`p-[6px_12px] rounded-full text-[0.88rem] transition-all ${theme === t ? 'bg-[var(--ann-accent)] text-white font-bold' : ''}`}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-[14px_18px] flex items-center justify-between gap-4 border-t border-[#DAD8E3] dark:border-[#22363E]">
                  <div>
                    <strong className="block text-[1rem]">Text size</strong>
                    <small className={`block text-[0.85rem] leading-[1.35] ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>Make reading easier</small>
                  </div>
                  <div className={`inline-flex p-[3px] rounded-full border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-[#EEEDF3] border-[#DAD8E3]'}`}>
                    {['m', 'l', 'xl'].map(s => (
                      <button 
                        key={s}
                        onClick={() => setFontSize(s as any)}
                        className={`p-[6px_12px] rounded-full text-[0.88rem] transition-all ${fontSize === s ? 'bg-[var(--ann-accent)] text-white font-bold' : ''}`}
                      >
                        {s === 'm' ? 'A' : (s === 'l' ? 'A+' : 'A++')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <h2 className="text-[1.25rem] font-black font-display tracking-[-0.01em] m-[30px_4px_12px] leading-[1.25]">About</h2>
              <div className={`p-[4px_0] rounded-[20px] border ${isDarkMode ? 'bg-[#13232A] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                <div className="p-[14px_18px]">
                  <strong className="block text-[1rem]">{demoHeader()}{DEMO ? '' : ' 2026'}</strong>
                  <small className={`block text-[0.85rem] leading-[1.35] ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>Wedding Memories Portal. Made with love.</small>
                </div>
                <div className="p-[14px_18px] flex items-center justify-between gap-4 border-t border-[#DAD8E3] dark:border-[#22363E]">
                  <div>
                    <strong className="block text-[1rem]">Report a problem</strong>
                    <small className={`block text-[0.85rem] leading-[1.35] ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>Tell the couple if something looks wrong</small>
                  </div>
                  <button className="inline-flex items-center justify-center gap-2 border-0 rounded-full p-[10px_18px] font-bold bg-[var(--ann-soft)] dark:bg-[#173039] text-[var(--ann-accent)] dark:text-[#4FC3CF] text-sm">Report</button>
                </div>
                <div className="p-[14px_18px] border-t border-[#DAD8E3] dark:border-[#22363E] text-center">
                  <span className={`text-xs font-bold tracking-wide select-none ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>
                    Happy Wedding, {demoHeader()}
                  </span>
                </div>
              </div>

              {!noChrome && (
                <div className="pt-6 pb-2" style={{ display: 'grid', justifyItems: 'center' }}>
                  <style>{`@keyframes evAdminHalo { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
                  {adminMode === 'none' ? (
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, opacity: .5, letterSpacing: '.08em', textTransform: 'uppercase' }}>Open admin dashboard</span>
                  ) : (
                    <button
                      onClick={onAdminShortcutTap}
                      aria-label="Open admin dashboard"
                      style={{ width: 64, height: 64, borderRadius: '50%', border: '3px solid var(--ann-accent)', background: `url(${heroImages[0] || DEMO_PHOTOS[0]}) center/cover no-repeat`, boxShadow: '0 10px 26px rgba(0,0,0,.4)', cursor: 'pointer', touchAction: 'manipulation', position: 'relative', padding: 0 }}
                    >
                      <span style={{ position: 'absolute', inset: -7, borderRadius: '50%', background: 'conic-gradient(from 0deg, transparent 0deg 250deg, var(--ann-accent) 320deg, transparent 360deg)', animation: 'evAdminHalo 2.6s linear infinite', pointerEvents: 'none' }} />
                    </button>
                  )}
                </div>
              )}
              </TabErrorBoundary>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      )}
      {/* TOAST NOTIFICATION */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ y: -100, x: '-50%', opacity: 0 }}
            animate={{ y: 20, x: '-50%', opacity: 1 }}
            exit={{ y: -100, x: '-50%', opacity: 0 }}
            className="fixed top-0 left-1/2 z-[580] w-full max-w-[320px] pointer-events-none"
          >
            <div className={`p-4 rounded-2xl shadow-2xl border flex items-center gap-3 pointer-events-auto ${
              toast.type === 'success' || toast.type === 'info'
                ? 'bg-[var(--ann-accent)] border-[var(--ann-accent)] text-white'
                : 'bg-red-500 border-red-600 text-white'
            }`}>
              {toast.type === 'success' && <Check className="w-5 h-5" />}
              {toast.type === 'info' && <ShieldCheck className="w-5 h-5" />}
              {toast.type === 'error' && <X className="w-5 h-5" />}
              <p className="text-sm font-bold">{toast.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin dashboard page (/admin) - separate page, not an overlay on the landing */}
      {isAdminModalOpen && adminGateOk && (
      <TabErrorBoundary label="Admin dashboard" isDarkMode={isDarkMode}>
      <AdminDashboardModal 
        isOpen={isAdminModalOpen}
        asPage={route === '/admin'}
        onClose={leaveAdminPage}
        onSignOut={() => doSignOut()}
        activeCode={activeAccessCode}
        onUpdateCode={updateAccessCode}
        posts={posts}
        videoOrientations={videoOrientations}
        events={EVENTS}
        story={STORY}
        weddingDetails={DETAILS}
        onSaveWedding={updateWedding}
        vendors={vendors}
        partners={partners}
        blockedUids={blockedUids}
        vendorRequests={vendorRequests}
        onUpdatePeople={updatePeople}
        onVendorAction={handleVendorRequest}
        approveGuestPosts={approveGuestPosts}
        pushEnabled={pushEnabled}
        archiveMode={archiveMode}
        feedActionMode={feedActionMode}
        feedPageSize={feedPageSize}
        onUpdateAppFlags={updateAppConfigFlags}
        feedPrivate={feedPrivate}
        updateFeedPrivacy={updateFeedPrivacy}
        revokeAccessCode={revokeAccessCode}
        onDownloadEverything={downloadEverything}
        onCreateMemoryBook={createMemoryBook}
        onDeleteAllGuestData={deleteAllGuestData}
        onDeletePost={(id: string) => {
          // Keep the dashboard open behind the confirm modal (the confirm modal
          // sits at z-801, above the dashboard's z-111), so rejecting a post
          // never kicks the admin out of moderation.
          setPostToDelete(id);
        }}
        onAdminDemoPost={(p: any) => setPosts((prev: any[]) => [p, ...prev])}
        isDarkMode={isDarkMode}
        heroImages={heroImages}
        heroImageLabels={heroImageLabels}
        onUpdateHeroLabels={updateHeroLabels}
        onSaveWeddingSection={updateWeddingSection}
        contactSettings={cfgContact}
        onUpdateFooterStyle={updateFooterStyle}
        footerStyle={footerStyle}
        footerThanks={footerThanks}
        onUpdateHeroTemplate={updateHeroTemplate}
        heroTpl={heroTpl}
        accentKey={accentKey}
        onUpdateAccent={updateAccent}
        onUpdateHeroImages={async (urls: string[]) => {
          const capped = urls.slice(0, 20);
          setHeroImages(capped);
          try {
            localStorage.setItem(lsKey('hero-images'), JSON.stringify(capped));
          } catch {
            // Ignore quota error
          }
          try {
            await setDoc(doc(db, scopedPath('app_config'), 'main'), {
              heroImages: capped,
              lastUpdated: serverTimestamp()
            }, { merge: true });
            showToast("Hero images updated!");
          } catch (err) {
            console.error("Update hero images error:", err);
            showToast("Failed to update hero images.", "error");
          }
        }}
        footerImages={footerImages}
        onUpdateFooterImages={async (urls: string[]) => {
          const capped = urls.slice(0, 40);
          setFooterImages(capped);
          try {
            localStorage.setItem(lsKey('footer-images'), JSON.stringify(capped));
          } catch {
            // Ignore quota error
          }
          try {
            await setDoc(doc(db, scopedPath('app_config'), 'main'), {
              footerImages: capped,
              lastUpdated: serverTimestamp()
            }, { merge: true });
            showToast("Footer images updated!");
          } catch (err) {
            console.error("Update footer images error:", err);
            showToast("Failed to update footer images.", "error");
          }
        }}
        allAdmins={allAdmins}
        selfRole={selfAdminRole}
        deletedPosts={deletedPosts}
        onRestorePost={handleRestorePost}
        onPermanentDelete={handlePermanentDelete}
        currentUserEmail={DEMO ? 'preview@eventicor.name.ng' : user?.email}
        adminPermissions={DEMO ? { canUploadImages: true, canDeletePosts: true, canSetAccessCode: true } : adminPermissions}
        showToast={showToast}
        onBackToMain={onBackToMain}
        postAds={postAds}
        reelAds={reelAds}
        onUpdatePostAds={async (ads: AdItem[]) => {
          try {
            await setDoc(doc(db, scopedPath('app_config'), 'main'), {
              postAds: ads,
              lastUpdated: serverTimestamp()
            }, { merge: true });
            showToast("Post feed ads updated!");
          } catch (err) {
            console.error("Update post ads error:", err);
            showToast("Failed to update post ads.", "error");
          }
        }}
        onUpdateReelAds={async (ads: AdItem[]) => {
          try {
            await setDoc(doc(db, scopedPath('app_config'), 'main'), {
              reelAds: ads,
              lastUpdated: serverTimestamp()
            }, { merge: true });
            showToast("Reels video ads updated!");
          } catch (err) {
            console.error("Update reel ads error:", err);
            showToast("Failed to update reel ads.", "error");
          }
        }}
      />
      </TabErrorBoundary>
      )}

      {/* /admin sign-in screen for signed-out visitors. While the auth
          listener is still restoring the session after a refresh, show a boot
          loader instead, never the sign-in screen. */}
      {route === '/admin' && adminMode === 'real' && !adminGateOk && (
        ((authChecked && !(user && !user.isAnonymous && !adminStatusChecked) && !adminRestorePending && !authTransient) || bootGateTimedOut) ? (
          <AuthScreen
            screen={authScreen ?? 'signin'}
            setScreen={setAuthScreen}
            coupleLabel={demoHeader()}
            onClose={leaveAdminPage}
            onSignIn={handleAdminLogin}
            onForgot={handleForgotPassword}
            busy={authBusy}
            error={authError}
            clearError={() => setAuthError('')}
            isDarkMode={isDarkMode}
          />
        ) : (
          <div className="fixed inset-0 z-[600] flex items-center justify-center bg-[#0B171C]">
            <div className="w-9 h-9 rounded-full border-4 border-[var(--ann-accent)] border-t-transparent animate-spin" />
          </div>
        )
      )}

      {/* Temporary debug banner: only renders with ?authdebug=1 */}
      {new URLSearchParams(window.location.search).has('authdebug') && (
        <div style={{position:'fixed',left:8,bottom:8,zIndex:99999,background:'#111',color:'#4f4',padding:'8px 10px',fontSize:'11px',fontFamily:'monospace',whiteSpace:'pre-wrap',maxWidth:'70vw',borderRadius:8}}>
          {'AUTHDEBUG\nadminMode ' + adminMode + '\nlistener ' + (debugState().listenerMode || '-') + ' realAuth ' + debugState().realAuth + '\nuser ' + (user ? ((user as any).email || user.uid) + (user.isAnonymous ? ' anon' : ' real') : 'null') + '\nisAdmin ' + isAdmin + ' mustSetPw ' + mustSetPassword + '\nroute ' + route + ' dash ' + isAdminModalOpen + '\nadmins ' + adminSync + ' pid ' + ((platformDb as any).app?.options?.projectId || '-')}
        </div>
      )}

      <DeleteConfirmationModal 
        isOpen={!!postToDelete}
        onClose={() => setPostToDelete(null)}
        onConfirm={() => {
          if (postToDelete) {
            handleDeletePost(postToDelete);
            setPostToDelete(null);
          }
        }}
        isDarkMode={isDarkMode}
      />

      {/* Post Composition Modal - BOTTOM SPLASH */}
      <AnimatePresence>
        {isComposeOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsComposeOpen(false)}
              className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[520px] z-[101] rounded-t-[32px] p-6 shadow-2xl border-t ${isDarkMode ? 'bg-[#13232A] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}
            >
              <div className="w-12 h-1.5 bg-[#DAD8E3] dark:bg-[#22363E] rounded-full mx-auto mb-6" />
              
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black font-display tracking-tight">Share a Memory</h3>
                <button 
                  onClick={() => setIsComposeOpen(false)}
                  className="p-2 rounded-full hover:bg-[#EEEDF3] dark:hover:bg-[#0B171C] transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-[var(--ann-accent)] flex items-center justify-center text-white font-bold shrink-0">
                  {avatar && !avatar.startsWith('blob:') ? <img src={avatar} className="w-full h-full object-cover" alt="" /> : <span>{(displayName || 'G').charAt(0).toUpperCase()}</span>}
                </div>
                <div className="min-w-0">
                  <b className="block text-[0.9rem] truncate">{displayName || 'Guest'}</b>
                  <small className="block opacity-50 text-[0.75rem]">{(vendors || []).includes(user?.uid) ? 'Official vendor' : 'Guest'}</small>
                </div>
              </div>

              {attachedMedia.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {attachedMedia.map((item, idx) => (
                    <div key={item.id} className={`relative rounded-xl overflow-hidden border border-[#DAD8E3] dark:border-[#22363E] bg-black ${item.orientation === 'portrait' ? 'aspect-[9/16] max-h-[200px]' : 'aspect-video'}`}>
                      {item.type === 'video' ? (
                        <video src={item.url} className="w-full h-full object-cover" muted playsInline />
                      ) : (
                        <img src={item.url} className="w-full h-full object-cover" alt="Attachment" />
                      )}
                      <button 
                        onClick={() => {
                          setAttachedMedia(prev => prev.filter((_, i) => i !== idx));
                          del(item.id); // Cleanup IDB
                        }}
                        className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full backdrop-blur-md"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {isUploading && (
                <p className="mt-3 text-[0.7rem] opacity-60 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Attaching your file…</span>
                </p>
              )}

              <div className="mt-4">
                <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-2">Which part of the celebration is this?</span>
                <div className="flex flex-wrap gap-2">
                  {EVENTS.map((e) => (
                    <button key={e.id} type="button" onClick={() => setNewPostEvent(newPostEvent === e.id ? '' : e.id)} className={`px-4 py-2 rounded-full text-[0.8rem] font-bold border transition-all ${newPostEvent === e.id ? 'bg-[var(--ann-accent)] text-white border-[var(--ann-accent)]' : (isDarkMode ? 'border-[#22363E] text-[#93A4AB]' : 'border-[#DAD8E3] text-[#5A6970]')}`}>{e.name}</button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <input 
                  type="password"
                  placeholder={!configLoaded ? "Checking access code..." : "Enter Access Code"}
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  disabled={!configLoaded || !activeAccessCode}
                  className={`w-full p-4 rounded-xl border-none outline-none font-black tracking-widest text-center transition-colors uppercase ${isDarkMode ? 'bg-[#0B171C] text-[var(--ann-accent)] placeholder-[#5A6970]' : 'bg-[#EEEDF3] text-[var(--ann-accent)] placeholder-[#93A4AB]'} ${(!configLoaded || !activeAccessCode) ? 'opacity-50' : ''}`}
                />
                {!configLoaded && (
                  <p className="text-[0.7rem] text-center mt-2 opacity-50 font-bold uppercase tracking-wider">Checking access code, please wait...</p>
                )}
                {configLoaded && !activeAccessCode && (
                  <p className="text-[0.7rem] text-center mt-2 text-red-500 font-bold uppercase tracking-wider">Posting is temporarily unavailable</p>
                )}
                {DEMO && configLoaded && activeAccessCode && (
                  <p className="text-[0.7rem] text-center mt-2 opacity-60 font-bold uppercase tracking-wider">Preview access code: {activeAccessCode}</p>
                )}
              </div>


              <textarea 
                placeholder="What's happening at the celebration?"
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                className={`mt-4 w-full min-h-[140px] p-4 rounded-2xl border-none outline-none resize-none text-[1.05rem] font-medium transition-colors ${isDarkMode ? 'bg-[#0B171C] text-white placeholder-[#5A6970]' : 'bg-[#EEEDF3] text-[#14262D] placeholder-[#93A4AB]'}`}
              />
              <p className="text-[0.7rem] opacity-50 font-medium">Up to 5 photos, or one video on its own.</p>
              <div className="mt-6 flex items-center justify-between">
                <div className="flex gap-2">
                  <input 
                    type="file" 
                    id="media-upload" 
                    className="hidden" 
                    accept="image/*,video/*"
                    multiple
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length === 0) return;

                      // One video per post, on its own; otherwise up to 5 photos.
                      const vids = files.filter((f: File) => Boolean(f.type && f.type.startsWith('video/')));
                      const imgs = files.filter((f: File) => !(f.type && f.type.startsWith('video/')));
                      const hasVideoAttached = attachedMedia.some((m) => m.type === 'video');
                      const rejectsVideo = vids.length > 1
                        || (vids.length === 1 && (imgs.length > 0 || attachedMedia.length > 0))
                        || (vids.length === 0 && hasVideoAttached);
                      if (rejectsVideo) {
                        showToast('One video at a time, on its own. Otherwise up to 5 photos.', 'error');
                        e.target.value = '';
                        return;
                      }

                      const filesToAdd = vids.length === 1 ? vids : imgs.slice(0, Math.max(0, 5 - attachedMedia.length));

                      if (filesToAdd.length === 0) {
                        showToast('Maximum 5 photos allowed per post.', 'error');
                        e.target.value = '';
                        return;
                      }
                      if (vids.length === 0 && imgs.length > filesToAdd.length) {
                        showToast(`You can attach up to 5 photos per post. Added the first ${filesToAdd.length}.`, 'error');
                      }

                      setIsUploading(true);
                      try {
                        const newMedia: {url: string, id: string, type: 'image' | 'video', orientation?: 'portrait' | 'landscape'}[] = [];
                        for (let i = 0; i < filesToAdd.length; i++) {
                          const file = filesToAdd[i] as File;
                          const fileId = `post_${Date.now()}_${i}`;
                          await set(fileId, file);
                          
                          const localUrl = URL.createObjectURL(file);
                          const isVid = Boolean(file.type && file.type.startsWith('video/'));
                          let orientation: 'portrait' | 'landscape' | undefined = undefined;

                          if (isVid) {
                            // Some phones hand over videos the browser cannot read
                            // metadata from (HEVC .mov files are the usual case) and
                            // then neither event ever fires: without a timeout the
                            // composer would wait forever and look frozen.
                            orientation = await new Promise<'portrait' | 'landscape'>((resolve) => {
                              let settled = false;
                              const finish = (o: 'portrait' | 'landscape') => { if (!settled) { settled = true; resolve(o); } };
                              const v = document.createElement('video');
                              v.preload = 'metadata';
                              v.onloadedmetadata = () => {
                                finish(v.videoHeight > v.videoWidth ? 'portrait' : 'landscape');
                              };
                              v.onerror = () => finish('landscape');
                              window.setTimeout(() => finish('landscape'), 4000);
                              v.src = localUrl;
                            });
                          }

                          newMedia.push({
                            url: localUrl,
                            id: fileId,
                            type: isVid ? 'video' : 'image',
                            orientation
                          });
                        }
                        setAttachedMedia(prev => [...prev, ...newMedia]);
                      } catch (err) {
                        console.error("Local storage error:", err);
                      } finally {
                        setIsUploading(false);
                      }
                    }}
                  />
                  <label 
                    htmlFor="media-upload"
                    className={`p-3 rounded-xl transition-colors cursor-pointer flex items-center gap-2 ${isDarkMode ? 'bg-[#0B171C] text-[#4FC3CF]' : 'bg-[var(--ann-soft)] text-[var(--ann-accent)]'}`}
                  >
                    <ImageIcon className="w-6 h-6" />
                    <VideoIcon className="w-6 h-6" />
                  </label>
                </div>
                
                <button 
                  disabled={(!newPostText.trim() && attachedMedia.length === 0) || isPosting || !configLoaded || !activeAccessCode}
                  onClick={async () => {
                    if (archiveMode) return; // Archive mode: the send button does not respond at all.
                    if (!newPostEvent) { showToast('Select the part of the celebration first.', 'error'); return; }
                    if (!accessCode.trim()) { showToast('Enter the access code before posting.', 'error'); return; }
                    if (!activeAccessCode) { showToast('No access code is set right now. Ask the couple for the new one.', 'error'); return; }
                    if (normalizeCode(accessCode) === normalizeCode(activeAccessCode ?? '')) {
                      if (DEMO) {
                        // Preview: the memory lives in this page only. Nothing is
                        // uploaded and nothing reaches the real couple's database.
                        const demoPost = {
                          id: `demo_${Date.now()}`,
                          localDemo: true,
                          authorUid: 'demo-self',
                          authorName: displayName || 'Guest',
                          authorPhoto: avatar && !avatar.startsWith('blob:') ? avatar : null,
                          text: newPostText,
                          mediaUrls: attachedMedia.map((m) => m.url),
                          mediaTypes: attachedMedia.map((m) => m.type || 'image'),
                          ...(attachedMedia.length === 1 && attachedMedia[0].type === 'video' && attachedMedia[0].orientation === 'portrait' ? { videoOrientation: 'portrait' } : {}),
                          ...(newPostEvent ? { eventId: newPostEvent } : {}),
                          pending: true,
                          likeCount: 0,
                          loveCount: 0,
                          commentCount: 0,
                          timestamp: new Date(),
                        };
                        setPosts((prev: any[]) => [demoPost, ...prev]);
                        setFeedSubTab(attachedMedia.length === 1 && attachedMedia[0].type === 'video' && attachedMedia[0].orientation === 'portrait' ? 'reels' : 'post');
                        setIsComposeOpen(false);
                        setNewPostText('');
                        setAccessCode('');
                        setNewPostEvent('');
                        setAttachedMedia([]);
                        showToast('Shared! Your post will be approved soon', 'success');
                        return;
                      }
                      setIsPosting(true);
                      try {
                        let finalMediaUrls: string[] = [];
                        let finalMediaTypes: ('image' | 'video')[] = [];
                        let postVideoOrientation: 'portrait' | 'landscape' | null = null;
                        let finalAvatarUrl = avatar;

                        // 1. Check if profile needs uploading/saving
                        const tempAvatar = await get('temp_profile_avatar');
                        if (tempAvatar && avatar?.startsWith('blob:')) {
                          const url = await uploadToCloudinary(tempAvatar, 'residents');
                          finalAvatarUrl = url;
                          // Update residents collection too
                          await setDoc(doc(db, scopedPath('residents'), user.uid), {
                            displayName,
                            photoUrl: finalAvatarUrl,
                            updatedAt: serverTimestamp()
                          }, { merge: true });
                          await del('temp_profile_avatar');
                          setAvatar(finalAvatarUrl);
                        }

                        // 2. The post appears in the feed right away with its media
                        // preview; the upload percentage renders on the card itself.
                        const pendingFlag = approveGuestPosts && !(vendors || []).includes(user.uid) && !isAdmin;
                        setUploadingPost({
                          id: `local_${Date.now()}`,
                          authorName: displayName || 'Guest',
                          authorPhoto: finalAvatarUrl || null,
                          text: newPostText,
                          localMediaUrls: attachedMedia.map((m) => m.url),
                          mediaTypes: attachedMedia.map((m) => m.type || 'image'),
                          pending: pendingFlag,
                          uploadProgress: 0
                        });
                        if (attachedMedia.length === 1 && attachedMedia[0].type === 'video' && attachedMedia[0].orientation === 'portrait') {
                          setFeedSubTab('reels');
                        } else {
                          setFeedSubTab('post');
                        }
                        setIsComposeOpen(false);
                        setNewPostText('');
                        setAccessCode('');
                        setNewPostEvent('');
                        setAttachedMedia([]);

                        // 3. Upload the media with live progress, then publish.
                        let uploadedCount = 0;
                        const totalFiles = attachedMedia.length || 1;
                        for (const item of attachedMedia) {
                          const tempFile = await get(item.id);
                          if (tempFile) {
                            const url = await uploadToCloudinaryWithProgress(tempFile, 'posts', (pct) => {
                              setUploadingPost((prev) => prev ? { ...prev, uploadProgress: Math.min(99, Math.round(((uploadedCount + pct / 100) / totalFiles) * 100)) } : prev);
                            });
                            finalMediaUrls.push(url);
                            finalMediaTypes.push(item.type || 'image');
                            if (item.type === 'video' && item.orientation) {
                              postVideoOrientation = item.orientation;
                            }
                            // Cleanup IndexedDB
                            await del(item.id);
                          }
                          uploadedCount++;
                          setUploadingPost((prev) => prev ? { ...prev, uploadProgress: Math.min(99, Math.round((uploadedCount / totalFiles) * 100)) } : prev);
                        }

                        await addDoc(collection(db, scopedPath('posts')), {
                          authorUid: user.uid,
                          authorName: displayName || 'Guest',
                          authorPhoto: finalAvatarUrl || null,
                          text: newPostText,
                          mediaUrls: finalMediaUrls,
                          mediaTypes: finalMediaTypes,
                          ...(postVideoOrientation ? { videoOrientation: postVideoOrientation } : {}),
                          ...(newPostEvent ? { eventId: newPostEvent } : {}),
                          pending: pendingFlag,
                          likeCount: 0,
                          loveCount: 0,
                          timestamp: serverTimestamp()
                        });
                        setUploadingPost(null);

                        showToast(pendingFlag ? 'Shared! Your post will be approved soon' : (approveGuestPosts ? 'Posted instantly. Only guest posts wait for approval.' : 'Memory shared successfully!'), 'success');

                      } catch (err: any) {
                        console.error("Post error:", err);
                        setUploadingPost(null);
                        const pcode = String(err?.code || '');
                        const pmsg = String(err?.message || '');
                        showToast(pmsg.includes('storage is full')
                          ? STORAGE_FULL_MESSAGE
                          : pcode.includes('permission-denied')
                          ? 'The couple\u2019s post settings are not accepting this right now. Try again later.'
                          : 'Failed to share memory. Check your connection and try again.', 'error');
                      } finally {
                        setIsPosting(false);
                      }
                    } else {
                      showToast('Invalid access code. Check with the couple.', 'error');
                    }
                  }}
                  className={`px-8 py-3.5 rounded-full font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                    ((newPostText.trim() || attachedMedia.length > 0) && !isPosting)
                      ? 'bg-[var(--ann-accent)] text-white shadow-lg hover:scale-105 active:scale-95' 
                      : 'bg-[#DAD8E3] dark:bg-[#22363E] text-[#5A6970] opacity-50'
                  }`}
                >
                  {isPosting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Posting...
                    </>
                  ) : 'Post'}
                </button>
              </div>
              
              <div className="h-[env(safe-area-inset-bottom,20px)]" />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Footer image lightbox */}
      <AnimatePresence>
        {footerLightbox && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFooterLightbox(null)}
              className="fixed inset-0 z-[140] bg-black/90 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={() => setFooterLightbox(null)}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[141] cursor-pointer"
            >
              <img
                src={footerLightbox}
                className="max-w-[86vw] max-h-[80vh] object-contain rounded-2xl shadow-2xl"
                alt="Memory"
              />
              <button
                onClick={(e) => { e.stopPropagation(); setFooterLightbox(null); }}
                aria-label="Close"
                className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-white text-[#14262D] shadow-lg grid place-items-center hover:bg-[#EEEDF3] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {avatarZoom && (
        <AvatarZoomModal src={avatarZoom} onClose={() => setAvatarZoom(null)} />
      )}

      {/* Admin email/password auth screens */}
      {authScreen && (
        <AuthScreen
          screen={authScreen}
          setScreen={setAuthScreen}
          coupleLabel={demoHeader()}
          onClose={() => { setAuthScreen(null); setAuthError(''); shortcutLoginRef.current = false; }}
          onSignIn={handleAdminLogin}
          onForgot={handleForgotPassword}
          busy={authBusy}
          error={authError}
          clearError={() => setAuthError('')}
          isDarkMode={isDarkMode}
        />
      )}
      {user && !user.isAnonymous && mustSetPassword && !authScreen && (
        <ForceSetPasswordScreen
          isDarkMode={isDarkMode}
          busy={setPasswordBusy}
          error={authError}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          confirmPassword={confirmNewPassword}
          setConfirmPassword={setConfirmNewPassword}
          onSubmit={handleSetPermanentPassword}
          onSignOut={() => { doSignOut(); setMustSetPassword(false); setAuthError(''); }}
        />
      )}

      {/* Bottom Nav - DYNAMIC FEED/SEND BUTTON (hidden while viewing full-portrait Reels or comments) */}
      {!(activeTab === 'feed' && feedSubTab === 'reels') && !commentsPost && (
      <nav className={`fixed left-1/2 bottom-0 -translate-x-1/2 w-full max-w-[520px] z-[90] grid grid-cols-3 items-end p-[8px_12px_calc(8px+env(safe-area-inset-bottom,0px))] border-t transition-colors ${isDarkMode ? 'bg-[#13232A] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}${noChrome ? ' hidden' : ''}`}>
        <button 
          onClick={() => setActiveTab('home')}
          className={`border-0 bg-transparent flex flex-col items-center gap-[3px] p-[6px_0] min-h-[52px] text-[0.74rem] ${activeTab === 'home' ? 'text-[var(--ann-accent)] font-bold' : 'text-[#5A6970]'}`}
        >
          <HomeIcon active={activeTab === 'home'} />
          <span>Home</span>
        </button>
        <button 
          onClick={() => {
            if (activeTab !== 'feed') {
              setActiveTab('feed');
            } else if (archiveMode) {
              // Archive mode: the Send button does not respond at all.
            } else if (DEMO) {
              setIsComposeOpen(true); // Preview skips the profile check
            } else {
              // A saved profile is a residents doc with a display name; the
              // profile photo is optional. The sync above restores the name
              // on return visits, so a guest who already saved can post again.
              if (!displayName.trim()) {
                setShowProfileModal(true);
              } else {
                setIsComposeOpen(true);
              }
            }
          }}
          className="relative -top-[18px] flex flex-col items-center gap-[5px] border-0 bg-transparent text-[0.74rem]"
        >
          <div className={`grid place-items-center w-[58px] h-[58px] rounded-full bg-[var(--ann-accent)] text-white shadow-[0_6px_18px_rgba(14,107,117,0.38)] border-4 transition-all duration-300 ${isDarkMode ? 'border-[#13232A]' : 'border-white'} ${activeTab === 'feed' ? 'scale-110 shadow-[0_8px_24px_rgba(14,107,117,0.5)]' : ''}`}>
            {activeTab === 'feed' ? (
              <Send className="w-[26px] h-[26px] stroke-[2.4]" />
            ) : (
              <Plus className="w-[26px] h-[26px] stroke-[2.4]" />
            )}
          </div>
          <span className={activeTab === 'feed' ? 'text-[var(--ann-accent)] font-bold' : 'text-[#5A6970]'}>
            {activeTab === 'feed' ? 'Send' : 'Feed'}
          </span>
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`border-0 bg-transparent flex flex-col items-center gap-[3px] p-[6px_0] min-h-[52px] text-[0.74rem] ${activeTab === 'settings' ? 'text-[var(--ann-accent)] font-bold' : 'text-[#5A6970]'}`}
        >
          <SettingsIcon active={activeTab === 'settings'} />
          <span>Settings</span>
        </button>
      </nav>
      )}

      {/* Install guide: the full installation page (animated phone + steps)
          opens over the app when the header Install button is tapped, with
          nothing but the guide in it - no WhatsApp or web link info. Android
          gets the install button, iPhone the 2-step guide. */}
      {showIOSInstallModal && (
        <div className="fixed inset-0 z-[210] overflow-y-auto" role="dialog" aria-label="Install guide">
          <button
            onClick={() => setShowIOSInstallModal(false)}
            className="fixed top-4 right-4 z-[212] w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center text-2xl leading-none shadow-lg"
            aria-label="Close install guide"
          >
            &times;
          </button>
          <Suspense fallback={<div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'system-ui, sans-serif', fontSize: 14 }}>Loading install guide…</div>}>
            <InstallGuide guideOnly names={demoHeader()} installable={installable} onInstallStart={() => showToast('Installing\u2026', 'info', true)} onInstallDismiss={() => setToast(null)} />
          </Suspense>
        </div>
      )}

      {/* Sharing and Media Overlays */}
      {sharingPost && (
        <ShareSheet 
          post={sharingPost} 
          isDarkMode={isDarkMode} 
          onClose={() => setSharingPost(null)} 
          showToast={showToast}
        />
      )}

      {commentsPost && (
        <CommentsSheet
          post={commentsPost}
          isDarkMode={isDarkMode}
          user={user}
          displayName={displayName}
          avatar={avatar}
          isAdmin={isAdmin}
          archiveMode={archiveMode}
          showToast={showToast}
          onClose={() => setCommentsPost(null)}
        />
      )}
      
      {activeMediaIndex && (
        <MediaLightbox 
          post={posts.find(p => p.id === activeMediaIndex.postId) || null}
          initialIndex={activeMediaIndex.index}
          isDarkMode={isDarkMode}
          onClose={() => setActiveMediaIndex(null)}
        />
      )}
    </div>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-[22px] h-[22px] fill-none stroke-current stroke-[1.8] ${active ? 'text-[var(--ann-accent)]' : ''}`} viewBox="0 0 24 24">
      <path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-[22px] h-[22px] fill-none stroke-current stroke-[1.8] ${active ? 'text-[var(--ann-accent)]' : ''}`} viewBox="0 0 24 24">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>
    </svg>
  );
}

function WhatsAppIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.031 2c-5.516 0-9.969 4.453-9.969 9.969 0 1.758.459 3.473 1.332 4.988L2 22l5.182-1.359c1.466.799 3.111 1.221 4.849 1.221 5.516 0 9.969-4.453 9.969-9.969 0-2.663-1.037-5.167-2.92-7.049C17.197 3.037 14.693 2 12.031 2zm5.819 14.281c-.242.681-1.404 1.304-1.958 1.387-.511.077-1.158.11-1.872-.116-.434-.138-.992-.323-1.707-.632-3.003-1.297-4.962-4.324-5.112-4.525-.15-.201-1.221-1.624-1.221-3.098 0-1.474.772-2.198 1.047-2.499.275-.301.6-.376.8-.376.2 0 .4.002.575.01.184.009.431-.07.674.515.25.603.85 2.076.925 2.227.075.151.125.327.025.528-.1.201-.15.327-.3.503-.15.176-.315.393-.45.528-.15.15-.306.313-.131.614.175.301.778 1.284 1.67 2.079 1.148 1.023 2.115 1.34 2.415 1.49.3.151.475.126.65-.075.175-.201.75-.879.95-1.18.2-.301.4-.251.675-.151.275.1 1.75.826 2.05.976.3.151.5.226.575.352.075.125.075.728-.167 1.409z"/>
    </svg>
  );
}

function ShareSheet({ post, isDarkMode, onClose, showToast }: any) {
  const shareUrl = `${window.location.origin}${window.location.pathname}?post=${post.id || post.uid}`;
  const title = post.text || demoText("Check out this memory from Amara & Daniel's wedding!");

  const shareOptions = [
    { 
      name: 'WhatsApp', 
      icon: <WhatsAppIcon className="w-7 h-7 text-white" />, 
      color: 'bg-[#25D366]', 
      url: `https://wa.me/?text=${encodeURIComponent(title + ' ' + shareUrl)}` 
    },
    { 
      name: 'Copy Link', 
      icon: <ExternalLink className="w-6 h-6 text-white" />, 
      color: 'bg-[var(--ann-accent)]', 
      action: () => {
        navigator.clipboard.writeText(shareUrl);
        if (showToast) showToast('Link copied');
      }
    },
    { 
      name: 'Twitter / X', 
      icon: <span className="text-white font-bold text-xl">𝕏</span>, 
      color: 'bg-black', 
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(shareUrl)}` 
    }
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center">
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        />
        <motion.div 
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          className={`relative w-full max-w-[500px] p-6 rounded-t-[32px] sm:rounded-[32px] shadow-2xl ${isDarkMode ? 'bg-[#13232A]' : 'bg-white'}`}
        >
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-6 sm:hidden" />
          <h3 className="text-xl font-black font-display text-center mb-8">Share Memory</h3>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {shareOptions.map((opt, i) => (
              <button 
                key={i} 
                onClick={() => { 
                  if (opt.action) {
                    opt.action();
                  } else if (opt.url) {
                    const a = document.createElement('a');
                    a.href = opt.url;
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }
                  onClose(); 
                }}
                className="flex flex-col items-center gap-2 group"
              >
                <div className={`w-14 h-14 ${opt.color} rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                  {opt.icon}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{opt.name}</span>
              </button>
            ))}
          </div>
          <button 
            onClick={onClose}
            className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest ${isDarkMode ? 'bg-white/5 text-white/40' : 'bg-gray-100 text-gray-500'}`}
          >
            Cancel
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// Browsers refuse to autoplay a video with sound unless a real user gesture
// started it. Try sound first; when the browser refuses, start muted so the
// video still plays, and surface a "Tap for sound" pill (a tap is a real
// gesture, so unmuting then brings the audio straight back).
const startVideoBestEffort = (vid: HTMLVideoElement | null, onSoundBlocked?: (blocked: boolean) => void): void => {
  if (!vid) return;
  vid.muted = false;
  const p = vid.play();
  if (p && typeof p.catch === 'function') {
    p.then(() => { if (onSoundBlocked) onSoundBlocked(false); }).catch(() => {
      vid.muted = true;
      const p2 = vid.play();
      if (p2 && typeof p2.catch === 'function') p2.catch(() => {});
      if (onSoundBlocked) onSoundBlocked(true);
    });
  }
};

// The fullscreen viewers' video: autoplays as soon as it is shown, with
// sound when the browser allows it and a one-tap unmute when it does not.
function AutoSoundVideo({ src, className, onMediaClick, onEnded }: { src: string; className?: string; onMediaClick?: (e: any) => void; onEnded?: () => void }) {
  const vidRef = useRef<HTMLVideoElement | null>(null);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [mutedNow, setMutedNow] = useState(true);
  useEffect(() => {
    setSoundBlocked(false);
    const vid = vidRef.current;
    if (!vid) return;
    const attempt = () => startVideoBestEffort(vid, setSoundBlocked);
    const t = window.setTimeout(attempt, 80);
    // If the first try lands before the browser holds any data, play() can
    // reject for reasons that have nothing to do with sound, so retry once
    // the first frame can actually play before going quiet.
    const onCanPlay = () => attempt();
    vid.addEventListener('canplay', onCanPlay, { once: true });
    return () => { window.clearTimeout(t); vid.removeEventListener('canplay', onCanPlay); };
  }, [src]);
  const toggleMute = () => {
    const vid = vidRef.current;
    if (!vid) return;
    vid.muted = !vid.muted;
    vid.play().catch(() => {});
    setSoundBlocked(false);
  };
  return (
    <div className="relative flex items-center justify-center max-w-full max-h-full">
      <video
        ref={vidRef}
        src={src}
        className={className}
        controls
        playsInline
        controlsList="nodownload noplaybackrate"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        onClick={onMediaClick}
        onEnded={onEnded}
        onVolumeChange={(e: any) => setMutedNow(!!e.currentTarget?.muted)}
      />
      <button
        onClick={(e) => { e.stopPropagation(); toggleMute(); }}
        className="absolute top-3 right-3 p-2.5 rounded-full bg-black/55 text-white backdrop-blur-md hover:bg-black/75 transition-colors z-10"
        style={{ touchAction: 'manipulation' }}
        aria-label={mutedNow ? 'Turn sound on' : 'Turn sound off'}
      >
        {mutedNow ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>
      {soundBlocked && (
        <button
          onClick={(e) => { e.stopPropagation(); toggleMute(); }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/70 text-white text-[0.65rem] font-black uppercase tracking-widest z-10 shadow-lg"
          style={{ touchAction: 'manipulation' }}
        >
          <VolumeX className="w-4 h-4" />
          Tap for sound
        </button>
      )}
    </div>
  );
}

// Branded dropdown (user direction Nov 21 2026): replaces every native
// <select> in the app. A button styled like the app's own fields opens a
// panel of options; the panel never fights the screen edge: not enough room
// below the button and it opens upward, not enough room above and it opens
// downward. Nothing here is a browser picker.
function BrandedSelect({ value, onChange, options, ariaLabel, className, isDarkMode, compact }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; ariaLabel?: string; className?: string; isDarkMode: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ left: number; top: number; bottom: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const est = Math.min(options.length * 40 + 14, 236);
  const openUp = rect ? rect.bottom + est + 10 > window.innerHeight && rect.top - est - 10 > 0 : false;
  const toggle = () => {
    if (open) { setOpen(false); return; }
    const el = btnRef.current;
    if (el) { const r = el.getBoundingClientRect(); setRect({ left: r.left, top: r.top, bottom: r.bottom, width: Math.max(r.width, 150) }); }
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDoc = (e: any) => { const t = e.target as Node; if (btnRef.current && panelRef.current && !btnRef.current.contains(t) && !panelRef.current.contains(t)) close(); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    // Scrolling the option list itself must not close the panel (user report
    // Nov 21 2026): only a scroll outside it does.
    const onScroll = (e: Event) => {
      const t = e.target as Node | null;
      if (panelRef.current && t && panelRef.current.contains(t)) return;
      close();
    };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onEsc);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onEsc);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);
  const current = options.find((o) => o.value === value);
  const btnCls = className || `p-3 rounded-xl border font-bold text-sm ${isDarkMode ? 'bg-[#0B171C] border-[#22363E] text-white' : 'bg-white border-[#DAD8E3] text-[#14262D]'}`;
  return (
    <div className="relative w-full">
      <button type="button" ref={btnRef} onClick={toggle} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} className={`flex items-center justify-between gap-2 w-full text-left ${btnCls}`}>
        <span className="truncate">{current ? current.label : 'Select'}</span>
        <ChevronDown className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} shrink-0 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && rect && (
        <div
          ref={panelRef}
          role="listbox"
          aria-label={ariaLabel}
          style={{ position: 'fixed', left: rect.left, top: openUp ? undefined : rect.bottom + 6, bottom: openUp ? window.innerHeight - rect.top + 6 : undefined, width: rect.width, maxHeight: Math.min(est, window.innerHeight - 24), zIndex: 1200 }}
          className={`rounded-2xl border shadow-2xl py-1 overflow-y-auto ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`flex items-center justify-between gap-3 w-full text-left px-4 py-2 text-sm font-bold ${o.value === value ? 'text-[var(--ann-accent)]' : isDarkMode ? 'text-white/80' : 'text-[#14262D]'} ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-[#EEEDF3]'}`}
            >
              <span className="truncate">{o.label}</span>
              {o.value === value && <Check className="w-4 h-4 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// A partner card on the app's home page (user direction Nov 21 2026): the
// basics always show, and a branded dropdown reveals the contact details the
// couple saved (WhatsApp, Instagram, website, TikTok, Facebook, YouTube),
// whichever of those are filled. Nothing here leads out of the app: the
// website address is plain text, never a link.
function PartnerHomeCard({ p, isDarkMode }: { p: any; isDarkMode: boolean }) {
  const [open, setOpen] = useState(false);
  const rows = [
    { label: 'WhatsApp', value: String(p.whatsapp || '').trim() },
    { label: 'Instagram', value: String(p.instagram || '').trim() },
    { label: 'Website', value: String(p.website || '').trim() },
    { label: 'TikTok', value: String(p.tiktok || '').trim() },
    { label: 'Facebook', value: String(p.facebook || '').trim() },
    { label: 'YouTube', value: String(p.youtube || '').trim() },
  ].filter((r) => r.value);
  const cardCls = `flex flex-col p-[14px_16px] rounded-[18px] border ${isDarkMode ? 'bg-[#13232A] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`;
  return (
    <div className={cardCls}>
      <button
        type="button"
        onClick={() => { if (rows.length) setOpen(!open); }}
        className={`flex items-center gap-3 w-full text-left ${rows.length ? 'cursor-pointer' : 'cursor-default'}`}
        style={rows.length ? { touchAction: 'manipulation' } : { pointerEvents: 'none' }}
        aria-expanded={rows.length ? open : undefined}
      >
        {p.photo
          ? <img src={p.photo} alt={p.name || 'Partner'} className="w-12 h-12 rounded-full object-cover shrink-0" />
          : <span className="w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-white font-black text-lg" style={{ background: 'var(--ann-accent)' }}>{(p.name || '?').slice(0, 1).toUpperCase()}</span>}
        <div className="min-w-0 flex-1">
          <b className="block text-[0.95rem] font-serif-display">{p.name}</b>
          {p.category ? <span className={`block text-[0.7rem] ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>{p.category}</span> : null}
          {p.description ? <p className={`m-0 text-[0.78rem] mt-1 leading-snug ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{p.description}</p> : null}
        </div>
        {rows.length > 0 && <ChevronDown className={`w-4 h-4 opacity-50 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
      {open && rows.length > 0 && (
        <div className={`mt-3 pt-3 border-t space-y-1.5 ${isDarkMode ? 'border-[#22363E]' : 'border-[#DAD8E3]'}`}>
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3">
              <span className={`shrink-0 text-[0.6rem] font-black uppercase tracking-widest ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'} opacity-70`}>{r.label}</span>
              <span className={`truncate text-[0.78rem] ${isDarkMode ? 'text-white/85' : 'text-[#14262D]'}`}>{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MediaLightbox({ post, initialIndex, isDarkMode, onClose }: any) {
  const [index, setIndex] = useState(initialIndex);
  const media = post.mediaUrls || (post.mediaUrl ? [post.mediaUrl] : []);
  const current = media[index];
  const isVideo = current?.toLowerCase().includes('.mp4') || current?.includes('/video/');

  const handleDownload = async () => {
    try {
      const response = await fetch(current);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dara-femi-memory-${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] bg-black flex flex-col items-center justify-center">
      <div className="absolute top-0 w-full p-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          {!isVideo && (
            <button
              onClick={handleDownload}
              className="p-2.5 bg-white/15 hover:bg-white/25 text-white rounded-full transition-colors flex items-center justify-center"
              title="Download Image"
              aria-label="Download Image"
            >
              <Download className="w-5 h-5" />
            </button>
          )}
          <span className="text-white text-sm font-bold">{index + 1} / {media.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-2 text-white/60 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="w-full flex-1 relative flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div 
            key={current}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-full h-full flex items-center justify-center p-4"
          >
            {isVideo ? (
              <AutoSoundVideo src={current} className="max-w-full max-h-full rounded-lg" />
            ) : (
              <img src={current} className="max-w-full max-h-full object-contain rounded-lg" alt="" />
            )}
          </motion.div>
        </AnimatePresence>

        {media.length > 1 && (
          <>
            <button 
              onClick={() => setIndex((index - 1 + media.length) % media.length)}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 text-white rounded-full hover:bg-black/60 transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setIndex((index + 1) % media.length)}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 text-white rounded-full hover:bg-black/60 transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      <div className="w-full p-6 pb-12 bg-gradient-to-t from-black to-transparent text-white">
        <p className="text-sm line-clamp-3">{post.text}</p>
        <p className="text-[10px] uppercase font-black tracking-widest opacity-40 mt-2">By {post.authorName}</p>
      </div>
    </div>
  );
}

// Swipeable carousel for posts with several photos: one slide fills the card,
// swipe or the arrows move between them, dots track position, tap opens the lightbox.
function MediaCarousel({ urls, mediaTypes, eventName, onOpenMedia }: { urls: string[]; mediaTypes?: string[]; eventName?: string; onOpenMedia: (i: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [slide, setSlide] = useState(0);

  const handleScroll = () => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    setSlide(Math.min(urls.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  };
  const goTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="mt-[10px] relative rounded-[18px] overflow-hidden border border-[#DAD8E3] dark:border-[#22363E] bg-black shadow-md">
      {eventName && slide === 0 && (
        <span className="absolute bottom-3 left-3 z-20 px-2.5 py-[3px] rounded-full bg-black/40 text-white text-[13px] pointer-events-none">{eventName}</span>
      )}
      {urls.length > 1 && (
        <span className="absolute top-3 right-3 z-20 px-2 py-[2px] rounded-full bg-black/50 text-white text-[0.68rem] font-bold">{slide + 1}/{urls.length}</span>
      )}
      {urls.length > 1 && (
        <>
          <button type="button" aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); goTo(Math.max(0, slide - 1)); }} className={`hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full items-center justify-center bg-black/45 text-white hover:bg-black/65 transition-all ${slide === 0 ? 'opacity-0 pointer-events-none' : ''}`}><ChevronLeft className="w-5 h-5" /></button>
          <button type="button" aria-label="Next photo" onClick={(e) => { e.stopPropagation(); goTo(Math.min(urls.length - 1, slide + 1)); }} className={`hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full items-center justify-center bg-black/45 text-white hover:bg-black/65 transition-all ${slide === urls.length - 1 ? 'opacity-0 pointer-events-none' : ''}`}><ChevronRight className="w-5 h-5" /></button>
        </>
      )}
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
      >
        {urls.map((url: string, i: number) => {
          const isVideo = mediaTypes?.[i] === 'video' || url.toLowerCase().includes('.mp4') || url.toLowerCase().includes('.webm') || url.toLowerCase().includes('.mov') || url.includes('/video/');
          return (
            <div
              key={i}
              className={`relative w-full shrink-0 snap-center cursor-pointer group ${urls.length === 1 ? 'max-h-[420px]' : 'h-[340px] sm:h-[420px]'}`}
              onClick={() => onOpenMedia(i)}
            >
              {isVideo ? (
                <video src={url} className="w-full h-full object-cover" muted playsInline />
              ) : (
                <img src={url} className="w-full h-full object-cover" alt="" draggable={false} />
              )}
              {isVideo && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Play className="w-8 h-8 text-white fill-current" />
                </div>
              )}
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          );
        })}
      </div>
      {urls.length > 1 && (
        <div className="absolute bottom-3 left-0 right-0 z-10 flex justify-center gap-1.5 pointer-events-none">
          {urls.map((_, i) => (
            <span key={i} className={`w-[6px] h-[6px] rounded-full transition-colors ${i === slide ? 'bg-white' : 'bg-white/40'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function Post({ 
  id, 
  name, 
  avatar, 
  onAvatarClick,
  text, 
  time, 
  mediaUrls, 
  mediaTypes,
  likeCount = 0, 
  loveCount = 0, 
  isDarkMode, 
  isAdmin, 
  user,
  onDelete,
  onLike,
  onLove,
  onShare,
  onOpenMedia,
  onComment,
  commentCount = 0,
  eventName,
  authorRole,
  authorUid,
  pending,
  onApprove,
  sample
}: any) {
  const [localLiked, setLocalLiked] = useState(false);
  const [localLoved, setLocalLoved] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const isLongText = Boolean(text && (text.length > 180 || text.split('\n').length > 4));
  const displayedText = isLongText && !isExpanded
    ? text.slice(0, 180).trimEnd() + '...'
    : text;

  useEffect(() => {
    if (!user || !id) return;
    const reactionRef = doc(db, scopedPath('posts'), id, 'reactions', user.uid);
    const unsub = onSnapshot(reactionRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setLocalLiked(!!data.like);
        setLocalLoved(!!data.love);
      } else {
        setLocalLiked(false);
        setLocalLoved(false);
      }
    });
    return () => unsub();
  }, [user, id]);

  const displayLiked = localLiked;
  const displayLoved = localLoved;
  return (
    <article id={`post-${id}`} className="flex gap-3 p-[20px_4px] border-b-[6px] border-[#D0CEDB] dark:border-[#1E323A] transition-all">
      <div
        onClick={() => onAvatarClick && avatar && onAvatarClick(avatar)}
        className={`flex-shrink-0 w-[42px] h-[42px] rounded-full overflow-hidden border ${isDarkMode ? 'border-[#22363E]' : 'border-[#DAD8E3]'} bg-[var(--ann-accent)] flex items-center justify-center text-white font-bold text-[0.9rem] ${avatar ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
      >
        {avatar ? <img src={avatar} className="w-full h-full object-cover" alt="" /> : <span>{name?.[0]?.toUpperCase() || 'R'}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <strong className="text-[1rem] leading-tight">{name}</strong>
            {authorRole === 'vendor' && (<span className="ml-1 inline-block align-middle text-[11px] font-bold px-2 py-[1px] rounded-full bg-[#C8932A] text-[#21122B]">Official</span>)}
            {authorRole === 'couple' && (<span className="ml-1 inline-block align-middle text-[11px] font-bold px-2 py-[1px] rounded-full bg-[var(--ann-accent)] text-white">Couple</span>)}
            {pending && (<span className="ml-1 inline-block align-middle text-[11px] font-bold px-2 py-[1px] rounded-full bg-[#C8932A] text-white">Awaiting approval</span>)}
            {sample && (<span className="ml-1 inline-block align-middle text-[11px] font-bold px-2 py-[1px] rounded-full bg-[#5A6970] text-white">Sample</span>)}
            <span className="text-[0.8rem] text-[#5A6970] dark:text-[#93A4AB] flex items-center gap-1">
              <span aria-hidden="true">·</span>
              <span>{time}</span>
            </span>
          </div>
          {eventName && (
            <span className="block w-full text-[0.8rem] text-[#5A6970] dark:text-[#93A4AB]">{eventName}</span>
          )}
          <div className="contents">
          </div>
          {isAdmin && (
            <button 
              onClick={onDelete}
              className="p-1.5 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
              title='Delete post'
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        {text && (
          (!mediaUrls || mediaUrls.length === 0) ? (
            <div className="m-[10px_0_2px] rounded-2xl bg-[var(--ann-accent)]/[0.06] dark:bg-[var(--ann-accent)]/15 p-[18px] relative">
              <span aria-hidden="true" className="absolute -top-2 left-4 font-serif-display text-5xl text-[var(--ann-accent)]/25 select-none leading-none">&ldquo;</span>
              <p className="font-serif-display italic text-[1.08rem] leading-relaxed whitespace-pre-wrap m-0">
                {displayedText}
              </p>
              {isLongText && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="mt-1 text-[0.9rem] font-extrabold text-[var(--ann-accent)] dark:text-[#4FC3CF] hover:underline focus:outline-none inline-flex items-center"
                >
                  {isExpanded ? 'See less' : 'See more'}
                </button>
              )}
            </div>
          ) : (
          <div className="m-[4px_0_0]">
            <p className="text-[1rem] leading-normal whitespace-pre-wrap inline">
              {displayedText}
            </p>
            {isLongText && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="ml-1.5 text-[0.9rem] font-extrabold text-[var(--ann-accent)] dark:text-[#4FC3CF] hover:underline focus:outline-none inline-flex items-center"
              >
                {isExpanded ? 'See less' : 'See more'}
              </button>
            )}
          </div>
          )
        )}
        
        {mediaUrls && mediaUrls.length > 0 && (
          <MediaCarousel urls={mediaUrls} mediaTypes={mediaTypes} eventName={eventName} onOpenMedia={onOpenMedia} />
        )}

        <div className="grid grid-cols-3 gap-2 w-full mt-3">
          <button
            onClick={onLike}
            className={`flex items-center justify-center gap-1.5 py-[9px] px-2 rounded-xl border text-[13px] transition-all ${displayLiked ? 'text-[var(--ann-accent)] dark:text-[#4FC3CF] border-[var(--ann-accent)] dark:border-[#4FC3CF] font-bold' : 'text-[#5A6970] dark:text-[#93A4AB] border-[#DAD8E3] dark:border-[#22363E] font-medium hover:border-[var(--ann-accent)]/60'}`}
          >
            <ThumbsUp className="w-[17px] h-[17px]" />
            <span>Like{likeCount > 0 ? ` ${likeCount}` : ''}</span>
          </button>
          <button
            onClick={onComment}
            className="flex items-center justify-center gap-1.5 py-[9px] px-2 rounded-xl border border-[#DAD8E3] dark:border-[#22363E] text-[13px] font-medium text-[#5A6970] dark:text-[#93A4AB] hover:border-[var(--ann-accent)]/60 transition-all"
          >
            <MessageCircle className="w-[17px] h-[17px]" />
            <span>Comment{commentCount > 0 ? ` ${commentCount}` : ''}</span>
          </button>
          <button
            onClick={onShare}
            className="flex items-center justify-center gap-1.5 py-[9px] px-2 rounded-xl border border-[#DAD8E3] dark:border-[#22363E] text-[13px] font-medium text-[#5A6970] dark:text-[#93A4AB] hover:border-[var(--ann-accent)]/60 transition-all"
          >
            <Share2 className="w-[17px] h-[17px]" />
            <span>Share</span>
          </button>
        </div>
      </div>
    </article>
  );
}

const formatExternalUrl = (url?: string): string => {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed) || /^tel:/i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed.replace(/^\/+/, '')}`;
};

function PostAdCard({ ad, isDarkMode }: { ad: AdItem; isDarkMode: boolean; [key: string]: any }) {
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaList = ad.mediaUrls && ad.mediaUrls.length > 0
    ? ad.mediaUrls
    : (ad.mediaUrl ? [ad.mediaUrl] : []);

  const isLongDesc = Boolean(ad.description && (ad.description.length > 180 || ad.description.split('\n').length > 4));
  const displayedDesc = isLongDesc && !isDescExpanded
    ? ad.description!.slice(0, 180).trimEnd() + '...'
    : ad.description;
  const formattedCtaUrl = formatExternalUrl(ad.ctaUrl);

  const handleHorizontalScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    if (clientWidth > 0) {
      const idx = Math.round(scrollLeft / clientWidth);
      if (idx !== activeSlide) {
        setActiveSlide(idx);
      }
    }
  };

  const scrollToSlide = (idx: number) => {
    if (!scrollRef.current) return;
    const target = Math.max(0, Math.min(idx, mediaList.length - 1));
    scrollRef.current.scrollTo({
      left: target * scrollRef.current.clientWidth,
      behavior: 'smooth'
    });
    setActiveSlide(target);
  };

  return (
    <article className="flex gap-3 p-[20px_4px] border-b-[6px] border-[#D0CEDB] dark:border-[#1E323A] transition-all">
      <div className={`flex-shrink-0 w-[42px] h-[42px] rounded-full overflow-hidden border ${isDarkMode ? 'border-[#22363E]' : 'border-[#DAD8E3]'} bg-[#C9A24B] flex items-center justify-center text-[#14262D] font-black text-[0.9rem]`}>
        <Megaphone className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <strong className="text-[1rem] leading-tight">{ad.sponsorName || 'Featured Partner'}</strong>
            <span className="text-[0.75rem] font-bold text-[#C9A24B] flex items-center gap-1">
              <span aria-hidden="true">·</span>
              <span>Sponsored</span>
            </span>
          </div>
        </div>
        {ad.headline && (
          <p className="text-[1rem] font-bold m-[4px_0_0] leading-snug">
            {ad.headline}
          </p>
        )}
        {ad.description && (
          <div className="m-[4px_0_0]">
            <p className={`text-[0.92rem] leading-normal whitespace-pre-wrap inline ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>
              {displayedDesc}
            </p>
            {isLongDesc && (
              <button
                type="button"
                onClick={() => setIsDescExpanded(!isDescExpanded)}
                className="ml-1.5 text-[0.85rem] font-extrabold text-[var(--ann-accent)] dark:text-[#4FC3CF] hover:underline focus:outline-none inline-flex items-center"
              >
                {isDescExpanded ? 'See less' : 'See more'}
              </button>
            )}
          </div>
        )}
        {mediaList.length > 0 && (
          <div className="mt-[10px] rounded-[18px] overflow-hidden border border-[#DAD8E3] dark:border-[#22363E] bg-black shadow-md relative">
            {mediaList.length === 1 ? (
              (() => {
                const url = mediaList[0];
                const isVideo = ad.mediaTypes?.[0] === 'video' || ad.mediaType === 'video' || url?.toLowerCase().includes('.mp4') || url?.includes('/video/');
                return isVideo ? (
                  <video
                    src={url}
                    className="w-full max-h-[420px] object-cover"
                    controls
                    controlsList="nodownload noplaybackrate"
                    disablePictureInPicture
                    onContextMenu={(e) => e.preventDefault()}
                    muted
                    playsInline
                    loop
                  />
                ) : (
                  <img src={url} className="w-full max-h-[420px] object-cover" alt={ad.headline || 'Sponsored'} />
                );
              })()
            ) : (
              <div className="relative group/adcarousel">
                <div
                  ref={scrollRef}
                  onScroll={handleHorizontalScroll}
                  className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth"
                >
                  {mediaList.map((url, idx) => {
                    const isVideo = ad.mediaTypes?.[idx] === 'video' || url?.toLowerCase().includes('.mp4') || url?.includes('/video/');
                    return (
                      <div
                        key={idx}
                        className="w-full flex-shrink-0 snap-center snap-always relative aspect-[4/3] max-h-[420px] overflow-hidden bg-black"
                      >
                        {isVideo ? (
                          <video
                            src={url}
                            className="w-full h-full object-cover"
                            controls
                            controlsList="nodownload noplaybackrate"
                            disablePictureInPicture
                            onContextMenu={(e) => e.preventDefault()}
                            muted
                            playsInline
                            loop
                          />
                        ) : (
                          <img src={url} className="w-full h-full object-cover" alt={`${ad.headline || 'Sponsored'} ${idx + 1}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
                {activeSlide > 0 && (
                  <button
                    type="button"
                    onClick={() => scrollToSlide(activeSlide - 1)}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors backdrop-blur-md"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                {activeSlide < mediaList.length - 1 && (
                  <button
                    type="button"
                    onClick={() => scrollToSlide(activeSlide + 1)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors backdrop-blur-md"
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                <span className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/70 text-white text-[10px] font-black uppercase tracking-wider backdrop-blur-md">
                  {activeSlide + 1} / {mediaList.length}
                </span>
                <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md">
                  {mediaList.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => scrollToSlide(idx)}
                      className={`h-1.5 rounded-full transition-all ${idx === activeSlide ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`}
                      aria-label={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {formattedCtaUrl && (
          <div className="mt-3 pt-2">
            <a
              href={formattedCtaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 rounded-xl bg-[var(--ann-accent)] text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-95 transition-opacity shadow-sm"
            >
              <span>{ad.ctaText || 'Learn More'}</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>
    </article>
  );
}

function ReelsFeed({ reels, isDarkMode, isAdmin, user, onSwitchToPost, onDelete, onLike, onLove, onShare, onComment, onAvatarClick, bannerSpace, sample }: any) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Snap-locked reels: the next video is only seen when swiping up.
  // The Post/Reels toggle is pinned above this container, outside the scroll.
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    if (clientHeight > 0) {
      const idx = Math.min(
        Math.max(0, reels.length - 1),
        Math.round(scrollTop / clientHeight)
      );
      if (idx !== activeIndex) {
        setActiveIndex(idx);
      }
    }
  };

  if (!reels || reels.length === 0) {
    return (
      <div>
        <div className="py-24 text-center opacity-30 border-t border-[#DAD8E3] dark:border-[#22363E]">
          <Film className="w-12 h-12 mx-auto mb-4" />
          <p className="font-black uppercase tracking-widest text-xs">No portrait reels yet</p>
          <p className="text-[0.75rem] mt-2">Upload a vertical portrait video to feature it in Reels!</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{ height: `calc(100dvh - ${150 + (bannerSpace || 0)}px)`, minHeight: 420 }}
      className="w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar relative rounded-[20px]"
    >
      {reels.map((reel: any, idx: number) => (
        <ReelCard
          key={reel.id}
          sample={sample}
          reel={reel}
          isActive={idx === activeIndex}
          isAdmin={isAdmin}
          user={user}
          onDelete={() => onDelete(reel.id)}
          onLike={() => onLike(reel.id)}
          onLove={() => onLove(reel.id)}
          onShare={() => onShare(reel)}
          onComment={() => onComment && onComment(reel)}
          onAvatarClick={onAvatarClick}
          hasNext={idx < reels.length - 1}
        />
      ))}
    </div>
  );
}

function ReelCard({
  reel,
  isActive,
  isAdmin,
  user,
  onDelete,
  onLike,
  onLove,
  onShare,
  onComment,
  onAvatarClick,
  hasNext,
  sample
}: any) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [localLiked, setLocalLiked] = useState(false);
  const [localLoved, setLocalLoved] = useState(false);

  const isSample = ['sample-', 'demo-seed-'].some((p) => String(reel.id || '').startsWith(p));
  const reelRole = postRole(reel);
  const media: string[] = reel.mediaUrls || (reel.mediaUrl ? [reel.mediaUrl] : []);
  const videoUrl = media.find((u: string, idx: number) =>
    reel.mediaTypes?.[idx] === 'video' ||
    u.toLowerCase().includes('.mp4') ||
    u.toLowerCase().includes('.webm') ||
    u.toLowerCase().includes('.mov') ||
    u.includes('/video/')
  ) || media[0];

  useEffect(() => {
    if (isSample || !user || !reel.id) return;
    const reactionRef = doc(db, scopedPath('posts'), reel.id, 'reactions', user.uid);
    const unsub = onSnapshot(reactionRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setLocalLiked(!!data.like);
        setLocalLoved(!!data.love);
      } else {
        setLocalLiked(false);
        setLocalLoved(false);
      }
    });
    return () => unsub();
  }, [user, reel.id]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (!isActive) {
      vid.pause();
      setIsPlaying(false);
      return;
    }
    // Reels always start with their sound on. If the browser blocks unmuted
    // autoplay, retry once the video can play, and only fall back to muted
    // as a last resort.
    vid.currentTime = 0;
    vid.muted = false;
    setMuted(false);
    const attempt = () => {
      vid.play().then(() => setIsPlaying(true)).catch(() => {
        vid.muted = true;
        setMuted(true);
        vid.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      });
    };
    attempt();
    vid.addEventListener('canplay', attempt, { once: true });
    return () => vid.removeEventListener('canplay', attempt);
  }, [isActive]);

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play();
      setIsPlaying(true);
    } else {
      vid.pause();
      setIsPlaying(false);
    }
  };

  const formattedDate = reel.timestamp?.toDate
    ? new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(reel.timestamp.toDate())
    : 'Just now';

  return (
    <div
      className="snap-start snap-always w-full h-full rounded-[20px] relative bg-black flex items-center justify-center overflow-hidden select-none shadow-2xl border border-[#DAD8E3] dark:border-[#22363E]"
    >
      {/* Demo and real reels alike carry a real video URL, so play it. The
          gradient placeholder only fills in for a reel with no media. */}
      {videoUrl ? (
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-cover cursor-pointer"
        loop
        playsInline
        muted={muted}
        onClick={togglePlay}
      />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: sampleArt(reel.eventName) }}>
          <div className="w-16 h-16 rounded-full bg-white/80 flex items-center justify-center">
            <Play className="w-7 h-7 text-[#21122B] fill-current ml-0.5" />
          </div>
        </div>
      )}

      {/* Play/Pause Center Indicator */}
      {!isPlaying && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer"
        >
          <div className="w-16 h-16 rounded-full bg-white/80 flex items-center justify-center">
            <Play className="w-7 h-7 text-[#21122B] fill-current ml-0.5" />
          </div>
        </div>
      )}

      {/* Top Controls: Mute & Admin Delete */}
      <div className="absolute top-4 right-4 left-4 flex items-center justify-between z-20 pointer-events-none">
        <div>
          {reel.isAd && (
            <div className="px-3 py-1 rounded-full backdrop-blur-md text-[10px] font-black uppercase tracking-widest pointer-events-auto bg-[#C9A24B] text-[#14262D]">
              Sponsored Ad
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => {
              // React does not apply muted prop updates to a mounted video
              // element, so the toggle must reach the element directly or the
              // icon flips while the audio stays silent.
              const vid = videoRef.current;
              if (!vid) return;
              vid.muted = !vid.muted;
              setMuted(vid.muted);
              if (vid.paused) vid.play().catch(() => {});
            }}
            className="p-2.5 rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70 transition-colors"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Vertical side action stack: like, comment, share */}
      <div className="absolute right-2.5 bottom-[76px] z-20 flex flex-col items-center gap-4">
        <button
          onClick={isSample ? () => setLocalLiked((v) => !v) : onLike}
          className="flex flex-col items-center gap-1 text-white"
          aria-label="Like"
        >
          <span className={`w-12 h-12 rounded-full grid place-items-center ${localLiked ? 'bg-[var(--ann-accent)]' : 'bg-black/40'}`}>
            <ThumbsUp className="w-6 h-6" />
          </span>
          <span className="text-xs font-semibold">{(reel.likeCount || 0) + (isSample && localLiked ? 1 : 0)}</span>
        </button>
        <button onClick={() => onComment && onComment(reel)} className="flex flex-col items-center gap-1 text-white" aria-label="Comments">
          <span className="w-12 h-12 rounded-full bg-black/40 grid place-items-center">
            <MessageCircle className="w-6 h-6" />
          </span>
          <span className="text-xs font-semibold">{reel.commentCount || 0}</span>
        </button>
        <button onClick={onShare ? () => onShare(reel) : undefined} className="flex flex-col items-center gap-1 text-white" aria-label="Share">
          <span className="w-12 h-12 rounded-full bg-black/40 grid place-items-center">
            <Share2 className="w-6 h-6" />
          </span>
          <span className="text-xs font-semibold">Share</span>
        </button>
      </div>

      {/* Bottom scrim & author info */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-4 pt-11 pr-[84px] text-white z-10">
        <div className="flex items-center gap-2.5">
          <div
            onClick={() => onAvatarClick && reel.authorPhoto && onAvatarClick(reel.authorPhoto)}
            className={`w-[30px] h-[30px] rounded-full overflow-hidden flex items-center justify-center font-bold text-[13px] shrink-0 bg-[var(--ann-accent)] text-white ${reel.authorPhoto && !reel.isAd ? 'cursor-pointer' : ''}`}
          >
            {reel.isAd ? (
              <Megaphone className="w-4 h-4" />
            ) : reel.authorPhoto ? (
              <img src={reel.authorPhoto} className="w-full h-full object-cover" alt="" />
            ) : (
              <span>{(reel.authorName || 'R').charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center flex-wrap gap-x-1.5">
              <strong className="text-[0.9rem] font-bold leading-tight truncate">
                {reel.isAd ? (reel.sponsorName || 'Featured Partner') : (reel.authorName || 'Guest')}
              </strong>
              {reelRole === 'vendor' && <span className="text-[10px] font-bold px-2 py-[1px] rounded-full bg-[#C8932A] text-[#21122B]">Official</span>}
              {(isSample || sample) && <span className="text-[10px] font-bold px-2 py-[1px] rounded-full bg-white/25 text-white border border-white/40">Sample</span>}
              {reelRole === 'couple' && <span className="text-[10px] font-bold px-2 py-[1px] rounded-full bg-[var(--ann-accent)] text-white">Couple</span>}
              <span className="text-[0.7rem] text-white/70"> · {reel.isAd ? 'Sponsored' : formattedDate}</span>
            </div>
            {(reel.isAd || reel.eventName) && (
              <p className="text-[0.7rem] text-white/70 truncate">{reel.isAd ? 'Sponsored Video' : reel.eventName}</p>
            )}
          </div>
        </div>

        {(reel.headline || reel.text || reel.description) && (
          <div className="mt-1.5">
            {reel.headline && (
              <p className="text-sm font-bold text-white leading-snug">{reel.headline}</p>
            )}
            {(reel.text || reel.description) && (
              <p className="text-sm text-white/95 line-clamp-2 leading-snug">
                {reel.text || reel.description}
              </p>
            )}
          </div>
        )}

        {reel.isAd && (
          <div className="w-full mt-2.5 pt-2.5 border-t border-white/15">
            {formatExternalUrl(reel.ctaUrl) ? (
              <a
                href={formatExternalUrl(reel.ctaUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-[#C9A24B] text-[#14262D] text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-95 transition-opacity shadow-lg"
              >
                <span>{reel.ctaText || 'Learn More'}</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            ) : (
              <div className="w-full py-2.5 px-4 rounded-xl bg-white/10 text-white/90 text-xs font-bold text-center">
                Sponsored Reel · {reel.sponsorName || 'Featured Partner'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Sample placeholder data matching the prototype feed (gradient tiles, no stock imagery)
const VENDOR_AUTHOR_NAMES = ['Lens & Light Studio', 'Kiln Films'];
const COUPLE_UID = 'p8BAKdDJEaYYJy0lHuQtzyntynr1';
const postRole = (p: any): string => {
  if (!p || p.isAd) return '';
  if (p.authorRole) return p.authorRole;
  if (VENDOR_AUTHOR_NAMES.includes(p.authorName || '')) return 'vendor';
  if (p.authorUid === COUPLE_UID) return 'couple';
  return '';
};
const EVENT_HUE_INDEX: Record<string, number> = {
  'Introduction': 0, 'Engagement': 1, 'Court Wedding': 2, 'Bridal Shower': 3,
  "Groom's Party": 4, 'Church Wedding': 5, 'Reception': 6, 'Thanksgiving': 7,
};
const sampleArt = (eventName?: string) => {
  const h = ((EVENT_HUE_INDEX[eventName || ''] ?? 0) * 47 + 260) % 360;
  return `linear-gradient(135deg, hsl(${h},55%,38%), hsl(${(h + 40) % 360},60%,22%))`;
};
const AVATAR_COLORS = ['#7b2d8e', '#0e6b57', '#c8932a', '#d23b5e', '#2b5fb3', '#555555'];
const avatarColor = (name?: string) => AVATAR_COLORS[(name || 'G').length % AVATAR_COLORS.length];

const SAMPLE_POSTS = [
  { id: 'sample-1', authorName: 'Aunty Ronke', role: 'guest', eventName: 'Introduction', mediaType: 'image', text: 'Dara walking in with her aunties. We cried before the first prayer.', likeCount: 14, commentCount: 1, timeAgo: '20 Jun 2026, 16:20' },
  { id: 'sample-2', authorName: 'Lens & Light Studio', role: 'vendor', eventName: 'Introduction', mediaType: 'image', text: 'Full introduction album, 212 photos, delivered.', likeCount: 31, commentCount: 0, timeAgo: '20 Jun 2026, 18:02' },
  { id: 'sample-3', authorName: 'Tolu', role: 'guest', eventName: 'Engagement', mediaType: 'video', text: 'The exact moment Femi went down on one knee!', likeCount: 42, commentCount: 2, timeAgo: '18 Jul 2026, 12:41' },
  { id: 'sample-4', authorName: 'Kiln Films', role: 'vendor', eventName: 'Engagement', mediaType: 'reel', text: 'Engagement highlight reel.', likeCount: 27, commentCount: 0, timeAgo: '18 Jul 2026, 13:15' },
  { id: 'sample-5', authorName: 'Chidi', role: 'guest', eventName: 'Engagement', mediaType: 'wish', text: 'Femi, my guy. Dara, thank you for making him smile like this. Cheers to forever.', likeCount: 9, commentCount: 0, timeAgo: '18 Jul 2026, 21:30' },
  { id: 'sample-6', authorName: 'Kemi', role: 'guest', eventName: 'Court Wedding', mediaType: 'reel', text: 'Signed, sealed, still in our work clothes.', likeCount: 19, commentCount: 0, timeAgo: '28 Aug 2026, 14:05' },
  { id: 'sample-7', authorName: 'Dara', role: 'couple', eventName: 'Introduction', mediaType: 'reel', text: 'Dancing in before the families. Look at my mum!', likeCount: 58, commentCount: 0, timeAgo: '20 Jun 2026, 17:10' },
];

// Sample captions keep the placeholder couple (Dara/Femi) at rest; render
// them with the bound couple's names so real apps never show placeholders.
const sampleCoupleText = (t: string) => String(t || '').replace(/\bDara\b/g, demoBride()).replace(/\bFemi\b/g, demoGroom());

const SAMPLE_COMMENTS: Record<string, Array<{ authorName: string; timeAgo: string; text: string }>> = {
  'sample-3': [
    { authorName: 'Aunty Ronke', timeAgo: '18 Jul 2026, 13:02', text: 'I screamed so loud, my neck is still sore!' },
    { authorName: 'Kemi', timeAgo: '18 Jul 2026, 13:20', text: 'Femi on one knee, I am not okay.' },
  ],
  'sample-1': [
    { authorName: 'Chidi', timeAgo: '20 Jun 2026, 19:40', text: 'The family photos came out so well.' },
  ],
};
// Shown in the feed in place of a post whose media is still uploading: the
// caption and a preview land immediately, with the upload percentage on the
// media itself.
function UploadingPostCard({ up, isDarkMode }: { up: any; isDarkMode: boolean }) {
  const pct = typeof up.uploadProgress === 'number' ? up.uploadProgress : 0;
  const urls: string[] = up.localMediaUrls || [];
  return (
    <div className={`rounded-[20px] border p-4 mb-4 ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
      <div className="flex items-center gap-2.5 mb-3">
        {up.authorPhoto ? (
          <img src={up.authorPhoto} className="w-9 h-9 rounded-full object-cover" alt="" />
        ) : (
          <span className="w-9 h-9 rounded-full bg-[var(--ann-accent)] text-white grid place-items-center font-black text-sm">{(up.authorName || 'G').charAt(0).toUpperCase()}</span>
        )}
        <div className="min-w-0">
          <b className="block text-sm">{up.authorName}</b>
          <p className="text-[0.7rem] opacity-50">{pct >= 99 ? 'Finishing up…' : `Uploading… ${pct}%`}</p>
        </div>
      </div>
      {up.text && <p className="text-[0.95rem] mb-3 whitespace-pre-wrap">{up.text}</p>}
      {urls.length > 0 && (
        <div className="relative rounded-[16px] overflow-hidden bg-black">
          {up.mediaTypes?.[0] === 'video' ? (
            <video src={urls[0]} className="w-full max-h-[420px] object-cover" muted playsInline autoPlay loop />
          ) : (
            <img src={urls[0]} className="w-full max-h-[420px] object-cover" alt="" />
          )}
          <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center gap-2.5">
            <span className="w-9 h-9 rounded-full border-[3px] border-white/30 border-t-white animate-spin" />
            <p className="text-white font-black text-sm">{pct >= 99 ? 'Finishing up…' : `${pct}%`}</p>
            <div className="w-2/3 h-1.5 rounded-full bg-white/25 overflow-hidden">
              <div className="h-full bg-white transition-all duration-200" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      )}
      {up.pending && <p className="text-[0.7rem] opacity-50 mt-3">Waiting for the couple to approve</p>}
    </div>
  );
}

function SamplePostCard({ post, isDarkMode, liked, onLike, onComment, onShare }: { post: any; isDarkMode: boolean; liked: boolean; onLike: () => void; onComment: () => void; onShare: () => void }) {
  const isWish = post.mediaType === 'wish';
  const isMotion = post.mediaType === 'video' || post.mediaType === 'reel';
  const likeShown = (post.likeCount || 0) + (liked ? 1 : 0);
  const mutedCls = isDarkMode ? 'text-[#5A6970]' : 'text-[#93A4AB]';
  return (
    <article className={`px-4 py-3.5 border-t-[6px] ${isDarkMode ? 'border-[#1E323A]' : 'border-[#DAD8E3]'}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0" style={{ background: avatarColor(post.authorName) }}>
          {(post.authorName || 'G').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-x-1.5">
            <strong className="text-[0.95rem] leading-tight">{post.authorName}</strong>
            {post.role === 'vendor' && <span className="text-[11px] font-bold px-2 py-[1px] rounded-full bg-[#C8932A] text-[#21122B]">Official</span>}
            {post.role === 'couple' && <span className="text-[11px] font-bold px-2 py-[1px] rounded-full bg-[var(--ann-accent)] text-white">Couple</span>}
            <span className="text-[11px] font-bold px-2 py-[1px] rounded-full bg-[#5A6970] text-white">Sample</span>
            <span className={`text-[0.72rem] ${mutedCls}`}> · {post.timeAgo}</span>
          </div>
          <p className={`text-[0.72rem] ${mutedCls}`}>{post.eventName}</p>
        </div>
      </div>
      {!isWish && <p className="text-[0.95rem] leading-relaxed mt-1">{post.text}</p>}
      {isWish ? (
        <p className="font-display italic text-[1.25rem] leading-[1.35] py-[14px] px-1">&ldquo;{post.text}&rdquo;</p>
      ) : (
        <div className="relative mt-2.5 rounded-[14px] overflow-hidden h-[240px] flex items-end p-3" style={{ background: sampleArt(post.eventName) }}>
          {isMotion && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[58px] h-[58px] rounded-full bg-white/80 flex items-center justify-center">
                <Play className="w-6 h-6 text-[#21122B] fill-current ml-0.5" />
              </div>
            </div>
          )}
          <span className="relative px-2.5 py-[3px] rounded-full bg-black/40 text-white text-[13px]">{post.eventName}</span>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 mt-2.5">
        <button
          onClick={onLike}
          className={`flex items-center justify-center gap-1.5 py-[9px] px-2 rounded-xl border text-[13px] transition-all ${liked ? 'text-[var(--ann-accent)] dark:text-[#4FC3CF] border-[var(--ann-accent)] dark:border-[#4FC3CF] font-bold' : `${mutedCls} border-[#DAD8E3] dark:border-[#22363E] font-medium`}`}
        >
          <ThumbsUp className="w-[17px] h-[17px]" />
          <span>Like{likeShown > 0 ? ` ${likeShown}` : ''}</span>
        </button>
        <button
          onClick={onComment}
          className={`flex items-center justify-center gap-1.5 py-[9px] px-2 rounded-xl border border-[#DAD8E3] dark:border-[#22363E] text-[13px] font-medium ${mutedCls}`}
        >
          <MessageCircle className="w-[17px] h-[17px]" />
          <span>Comment{post.commentCount > 0 ? ` ${post.commentCount}` : ''}</span>
        </button>
        <button
          onClick={onShare}
          className={`flex items-center justify-center gap-1.5 py-[9px] px-2 rounded-xl border border-[#DAD8E3] dark:border-[#22363E] text-[13px] font-medium ${mutedCls}`}
        >
          <Share2 className="w-[17px] h-[17px]" />
          <span>Share</span>
        </button>
      </div>
    </article>
  );
}
function CommentsSheet({ post, isDarkMode, user, displayName, avatar, isAdmin, showToast, onClose, archiveMode }: any) {
  const isSample = ['sample-', 'demo-seed-'].some((p) => String(post?.id || '').startsWith(p));
  const [comments, setComments] = useState<any[]>(isSample ? (SAMPLE_COMMENTS[post.id] || []) : []);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (isSample || DEMO || !post?.id) return;
    const q = query(collection(db, scopedPath('posts'), post.id, 'comments'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('comments load failed', err));
    return () => unsub();
  }, [isSample, post?.id]);

  const send = async () => {
    if (archiveMode) return; // Archive mode: commenting is off everywhere.
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      if (isSample || DEMO) {
        setComments((prev) => [...prev, { authorName: displayName || 'Guest', text: body, timeAgo: 'Just now' }]);
      } else {
        if (!auth.currentUser) {
          try { await signInAnonymously(auth); } catch {}
        }
        // Guests must save a profile first; admins can always comment.
        if (!isAdmin && auth.currentUser?.uid) {
          const resSnap = await getDoc(doc(db, scopedPath('residents'), auth.currentUser.uid));
          if (!resSnap.exists() || !resSnap.data()?.displayName) {
            showToast?.('Save your profile first: add your name in Settings, then you can comment.', 'error');
            return;
          }
        }
        await addDoc(collection(db, scopedPath('posts'), post.id, 'comments'), {
          authorUid: user?.uid || null,
          authorName: displayName || 'Guest',
          authorPhoto: avatar || null,
          text: body,
          createdAt: serverTimestamp(),
        });
        await updateDoc(doc(db, scopedPath('posts'), post.id), { commentCount: increment(1) });
      }
      setText('');
      if (showToast) showToast('Comment added');
    } catch (err) {
      console.error('comment failed', err);
      if (showToast) showToast('Could not post the comment. Try again.', 'error');
    } finally {
      setSending(false);
    }
  };

  const removeComment = async (c: any) => {
    if (isSample) {
      setComments((prev) => prev.filter((x) => x !== c));
      return;
    }
    try {
      await deleteDoc(doc(db, scopedPath('posts'), post.id, 'comments', c.id));
      await updateDoc(doc(db, scopedPath('posts'), post.id), { commentCount: increment(-1) });
    } catch (err) {
      console.error('comment delete failed', err);
    }
  };

  const mutedCls = isDarkMode ? 'text-[#5A6970]' : 'text-[#93A4AB]';
  const fmt = (c: any) => {
    if (c.createdAt?.toDate) {
      return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(c.createdAt.toDate());
    }
    return c.timeAgo || 'Just now';
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-end justify-center" onClick={onClose}>
      <div
        className={`w-full max-w-[430px] max-h-[85vh] overflow-y-auto rounded-t-[24px] px-[18px] pt-5 pb-[calc(22px+env(safe-area-inset-bottom,0px))] ${isDarkMode ? 'bg-[#13232A]' : 'bg-[#F6F5FA]'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-[22px] font-medium leading-tight">Comments{comments.length > 0 ? ` (${comments.length})` : ''}</h3>
        {comments.length === 0 ? (
          <p className={`my-4 text-[0.9rem] ${mutedCls}`}>No comments yet. Start the conversation.</p>
        ) : (
          comments.map((c, i) => (
            <div key={c.id || i} className="flex gap-2.5 my-3">
              <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0" style={{ background: avatarColor(c.authorName) }}>
                {(c.authorName || 'G').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[0.9rem]">
                  <strong>{c.authorName || 'Guest'}</strong>
                  <span className={`text-[0.75rem] ${mutedCls}`}> · {fmt(c)}</span>
                </p>
                <p className="text-[0.95rem] mt-0.5 whitespace-pre-wrap">{c.text}</p>
                {isAdmin && (
                  <button onClick={() => removeComment(c)} className="text-[13px] text-[#d23b3b] mt-1">Remove</button>
                )}
              </div>
            </div>
          ))
        )}
        {!archiveMode && (
        <div className={`sticky bottom-0 flex items-center gap-2 pt-2 pb-1 ${isDarkMode ? 'bg-[#13232A]' : 'bg-[#F6F5FA]'}`}>
          <div className="w-[34px] h-[34px] rounded-full bg-[var(--ann-accent)] text-white flex items-center justify-center text-[13px] font-bold shrink-0 overflow-hidden">
            {avatar ? <img src={avatar} className="w-full h-full object-cover" alt="" /> : <span>{(displayName || 'Y').charAt(0).toUpperCase()}</span>}
          </div>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            placeholder="Add a comment…"
            maxLength={500}
            className={`flex-1 min-w-0 rounded-xl border px-3 py-2.5 text-[0.95rem] outline-none bg-transparent ${isDarkMode ? 'border-[#22363E]' : 'border-[#DAD8E3]'}`}
          />
          <button onClick={send} disabled={!text.trim() || sending} className="bg-[var(--ann-accent)] text-white rounded-full px-4 py-2.5 font-semibold text-[0.9rem] disabled:opacity-40 shrink-0">Send</button>
        </div>
        )}
      </div>
    </div>
  );
}

// Giant footer helpers: the couple picks the footer look in the dashboard
// (Style 1 · Photo wall, Style 2 · Marquee). Rows scroll as a seamless loop,
// so every row's content is duplicated once and the keyframes move -50%.
const footerRows = (images: string[], rows: number): string[][] => {
  const src = images.length > 0 ? images : (DEMO ? DEMO_PHOTOS : PLACEHOLDER_IMAGES);
  const out: string[][] = [];
  const n = Math.max(1, src.length);
  const per = rows === 4 ? 10 : Math.max(5, Math.ceil(n / rows) + 2);
  for (let r = 0; r < rows; r++) {
    const off = (r * per) % n;
    const rotated = [...src.slice(off), ...src.slice(0, off)];
    const row: string[] = [];
    while (row.length < per) row.push(...rotated);
    out.push(row.slice(0, per));
  }
  return out;
};

// Style 1 · Photo wall: a still 24-photo grid under the couple's serif names.
// Every tile sits greyed out; a bright scan sweeps the rows top to bottom and
// back up again, looping (the reference video's arrangement).
function GiantFooterWall({ images = [], isDarkMode, onTap, thanks, paused }: { images?: string[]; isDarkMode: boolean; onTap?: (src: string) => void; thanks?: string; paused?: boolean }) {
  const ROWS = 8;
  const [activeRow, setActiveRow] = useState(0);
  const pausedRef = useRef(false);
  pausedRef.current = !!paused;
  useEffect(() => {
    let r = 0;
    let dir = 1;
    const t = setInterval(() => {
      if (pausedRef.current) return;
      let next = r + dir;
      if (next > ROWS - 1) { dir = -1; next = ROWS - 2; }
      if (next < 0) { dir = 1; next = 1; }
      r = next;
      setActiveRow(r);
    }, 750);
    return () => clearInterval(t);
  }, []);
  const gridRows: string[][] = [];
  for (let i = 0; i < ROWS; i++) gridRows.push(images.slice(i * 5, i * 5 + 5));
  return (
    <section className="relative overflow-hidden w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] min-h-[720px] sm:min-h-[900px] flex items-center justify-center bg-[#EEEDF3] dark:bg-[#0B171C] mt-12">
      <div className="absolute inset-0 z-0 flex flex-col justify-center gap-[6px] py-2">
        {gridRows.map((row, r) => (
          <div key={r} className="grid grid-cols-5 gap-[6px]">
            {row.map((src, i) => (
              <button key={i} type="button" onClick={() => onTap && onTap(src)} className={`ev-fw-tile${r === activeRow ? ' ev-fw-lit' : Math.abs(r - activeRow) === 1 ? ' ev-fw-warm' : ''}`}>
                <img src={src} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className={`absolute inset-0 z-[1] pointer-events-none ${isDarkMode ? 'bg-[#0B171C]/25' : 'bg-white/20'}`} />
      <div className="relative z-10 flex flex-col items-center text-center px-4 pointer-events-none">
        <div className="mb-2 text-[clamp(0.55rem,2vw,0.78rem)] font-display font-black uppercase tracking-[0.28em] text-[var(--ann-accent)]">{(thanks || '').trim() || EVFW_THANKS}</div>
        <h2 className="text-[clamp(3.5rem,16.5vw,10rem)] font-serif-display font-medium tracking-[0.02em] leading-[0.95] uppercase text-[var(--ann-accent)] m-0">{demoBride()}</h2>
        <div className="text-[clamp(1.4rem,5vw,3rem)] font-serif-display italic leading-none my-1 text-[var(--ann-accent)]">&amp;</div>
        <h2 className="text-[clamp(3.5rem,16.5vw,10rem)] font-serif-display font-medium tracking-[0.02em] leading-[0.95] uppercase text-[var(--ann-accent)] m-0 flex items-center">
          <span>{demoGroom()}</span>
          <span className="w-[0.13em] h-[0.13em] rounded-full bg-[#C8932A] ml-[0.09em] inline-block" />
        </h2>
        <div className="mt-6 flex items-center gap-3 justify-center w-full max-w-[420px]">
          <span className="flex-1 border-t border-dashed border-[var(--ann-accent)] opacity-50" />
          <span className="text-[clamp(0.85rem,3.1vw,1.3rem)] font-display font-black tracking-[0.5em] uppercase text-[var(--ann-accent)] opacity-90">{WED_DOT_SPACED}</span>
          <span className="flex-1 border-t border-dashed border-[var(--ann-accent)] opacity-50" />
        </div>
      </div>
    </section>
  );
}

// Style 2 · Marquee: dark navy wall, accent bar on top, rounded photo rows
// drifting at different speeds, and a small photo-count chip.
function GiantFooterMarquee({ images = [], onTap, thanks, paused }: { images?: string[]; isDarkMode?: boolean; onTap?: (src: string) => void; thanks?: string; paused?: boolean }) {
  const rows = footerRows(images, 4);
  return (
    <section className="relative overflow-hidden w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] bg-[#070716] mt-12">
      <div className="h-[12px] bg-[var(--ann-accent)]" />
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none px-4">
        <div className="mb-2 text-[clamp(0.55rem,2vw,0.78rem)] font-display font-black uppercase tracking-[0.28em] text-white" style={{ textShadow: '0 2px 16px rgba(7,7,22,0.8)' }}>{(thanks || '').trim() || EVFW_THANKS}</div>
        <h2 className="text-[clamp(2.8rem,12.5vw,6.2rem)] font-serif-display font-medium tracking-[0.02em] leading-[0.95] uppercase text-white m-0" style={{ textShadow: '0 2px 28px rgba(7,7,22,0.75)' }}>{demoBride()}</h2>
        <div className="text-[clamp(1.1rem,4vw,2rem)] font-serif-display italic leading-none my-1 text-white" style={{ textShadow: '0 2px 20px rgba(7,7,22,0.75)' }}>&amp;</div>
        <h2 className="text-[clamp(2.8rem,12.5vw,6.2rem)] font-serif-display font-medium tracking-[0.02em] leading-[0.95] uppercase text-white m-0 flex items-center" style={{ textShadow: '0 2px 28px rgba(7,7,22,0.75)' }}>
          <span>{demoGroom()}</span>
          <span className="w-[0.13em] h-[0.13em] rounded-full bg-[#C8932A] ml-[0.09em] inline-block" />
        </h2>
        <div className="mt-4 flex items-center gap-3 justify-center w-full max-w-[380px]">
          <span className="flex-1 border-t border-dashed border-white/60" />
          <span className="text-[clamp(0.8rem,2.9vw,1.15rem)] font-display font-black tracking-[0.5em] uppercase text-white" style={{ textShadow: '0 2px 16px rgba(7,7,22,0.8)' }}>{WED_DOT_SPACED}</span>
          <span className="flex-1 border-t border-dashed border-white/60" />
        </div>
      </div>
      <div className="flex flex-col gap-[6px] py-[14px]">
        {rows.map((row, r) => (
          <div key={r} className={`ev-fw-row ev-fw-row-lg ${r % 2 ? 'ev-fw-row-rev' : ''}`} style={{ animationDuration: `${46 + r * 13}s`, animationPlayState: paused ? 'paused' : 'running' }}>
            {[...row, ...row].map((src, i) => (
              <button key={i} type="button" onClick={() => onTap && onTap(src)} className="ev-fw-cell-lg">
                <img src={src} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

// Giant footer styles 3 & 4 (Nov 21 2026, replicated from the admin's
// footer-styles file): the couple's photos moving in 3D. Both drift on their
// own, respect reduced motion, and open a photo on tap; dragging does nothing
// and the drift pauses while the photo popup is open.
// compact=true is the dashboard preview mockup's small version.
const EVFW_CROP = [['cover', 'center'], ['210% auto', '50% 22%'], ['190% auto', '20% 40%'], ['190% auto', '80% 45%']];
const EVFW_THANKS = 'Thank you for celebrating with us';

function GiantFooterNames({ bride, groom, wed, thanks, compact = false }: { bride: string; groom: string; wed: string; thanks?: string; compact?: boolean }) {
  return (
    <div className={`ev-fw-gn ${compact ? 'ev-fw-gn-sm' : ''}`}>
      <small>{(thanks || '').trim() || EVFW_THANKS}</small>
      <h2>{bride} <i>&amp;</i> {groom}</h2>
      <p>{wed}</p>
    </div>
  );
}

function GiantFooter3dShell({ compact, worldRef, stageRef, vignette, background, onTap, bride, groom, wed, thanks }: { compact?: boolean; worldRef: React.RefObject<HTMLDivElement>; stageRef: React.RefObject<HTMLDivElement>; vignette: string; background: string; onTap?: (src: string) => void; bride?: string; groom?: string; wed?: string; thanks?: string }) {
  return (
    <section
      ref={stageRef}
      className={`ev-fw-stage relative overflow-hidden ${compact ? 'w-full h-[460px]' : 'w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] min-h-[720px] sm:min-h-[900px] mt-12'}`}
      style={{ background, touchAction: 'pan-y', cursor: 'pointer' }}
    >
      <div ref={worldRef} className="ev-fw-world" />
      <div className="ev-fw-vig" style={{ background: vignette }} />
      <GiantFooterNames bride={bride || demoBride()} groom={groom || demoGroom()} wed={wed || WED_DOT_SPACED} thanks={thanks} compact={compact} />
      {onTap ? <div className="ev-fw-hint">TAP A PHOTO</div> : null}
    </section>
  );
}

function GiantFooterTunnel({ images = [], compact = false, bride, groom, wed, onTap, paused }: { images?: string[]; compact?: boolean; bride?: string; groom?: string; wed?: string; onTap?: (src: string) => void; paused?: boolean }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(0);
  const imgRef = useRef<string[]>(images);
  imgRef.current = images;
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;
  const pool = () => (imgRef.current.length ? imgRef.current : PLACEHOLDER_IMAGES);
  const pausedRef = useRef(false);
  pausedRef.current = !!paused;

  useEffect(() => {
    const stage = stageRef.current, world = worldRef.current;
    if (!stage || !world) return;
    const rm = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    world.innerHTML = '';
    const W = stage.clientWidth || (compact ? 340 : 390);
    const H = stage.clientHeight || (compact ? 460 : 720);
    const m = Math.min(W, H);
    const R = m * 0.6, n = 10, tw = 2 * Math.PI * R / n * 0.94, dz = tw * 1.16, M = 9;
    stage.style.perspective = (m * 0.95) + 'px';
    const tiles: any[] = [];
    for (let j = 0; j < M; j++) for (let k = 0; k < n; k++) {
      const e = document.createElement('div');
      e.className = 'ev-fw-3d-t';
      e.style.width = tw + 'px';
      e.style.height = dz * 0.94 + 'px';
      e.style.marginLeft = (-tw / 2) + 'px';
      e.style.marginTop = (-dz * 0.47) + 'px';
      e._j = j; e._k = k; e._g = -1;
      world.appendChild(e);
      tiles.push(e);
    }
    const st = { off: 0, rot: 0 };
    let last = performance.now(), raf = 0;
    const paint = (e: any, idx: number) => {
      if (e._g === idx) return;
      e._g = idx;
      const P = pool();
      const i = ((idx % P.length) + P.length) % P.length;
      e.style.backgroundImage = `url("${P[i]}")`;
      const v = Math.floor(idx / 6) % 4;
      e.style.backgroundSize = EVFW_CROP[v][0];
      e.style.backgroundPosition = EVFW_CROP[v][1];
    };
    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (pausedRef.current) { raf = requestAnimationFrame(frame); return; }
      if (!rm) {
        st.off += (80 * (m / 390)) * dt;
        st.rot += 2.4 * dt;
      }
      const o = ((st.off % dz) + dz) % dz, gb = Math.floor(st.off / dz);
      tiles.forEach(e => {
        const d = e._j * dz - o + R * 0.3, g = gb + e._j;
        const N = Math.max(1, pool().length);
        paint(e, ((g * n + e._k) % N + N) % N);
        const th = e._k * 360 / n + st.rot + ((g % 2) * (180 / n));
        e.style.transform = `translate3d(0,0,${-d}px) rotateZ(${th}deg) translateX(${R}px) rotateY(90deg) rotateZ(90deg) scaleX(-1)`;
        e.style.opacity = String(Math.max(0, Math.min(1, Math.min((d - R * 0.05) / (R * 0.2), (R * 5.4 - d) / (R * 1.8)))));
        e.style.filter = `brightness(${Math.max(0.3, Math.min(1.1, 1.2 - d / (R * 6)))})`;
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    let pdown: any = null;
    let lastTapAt = 0;
    const onDown = (ev: PointerEvent) => {
      pdown = { x: ev.clientX, y: ev.clientY, t: performance.now() };
    };
    const tapAt = (x: number, y: number) => {
      if (!onTapRef.current || typeof document.elementsFromPoint !== 'function') return;
      const el = (document.elementsFromPoint(x, y) as any[]).find(x => x && x._g !== undefined && x.classList && x.classList.contains('ev-fw-3d-t'));
      if (el) {
        const P = pool();
        onTapRef.current(P[((el._g % P.length) + P.length) % P.length]);
      }
    };
    const onEnd = (ev: PointerEvent) => {
      const p = pdown; pdown = null;
      lastTapAt = performance.now();
      if (p && Math.hypot(ev.clientX - p.x, ev.clientY - p.y) < 12) tapAt(ev.clientX, ev.clientY);
    };
    const onCancel = (ev: PointerEvent) => {
      const p = pdown; pdown = null;
      lastTapAt = performance.now();
      // Mobile: a tap the browser mistook for the start of a scroll arrives here.
      if (p && Math.hypot(ev.clientX - p.x, ev.clientY - p.y) < 12 && performance.now() - p.t < 450) tapAt(ev.clientX, ev.clientY);
    };
    const onClick = (ev: MouseEvent) => {
      if (performance.now() - lastTapAt < 700) return;
      lastTapAt = performance.now();
      tapAt(ev.clientX, ev.clientY);
    };
    const onResize = () => setTick(x => x + 1);
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointerup', onEnd);
    stage.addEventListener('pointercancel', onCancel);
    stage.addEventListener('click', onClick);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointerup', onEnd);
      stage.removeEventListener('pointercancel', onCancel);
      stage.removeEventListener('click', onClick);
    };
  }, [tick, compact]);

  return (
    <GiantFooter3dShell
      compact={compact}
      stageRef={stageRef}
      worldRef={worldRef}
      background="#030306"
      vignette="radial-gradient(circle at 50% 50%, #000 0%, rgba(0,0,0,0.66) 14%, rgba(0,0,0,0) 42%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.53) 100%)"
      onTap={onTap}
      bride={bride} groom={groom} wed={wed}
    />
  );
}

function GiantFooterGlobe({ images = [], compact = false, bride, groom, wed, onTap, paused }: { images?: string[]; compact?: boolean; bride?: string; groom?: string; wed?: string; onTap?: (src: string) => void; paused?: boolean }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(0);
  const imgRef = useRef<string[]>(images);
  imgRef.current = images;
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;
  const pool = () => (imgRef.current.length ? imgRef.current : PLACEHOLDER_IMAGES);
  const pausedRef = useRef(false);
  pausedRef.current = !!paused;
  const imgKey = (images[0] || '') + '|' + images.length;

  useEffect(() => {
    const stage = stageRef.current, world = worldRef.current;
    if (!stage || !world) return;
    const rm = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    world.innerHTML = '';
    const W = stage.clientWidth || (compact ? 340 : 390);
    const H = stage.clientHeight || (compact ? 460 : 720);
    const m = Math.min(W, H);
    const R = m * 0.62, cols = 14, rows = 5, sg = 28;
    stage.style.perspective = (m * 1.6) + 'px';
    const tiles: any[] = [];
    const P0 = pool();
    for (let r = 0; r < rows; r++) {
      const phi = (r - (rows - 1) / 2) * sg;
      const cw = Math.cos(phi * Math.PI / 180) * 2 * Math.PI * R / cols * 0.9;
      const ch = R * sg * Math.PI / 180 * 0.9;
      for (let c = 0; c < cols; c++) {
        const th = c * 360 / cols + (r % 2) * (180 / cols);
        const e = document.createElement('div');
        e.className = 'ev-fw-3d-t';
        e.style.backfaceVisibility = 'hidden';
        e.style.width = cw + 'px';
        e.style.height = ch + 'px';
        e.style.marginLeft = (-cw / 2) + 'px';
        e.style.marginTop = (-ch / 2) + 'px';
        e.style.transform = `rotateY(${th}deg) rotateX(${-phi}deg) translateZ(${R}px)`;
        const N = Math.max(1, P0.length);
        const idx = ((r * cols + c) % N + N) % N;
        e._g = idx;
        e.style.backgroundImage = `url("${P0[idx]}")`;
        const v = Math.floor(idx / 6) % 4;
        e.style.backgroundSize = EVFW_CROP[v][0];
        e.style.backgroundPosition = EVFW_CROP[v][1];
        world.appendChild(e);
        tiles.push(e);
      }
    }
    const st = { ry: 0 };
    let T = 0, last = performance.now(), raf = 0;
    const applyTransform = () => {
      const tl = -8 + Math.sin(T * 0.22) * 4;
      world.style.transform = `translateZ(${-R * 0.55}px) rotateX(${tl}deg) rotateY(${st.ry}deg)`;
    };
    applyTransform();
    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (pausedRef.current) { raf = requestAnimationFrame(frame); return; }
      if (!rm) {
        T += dt;
        st.ry += 5 * dt;
      }
      applyTransform();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    let pdown: any = null;
    let lastTapAt = 0;
    const onDown = (ev: PointerEvent) => {
      pdown = { x: ev.clientX, y: ev.clientY, t: performance.now() };
    };
    const tapAt = (x: number, y: number) => {
      if (!onTapRef.current || typeof document.elementsFromPoint !== 'function') return;
      const el = (document.elementsFromPoint(x, y) as any[]).find(x => x && x._g !== undefined && x.classList && x.classList.contains('ev-fw-3d-t'));
      if (el) {
        const P = pool();
        onTapRef.current(P[((el._g % P.length) + P.length) % P.length]);
      }
    };
    const onEnd = (ev: PointerEvent) => {
      const p = pdown; pdown = null;
      lastTapAt = performance.now();
      if (p && Math.hypot(ev.clientX - p.x, ev.clientY - p.y) < 12) tapAt(ev.clientX, ev.clientY);
    };
    const onCancel = (ev: PointerEvent) => {
      const p = pdown; pdown = null;
      lastTapAt = performance.now();
      // Mobile: a tap the browser mistook for the start of a scroll arrives here.
      if (p && Math.hypot(ev.clientX - p.x, ev.clientY - p.y) < 12 && performance.now() - p.t < 450) tapAt(ev.clientX, ev.clientY);
    };
    const onClick = (ev: MouseEvent) => {
      if (performance.now() - lastTapAt < 700) return;
      lastTapAt = performance.now();
      tapAt(ev.clientX, ev.clientY);
    };
    const onResize = () => setTick(x => x + 1);
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointerup', onEnd);
    stage.addEventListener('pointercancel', onCancel);
    stage.addEventListener('click', onClick);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointerup', onEnd);
      stage.removeEventListener('pointercancel', onCancel);
      stage.removeEventListener('click', onClick);
    };
  }, [tick, compact, imgKey]);

  return (
    <GiantFooter3dShell
      compact={compact}
      stageRef={stageRef}
      worldRef={worldRef}
      background="#000"
      vignette="radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.87) 78%, #000 96%)"
      onTap={onTap}
      bride={bride} groom={groom} wed={wed}
    />
  );
}

function GridScanner({ isDarkMode, images = [], onTap }: { isDarkMode: boolean; images?: string[]; onTap?: (src: string) => void }) {
  const [activeRow, setActiveRow] = useState(0);
  const [direction, setDirection] = useState(1);
  const rowCount = 10;

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveRow(prev => {
        let next = prev + direction;
        if (next >= rowCount - 1) {
          setDirection(-1);
          return rowCount - 1;
        }
        if (next <= 0) {
          setDirection(1);
          return 0;
        }
        return next;
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [direction, rowCount]);

  return (
    <>
      {Array.from({ length: 80 }).map((_, i) => {
        const colCount = 10;
        const rowIdx = Math.floor(i / colCount);
        const isCurrentlyScanning = rowIdx === activeRow;
        return (
          <GridImage
            key={i}
            index={i}
            isDarkMode={isDarkMode}
            isCleared={isCurrentlyScanning}
            images={images}
            onTap={onTap}
          />
        );
      })}
    </>
  );
}

function GridImage({ index, isDarkMode, isCleared: autoCleared, images = [], onTap }: any) {
  const isCleared = autoCleared;
  const pool = images.length > 0 ? images : PLACEHOLDER_IMAGES;
  const imgSrc = pool[index % pool.length];

  return (
    <div
      className="relative w-full aspect-square cursor-pointer group pointer-events-auto"
      onClick={() => onTap && onTap(imgSrc)}
    >
      <motion.img
        src={imgSrc}
        animate={{
          filter: isCleared ? 'grayscale(0%) brightness(1.1)' : 'grayscale(100%) brightness(0.8)',
          scale: isCleared ? 1.05 : 1
        }}
        className="w-full h-full object-cover transition-all duration-700"
        alt=""
      />
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: isCleared ? 0 : 1 }}
        transition={{ duration: 0.4 }}
        className={`absolute inset-0 ${isDarkMode ? 'bg-[#0B171C]/70' : 'bg-[#EEEDF3]/70'}`}
      />
    </div>
  );
}

// Circular zoom-in popup for a poster's profile picture. Starts as a modest
// circle, and the expand button takes it to a near-full-screen view.
function AvatarZoomModal({ src, onClose }: { src: string; onClose: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[170] bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center"
      >
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          onClick={(e) => e.stopPropagation()}
          className="relative flex flex-col items-center"
        >
          <img
            src={src}
            alt="Profile"
            onClick={() => setExpanded((v) => !v)}
            className={`${expanded ? 'w-screen max-w-[100vw] h-[82vh] object-contain rounded-3xl' : 'w-[min(72vw,340px)] aspect-square object-cover rounded-full shadow-2xl'} cursor-zoom-in transition-all`}
          />
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? 'Exit full screen' : 'View full screen'}
              className="w-10 h-10 rounded-full bg-white/15 border border-white/40 text-white grid place-items-center hover:bg-white/25 transition-colors"
            >
              {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-10 h-10 rounded-full bg-white/15 border border-white/40 text-white grid place-items-center hover:bg-white/25 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ---- Branded time + date pickers (dashboard) -------------------------------
// The dashboard never shows the browser's native pickers: a time opens the
// app's own hour / minute / AM-PM sheet, a date opens the app's own calendar
// with month navigation. Both write back the same text formats the app
// already stores ("3:00 pm", "2027-03-06").

function BrandedTimeField({ value, onChange, isDarkMode, inputCls }: any) {
  const [open, setOpen] = useState(false);
  const parse = (raw: string) => {
    const m = String(raw || '').trim().match(/^(\d{1,2})(?:\s*[:. ]\s*(\d{1,2}))?\s*([ap]\.?m\.?)?$/i);
    if (!m) return { h: 10, m: 0, ap: 'am' as 'am' | 'pm' };
    let h = parseInt(m[1], 10);
    if (h === 0) h = 12; else if (h > 12) h = h - 12;
    return { h, m: Math.min(55, Math.max(0, parseInt(m[2] || '0', 10))), ap: (/p/i.test(m[3] || '') ? 'pm' : 'am') as 'am' | 'pm' };
  };
  const fmt = (d: { h: number; m: number; ap: string }) => `${d.h}:${String(d.m).padStart(2, '0')} ${d.ap}`;
  const [draft, setDraft] = useState(() => parse(value));
  useEffect(() => { if (open) setDraft(parse(value)); }, [open, value]);
  const chipCls = (active: boolean) => `py-1.5 rounded-lg text-[0.72rem] font-black transition-colors ${active ? 'bg-[var(--ann-accent)] text-white' : (isDarkMode ? 'bg-white/5 text-white/70 hover:bg-white/10' : 'bg-[#EEEDF3] text-[#14262D] hover:bg-[#E2E0EA]')}`;
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className={`${inputCls} text-left`}>{String(value || '').trim() || fmt(parse(value))}</button>
      {open && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
          <div className={`absolute z-[100] left-0 right-0 mt-2 rounded-2xl border p-4 shadow-2xl ${isDarkMode ? 'bg-[#13232A] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
            <div className="flex gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[0.6rem] font-black uppercase tracking-widest opacity-50 mb-1.5">Hour</p>
                <div className="grid grid-cols-4 gap-1.5 max-h-[104px] overflow-y-auto pr-1">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                    <button key={h} type="button" onClick={() => setDraft((d: any) => ({ ...d, h }))} className={chipCls(draft.h === h)}>{h}</button>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[0.6rem] font-black uppercase tracking-widest opacity-50 mb-1.5">Minute</p>
                <div className="grid grid-cols-4 gap-1.5 max-h-[104px] overflow-y-auto pr-1">
                  {Array.from({ length: 12 }, (_, i) => i * 5).map((mm) => (
                    <button key={mm} type="button" onClick={() => setDraft((d: any) => ({ ...d, m: mm }))} className={chipCls(draft.m === mm)}>{String(mm).padStart(2, '0')}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex flex-1 rounded-full border border-[#DAD8E3] dark:border-[#22363E] overflow-hidden">
                {(['am', 'pm'] as const).map((ap) => (
                  <button key={ap} type="button" onClick={() => setDraft((d: any) => ({ ...d, ap }))} className={`flex-1 py-2 text-[0.65rem] font-black uppercase tracking-widest ${draft.ap === ap ? 'bg-[var(--ann-accent)] text-white' : 'opacity-60'}`}>{ap}</button>
                ))}
              </div>
              <button type="button" onClick={() => { onChange(fmt(draft)); setOpen(false); }} className="px-5 py-2 rounded-full bg-[var(--ann-accent)] text-white text-[0.65rem] font-black uppercase tracking-widest">Done</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BrandedDateField({ value, onChange, isDarkMode, inputCls }: any) {
  const [open, setOpen] = useState(false);
  const parse = (raw: string) => {
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(String(raw))) {
      const d = new Date(`${raw}T12:00:00`);
      return { y: d.getFullYear(), m: d.getMonth(), day: d.getDate() };
    }
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth(), day: 0 };
  };
  const [view, setView] = useState(() => parse(value));
  useEffect(() => { if (open) setView(parse(value)); }, [open, value]);
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const shift = (delta: number) => setView((v: any) => { const d = new Date(v.y, v.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth(), day: 0 }; });
  const startDow = new Date(view.y, view.m, 1).getDay();
  const daysIn = new Date(view.y, view.m + 1, 0).getDate();
  const iso = (day: number) => `${view.y}-${String(view.m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const nice = (raw: string) => {
    if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(String(raw))) return String(raw || 'Pick a date');
    return new Date(`${raw}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className={`${inputCls} text-left`}>{nice(String(value || ''))}</button>
      {open && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
          <div className={`absolute z-[100] left-0 right-0 mt-2 rounded-2xl border p-4 shadow-2xl ${isDarkMode ? 'bg-[#13232A] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
            <div className="flex items-center justify-between mb-2">
              <button type="button" onClick={() => shift(-1)} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 text-base" aria-label="Previous month">‹</button>
              <p className="font-black font-display text-sm">{MONTHS[view.m]} {view.y}</p>
              <button type="button" onClick={() => shift(1)} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 text-base" aria-label="Next month">›</button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, wi) => (<span key={wi} className="text-[0.55rem] font-black uppercase opacity-40">{w}</span>))}
              {Array.from({ length: startDow }).map((_, i) => (<span key={`b${i}`} />))}
              {Array.from({ length: daysIn }, (_, i) => i + 1).map((day) => (
                <button key={day} type="button" onClick={() => setView((v: any) => ({ ...v, day }))} className={`py-1.5 rounded-lg text-[0.72rem] font-bold transition-colors ${view.day === day ? 'bg-[var(--ann-accent)] text-white' : (isDarkMode ? 'text-white/70 hover:bg-white/10' : 'text-[#14262D] hover:bg-[#EEEDF3]')}`}>{day}</button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <button type="button" onClick={() => { onChange(''); setOpen(false); }} className="text-[0.65rem] font-black uppercase tracking-widest opacity-50">Clear</button>
              <button type="button" disabled={!view.day} onClick={() => { if (view.day) onChange(iso(view.day)); setOpen(false); }} className={`px-5 py-2 rounded-full bg-[var(--ann-accent)] text-white text-[0.65rem] font-black uppercase tracking-widest ${!view.day ? 'opacity-50' : ''}`}>Done</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Fullscreen viewer for one album's media: photos flip one by one (tap the
// arrows or swipe), and a video plays through and rolls into the next item
// when it ends, so an album of videos plays one after the other.
function AlbumMediaViewer({ items, startIndex, onClose, onDelete, onDownload, onPostToFeed }: { items: any[]; startIndex: number; onClose: () => void; onDelete?: (item: any) => void; onDownload?: (item: any) => void; onPostToFeed?: (item: any) => void }) {
  const [idx, setIdx] = useState(startIndex);
  const touchXRef = useRef<number | null>(null);
  const item = items[idx];
  const go = (d: number) => setIdx((i) => Math.min(items.length - 1, Math.max(0, i + d)));
  if (!item) return null;
  return (
    <div
      className="fixed inset-0 z-[700] bg-black/95 flex flex-col"
      onClick={onClose}
      onTouchStart={(e) => { touchXRef.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => {
        const x0 = touchXRef.current;
        touchXRef.current = null;
        if (x0 == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? x0) - x0;
        if (dx < -40) go(1);
        else if (dx > 40) go(-1);
      }}
    >
      <div className="flex items-center justify-between p-4 shrink-0">
        <span className="text-white/80 text-xs font-black tracking-widest">{idx + 1} / {items.length}</span>
        <div className="flex items-center gap-2">
          {onDownload && (
            <button onClick={(e) => { e.stopPropagation(); onDownload(item); }} className="w-9 h-9 rounded-full bg-white/10 text-white grid place-items-center" style={{ touchAction: 'manipulation' }} title="Download this one"><Download className="w-5 h-5" /></button>
          )}
          {onDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(item); }} className="w-9 h-9 rounded-full bg-white/10 text-white grid place-items-center" style={{ touchAction: 'manipulation' }} title="Remove from album"><Trash2 className="w-5 h-5" /></button>
          )}
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 text-white grid place-items-center" style={{ touchAction: 'manipulation' }}><X className="w-5 h-5" /></button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center min-h-0 px-2">
        {item.type === 'video' ? (
          <AutoSoundVideo
            key={idx}
            src={item.url}
            className="max-w-full max-h-full"
            onMediaClick={(e: any) => e.stopPropagation()}
            onEnded={() => { if (idx < items.length - 1) setIdx(idx + 1); else onClose(); }}
          />
        ) : (
          <img key={idx} src={item.url} className="max-w-full max-h-full object-contain" alt="" onClick={(e) => e.stopPropagation()} />
        )}
      </div>
      {items.length > 1 && (
        <div className="flex items-center justify-center gap-4 p-4 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => go(-1)} disabled={idx === 0} className="w-11 h-11 rounded-full bg-white/10 text-white grid place-items-center disabled:opacity-30" style={{ touchAction: 'manipulation' }}><ChevronLeft className="w-5 h-5" /></button>
          <button onClick={() => go(1)} disabled={idx === items.length - 1} className="w-11 h-11 rounded-full bg-white/10 text-white grid place-items-center disabled:opacity-30" style={{ touchAction: 'manipulation' }}><ChevronRight className="w-5 h-5" /></button>
        </div>
      )}
      {onPostToFeed && (
        <button
          onClick={(e) => { e.stopPropagation(); onPostToFeed(item); }}
          className="absolute left-4 bottom-[92px] z-30 flex items-center gap-2 px-5 py-3 rounded-full bg-white text-[#21122B] font-black text-[0.7rem] uppercase tracking-widest shadow-xl"
          style={{ touchAction: 'manipulation' }}
        >
          <Send className="w-4 h-4" />
          Post to feed
        </button>
      )}
    </div>
  );
}

// A couple posts a photo or video straight from their albums to the feed.
// The event tag is required, the caption is optional, and no access code is
// asked for: this is the couple posting from their own dashboard.
function QuickPostToFeedModal({ media, coupleName, events, isDarkMode, onClose, onPosted }: any) {
  const [quickCaption, setQuickCaption] = useState('');
  const [quickEvent, setQuickEvent] = useState('');
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickOrientation, setQuickOrientation] = useState<'portrait' | 'landscape'>('landscape');

  // Album media carries no stored orientation; a portrait video belongs on
  // the Reels tab, so measure it while the popup is open (fallback landscape).
  useEffect(() => {
    if (!media || media.type !== 'video' || !media.url) return;
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    let settled = false;
    const finish = (o: 'portrait' | 'landscape') => { if (!settled) { settled = true; setQuickOrientation(o); } };
    v.onloadedmetadata = () => finish((v.videoHeight || 0) > (v.videoWidth || 0) ? 'portrait' : 'landscape');
    v.onerror = () => finish('landscape');
    v.src = media.url;
    const t = window.setTimeout(() => finish('landscape'), 4000);
    return () => { window.clearTimeout(t); };
  }, [media?.url]);

  const sendQuickPost = async () => {
    if (!quickEvent || quickBusy) return;
    setQuickBusy(true);
    try {
      const shared: any = {
        authorName: coupleName || 'The couple',
        text: quickCaption.trim(),
        mediaUrls: [media.url],
        mediaTypes: [media.type || 'image'],
        ...(media.type === 'video' && quickOrientation === 'portrait' ? { videoOrientation: 'portrait' } : {}),
        eventId: quickEvent,
        pending: false,
        likeCount: 0,
        loveCount: 0
      };
      if (DEMO) {
        onPosted({
          ...shared,
          id: `demo_${Date.now()}`,
          localDemo: true,
          authorUid: 'demo-self',
          authorPhoto: null,
          commentCount: 0,
          timestamp: new Date()
        });
        return;
      }
      await addDoc(collection(db, scopedPath('posts')), { ...shared, authorUid: 'admin', authorPhoto: null, timestamp: serverTimestamp() });
      onPosted(null);
    } catch (err) {
      console.error('Quick post error:', err);
      onPosted('error');
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/60 z-[820] backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        onClick={(e: any) => e.stopPropagation()}
        className={`fixed inset-x-4 top-1/2 -translate-y-1/2 z-[821] mx-auto max-w-md rounded-[24px] p-5 border shadow-2xl ${isDarkMode ? 'bg-[#0B171C] border-[#22363E] text-white' : 'bg-white border-[#DAD8E3] text-[#1A2B32]'}`}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h3 className="font-black font-display text-lg">Post to your feed</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="rounded-[16px] overflow-hidden bg-black mb-4 max-h-[240px] flex items-center justify-center">
          {media.type === 'video' ? (
            <video src={media.url} className="max-h-[240px] w-full object-contain" muted playsInline autoPlay loop />
          ) : (
            <img src={media.url} className="max-h-[240px] w-full object-contain" alt="" />
          )}
        </div>
        <p className="text-[0.65rem] uppercase tracking-widest font-black opacity-50 mb-2">Tag the part of the celebration</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {(events || []).map((e: any) => (
            <button key={e.id} type="button" onClick={() => setQuickEvent(quickEvent === e.id ? '' : e.id)} className={`px-4 py-2 rounded-full text-[0.8rem] font-bold border transition-all ${quickEvent === e.id ? 'bg-[var(--ann-accent)] text-white border-[var(--ann-accent)]' : (isDarkMode ? 'border-[#22363E] text-[#93A4AB]' : 'border-[#DAD8E3] text-[#5A6970]')}`}>{e.name}</button>
          ))}
        </div>
        <textarea
          value={quickCaption}
          onChange={(e) => setQuickCaption(e.target.value)}
          rows={2}
          placeholder="Add a caption (optional)"
          className={`w-full rounded-[14px] p-3 text-sm outline-none border mb-4 resize-none ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-[#F8F8FA] border-[#DAD8E3]'}`}
        />
        <button
          onClick={sendQuickPost}
          disabled={!quickEvent || quickBusy}
          className={`w-full py-3.5 rounded-full font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${quickEvent && !quickBusy ? 'bg-[var(--ann-accent)] text-white shadow-lg active:scale-[0.98]' : 'bg-[#DAD8E3] dark:bg-[#22363E] text-[#5A6970] opacity-50'}`}
          style={{ touchAction: 'manipulation' }}
        >
          {quickBusy ? <><RefreshCw className="w-4 h-4 animate-spin" /> Posting…</> : <><Send className="w-4 h-4" /> Send to feed</>}
        </button>
      </motion.div>
    </>
  );
}

function DeleteConfirmationModal({ isOpen, onClose, onConfirm, isDarkMode, title, message, confirmLabel }: any) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-[800] backdrop-blur-sm"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[340px] z-[801] rounded-[28px] p-6 shadow-2xl text-center ${isDarkMode ? 'bg-[#13232A] border border-[#22363E]' : 'bg-white border border-[#DAD8E3]'}`}
          >
            <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black font-display tracking-tight mb-2">{title || 'Delete Post?'}</h3>
            <p className="text-sm opacity-60 mb-6">{message || 'This action cannot be undone. This memory will be removed from the guest wall.'}</p>
            
            <div className="flex gap-3">
              <button 
                onClick={onClose}
                className={`flex-1 py-3 rounded-full font-bold text-xs uppercase tracking-widest ${isDarkMode ? 'bg-[#0B171C] text-white' : 'bg-[#EEEDF3] text-[#14262D]'}`}
              >
                Cancel
              </button>
              <button 
                onClick={onConfirm}
                className="flex-1 py-3 rounded-full bg-red-500 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-500/20"
              >
                {confirmLabel || 'Delete'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}


function AuthScreen({ screen, setScreen, onClose, onSignIn, onForgot, busy, error, clearError, isDarkMode, coupleLabel }: {
  screen: 'signin' | 'forgot' | 'sent';
  setScreen: (s: 'signin' | 'forgot' | 'sent') => void;
  onClose: () => void;
  onSignIn: (email: string, password: string) => void;
  onForgot: (email: string) => void;
  busy: boolean;
  error: string;
  clearError: () => void;
  isDarkMode: boolean;
  coupleLabel: string;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const submit = () => {
    if (!email.trim() || !password) { return; }
    onSignIn(email, password);
  };

  return (
    <div className={`fixed inset-0 z-[300] flex items-center justify-center p-5 overflow-y-auto ${isDarkMode ? 'bg-[#0B171C]' : 'bg-[#F6F5FA]'}`}>
      <div className={`w-full max-w-[430px] my-auto rounded-[28px] p-8 shadow-2xl ${isDarkMode ? 'bg-[#13232A] border border-[#22363E]' : 'bg-white border border-[#DAD8E3]'}`}>
        <div className="flex justify-end mb-1">
          <button
            onClick={onClose}
            className={`flex items-center gap-1.5 py-1 px-2 text-[0.85rem] font-bold ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}
          >
            Cancel <X className="w-4 h-4" />
          </button>
        </div>
        {screen === 'sent' ? (
          <>
            <div className="w-16 h-16 rounded-full bg-[var(--ann-accent)]/10 text-[var(--ann-accent)] flex items-center justify-center mx-auto mb-5">
              <Mail className="w-8 h-8" />
            </div>
            <h2 className="text-center text-[1.6rem] font-black font-display tracking-tight mb-2">Check your email</h2>
            <p className={`text-center text-[0.95rem] leading-relaxed mb-8 ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>
              We sent a password reset link. Follow it to set a new password, then come back and sign in.
            </p>
            <button
              onClick={() => setScreen('signin')}
              className="w-full py-4 rounded-full bg-[var(--ann-accent)] text-white font-black text-xs uppercase tracking-widest hover:brightness-110 transition-all"
            >
              Back to sign in
            </button>
          </>
        ) : screen === 'forgot' ? (
          <>
            <div className="w-16 h-16 rounded-full bg-[var(--ann-accent)]/10 text-[var(--ann-accent)] flex items-center justify-center mx-auto mb-5">
              <KeyRound className="w-8 h-8" />
            </div>
            <h2 className="text-center text-[1.6rem] font-black font-display tracking-tight mb-2">Forgot password?</h2>
            <p className={`text-center text-[0.95rem] leading-relaxed mb-8 ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>
              Enter the email on your admin account and we will send a reset link.
            </p>
            <label className={`block text-[0.7rem] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className={`w-full p-4 rounded-xl border-none outline-none font-bold mb-4 ${isDarkMode ? 'bg-[#0B171C] text-white placeholder-[#5A6970]' : 'bg-[#EEEDF3] text-[#14262D] placeholder-[#93A4AB]'}`}
            />
            {error && <p className="text-[0.85rem] font-bold text-[#C4453B] mb-4">{error}</p>}
            <button
              onClick={() => onForgot(email)}
              disabled={busy || !email.trim()}
              className="w-full py-4 rounded-full bg-[var(--ann-accent)] text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-[var(--ann-accent)]/20 disabled:opacity-50 hover:brightness-110 transition-all"
            >
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
            <button onClick={() => setScreen('signin')} className={`w-full py-4 font-bold text-xs uppercase tracking-widest ${isDarkMode ? 'text-white/40' : 'text-[#5A6970]'}`}>
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <div className="text-center mb-8">
              <p className="font-display text-[var(--ann-accent)] text-[0.85rem] font-medium mb-1">{coupleLabel}</p>
              <h2 className="text-[1.9rem] font-black font-display tracking-tight leading-tight">
                Welcome back
              </h2>
              <p className={`text-[0.92rem] mt-1 ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>
                Sign in to the couple dashboard.
              </p>
            </div>
            <label className={`block text-[0.7rem] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className={`w-full p-4 rounded-xl border-none outline-none font-bold mb-4 ${isDarkMode ? 'bg-[#0B171C] text-white placeholder-[#5A6970]' : 'bg-[#EEEDF3] text-[#14262D] placeholder-[#93A4AB]'}`}
            />
            <label className={`block text-[0.7rem] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>Password</label>
            <div className="relative mb-2">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                placeholder="Your password"
                autoComplete="current-password"
                className={`w-full p-4 pr-12 rounded-xl border-none outline-none font-bold ${isDarkMode ? 'bg-[#0B171C] text-white placeholder-[#5A6970]' : 'bg-[#EEEDF3] text-[#14262D] placeholder-[#93A4AB]'}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#5A6970]"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <button onClick={() => setScreen('forgot')} className="text-[0.85rem] font-bold text-[var(--ann-accent)] mb-2">
              Forgot password?
            </button>
            {error && <p className="text-[0.85rem] font-bold text-[#C4453B] my-3">{error}</p>}
            <button
              onClick={submit}
              disabled={busy || !email.trim() || !password}
              className="w-full py-4 rounded-full bg-[var(--ann-accent)] text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-[var(--ann-accent)]/20 disabled:opacity-50 hover:brightness-110 transition-all mt-3"
            >
              {busy ? 'Please wait…' : 'Sign in'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ForceSetPasswordScreen({ isDarkMode, busy, error, newPassword, setNewPassword, confirmPassword, setConfirmPassword, onSubmit, onSignOut }: {
  isDarkMode: boolean;
  busy: boolean;
  error: string;
  newPassword: string;
  setNewPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  onSubmit: () => void;
  onSignOut: () => void;
}) {
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const strength = newPassword.length >= 10 ? 'Strong' : newPassword.length >= 6 ? 'Okay' : 'Too short';
  return (
    <div className={`fixed inset-0 z-[310] flex items-center justify-center p-5 overflow-y-auto ${isDarkMode ? 'bg-[#0B171C]' : 'bg-[#F6F5FA]'}`}>
      <div className={`w-full max-w-[430px] my-auto rounded-[28px] p-8 shadow-2xl ${isDarkMode ? 'bg-[#13232A] border border-[#22363E]' : 'bg-white border border-[#DAD8E3]'}`}>
        <div className="w-16 h-16 rounded-full bg-[#C8932A]/15 text-[#C8932A] flex items-center justify-center mx-auto mb-5">
          <KeyRound className="w-8 h-8" />
        </div>
        <h2 className="text-center text-[1.7rem] font-black font-display tracking-tight mb-2">Set your permanent password</h2>
        <p className={`text-center text-[0.95rem] leading-relaxed mb-8 ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>
          You signed in with a temporary password. Choose a permanent one before you continue.
        </p>
        <label className={`block text-[0.7rem] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>New password</label>
        <div className="relative mb-4">
          <input
            type={show1 ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 6 characters"
            autoComplete="new-password"
            className={`w-full p-4 pr-12 rounded-xl border-none outline-none font-bold ${isDarkMode ? 'bg-[#0B171C] text-white placeholder-[#5A6970]' : 'bg-[#EEEDF3] text-[#14262D] placeholder-[#93A4AB]'}`}
          />
          <button type="button" onClick={() => setShow1(!show1)} aria-label={show1 ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#5A6970]">
            {show1 ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        <label className={`block text-[0.7rem] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#93A4AB]' : 'text-[#5A6970]'}`}>Confirm new password</label>
        <div className="relative mb-4">
          <input
            type={show2 ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && newPassword && confirmPassword) onSubmit(); }}
            placeholder="Type it once more"
            autoComplete="new-password"
            className={`w-full p-4 pr-12 rounded-xl border-none outline-none font-bold ${isDarkMode ? 'bg-[#0B171C] text-white placeholder-[#5A6970]' : 'bg-[#EEEDF3] text-[#14262D] placeholder-[#93A4AB]'}`}
          />
          <button type="button" onClick={() => setShow2(!show2)} aria-label={show2 ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#5A6970]">
            {show2 ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        {newPassword && (
          <p className={`text-[0.8rem] font-bold mb-3 ${newPassword.length >= 6 ? 'text-[var(--ann-accent)]' : 'text-[#C4453B]'}`}>
            Password strength: {strength}
          </p>
        )}
        {error && <p className="text-[0.85rem] font-bold text-[#C4453B] mb-3">{error}</p>}
        <button
          onClick={onSubmit}
          disabled={busy || !newPassword || !confirmPassword}
          className="w-full py-4 rounded-full bg-[var(--ann-accent)] text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-[var(--ann-accent)]/20 disabled:opacity-50 hover:brightness-110 transition-all"
        >
          {busy ? 'Saving…' : 'Save password & continue'}
        </button>
        <button onClick={onSignOut} className={`w-full py-4 font-bold text-xs uppercase tracking-widest ${isDarkMode ? 'text-white/40' : 'text-[#5A6970]'}`}>
          Sign out
        </button>
      </div>
    </div>
  );
}

// Renders the actual error message instead of a blank page when a section's
// rendering fails, so a crash is always visible and fixable.
class TabErrorBoundary extends React.Component<{ label: string; isDarkMode: boolean; children: any }, { error: any }> {
  state = { error: null as any };
  static getDerivedStateFromError(error: any) { return { error }; }
  componentDidCatch(error: any, info: any) {
    console.error(`Section "${this.props.label}" failed to render:`, error, info);
  }
  render() {
    if (this.state.error) {
      const msg = String(this.state.error?.message || this.state.error || 'Unknown error');
      return (
        <div className={`p-5 rounded-[20px] border border-[#C4453B]/40 ${this.props.isDarkMode ? 'bg-[#C4453B]/10' : 'bg-[#C4453B]/5'}`}>
          <h3 className="font-black font-display text-lg text-[#C4453B] mb-1">This section could not load</h3>
          <p className="text-sm opacity-70 mb-2">Section: {this.props.label}. Send the text below to your assistant to get it fixed.</p>
          <code className="block p-3 rounded-lg bg-black/10 text-[0.7rem] break-words whitespace-pre-wrap">{msg}</code>
        </div>
      );
    }
    return this.props.children;
  }
}

// The dashboard's Preview popup shows a lightweight look at the home page,
// drawn right here from the dashboard's current state: no iframe, no routing,
// nothing loads, exactly like the template preview on the landing page.
// Branded auto sign-out dropdown (Security): the app's own list, not the browser select.
function BrandedSessionSelect({ value, onChange, isDarkMode, inputCls }: { value: number; onChange: (m: number) => void; isDarkMode: boolean; inputCls: string }) {
  const [open, setOpen] = useState(false);
  const opts: [number, string][] = [[30, '30 minutes'], [60, '1 hour'], [120, '2 hours'], [720, '12 hours'], [1440, '1 day'], [10080, '1 week']];
  const cur = opts.find((o) => o[0] === value) || opts[1];
  return (
    <div className="relative max-w-[220px] w-full">
      <button type="button" onClick={() => setOpen((v) => !v)} className={`${inputCls} w-full flex items-center justify-between gap-2 text-left`}>
        <span className="truncate">{cur[1]}</span>
        <ChevronDown className={`w-4 h-4 opacity-50 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-20 cursor-default bg-transparent border-0 p-0" />
          <div className={`absolute left-0 right-0 mt-2 z-30 rounded-2xl border shadow-xl overflow-hidden ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
            {opts.map(([m, label]) => (
              <button key={m} type="button" onClick={() => { setOpen(false); if (m !== value) onChange(m); }} className={`w-full px-4 py-3 flex items-center justify-between gap-2 text-left text-sm font-bold transition-colors ${m === value ? 'text-[var(--ann-accent)]' : (isDarkMode ? 'text-white' : 'text-[#14262D]')} hover:bg-[var(--ann-accent)]/10`}>
                <span>{label}</span>
                {m === value && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Eye toggle (Events & photos): hides or shows a section on the couple's app.
// Hidden sections also disappear from the preview mockup straight away.
function SectionEyeBtn({ hidden, onClick, isDarkMode }: { hidden: boolean; onClick: () => void; isDarkMode: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hidden ? 'Show this section in the app' : 'Hide this section in the app'}
      className={`px-3 py-2 rounded-full border flex items-center gap-1.5 text-[0.65rem] font-black uppercase tracking-widest shrink-0 transition-colors ${hidden ? 'border-[var(--ann-accent)]/50 text-[var(--ann-accent)] bg-[var(--ann-accent)]/10' : (isDarkMode ? 'border-[#22363E] text-[#93A4AB]' : 'border-[#DAD8E3] text-[#5A6970]')}`}
    >
      {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      {hidden ? 'Hidden' : 'Hide'}
    </button>
  );
}

function PreviewHomeMockup({ bride, groom, city, wedDate, events, story, details, heroImages, tpl, wallStyle, thanks, partners = DEMO_PARTNERS }: any) {
  // A faithful miniature of the real home page: the actual template hero
  // components (compact), the same banner, journey timeline and giant footer
  // wall the couple sees, all drawn from the admin's current drafts.
  const heroes: string[] = (heroImages && heroImages.length ? heroImages : PLACEHOLDER_IMAGES);
  const evs: any[] = (events || []).filter((e: any) => (e.name || '').trim() && !e.hidden);
  const mockHidden: string[] = (details && details.hiddenSections) || [];
  const eventNames = evs.map((e: any) => e.name);
  const heroTpl: string = tpl || 'classic';
  const wallMode: string = wallStyle || 'wall';
  const pool: string[] = Array.from({ length: 40 }, (_, i) => heroes[i % heroes.length]);
  const ROWS = 8;
  const [activeRow, setActiveRow] = useState(0);
  useEffect(() => {
    let r = 0; let dir = 1;
    const t = setInterval(() => {
      let next = r + dir;
      if (next > ROWS - 1) { dir = -1; next = ROWS - 2; }
      if (next < 0) { dir = 1; next = 1; }
      r = next;
      setActiveRow(r);
    }, 750);
    return () => clearInterval(t);
  }, []);
  const wedDot = (() => { try { if (!wedDate) return '20 \u00b7 03 \u00b7 2027'; const d = new Date(wedDate + 'T12:00:00'); return String(d.getDate()).padStart(2, '0') + ' \u00b7 ' + String(d.getMonth() + 1).padStart(2, '0') + ' \u00b7 ' + d.getFullYear(); } catch { return '20 \u00b7 03 \u00b7 2027'; } })();
  const wedShort = (() => { try { if (!wedDate) return { d: '20', y: '2027' }; const d = new Date(wedDate + 'T12:00:00'); return { d: String(d.getDate()), y: String(d.getFullYear()) }; } catch { return { d: '20', y: '2027' }; } })();
  const wedFull = (() => { try { return wedDate ? new Date(wedDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''; } catch { return ''; } })();
  const fmtEvDate = (e: any) => { try { return e.date ? new Date(e.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Date to be announced'; } catch { return 'Date to be announced'; } };
  const tagCls = (st: string) => st === 'done'
    ? 'bg-[var(--ann-accent)]/10 text-[var(--ann-accent)] border-[var(--ann-accent)]/30'
    : st === 'next'
      ? 'bg-[#C8932A]/15 text-[#C8932A] border-[#C8932A]/40'
      : 'bg-[#EEEDF3] text-[#5A6970] border-[#DAD8E3]';
  const dotCls = (st: string) => st === 'done'
    ? 'bg-[var(--ann-accent)] border-[var(--ann-accent)]'
    : st === 'next'
      ? 'bg-[#C8932A] border-[#C8932A]'
      : 'bg-[#EEEDF3] border-[#5A6970]';
  const wallNames = (
    <div className="relative z-10 flex flex-col items-center text-center px-4 pointer-events-none py-8">
      <div className="mb-1.5 text-[0.55rem] font-display font-black uppercase tracking-[0.28em] text-[var(--ann-accent)]">{(thanks || '').trim() || EVFW_THANKS}</div>
      <h2 className="text-[2.3rem] font-serif-display font-medium tracking-[0.02em] leading-[0.95] uppercase text-[var(--ann-accent)] m-0">{bride}</h2>
      <div className="text-[1rem] font-serif-display italic leading-none my-0.5 text-[var(--ann-accent)]">&amp;</div>
      <h2 className="text-[2.3rem] font-serif-display font-medium tracking-[0.02em] leading-[0.95] uppercase text-[var(--ann-accent)] m-0 flex items-center">
        <span>{groom}</span>
        <span className="w-[4px] h-[4px] rounded-full bg-[#C8932A] ml-[3px] inline-block" />
      </h2>
      <div className="mt-3 flex items-center gap-2 justify-center w-full">
        <span className="flex-1 border-t border-dashed border-[var(--ann-accent)] opacity-50" />
        <span className="text-[0.6rem] font-display font-black tracking-[0.4em] uppercase text-[var(--ann-accent)] opacity-90">{wedDot}</span>
        <span className="flex-1 border-t border-dashed border-[var(--ann-accent)] opacity-50" />
      </div>
    </div>
  );
  return (
    <div className="ev-preview-mockup w-full h-full overflow-y-auto bg-[#F1EFF6] text-[#1a1a2e]">
      <style>{'.ev-preview-mockup::-webkit-scrollbar { display: none } .ev-preview-mockup { scrollbar-width: none; -ms-overflow-style: none } .ev-preview-mockup .ev-fw-cell-lg img { width: 30px; border-radius: 6px; }'}</style>
      {/* Hero: the real template hero, compact */}
      <div className="relative w-full h-[238px] overflow-hidden">
        {heroTpl === 'classic' && <FloatingHeroSection compact isDarkMode={false} images={heroes} eventNames={eventNames} />}
        {heroTpl === 'halo' && <HaloHero compact images={heroes} names={bride + ' & ' + groom} eventNames={eventNames} />}
        {heroTpl === 'hero' && <DeckHero compact images={heroes} names={bride + ' & ' + groom} eventNames={eventNames} />}
        {heroTpl === 'book' && <BookHero compact images={heroes} bride={bride} groom={groom} dotDate={wedDot} city={city || 'Lagos'} hashtag={(details && details.hashtag) || '#AmaraAndDaniel'} eventNames={eventNames} />}
      </div>
      {/* Banner */}
      <div className="mx-3 mt-4 rounded-[22px] p-[22px_16px] text-[#F2F7F8] relative overflow-hidden shadow-lg" style={{ background: 'linear-gradient(135deg, var(--ann-hero) 0%, #3A2F63 100%)' }}>
        <p className="m-0 text-center text-[0.62rem] font-medium text-[#C8932A]">Together with their families</p>
        <h2 className="text-center font-serif-display text-white text-[2rem] leading-[1] mt-2 mb-0">
          {bride}
          <span className="block italic text-[0.95rem] text-[#C8932A] my-1">and</span>
          {groom}
        </h2>
        <p className="text-center text-[0.7rem] opacity-[0.85] mt-3 mb-0 leading-snug">are getting married. Share every moment with us, from the first introduction to the last dance.</p>
        <div className="mt-4 mx-auto bg-white/10 border border-white/25 rounded-[14px] py-2.5 backdrop-blur-md">
          <div className="flex items-stretch justify-center divide-x divide-white/25">
            <div className="px-4 text-center">
              <b className="block text-[1rem] font-serif-display leading-none">{wedShort.d}</b>
              <span className="block text-[0.55rem] uppercase tracking-wider opacity-75 mt-1">{wedShort.y}</span>
            </div>
            <div className="px-4 text-center">
              <b className="block text-[1rem] font-serif-display leading-none">{city || 'Lagos'}</b>
              <span className="block text-[0.55rem] uppercase tracking-wider opacity-75 mt-1">Nigeria</span>
            </div>
          </div>
          {wedDate && <CountdownRow date={wedDate} time="12:00" />}
        </div>
      </div>
      {/* Our story */}
      {!mockHidden.includes('story') && (
      <section className="px-5 pt-6">
        <h2 className="text-[1.15rem] font-black font-display tracking-[-0.01em] m-[0_4px_8px] leading-[1.25]">Our story</h2>
        <p className="text-[0.85rem] leading-relaxed m-0 text-[#5A6970]">{story}</p>
      </section>
      )}
      {/* The journey: the same timeline cards the app shows */}
      <section className="px-5 pt-7">
        <h2 className="text-[1.15rem] font-black font-display tracking-[-0.01em] m-[0_4px_2px] leading-[1.25]">The journey</h2>
        <p className="text-[0.8rem] m-[0_4px_12px] text-[#5A6970]">Tap an event to open it.</p>
        <div className="ml-[10px] pl-[16px] border-l-[3px] border-[#DAD8E3] space-y-2.5">
          {evs.slice(0, 8).map((e: any, ji: number) => {
            const st = e.status || 'up';
            return (
              <div key={ji} className="relative">
                <span className={`absolute -left-[25px] top-[16px] w-[11px] h-[11px] rounded-full border-[3px] ${dotCls(st)}`} />
                <div className={`rounded-[14px] border overflow-hidden bg-white ${st === 'next' ? 'border-[#C8932A]/60' : 'border-[#DAD8E3]'}`}>
                  <div className="p-[12px_14px] flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <b className="text-[0.92rem] font-serif-display leading-tight">{e.name}</b>
                        <span className={`flex-shrink-0 px-2 py-0.5 rounded-full border text-[8.5px] font-black uppercase tracking-wider ${tagCls(st)}`}>
                          {st === 'done' ? 'Done' : st === 'next' ? 'Next up' : 'Upcoming'}
                        </span>
                      </div>
                      <small className="block text-[0.68rem] mt-0.5 text-[#5A6970]">{e.type ? e.type + ' \u00b7 ' : ''}{fmtEvDate(e)}</small>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      {/* Wedding day */}
      {!mockHidden.includes('details') && (
      <section className="px-5 pt-7">
        <h2 className="text-[1.15rem] font-black font-display tracking-[-0.01em] m-[0_4px_10px] leading-[1.25]">Wedding day</h2>
        <p className="text-[0.8rem] m-[0_4px_10px] text-[#5A6970]">{wedFull}</p>
        <div className="p-[14px_16px] rounded-[16px] border bg-white border-[#DAD8E3] space-y-3">
          {details && details.churchTime && (
            <div>
              <strong className="block text-[0.85rem]">Church wedding · {details.churchTime}</strong>
              <p className="m-0 text-[0.8rem] text-[#5A6970]">{details.churchVenue}</p>
            </div>
          )}
          {details && details.receptionTime && (
            <div>
              <strong className="block text-[0.85rem]">Reception · {details.receptionTime}</strong>
              <p className="m-0 text-[0.8rem] text-[#5A6970]">{details.receptionVenue}</p>
            </div>
          )}
          {details && details.asoEbi && (
            <div>
              <strong className="block text-[0.85rem] flex items-center gap-2 flex-wrap">Aso-ebi:{(details.dressColors || []).filter(Boolean).length ? <span className="inline-flex gap-1.5">{(details.dressColors || []).filter(Boolean).map((c: string, i: number) => <span key={i} className="inline-block w-3.5 h-3.5 rounded-full border border-black/10 shadow-sm" style={{ background: c }} />)}</span> : ` ${details.asoEbi || ''}`}</strong>
              <p className="m-0 text-[0.8rem] text-[#5A6970]">Share your looks with <span className="font-bold text-[var(--ann-accent)]">{(details && details.hashtag) || ''}</span></p>
            </div>
          )}
        </div>
      </section>
      )}
      
      {/* Feed CTA */}
      <section className="px-5 pt-7">
        <h2 className="text-[1.15rem] font-black font-display tracking-[-0.01em] m-[0_4px_10px] leading-[1.25]">Say something to the couple</h2>
        <div className="rounded-full bg-[var(--ann-accent)] text-white text-center text-[0.72rem] font-black uppercase tracking-widest py-3">Open the feed</div>
      </section>
      {/* Gifts & support: mirrors the real home section */}
      {details && details.giftInfo && (details.giftInfo.accountNumber || details.giftInfo.accountName) && !((details.hiddenSections || []).includes('gifts')) && (
        <section className="px-5 pt-7">
          <div className="relative overflow-hidden rounded-[18px] border border-[#DAD8E3] bg-white p-4">
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-[var(--ann-accent)]/15 blur-xl pointer-events-none" />
            <span className="block text-[0.55rem] font-black uppercase tracking-widest text-[var(--ann-accent)] mb-1">Gift the couple</span>
            <h2 className="text-[1.05rem] font-black font-display tracking-[-0.01em] leading-[1.25]">Say it with a gift</h2>
            <p className="text-[0.75rem] text-[#5A6970] mt-1 mb-3">{details.giftInfo.note || 'Your presence means everything. If you would also love to gift us, it is deeply appreciated.'}</p>
            <div className="space-y-2">
              {details.giftInfo.bank && (
                <div className="p-[10px_12px] rounded-[14px] bg-[#EEEDF3] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="block text-[0.5rem] font-black uppercase tracking-widest text-[#5A6970]">Bank</span>
                    <b className="block text-[0.8rem] font-serif-display truncate">{details.giftInfo.bank}</b>
                  </div>
                  <Banknote className="w-4 h-4 opacity-40 shrink-0" />
                </div>
              )}
              {details.giftInfo.accountNumber && (
                <div className="p-[10px_12px] rounded-[14px] bg-[#EEEDF3] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="block text-[0.5rem] font-black uppercase tracking-widest text-[#5A6970]">Account number</span>
                    <b className="block text-[0.9rem] font-display tracking-[0.08em]">{details.giftInfo.accountNumber}</b>
                  </div>
                  <Copy className="w-4 h-4 opacity-50 shrink-0" />
                </div>
              )}
              {details.giftInfo.accountName && (
                <div className="p-[10px_12px] rounded-[14px] bg-[#EEEDF3]">
                  <span className="block text-[0.5rem] font-black uppercase tracking-widest text-[#5A6970]">Account name</span>
                  <b className="block text-[0.8rem] font-serif-display">{details.giftInfo.accountName}</b>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
      {/* Our partners — Events & photos, under Gifts & support */}
      {(partners || []).length > 0 && !mockHidden.includes('partners') && (
      <section className="px-5 pt-7">
        <h2 className="text-[1.15rem] font-black font-display tracking-[-0.01em] m-[0_4px_10px] leading-[1.25]">Our partners</h2>
        <p className="text-[0.8rem] m-[0_4px_10px] text-[#5A6970]">The people and brands behind this celebration.</p>
        <div className="flex flex-col gap-2">
          {(partners || []).map((p: any) => (
            <div key={p.id || p.name} className="flex items-center gap-3 p-[10px_12px] rounded-[14px] border bg-white border-[#DAD8E3]">
              {p.photo
                ? <img src={p.photo} alt={p.name || 'Partner'} className="w-9 h-9 rounded-full object-cover shrink-0" />
                : <span className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white font-black text-[0.8rem]" style={{ background: 'var(--ann-accent)' }}>{(p.name || '?').slice(0, 1).toUpperCase()}</span>}
              <div className="min-w-0 flex-1">
                <b className="block text-[0.8rem] font-serif-display">{p.name}</b>
                {p.category ? <span className="block text-[0.65rem] text-[#5A6970]">{p.category}</span> : null}
              </div>
            </div>
          ))}
        </div>
      </section>
      )}
      {/* Giant footer: the real wall, in the style the admin picked */}
      {wallMode === 'wall' ? (
        <section className="relative overflow-hidden w-full flex items-center justify-center bg-[#EEEDF3] mt-8">
          <div className="absolute inset-0 z-0 flex flex-col justify-center gap-[4px] py-2">
            {Array.from({ length: ROWS }, (_, r) => (
              <div key={r} className="grid grid-cols-5 gap-[4px]">
                {pool.slice(r * 5, r * 5 + 5).map((src: string, i: number) => (
                  <div key={i} className={'ev-fw-tile' + (r === activeRow ? ' ev-fw-lit' : Math.abs(r - activeRow) === 1 ? ' ev-fw-warm' : '')}>
                    <img src={src} alt="" />
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="absolute inset-0 z-[1] pointer-events-none bg-white/20" />
          {wallNames}
        </section>
      ) : wallMode === 'tunnel' || wallMode === 'globe' ? (
        <div className="relative w-full overflow-hidden bg-[#030306] mt-8" style={{ height: 460 }}>
          {wallMode === 'tunnel'
            ? <GiantFooterTunnel images={pool} compact thanks={thanks} bride={bride} groom={groom} wed={wedDot} />
            : <GiantFooterGlobe images={pool} compact thanks={thanks} bride={bride} groom={groom} wed={wedDot} />}
        </div>
      ) : (
        <section className="relative overflow-hidden w-full bg-[#070716] mt-8">
          <div className="h-[8px] bg-[var(--ann-accent)]" />
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none px-4">
            <div className="mb-1.5 text-[0.55rem] font-display font-black uppercase tracking-[0.28em] text-white" style={{ textShadow: '0 2px 12px rgba(7,7,22,0.8)' }}>{(thanks || '').trim() || EVFW_THANKS}</div>
            <h2 className="text-[2rem] font-serif-display font-medium tracking-[0.02em] leading-[0.95] uppercase text-white m-0" style={{ textShadow: '0 2px 18px rgba(7,7,22,0.75)' }}>{bride}</h2>
            <div className="text-[0.9rem] font-serif-display italic leading-none my-0.5 text-white" style={{ textShadow: '0 2px 14px rgba(7,7,22,0.75)' }}>&amp;</div>
            <h2 className="text-[2rem] font-serif-display font-medium tracking-[0.02em] leading-[0.95] uppercase text-white m-0 flex items-center" style={{ textShadow: '0 2px 18px rgba(7,7,22,0.75)' }}>
              <span>{groom}</span>
              <span className="w-[4px] h-[4px] rounded-full bg-[#C8932A] ml-[3px] inline-block" />
            </h2>
            <div className="mt-3 flex items-center gap-2 justify-center w-full">
              <span className="flex-1 border-t border-dashed border-white/60" />
              <span className="text-[0.6rem] font-display font-black tracking-[0.4em] uppercase text-white" style={{ textShadow: '0 2px 12px rgba(7,7,22,0.8)' }}>{wedDot}</span>
              <span className="flex-1 border-t border-dashed border-white/60" />
            </div>
          </div>
          <div className="flex flex-col gap-[4px] py-[10px]">
            {[0, 1, 2, 3].map((r) => (
              <div key={r} className={'ev-fw-row ev-fw-row-lg ' + (r % 2 ? 'ev-fw-row-rev' : '')} style={{ animationDuration: (46 + r * 13) + 's' }}>
                {pool.slice(r * 10, r * 10 + 10).concat(pool.slice(r * 10, r * 10 + 10)).map((src: string, i: number) => (
                  <div key={i} className="ev-fw-cell-lg"><img src={src} alt="" /></div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="py-6 text-center">
        <p className="font-display text-[0.95rem] font-bold m-0">{bride} &amp; {groom}</p>
        <p className="text-[0.6rem] font-bold uppercase tracking-[0.25em] text-[#8a879b] mt-1 m-0">Wedding memories, kept for life</p>
      </div>
    </div>
  );
}


// The Inbox invite section: the couple's invitation cards, designed like the
// Events & details cards. Six styles, one form filled from the couple's own
// details, and every open of the sent card counted live.
const IV_STYLES = [
  { id: 'envelope', n: 'Gold envelope', d: 'Burgundy & gold-foil envelope opens in 3D', iv: true },
  { id: 'ribbon', n: 'Ribbon & scissors', d: 'A satin bow is snipped open with scissors', iv: true },
  { id: 'doors', n: 'Palace doors', d: 'Gilded palace doors swing open in 3D', iv: true },
];

function InviteCardSection({ isDarkMode, weddingDetails, story, wedDate, showToast }: any) {
  const inputCls = `w-full px-3 py-2.5 rounded-xl border text-sm font-medium ${isDarkMode ? 'bg-[#0B171C] border-[#22363E] text-white placeholder-white/30' : 'bg-white border-[#DAD8E3] text-slate-900'}`;
  const cardCls = `rounded-[20px] p-5 border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`;
  const labCls = 'block text-[0.7rem] uppercase tracking-widest font-black opacity-50 mb-1.5';
  const chipCls = (on: boolean) => `px-3 py-2 rounded-full border text-[11px] font-black uppercase tracking-widest transition-colors ${on ? 'bg-[var(--ann-accent)] text-white border-transparent' : isDarkMode ? 'border-[#22363E] text-white/70' : 'border-[#DAD8E3] text-slate-600'}`;
  const [tpl, setTpl] = useState('envelope');
  const [musicLib, setMusicLib] = useState<{ id: string; name: string; url: string }[]>([]);
  useEffect(() => {
    let alive = true
    ;(async () => {
      for (const ep of ['/api/music-library', '/.netlify/functions/music-library']) {
        try {
          const res = await fetch(ep, { credentials: ep.startsWith('http') ? 'omit' : 'include' })
          if (!res.ok) continue
          const j = await res.json()
          if (alive && Array.isArray(j.docs)) { setMusicLib(j.docs); return }
        } catch { /* try the next endpoint */ }
      }
    })()
    return () => { alive = false }
  }, []);
  const [f, setF] = useState<any>(() => ({
    bride: demoBride() || 'Amara',
    groom: demoGroom() || 'Daniel',
    date: wedDate || '',
    venue: weddingDetails?.receptionVenue || weddingDetails?.churchVenue || '',
    city: demoCity() || '',
    hashtag: weddingDetails?.hashtag || '',
    story: story || '',
    dress: weddingDetails?.asoEbi || '',
    rsvpBy: '',
    whatsapp: '',
    photos: [] as string[],
    schedule: [['2:00 PM', 'Ceremony', 'Please be seated by 1:45 PM'], ['4:00 PM', 'Cocktails and photos', 'Garden terrace'], ['6:00 PM', 'Reception dinner', 'Followed by speeches'], ['8:00 PM', 'First dance and party', 'Dancing until late']],
    music: '',
  }));
  const [docId, setDocId] = useState<string | null>(null);
  const [opens, setOpens] = useState(0);
  const [savedLink, setSavedLink] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewTpl, setPreviewTpl] = useState<string | null>(null);
  const [musicOpen, setMusicOpen] = useState(false);
  const [invitePlaying, setInvitePlaying] = useState('');
  const inviteAudioRef = useRef<HTMLAudioElement | null>(null);
  const stopInvitePreview = () => { try { inviteAudioRef.current?.pause() } catch { /* already stopped */ } inviteAudioRef.current = null; setInvitePlaying('') };
  const toggleInvitePreview = (url: string) => {
    if (invitePlaying === url) { stopInvitePreview(); return }
    stopInvitePreview()
    const a = new Audio(url)
    inviteAudioRef.current = a
    a.onended = stopInvitePreview
    a.onerror = () => { stopInvitePreview(); showToast("Couldn't play that track") }
    a.play().catch(() => stopInvitePreview())
    setInvitePlaying(url)
  };
  const closeMusicDropdown = () => { setMusicOpen(false); stopInvitePreview() };

  // Load the couple's saved card, if one exists, so the form reopens with it.
  useEffect(() => {
    if (DEMO) {
      try {
        const s = JSON.parse(localStorage.getItem(lsKey('iv-form')) || 'null');
        if (s) { setF(s.f); setTpl(s.tpl || 'envelope'); setDocId('demo'); setOpens(s.opens || 0); setSavedLink(s.link || null); }
      } catch { /* ignore */ }
      return;
    }
    let alive = true;
    getDocs(collection(db, scopedPath('invites'))).then((snap: any) => {
      if (!alive) return;
      let best: any = null; let bestId = '';
      snap.forEach((x: any) => {
        const d = x.data() || {};
        if (!best || ((d.createdAt || {}).seconds || 0) > ((best.createdAt || {}).seconds || 0)) { best = d; bestId = x.id; }
      });
      if (!best) return;
      setDocId(bestId);
      setOpens(best.opens || 0);
      if (IV_STYLES.some((s) => s.id === best.tpl)) setTpl(best.tpl);
      setF({
        bride: best.bride || demoBride() || 'Amara',
        groom: best.groom || demoGroom() || 'Daniel',
        date: best.wedDate || wedDate || '',
        venue: best.venue || weddingDetails?.receptionVenue || weddingDetails?.churchVenue || '',
        city: best.city || demoCity() || '',
        hashtag: best.hashtag || weddingDetails?.hashtag || '',
        story: best.message || story || '',
        dress: best.dress || weddingDetails?.asoEbi || '',
        rsvpBy: best.rsvpBy || '',
        whatsapp: best.whatsapp || '',
        schedule: (() => {
          const raw = best.schedule;
          let rows: any = null;
          if (Array.isArray(raw) && raw.length) rows = raw;
          else if (typeof raw === 'string' && raw.trim()) { try { const parsed = JSON.parse(raw); if (Array.isArray(parsed) && parsed.length) rows = parsed; } catch { /* unparsable, use defaults */ } }
          return rows && rows.length ? rows : [['2:00 PM', 'Ceremony', 'Please be seated by 1:45 PM'], ['4:00 PM', 'Cocktails and photos', 'Garden terrace'], ['6:00 PM', 'Reception dinner', 'Followed by speeches'], ['8:00 PM', 'First dance and party', 'Dancing until late']];
        })(),
        music: best.music || '',
        photos: Array.isArray(best.photos) ? best.photos : [],
      });
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Live open count while the section is open.
  useEffect(() => {
    if (DEMO || !docId) return;
    const unsub = onSnapshot(doc(db, scopedPath('invites'), docId), (s: any) => { if (s.exists()) setOpens((s.data() || {}).opens || 0); });
    return () => { try { unsub(); } catch { /* ignore */ } };
  }, [docId]);

  const setRow = (i: number, k: number, v: string) => {
    const rows = f.schedule.map((r: any[], ri: number) => ri === i ? r.map((c, ci) => ci === k ? v : c) : r.slice());
    setF({ ...f, schedule: rows });
  };

  const cardParams = () => {
    const p = new URLSearchParams();
    p.set('name1', f.bride || 'Amara');
    p.set('name2', f.groom || 'Daniel');
    if (f.date) p.set('date', f.date + ' 10:00');
    if (f.venue) p.set('venue', f.venue);
    if (f.city) p.set('address', f.city);
    if (f.hashtag) p.set('hashtag', f.hashtag);
    if (f.story) p.set('story', f.story);
    if (f.dress) p.set('dress', f.dress);
    if (Array.isArray(dressColors) && dressColors.length) p.set('dressColors', JSON.stringify(dressColors));
    if (f.music) p.set('music', f.music);
    if (f.photos && f.photos.length) p.set('photo', f.photos[0]);
    if (f.schedule && f.schedule.length) p.set('schedule', JSON.stringify(f.schedule));
    return p.toString();
  };

  const previewUrl = (t: string) => {
    const st = IV_STYLES.find((s) => s.id === t);
    if (st && st.iv) return `/iv/iv-${t}.html?${cardParams()}`;
    const p = new URLSearchParams();
    p.set('tpl', t);
    p.set('bride', f.bride || 'Amara');
    p.set('groom', f.groom || 'Daniel');
    if (f.date) p.set('date', f.date + ' 10:00');
    if (f.venue) p.set('venue', f.venue);
    if (f.city) p.set('city', f.city);
    if (f.story) p.set('message', f.story);
    return `/invite.html?${p.toString()}`;
  };

  const buildLink = (t: string, id: string) => {
    const st = IV_STYLES.find((s) => s.id === t);
    return st && st.iv ? `${window.location.origin}/iv/iv-${t}.html?i=${id}&app=${APP_ID}` : `${window.location.origin}/invite.html?i=${id}&app=${APP_ID}`;
  };

  const fmtDate = (v: string) => { try { return new Date(v + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); } catch { return v; } };

  const saveInvite = async () => {
    if (!f.bride.trim() || !f.groom.trim()) { showToast('Bride and groom names are required', 'error'); return; }
    setSaving(true);
    const s = (v: any) => (v == null || typeof v === 'object' ? '' : String(v)).trim();
    const dateStr = s(f.date).slice(0, 10);
    const dt = dateStr ? new Date(dateStr + 'T12:00:00') : null;
    const okDate = !!dt && !isNaN(dt.getTime());
    const scheduleRows = (Array.isArray(f.schedule) ? f.schedule : [])
      .map((r: any) => (Array.isArray(r) ? r : []).slice(0, 3).map((c: any) => s(c)))
      .filter((r: string[]) => r.some((c: string) => c));
    const payload: any = {
      bride: s(f.bride), groom: s(f.groom), tpl,
      wedDate: dateStr,
      month: okDate && dt ? dt.toLocaleString('en-GB', { month: 'long' }) : '',
      day: okDate && dt ? String(dt.getDate()) : '',
      year: okDate && dt ? String(dt.getFullYear()) : '',
      venue: s(f.venue), city: s(f.city),
      message: s(f.story), hashtag: s(f.hashtag), dress: s(f.dress),
      whatsapp: s(f.whatsapp).replace(/\D/g, ''),
      dressColors: (Array.isArray(dressColors) ? dressColors : []).filter((c: any) => typeof c === 'string' && c.trim()).map((c: string) => c.trim()).slice(0, 12),
      photos: (Array.isArray(f.photos) ? f.photos : []).slice(0, 5).filter((u: any) => typeof u === 'string' && u),
      schedule: JSON.stringify(scheduleRows),
      music: s(f.music), updatedAt: serverTimestamp(),
    };
    try {
      if (DEMO) {
        const link = `${window.location.origin}${previewUrl(tpl)}`;
        localStorage.setItem(lsKey('iv-form'), JSON.stringify({ f, tpl, opens }));
        setDocId('demo'); setSavedLink(link);
        showToast('Demo app: the card is saved on this device only', 'success');
      } else if (docId) {
        await updateDoc(doc(db, scopedPath('invites'), docId), payload);
        setSavedLink(buildLink(tpl, docId));
        showToast('Invitation card updated. The link still works', 'success');
      } else {
        const res: any = await addDoc(collection(db, scopedPath('invites')), { ...payload, opens: 0, createdAt: serverTimestamp() });
        setDocId(res.id);
        setSavedLink(buildLink(tpl, res.id));
        showToast('Invitation card created. Send the link to your guests', 'success');
      }
    } catch (e: any) {
      console.error('[invite-save] failed:', e, { tpl, docId });
      showToast('Could not save the invitation: ' + String((e && (e.message || e.code)) || 'unknown error').slice(0, 140) + '. Try again', 'error');
    }
    setSaving(false);
  };

  const copyText = async (t: string, what: string) => {
    try { await navigator.clipboard.writeText(t); showToast(what + ' copied', 'success'); } catch { showToast('Could not copy', 'error'); }
  };

  const [guests, setGuests] = useState<any[] | null>(null);
  const [openSec, setOpenSec] = useState<Record<string, boolean>>({});
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [addingGuest, setAddingGuest] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!docId) { setGuests(null); return; }
    if (docId === 'demo') {
      try { setGuests(JSON.parse(localStorage.getItem(lsKey('iv-guests')) || '[]')); } catch { setGuests([]); }
      return;
    }
    const unsub = onSnapshot(collection(db, scopedPath('invites'), docId, 'guests'), (snap: any) => {
      const rows = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      rows.sort((a: any, b: any) => ((a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)));
      setGuests(rows);
    }, () => setGuests([]));
    return () => { try { unsub(); } catch { /* gone */ } };
  }, [docId]);

  const guestLink = (gid: string) => {
    const st = IV_STYLES.find((s) => s.id === tpl);
    return st && st.iv
      ? `${window.location.origin}/iv/iv-${tpl}.html?i=${docId}&g=${gid}&app=${APP_ID}`
      : `${window.location.origin}/invite.html?i=${docId}&g=${gid}&app=${APP_ID}`;
  };

  const addGuest = async () => {
    if (!docId) { showToast('Save the invitation first, then add your invitees', 'error'); return; }
    if (!guestName.trim()) { showToast("Type the invitee's name first", 'error'); return; }
    setAddingGuest(true);
    const phone = guestPhone.replace(/\D/g, '');
    try {
      if (docId === 'demo') {
        const next = [...(guests || []), { id: 'g' + Date.now(), name: guestName.trim(), phone, createdAt: { seconds: Math.floor(Date.now() / 1000) } }];
        setGuests(next);
        localStorage.setItem(lsKey('iv-guests'), JSON.stringify(next));
      } else {
        await addDoc(collection(db, scopedPath('invites'), docId, 'guests'), { name: guestName.trim(), phone, createdAt: serverTimestamp() });
      }
      setGuestName(''); setGuestPhone('');
      showToast('Invitee added. Copy their link or tap WhatsApp to send it', 'success');
    } catch (e: any) { showToast('Could not add the invitee' + (e && e.message ? ': ' + String(e.message).slice(0, 100) : '') + '. Try again', 'error'); }
    setAddingGuest(false);
  };

  const [dressColors, setDressColors] = useState<string[]>(() => {
    try { const v = JSON.parse(localStorage.getItem(lsKey('dress-colors')) || 'null'); if (Array.isArray(v)) return v; } catch { /* private mode */ }
    return (weddingDetails && weddingDetails.dressColors) || [];
  });
  useEffect(() => {
    const dc = weddingDetails && weddingDetails.dressColors;
    if (Array.isArray(dc)) setDressColors(dc);
  }, [weddingDetails]);
  const saveColorsShared = async (next: string[]) => {
    setDressColors(next);
    if (DEMO) { try { localStorage.setItem(lsKey('dress-colors'), JSON.stringify(next)); } catch { /* private mode */ } return; }
    try { await setDoc(doc(db, scopedPath('app_config'), 'main'), { weddingDetails: { dressColors: next } }, { merge: true }); } catch { showToast('Could not save the colours', 'error'); }
  };

  const guestMsg = (gl: string) => `You are invited to the wedding of ${f.bride} & ${f.groom}${f.date ? ', ' + fmtDate(f.date) : ''}${f.venue ? ', ' + f.venue : ''}. Open your invitation card: ${gl}`;

  const onInvitePhotos = async (e: any) => {
    const files = Array.from(e.target.files || []) as File[];
    e.target.value = '';
    if (!files.length) return;
    const room = 5 - (f.photos || []).length;
    if (room <= 0) { showToast('Up to 5 photos on the card', 'error'); return; }
    setPhotoBusy(true);
    try {
      const urls: string[] = [];
      for (const file of files.slice(0, room)) {
        if (DEMO) { urls.push(await demoImageDataUrl(file)); }
        else { urls.push(await uploadToCloudinaryWithProgress(file, 'eventicor-invite', () => {})); }
      }
      setF((prev: any) => ({ ...prev, photos: [...(prev.photos || []), ...urls] }));
      showToast(urls.length === 1 ? 'Photo added' : urls.length + ' photos added', 'success');
    } catch { showToast('Could not upload that photo. Try again', 'error'); }
    setPhotoBusy(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-black font-display tracking-tight">Inbox invite</h2>
        <p className="text-sm opacity-60 mt-0.5">Invitation cards you send your guests. Pick a style, check the details, save, then add your invitees. Each one gets their own link, and you see when they open it and what they reply.</p>
      </div>

      <section>
        <div className="mb-3">
          <label className="block text-[0.7rem] uppercase tracking-widest font-black opacity-50">Card style</label>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {IV_STYLES.map((s) => (
            <div key={s.id} className={`relative rounded-2xl border p-4 cursor-pointer transition-all ${tpl === s.id ? 'border-[var(--ann-accent)] ring-2 ring-[var(--ann-accent)]/30' : isDarkMode ? 'border-[#22363E]' : 'border-[#DAD8E3]'}`} onClick={() => setTpl(s.id)}>
              {tpl === s.id && <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--ann-accent)] text-white flex items-center justify-center"><Check className="w-3 h-3" /></span>}
              <b className="text-sm font-black block pr-6">{s.n}</b>
              <span className="text-xs opacity-50 block mt-1">{s.d}</span>
            </div>
          ))}
        </div>
      </section>

      {(() => {
        const InvSec = ({ id, title, children }: any) => (
          <section className={cardCls}>
            <div className="flex items-center justify-between gap-3">
              <label className={labCls + ' !mb-0'}>{title}</label>
              <button type="button" onClick={() => setOpenSec((o) => ({ ...o, [id]: !o[id] }))} className="text-[0.6rem] font-black uppercase tracking-widest text-[var(--ann-accent)] whitespace-nowrap">{openSec[id] === false ? 'Show' : 'Hide'}</button>
            </div>
            {openSec[id] !== false && <div className="mt-3">{children}</div>}
          </section>
        );
        return (
          <>
            <InvSec id="couple" title="The couple">
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className={labCls}>Bride</label><input className={inputCls} value={f.bride} onChange={(e) => setF({ ...f, bride: e.target.value })} placeholder="Bride's name" /></div>
                <div><label className={labCls}>Groom</label><input className={inputCls} value={f.groom} onChange={(e) => setF({ ...f, groom: e.target.value })} placeholder="Groom's name" /></div>
                <div><label className={labCls}>Wedding date</label><BrandedDateField value={f.date} onChange={(v: string) => setF({ ...f, date: v })} isDarkMode={isDarkMode} inputCls={inputCls} /></div>
                <div><label className={labCls}>Hashtag</label><input className={inputCls} value={f.hashtag} onChange={(e) => setF({ ...f, hashtag: e.target.value })} placeholder="#YourNames" /></div>
              </div>
            </InvSec>
            <InvSec id="venue" title="The venue">
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className={labCls}>Venue</label><input className={inputCls} value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} placeholder="Venue name" /></div>
                <div><label className={labCls}>Address / city</label><input className={inputCls} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} placeholder="12 Palm Avenue, Lekki, Lagos" /></div>
              </div>
            </InvSec>
            <InvSec id="note" title="A note to your guests">
              <textarea className={inputCls + ' min-h-[70px]'} value={f.story} onChange={(e) => setF({ ...f, story: e.target.value })} placeholder="A short line that welcomes your guests" />
            </InvSec>
            <InvSec id="dress" title="Dress colours">
              <ColorSwatchesRow colors={dressColors} onChange={(next: string[]) => saveColorsShared(next)} isDarkMode={isDarkMode} />
              <p className="text-[10px] opacity-50 mt-1">The colours of the day. They show on the card and on the home page, and match the events section.</p>
            </InvSec>
            <InvSec id="schedule" title="Day schedule">
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2 text-[10px] font-black uppercase tracking-widest opacity-50 px-0.5"><span>Time</span><span>What</span><span>Note</span></div>
                {f.schedule.map((r: any[], i: number) => (
                  <div key={i} className="grid grid-cols-3 gap-2">
                    <input className={inputCls} value={r[0] || ''} onChange={(e) => setRow(i, 0, e.target.value)} placeholder="2:00 PM" />
                    <input className={inputCls} value={r[1] || ''} onChange={(e) => setRow(i, 1, e.target.value)} placeholder="Ceremony" />
                    <input className={inputCls} value={r[2] || ''} onChange={(e) => setRow(i, 2, e.target.value)} placeholder="Note" />
                  </div>
                ))}
              </div>
            </InvSec>
            <InvSec id="photos" title="Photos on the card">
              <div className="grid grid-cols-3 gap-2">
                {(f.photos || []).map((u: string, i: number) => (
                  <div key={i} className={`relative rounded-xl overflow-hidden border ${isDarkMode ? 'border-[#22363E]' : 'border-[#DAD8E3]'}`} style={{ aspectRatio: '3/4' }}>
                    <img src={u} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setF({ ...f, photos: f.photos.filter((_: string, j: number) => j !== i) })} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-sm leading-none flex items-center justify-center">×</button>
                  </div>
                ))}
                {(f.photos || []).length < 5 && (
                  <button type="button" onClick={() => photoInputRef.current?.click()} className={`rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 text-xs font-black uppercase tracking-widest ${isDarkMode ? 'border-[#22363E] text-white/50' : 'border-[#DAD8E3] text-slate-400'}`} style={{ aspectRatio: '3/4' }}>
                    {photoBusy ? 'Uploading…' : '+ Photo'}
                  </button>
                )}
              </div>
              <p className="text-[10px] opacity-50 mt-1.5">Up to 5. On the card they glide across by themselves.</p>
              <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onInvitePhotos} />
            </InvSec>
            <InvSec id="music" title="Music">
              <div className="relative">
                {musicOpen && <div className="fixed inset-0 z-20" onClick={closeMusicDropdown} />}
                <button type="button" onClick={() => { if (musicOpen) stopInvitePreview(); setMusicOpen(!musicOpen) }} className={inputCls + ' flex items-center justify-between gap-2 text-left'}>
                  <span className="truncate">{f.music === '' ? 'Built-in music' : f.music === 'none' ? 'No music' : ((musicLib.find((tr) => tr.url === f.music) || {}).name || 'Selected track')}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${musicOpen ? 'rotate-180' : ''}`} />
                </button>
                {musicOpen && (
                  <div className={`absolute left-0 right-0 mt-2 rounded-xl border shadow-xl z-30 max-h-[260px] overflow-auto ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                    {[
                      { id: 'builtin', name: 'Built-in music', v: '' },
                      { id: 'none', name: 'No music', v: 'none' },
                      ...musicLib.map((tr) => ({ id: tr.id, name: tr.name, v: tr.url })),
                    ].map((o) => {
                      const playing = invitePlaying === o.v;
                      return (
                      <div key={o.id} className={`w-full flex items-center gap-1 pr-2 ${playing ? 'mus-playing' : 'hover:bg-[var(--ann-accent)]/5'}`}>
                        <button type="button" onClick={() => { setF({ ...f, music: o.v }); closeMusicDropdown(); }} className="flex-1 min-w-0 flex items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm">
                          <span className="flex min-w-0 items-center gap-2">
                            {playing && <span className="eqbars text-[var(--ann-accent)]" aria-hidden="true"><i /><i /><i /></span>}
                            <span className={`truncate ${playing ? 'font-semibold text-[var(--ann-accent)]' : ''}`}>{o.name}</span>
                          </span>
                          {f.music === o.v && <Check className="w-4 h-4 text-[var(--ann-accent)] shrink-0" />}
                        </button>
                        {o.v !== '' && o.v !== 'none' && (
                          <button type="button" aria-label={`Listen to ${o.name}`} onClick={() => toggleInvitePreview(o.v)} className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 active:scale-95 ${isDarkMode ? 'bg-white/10 text-white' : 'bg-black/5 text-slate-700'}`}>
                            {invitePlaying === o.v ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
                          </button>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </InvSec>
          </>
        );
      })()}

      {docId && (
        <section className={cardCls}>
          <label className={labCls}>Your invitees</label>
          <p className="text-xs opacity-60 mt-1 mb-3">Every invitee gets their own link. You see here when each one opens their card, and their reply the moment they send it.</p>
          {guests === null ? (
            <p className="text-xs opacity-60">Loading your invitees…</p>
          ) : guests.length === 0 ? (
            <p className="text-xs opacity-60">No invitees yet. Add one for each person you are inviting, then copy their link.</p>
          ) : (
            <div className="space-y-2">
              {guests.map((g: any, i: number) => {
                const gl = docId !== 'demo' ? guestLink(g.id) : window.location.origin + previewUrl(tpl);
                const openedAt = g.openedAt?.seconds ? new Date(g.openedAt.seconds * 1000) : (g.openedAt ? new Date(g.openedAt) : null);
                const rep = g.reply || null;
                return (
                  <div key={g.id} className={`rounded-xl border p-3 ${isDarkMode ? 'border-[#22363E]' : 'border-[#DAD8E3]'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <b className="text-sm">{g.name || `Invitee ${i + 1}`}</b>
                      <span className={`px-2 py-1 rounded-full text-[0.6rem] font-black uppercase tracking-widest ${rep ? 'bg-emerald-500/15 text-emerald-600' : openedAt ? 'bg-[var(--ann-accent)]/15 text-[var(--ann-accent)]' : isDarkMode ? 'bg-white/10 text-white/60' : 'bg-black/5 text-slate-500'}`}>{rep ? 'Replied' : openedAt ? 'Opened' : 'Not opened'}</span>
                    </div>
                    {openedAt && <p className="text-xs opacity-60 mt-1">Opened {openedAt.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>}
                    {rep && <p className="text-xs mt-1">{rep.attend === 'no' ? "Can't make it" : 'Coming'}{rep.note ? ` · ${rep.note}` : ''}</p>}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button type="button" onClick={() => copyText(gl, 'Link')} className="px-3 py-1.5 rounded-full bg-[var(--ann-accent)] text-white text-[0.6rem] font-black uppercase tracking-widest">Copy link</button>
                      <button type="button" onClick={() => copyText(guestMsg(gl), 'Message')} className="px-3 py-1.5 rounded-full border border-[var(--ann-accent)] text-[var(--ann-accent)] text-[0.6rem] font-black uppercase tracking-widest">Copy message</button>
                      <button type="button" aria-label={`Send ${g.name || 'this invitee'} their invite on WhatsApp`} onClick={() => { const ph = String(g.phone || '').replace(/\D/g, ''); if (!ph) { showToast('Add their WhatsApp number to open the chat', 'error'); return; } window.open('https://wa.me/' + ph + '?text=' + encodeURIComponent(guestMsg(gl)), '_blank'); }} className="px-3 py-1.5 rounded-full bg-[#25D366] text-white text-[0.6rem] font-black uppercase tracking-widest" style={{ touchAction: 'manipulation' }}>WhatsApp</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-3">
            <label className="block text-[0.7rem] uppercase tracking-widest font-black opacity-50 mb-1.5">Add an invitee</label>
            <div className="flex gap-2">
              <input className={inputCls} value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Their name" maxLength={40} />
              <input className={inputCls} value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="WhatsApp number" inputMode="tel" maxLength={20} />
              <button type="button" onClick={addGuest} disabled={addingGuest} className="px-4 py-2 rounded-full bg-[var(--ann-accent)] text-white text-[0.65rem] font-black uppercase tracking-widest disabled:opacity-50 whitespace-nowrap" style={{ touchAction: 'manipulation' }}>{addingGuest ? 'Adding…' : 'Add'}</button>
            </div>
            <p className="text-[10px] opacity-50 mt-1.5">Their WhatsApp number powers the WhatsApp button on their row.</p>
          </div>
        </section>
      )}

      <div>
        <div className={`${cardCls} flex items-center justify-between gap-3`}>
          <span className="text-xs opacity-60">{docId ? 'Your card is live. Changes update the same link.' : 'Nothing saved yet.'}</span>
          <button type="button" onClick={saveInvite} disabled={saving} className="px-5 py-2.5 rounded-full bg-[var(--ann-accent)] text-white text-[0.7rem] font-black uppercase tracking-widest disabled:opacity-50">{saving ? 'Saving…' : docId ? 'Update invite' : 'Save invite'}</button>
        </div>
      </div>

      <button type="button" aria-label="Preview card" onClick={() => setPreviewTpl(tpl)} className="fixed w-12 h-12 rounded-full bg-[var(--ann-accent)] text-white shadow-xl flex items-center justify-center" style={{ right: 14, bottom: 84, zIndex: 250, touchAction: 'manipulation' }}>
        <Eye className="w-5 h-5" />
      </button>

      {previewTpl && (
        <div className="fixed inset-0 z-[500] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPreviewTpl(null)}>
          <div className="relative w-[340px] max-w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2 text-white">
              <span className="text-xs font-black uppercase tracking-widest">Preview · {IV_STYLES.find((s) => s.id === previewTpl)?.n || ''}</span>
              <button type="button" onClick={() => setPreviewTpl(null)} className="text-xs font-black uppercase tracking-widest opacity-70">Close</button>
            </div>
            <div className="rounded-[28px] bg-black p-1.5 shadow-2xl">
              <iframe src={previewUrl(previewTpl)} className="w-[320px] h-[620px] rounded-[22px] bg-white" title="Invitation preview" />
            </div>
            <p className="text-center text-[11px] text-white/70 mt-2">Your card as guests will open it · tap inside the mockup</p>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminDashboardModal({ 
  isOpen, 
  asPage, 
  onClose, 
  activeCode, 
  onUpdateCode, 
  isDarkMode, 
  heroImages, 
  heroImageLabels,
  onUpdateHeroLabels,
  onSaveWeddingSection,
  contactSettings,
  onUpdateHeroImages,
  footerImages,
  onUpdateFooterImages,
  onUpdateFooterStyle,
  footerStyle,
  footerThanks,
  onUpdateHeroTemplate,
  heroTpl,
  accentKey,
  onUpdateAccent,
  allAdmins,
  selfRole,
  deletedPosts,
  onRestorePost,
  onPermanentDelete,
  currentUserEmail,
  onSignOut,
  adminPermissions,
  videoOrientations,
  events,
  story,
  weddingDetails,
  onSaveWedding,
  vendors,
  blockedUids,
  vendorRequests,
  onUpdatePeople,
  onVendorAction,
  approveGuestPosts,
  pushEnabled,
  archiveMode,
  feedActionMode,
  adminMode = 'real',
  onUpdateAppFlags,
  feedPrivate,
  updateFeedPrivacy,
  revokeAccessCode,
  onDownloadEverything,
  onCreateMemoryBook,
  onDeleteAllGuestData,
  showToast,
  onBackToMain,
  postAds = [],
  reelAds = [],
  onUpdatePostAds,
  onUpdateReelAds,
  posts = [],
  onDeletePost,
  partners = DEMO_PARTNERS,
  onAdminDemoPost
}: any) {
  const [newCode, setNewCode] = useState(activeCode ?? '');
  const [revokeArmed, setRevokeArmed] = useState(false);
  // Storage (Eventicor platform settings): live usage record for this app,
  // the plan storage values the Eventicor admin sets, and the upgrade flow.
  const [usageRec, setUsageRec] = useState<any>(null);
  const [platStore, setPlatStore] = useState<Record<string, number>>(() => getCouplePlatform().storage);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const appPlan = getCouplePlan();
  const planGB = platStore[appPlan] || 5;
  const usedBytes = usageRec ? (Number(usageRec.imagesBytes) || 0) + (Number(usageRec.videosBytes) || 0) : 0;
  const limitBytes = planGB * 1073741824;
  const usedGB = usedBytes / 1073741824;
  const imagesGB = usageRec ? (Number(usageRec.imagesBytes) || 0) / 1073741824 : 0;
  const videosGB = usageRec ? (Number(usageRec.videosBytes) || 0) / 1073741824 : 0;
  const freeBytes = Math.max(0, limitBytes - usedBytes);
  const storageFull = usedBytes >= limitBytes;
  const [isDirty, setIsDirty] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState<string>(() => {
    try {
      const storedAdminUi = JSON.parse(localStorage.getItem(lsKey('admin-ui')) || 'null');
      // Nov 20 2026: the Hero photos tab merged into Events & photos.
      const storedTab = storedAdminUi?.tab === 'hero' ? 'events' : storedAdminUi?.tab;
      return storedTab && ['overview', 'moderation', 'posts', 'events', 'invite', 'albums', 'settings', 'ads', 'recycle'].includes(storedTab) ? storedTab : 'overview';
    } catch {
      return 'overview';
    }
  });
  const [mobileAdminNavOpen, setMobileAdminNavOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  // Latest activity popup: the recorded activity, newest first, capped at the
  // last 30 records.
  const [activityOpen, setActivityOpen] = useState(false);
  // Partners: the couple's partner directory (name, category, description,
  // logo, contacts) shown on the app's home page under Our partners. Demo
  // runs keep the list locally so the preview always has something to show.
  const [demoPartnersLocal, setDemoPartnersLocal] = useState<any[]>(DEMO_PARTNERS);
  const partnersList: any[] = DEMO ? demoPartnersLocal : (partners || []);
  const [partnerForm, setPartnerForm] = useState<any>({ name: '', category: '', description: '', photo: '', whatsapp: '', instagram: '', website: '', tiktok: '', facebook: '', youtube: '' });
  const [partnerEditing, setPartnerEditing] = useState<any>(null);
  const [partnerDelete, setPartnerDelete] = useState<any>(null);
  const [partnerLogoBusy, setPartnerLogoBusy] = useState(false);
  // Storage reader: reconciled against Cloudinary so it always shows the real
  // bytes this app's media occupies, not only the uploads made since tracking
  // started. The dashboard syncs when it opens and shortly after any upload.
  const syncUsage = async () => {
    if (DEMO) return;
    try {
      const token = await auth?.currentUser?.getIdToken?.();
      if (!token) return;
      const eps = [
        `/api/usage-sync?app=${encodeURIComponent(APP_ID)}`,
        `/.netlify/functions/usage-sync?app=${encodeURIComponent(APP_ID)}`
      ];
      for (const ep of eps) {
        try {
          const r = await fetch(ep, { headers: { Authorization: `Bearer ${token}` } });
          if (r.ok) {
            const d = await r.json();
            setUsageRec((prev: any) => ({ ...(prev || {}), imagesBytes: Number(d.imagesBytes) || 0, videosBytes: Number(d.videosBytes) || 0, syncedAt: new Date() }));
            return;
          }
        } catch { /* try the next endpoint */ }
      }
    } catch { /* the reader keeps the last known numbers */ }
  };
  useEffect(() => { syncUsage(); }, []);
  useEffect(() => {
    let t: any;
    const on = () => { try { clearTimeout(t); } catch {} t = setTimeout(() => { syncUsage(); }, 10000); };
    window.addEventListener('ann-usage-dirty', on);
    return () => { window.removeEventListener('ann-usage-dirty', on); try { clearTimeout(t); } catch {} };
  }, []);

  const savePartner = async () => {
    const name = String(partnerForm.name || '').trim();
    if (!name) { showToast('Give the partner a name first.', 'error'); return; }
    const payload: any = {
      name,
      category: String(partnerForm.category || '').trim(),
      description: String(partnerForm.description || '').trim(),
      photo: partnerForm.photo || '',
      whatsapp: String(partnerForm.whatsapp || '').trim(),
      instagram: String(partnerForm.instagram || '').trim(),
      website: String(partnerForm.website || '').trim(),
      tiktok: String(partnerForm.tiktok || '').trim(),
      facebook: String(partnerForm.facebook || '').trim(),
      youtube: String(partnerForm.youtube || '').trim(),
    };
    try {
      if (DEMO) {
        if (partnerEditing) setDemoPartnersLocal((l: any[]) => l.map((x: any) => x.id === partnerEditing.id ? { ...x, ...payload } : x));
        else setDemoPartnersLocal((l: any[]) => [...l, { id: `demo-${Date.now()}`, ...payload }]);
      } else if (partnerEditing) {
        await updateDoc(doc(db, scopedPath('partners'), partnerEditing.id), { ...payload, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, scopedPath('partners')), { ...payload, createdAt: serverTimestamp() });
      }
      showToast(partnerEditing ? 'Partner updated.' : 'Partner added. It is live on the app now.', 'success');
      setPartnerForm({ name: '', category: '', description: '', photo: '', whatsapp: '', instagram: '', website: '', tiktok: '', facebook: '', youtube: '' });
      setPartnerEditing(null);
    } catch {
      showToast('Could not save the partner. Check your connection and try again.', 'error');
    }
  };
  const removePartner = async () => {
    if (!partnerDelete) return;
    try {
      if (DEMO) setDemoPartnersLocal((l: any[]) => l.filter((x: any) => x.id !== partnerDelete.id));
      else await deleteDoc(doc(db, scopedPath('partners'), partnerDelete.id));
      showToast('Partner removed from the app.', 'success');
    } catch { showToast('Could not remove the partner.', 'error'); }
    setPartnerDelete(null);
  };
  const uploadPartnerLogo = async (file: any) => {
    if (!file) return;
    setPartnerLogoBusy(true);
    try {
      const url = await uploadToCloudinary(file, 'partners');
      setPartnerForm((f: any) => ({ ...f, photo: url }));
    } catch (err: any) {
      showToast(String(err?.message || '').includes('storage is full') ? STORAGE_FULL_MESSAGE : 'Logo upload failed. Try again.', 'error');
    }
    setPartnerLogoBusy(false);
  };

  // Plan chooser (Storage > Upgrade): the same three-plan flow as the trial
  // screen. In demo or preview runs nothing is sent anywhere.
  const paymentPanel = (() => {
    if (!upgradeOpen) return null;
    const header = demoHeader();
    return (
      <div className="fixed inset-0 z-[400] flex items-center justify-center p-4" style={{ background: 'rgba(10,10,22,.62)', backdropFilter: 'blur(4px)' }} onClick={(e) => { if (e.target === e.currentTarget) setUpgradeOpen(false) }}>
        <div className="relative w-full max-h-[92vh] overflow-y-auto rounded-[24px] p-6" style={{ background: '#faf7f0', maxWidth: 470 }} onClick={(e) => e.stopPropagation()}>
          <button type="button" aria-label="Close" onClick={() => setUpgradeOpen(false)} className="absolute right-4 top-4 w-9 h-9 rounded-full border border-[#DAD8E3] bg-white text-[#5A6970] flex items-center justify-center font-black">×</button>
          <PaymentFlow
            accent={typeof window !== 'undefined' ? (getComputedStyle(document.documentElement).getPropertyValue('--ann-accent').trim() || '#7a4b9e') : '#7a4b9e'}
            appName={`${demoBride() || 'Bride'} & ${demoGroom() || 'Groom'}`}
            email={''}
            appId={APP_ID}
            titles={['Choose a new plan', 'Make your transfer', 'Almost there']}
            intro={'Pick the plan that fits your app. Storage, photographers, vendors and features follow the plan you choose.'}
            demoMode={DEMO || adminMode !== 'real'}
            onDone={() => setUpgradeOpen(false)}
          />
        </div>
      </div>
    );
  })();

  useEffect(() => {
    // Live usage: what this app's media has eaten, images and videos apart.
    // Demo and preview apps have no usage record; they show 0 used.
    if (DEMO) return;
    const ref = doc(db, scopedPath('usage'), 'main');
    const unsub = onSnapshot(ref, (snap: any) => {
      const u = snap.exists() ? (snap.data() as any) : null;
      setUsageRec(u);
      setUsageClient(u, getCouplePlan());
    }, () => {});
    return () => { try { unsub() } catch {} };
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(platformDb as any, 'platform', 'settings'), (snap: any) => {
      try {
        const d = snap.exists() ? (snap.data() as any) : {};
        const st: Record<string, number> = { ...getCouplePlatform().storage };
        for (const k of ['essential', 'complete', 'legacy'] as const) {
          const v = Number(d?.storage?.[k]);
          if (Number.isFinite(v) && v > 0) st[k] = v;
        }
        setPlatStore(st);
        setPlatformSettingsClient({ feedPageSize: getCouplePlatform().feedPageSize, storage: st });
        setUsageClient(usageRec, getCouplePlan());
      } catch {}
    }, () => {});
    return () => { try { unsub() } catch {} };
  }, []);

  useEffect(() => {
    try {
      const storedAdminUi = JSON.parse(localStorage.getItem(lsKey('admin-ui')) || 'null') || {};
      localStorage.setItem(lsKey('admin-ui'), JSON.stringify({ ...storedAdminUi, tab: activeAdminTab }));
    } catch {}
  }, [activeAdminTab]);

  // Photo albums live in the `albums` collection; every upload carries the
  // uploader's name and the upload date.
  useEffect(() => {
    if (!isOpen) return;
    const q = query(collection(db, scopedPath('albums')), orderBy('uploadedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => setAlbums(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))), (err) => console.error('Albums load error:', err));
    return () => unsub();
  }, [isOpen]);

  // Photographers and vendors see and do exactly one thing here: Photo albums.
  // The signed-in admin's own doc. Prefer the live collection copy, but fall
  // back to the role synced from their own admins doc so a restricted role
  // (a photographer) is locked to Vendor albums from the very first render,
  // not only once the whole collection snapshot lands.
  const myAdminDoc = allAdmins.find((a: any) => a.email === currentUserEmail)
    || (selfRole ? { id: '__self__', email: currentUserEmail, name: null, role: selfRole, permissions: adminPermissions, mustSetPassword: false } : null);
  const restrictedRole = ['photographer', 'videographer', 'vendor'].includes(myAdminDoc?.role);
  useEffect(() => {
    if (restrictedRole && activeAdminTab !== 'albums') setActiveAdminTab('albums');
  }, [restrictedRole, activeAdminTab]);

  // Team "View details" popup: one place that shows a member's name, email
  // and exactly what their role lets them do.
  const [teamDetail, setTeamDetail] = useState<any | null>(null);

  // Vendor albums: every upload session is ONE album. The album carries the
  // name of the admin who uploaded it and the date; the tab shows compact
  // album tiles, and tapping one opens every photo or video inside it.
  const [albumPopupKind, setAlbumPopupKind] = useState<'photo' | 'video' | null>(null);
  const [albumPicked, setAlbumPicked] = useState<{ file: File; preview: string }[]>([]);
  const [albumTitle, setAlbumTitle] = useState('');
  const [albumUploading, setAlbumUploading] = useState(false);
  const [albumProgressPct, setAlbumProgressPct] = useState(0);
  const [albumViewer, setAlbumViewer] = useState<any | null>(null);
  const [albumMediaView, setAlbumMediaView] = useState<{ items: any[]; index: number } | null>(null);
  // Posting an album photo or video straight to the feed from its viewer.
  const [quickPostToFeed, setQuickPostToFeed] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const canPostToFeed = !selfRole || ['owner', 'couple', 'admin', 'bride', 'groom'].includes(selfRole);
  const [albumZipBusy, setAlbumZipBusy] = useState<string | null>(null);
  // Adding more to an album that already exists: the viewer's Add more button
  // opens the same upload popup aimed at that album.
  const [albumAddTarget, setAlbumAddTarget] = useState<any | null>(null);

  const uploaderDisplayName = (() => {
    const n = (myAdminDoc as any)?.name;
    if (n && String(n).trim()) return String(n).trim();
    return (currentUserEmail || 'Admin').split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  })();

  const openAlbumPopup = (kind: 'photo' | 'video', target: any = null) => {
    setAlbumPopupKind(kind);
    setAlbumPicked([]);
    setAlbumTitle('');
    setAlbumProgressPct(0);
    setAlbumAddTarget(target);
  };
  const pickAlbumFiles = (files: FileList | null) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    setAlbumPicked((prev) => [...prev, ...list.map((f) => ({ file: f, preview: URL.createObjectURL(f) }))]);
  };
  const dropAlbumFile = (i: number) => {
    setAlbumPicked((prev) => { const p = prev[i]; if (p) { try { URL.revokeObjectURL(p.preview); } catch { /* already gone */ } } return prev.filter((_, x) => x !== i); });
  };
  const uploadAlbumBatch = async () => {
    const kind = albumPopupKind;
    if (!kind || !albumPicked.length || albumUploading) return;
    if (!DEMO && storageBlocked()) {
      if (showToast) showToast(STORAGE_FULL_MESSAGE, 'error');
      return;
    }
    setAlbumUploading(true);
    setAlbumProgressPct(0);
    const totalFiles = albumPicked.length;
    const results: ({ url: string; type: 'image' | 'video' } | null)[] = new Array(totalFiles).fill(null);
    let failed = 0;
    let completed = 0;
    // Several files upload side by side (three at a time) instead of one
    // after another, so a batch of videos finishes in roughly a third of
    // the wait.
    const queue = albumPicked.map((picked, i) => ({ file: picked.file, i }));
    const worker = async () => {
      while (queue.length) {
        const job = queue.shift()!;
        try {
          let url: string;
          if (DEMO) {
            // The demo console keeps everything in the browser: photos shrink to
            // data URLs, videos play from a session blob URL (a full video can
            // never fit in a demo data URL or the demo store).
            url = isVideoFile(job.file) ? URL.createObjectURL(job.file) : await demoImageDataUrl(job.file);
          } else {
            url = await uploadToCloudinaryWithProgress(job.file, 'albums', (pct) => {
              setAlbumProgressPct(Math.min(99, Math.round(((completed + pct / 100) / totalFiles) * 100)));
            });
          }
          results[job.i] = { url, type: isVideoFile(job.file) ? 'video' : 'image' };
        } catch (err) {
          failed += 1;
          console.error('Album upload error:', err);
        }
        completed += 1;
        setAlbumProgressPct(Math.min(99, Math.round((completed / totalFiles) * 100)));
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    const media: { url: string; type: 'image' | 'video' }[] = results.filter(Boolean) as any;
    setAlbumProgressPct(100);
    const title = albumAddTarget ? (albumAddTarget.title || (kind === 'video' ? 'Video album' : 'Photo album')) : (albumTitle.trim() || (kind === 'video' ? 'Video album' : 'Photo album'));
    if (media.length) {
      try {
        if (albumAddTarget) {
          // Add to an album that already exists. Old day-grouped albums are
          // merged into one album document as they are touched.
          if (albumAddTarget.legacy) {
            const merged = [...(albumAddTarget.media || []), ...media];
            await addDoc(collection(db, scopedPath('albums')), {
              title,
              mediaType: kind === 'video' ? 'video' : 'image',
              media: merged,
              mediaCount: merged.length,
              uploaderName: albumAddTarget.uploaderName,
              uploaderEmail: albumAddTarget.uploaderEmail,
              uploadedAt: serverTimestamp()
            });
            for (const id of (albumAddTarget.docIds || [])) { try { await deleteDoc(doc(db, scopedPath('albums'), id)); } catch { /* already gone */ } }
            setAlbumViewer(null);
          } else {
            const ref = doc(db, scopedPath('albums'), albumAddTarget.docId);
            const snap = await getDoc(ref);
            const old = snap.exists() ? (snap.data()?.media || []) : [];
            const merged = [...old, ...media];
            await setDoc(ref, { media: merged, mediaCount: merged.length, uploadedAt: serverTimestamp() }, { merge: true });
            setAlbumViewer((gv: any) => (gv && gv.docId === albumAddTarget.docId ? { ...gv, media: merged, count: merged.length } : gv));
          }
          if (showToast) showToast(failed ? `${media.length} added to "${title}", ${failed} failed. Try the rest again.` : `${media.length} ${kind === 'video' ? 'video' : 'photo'}${media.length === 1 ? '' : 's'} added to "${title}".`, failed ? 'info' : 'success');
        } else {
          await addDoc(collection(db, scopedPath('albums')), {
            title,
            mediaType: kind === 'video' ? 'video' : 'image',
            media,
            mediaCount: media.length,
            uploaderName: uploaderDisplayName,
            uploaderEmail: currentUserEmail,
            uploadedAt: serverTimestamp()
          });
          if (showToast) showToast(failed ? `${media.length} uploaded to "${title}", ${failed} failed. Try the rest again.` : `${media.length} ${kind === 'video' ? 'video' : 'photo'}${media.length === 1 ? '' : 's'} uploaded to "${title}".`, failed ? 'info' : 'success');
        }
      } catch (err) {
        console.error('Album save error:', err);
        if (showToast) showToast('The files uploaded but saving the album failed. Try again.', 'error');
      }
    } else if (showToast) showToast('Nothing uploaded. Check your connection and try again.', 'error');
    setAlbumPicked((prev) => { prev.forEach((pp) => { try { URL.revokeObjectURL(pp.preview); } catch { /* already gone */ } }); return []; });
    setAlbumUploading(false);
    setAlbumPopupKind(null);
    setAlbumAddTarget(null);
    setAlbumTitle('');
  };
  const deleteAlbumGroup = async (g: any) => {
    try {
      if (g.legacy && g.docIds) { for (const id of g.docIds) await deleteDoc(doc(db, scopedPath('albums'), id)); }
      else if (g.docId) await deleteDoc(doc(db, scopedPath('albums'), g.docId));
      if (showToast) showToast('Album removed.', 'success');
    } catch (err) {
      console.error('Album delete error:', err);
      if (showToast) showToast('Could not remove it. Try again.', 'error');
    }
  };

  // Download one photo or video out of an album.
  const downloadMediaFile = async (url: string, name: string) => {
    try {
      const res = await fetch(url, { mode: 'cors' });
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 6000);
    } catch {
      window.open(url, '_blank');
    }
  };
  const albumFileBase = (g: any) => (String(g?.title || 'album').replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'album');
  // MASS DOWNLOAD: the whole album, photos and videos, in one zip.
  const downloadAlbumZip = async (g: any) => {
    if (albumZipBusy) return;
    setAlbumZipBusy(g.id);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      let i = 0;
      for (const m of (g.media || [])) {
        try {
          const res = await fetch(m.url, { mode: 'cors' });
          const blob = await res.blob();
          i += 1;
          const ext = m.type === 'video' ? 'mp4' : 'jpg';
          zip.file(`${albumFileBase(g)}-${String(i).padStart(3, '0')}.${ext}`, blob);
        } catch { /* one bad file does not sink the album */ }
      }
      if (!i) { if (showToast) showToast('Could not read the files to pack them. Try again.', 'error'); return; }
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${albumFileBase(g)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      if (showToast) showToast('Album download started.', 'success');
    } catch (err) {
      console.error('Album zip error:', err);
      if (showToast) showToast('Could not package the album. Try again.', 'error');
    } finally {
      setAlbumZipBusy(null);
    }
  };
  // Remove one photo or video from an album.
  const deleteAlbumMedia = async (g: any, item: any) => {
    try {
      if (g?.legacy && item.docId) {
        await deleteDoc(doc(db, scopedPath('albums'), item.docId));
      } else if (g?.docId) {
        const ref = doc(db, scopedPath('albums'), g.docId);
        const snap = await getDoc(ref);
        const old = snap.exists() ? (snap.data()?.media || []) : [];
        const next = old.filter((x: any) => x.url !== item.url);
        await setDoc(ref, { media: next, mediaCount: next.length }, { merge: true });
      }
      setAlbumViewer((gv: any) => (gv ? { ...gv, media: (gv.media || []).filter((x: any) => x.url !== item.url), count: Math.max(0, (gv.count || 0) - 1) } : gv));
      setAlbumMediaView((mv: any) => {
        if (!mv) return null;
        const next = mv.items.filter((x: any) => x.url !== item.url);
        return next.length ? { items: next, index: Math.min(mv.index, next.length - 1) } : null;
      });
      if (showToast) showToast('Removed from the album.', 'success');
    } catch (err) {
      console.error('Album media delete error:', err);
      if (showToast) showToast('Could not remove it. Try again.', 'error');
    }
  };

  const handleAdminSignOut = () => {
    try { localStorage.removeItem(lsKey('admin-ui')); } catch {}
    onSignOut();
    onClose();
  };
  const [newAdminEmail, setNewAdminEmail] = useState('');
  // All posts preview: the post being watched/viewed full-screen from the list.
  const [adminViewerPost, setAdminViewerPost] = useState<any>(null);
  // Label to attach to newly uploaded hero photos.
  const [newHeroLabel, setNewHeroLabel] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  // Branded confirmation for every delete action in the dashboard.
  const [confirmAsk, setConfirmAsk] = useState<{ title: string; message: string; confirmLabel?: string; action: () => void } | null>(null);
  const [inviteRole, setInviteRole] = useState('vendor');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [rulesBusy, setRulesBusy] = useState(false);

  // Re-applies the app's fixed Firestore security rules through the auth-admin
  // function (super admin only). Keeps guest-post approval enforced server-side.
  const publishSecurityRules = async () => {
    setRulesBusy(true);
    try {
      const currentUser = auth.currentUser;
      const token = currentUser ? await currentUser.getIdToken() : '';
      const res = await fetch('/api/auth-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'publishRules' })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) showToast('Security rules published.');
      else showToast('Could not publish the rules. Try again in a moment.', 'error');
    } catch (err) {
      showToast('Could not publish the rules. Check your connection.', 'error');
    } finally {
      setRulesBusy(false);
    }
  };
  const [inviteResult, setInviteResult] = useState<{ email: string; emailed: boolean; mailError: string } | null>(null);
  const [inviteName, setInviteName] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteStep, setInviteStep] = useState<'form' | 'done'>('form');
  const [invitePerms, setInvitePerms] = useState<Record<string, boolean>>({ canDeletePosts: false, canUploadImages: true, canSetAccessCode: false });
  const [inviteResendBusy, setInviteResendBusy] = useState<string | null>(null);

  const openInviteModal = () => {
    setInviteEmail('');
    setInviteName('');
    setInviteRole('vendor');
    setInvitePerms({ canDeletePosts: false, canUploadImages: true, canSetAccessCode: false });
    setInviteResult(null);
    setInviteStep('form');
    setShowInviteModal(true);
  };

  const applyInviteRole = (r: string) => {
    setInviteRole(r);
    setInvitePerms(['couple', 'bride', 'groom'].includes(r)
      ? { canDeletePosts: true, canUploadImages: true, canSetAccessCode: true }
      : { canDeletePosts: false, canUploadImages: true, canSetAccessCode: false });
  };

  // Team list with the signed-in admin always present, plus self markers.
  const teamList = useMemo(() => {
    const list = (allAdmins as any[]).map((a: any) => ({ ...a, isSelf: a.email === currentUserEmail }));
    if (currentUserEmail && !list.some((a: any) => a.isSelf)) {
      list.push({
        id: '__self__',
        email: currentUserEmail,
        role: (myAdminDoc as any)?.role || 'owner',
        mustSetPassword: false,
        permissions: (myAdminDoc as any)?.permissions || { canDeletePosts: true, canUploadImages: true, canSetAccessCode: true },
        isSelf: true
      });
    }
    return list;
  }, [allAdmins, currentUserEmail, myAdminDoc]);

  // Super Admin Ad Creation & Editing State
  const [adTypeTab, setAdTypeTab] = useState<'post' | 'reel'>('post');
  const [editingAdId, setEditingAdId] = useState<string | null>(null);
  const [adSponsor, setAdSponsor] = useState('');
  const [adHeadline, setAdHeadline] = useState('');
  const [adDescription, setAdDescription] = useState('');
  const [adCtaText, setAdCtaText] = useState('Learn More');
  const [adCtaUrl, setAdCtaUrl] = useState('');
  const [adMediaUrls, setAdMediaUrls] = useState<string[]>([]);
  const [adMediaTypes, setAdMediaTypes] = useState<('image' | 'video')[]>([]);
  const [isAdUploading, setIsAdUploading] = useState(false);

  const resetAdForm = (type: 'post' | 'reel' = adTypeTab) => {
    setEditingAdId(null);
    setAdSponsor('');
    setAdHeadline('');
    setAdDescription('');
    setAdCtaText('Learn More');
    setAdCtaUrl('');
    setAdMediaUrls([]);
    setAdMediaTypes(type === 'reel' ? ['video'] : []);
  };

  const daysToWedding = Math.max(0, Math.ceil((new Date(`${WEDDING_DATE}T11:00:00`).getTime() - Date.now()) / 86400000));

  const inviteDashboardAccess = async (perms: Record<string, boolean>) => {
    const email = inviteEmail.trim();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      showToast('Enter a valid email address.', 'error');
      return;
    }
    setInviteBusy(true);
    try {
      const currentUser = auth.currentUser;
      const token = currentUser ? await currentUser.getIdToken() : '';
      const res = await fetch('/api/auth-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'invite', email, name: inviteName.trim(), role: inviteRole, app: APP_ID, appUrl: window.location.origin + window.location.pathname + window.location.search.replace(/#.*$/, '') })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        const rolePerms: any = { ...perms };
        try {
          await setDoc(doc(db, scopedPath('admins'), email.toLowerCase().trim()), {
            email: email.toLowerCase().trim(),
            name: inviteName.trim() || null,
            role: inviteRole,
            mustSetPassword: true,
            permissions: rolePerms,
            status: 'invited',
            sessionMinutes: 30,
            addedAt: serverTimestamp(),
            addedBy: currentUserEmail
          }, { merge: true });
        } catch (permErr) {
          console.error('Admin doc write error:', permErr);
        }
        setInviteResult({ email, emailed: !!data.emailed, mailError: data.mailError || '' });
        setInviteStep('done');
        setInviteEmail('');
        setInviteName('');
        showToast(data.emailed ? 'Invite sent. The temporary password went to their email.' : 'Account created, but the invite email failed to send.', data.emailed ? 'success' : 'error');
      } else {
        showToast(data.error || 'Could not create the account. Try again.', 'error');
      }
    } catch (err) {
      console.error('Invite error:', err);
      showToast('Could not reach the invite service.', 'error');
    } finally {
      setInviteBusy(false);
    }
  };

  // Sync newCode with live value
  useEffect(() => {
    if (isOpen && !isDirty) {
      setNewCode(activeCode ?? '');
    }
  }, [activeCode, isOpen, isDirty]);

  // Reset dirty flag when closing/opening
  useEffect(() => {
    if (!isOpen) setIsDirty(false);
  }, [isOpen]);

  const isSuper = currentUserEmail === "justfashion414@gmail.com";
  // Bride and groom are owners with the same power, invites included; the
  // platform owner is always an owner too. Matches auth-admin's FULL_ROLES.
  const OWNER_ROLES = ['owner', 'couple', 'admin', 'bride', 'groom'];
  const ownerAdmin = isSuper || OWNER_ROLES.includes(String((myAdminDoc as any)?.role || 'owner'));

  const [modQueue, setModQueue] = useState<'pending' | 'reports' | 'vendors'>('pending');
  const [postEventFilter, setPostEventFilter] = useState<string>('all');

  const [evDraft, setEvDraft] = useState<WeddingEvent[]>(events);
  const [storyDraft, setStoryDraft] = useState<string>(story);
  const [detDraft, setDetDraft] = useState<any>(() => withDerivedHashtag({ ...(weddingDetails || {}), hiddenSections: weddingDetails?.hiddenSections || [] }));
  const [detColors, setDetColors] = useState<string[]>(() => {
    try { const v = JSON.parse(localStorage.getItem(lsKey('dress-colors')) || 'null'); if (Array.isArray(v)) return v; } catch { /* private mode */ }
    return (weddingDetails && weddingDetails.dressColors) || [];
  });
  useEffect(() => {
    const dc = weddingDetails && weddingDetails.dressColors;
    if (Array.isArray(dc)) setDetColors(dc);
  }, [weddingDetails]);
  // Aso-ebi colours are shared live: the events section and the invite form
  // both write this one field, so they never drift apart.
  const saveColorsLive = async (next: string[]) => {
    setDetColors(next);
    setDetDraft({ ...(detDraft || {}), dressColors: next });
    if (DEMO) { try { localStorage.setItem(lsKey('dress-colors'), JSON.stringify(next)); } catch { /* private mode */ } return; }
    try { await setDoc(doc(db, scopedPath('app_config'), 'main'), { weddingDetails: { dressColors: next } }, { merge: true }); } catch { /* the next full save carries it */ }
  };
  const [weddingBusy, setWeddingBusy] = useState(false);
  useEffect(() => { setEvDraft(events); }, [events]);
  useEffect(() => { setStoryDraft(story); }, [story]);
  useEffect(() => { setDetDraft(withDerivedHashtag(weddingDetails)); }, [weddingDetails]);

  const inputCls = `w-full p-3.5 rounded-xl border-none outline-none font-bold text-sm ${isDarkMode ? 'bg-[#0B171C] text-white' : 'bg-[#EEEDF3] text-[#14262D]'}`;
  // One page, one save (Nov 20 2026 direction): every edit on Events & photos
  // stays a draft. The preview mockup draws the drafts live, and only the
  // Save bar at the bottom writes anything to the app.
  const [heroImgDraft, setHeroImgDraft] = useState<string[]>(heroImages);
  const heroSyncKeyRef = useRef<string>('');
  // If the hero photos card opens with an empty draft while Firestore already
  // holds images, show them (and keep Clear All working while editing).
  useEffect(() => {
    const key = heroImages.join('|');
    if (key && key !== heroSyncKeyRef.current) {
      heroSyncKeyRef.current = key;
      setHeroImgDraft((prev: string[]) => (prev.length ? prev : heroImages as string[]));
    }
  }, [heroImages.join('|')]);
  const [heroLabelDraft, setHeroLabelDraft] = useState<Record<string, string>>(() => ({ ...(heroImageLabels || {}) }));
  const [heroTplDraft, setHeroTplDraft] = useState<'classic' | 'halo' | 'hero' | 'book'>(heroTpl);
  const [footerStyleDraft, setFooterStyleDraft] = useState<'wall' | 'marquee' | 'tunnel' | 'globe'>(footerStyle);
  const [footerThanksDraft, setFooterThanksDraft] = useState<string>(footerThanks || '');
  // Gifts & support draft (Events & photos): initializes straight from the
  // saved details, so the page's single Save bar owns it from the first render.
  const [giftDraft, setGiftDraft] = useState<any>(() => {
    const gi = (weddingDetails || ({} as any)).giftInfo || {};
    const seed = DEMO && !gi.accountNumber && !gi.accountName ? ((DEMO_DETAILS as any).giftInfo || {}) : ({} as any);
    return {
      enabled: gi.enabled !== false,
      bank: gi.bank || seed.bank || '',
      accountNumber: gi.accountNumber || seed.accountNumber || '',
      accountName: gi.accountName || seed.accountName || '',
      note: gi.note || seed.note || 'Your presence means everything. If you would also love to gift us, it is deeply appreciated.'
    };
  });
  // Footer (Events & photos): the words at the very bottom of the home page,
  // after the photo wall. Empty fields keep the app's default wording.
  const [footerDraft, setFooterDraft] = useState<any>(() => {
    const fi = (weddingDetails || ({} as any)).footer || {};
    return { message: fi.message || '', caption: fi.caption || '' };
  });
  const draftBaseRef = useRef<any>(null);
  if (!draftBaseRef.current) {
    draftBaseRef.current = {
      story,
      det: JSON.stringify(withDerivedHashtag(weddingDetails)),
      ev: JSON.stringify(events),
      hero: JSON.stringify(heroImages),
      heroLabels: JSON.stringify(heroImageLabels || {}),
      gift: JSON.stringify(giftDraft || {}),
      footer: JSON.stringify(footerDraft || {}),
      heroTpl,
      footerStyle,
      footerThanks
    };
  }
  // The photos the hero shows right now: the draft list when one exists,
  // otherwise the built-in placeholder photos the site falls back to.
  // Editing from the admin grid always writes the full draft list, so removing
  // a placeholder or adding a photo takes the hero over from the placeholders.
  const heroShown: string[] = heroImgDraft.length ? heroImgDraft : PLACEHOLDER_IMAGES;
  const pageDirty = storyDraft !== draftBaseRef.current.story
    || JSON.stringify(detDraft) !== draftBaseRef.current.det
    || JSON.stringify(evDraft) !== draftBaseRef.current.ev
    || JSON.stringify(heroImgDraft) !== draftBaseRef.current.hero
    || JSON.stringify(heroLabelDraft) !== draftBaseRef.current.heroLabels
    || heroTplDraft !== draftBaseRef.current.heroTpl
    || footerStyleDraft !== draftBaseRef.current.footerStyle
    || (footerThanksDraft || '') !== draftBaseRef.current.footerThanks
    || JSON.stringify(giftDraft || {}) !== draftBaseRef.current.gift
    || JSON.stringify(footerDraft || {}) !== draftBaseRef.current.footer;

  // One Save for the whole page: story, wedding day details, the journey, hero
  // photos and labels, hero style and the giant footer style commit together.
  // Until it is tapped nothing reaches the app; the preview mockup shows the
  // drafts meanwhile. quiet=true keeps the style setters from double-toasting.
  // Demo placeholder posts never count as content: they vanish the moment a
  // real post lands, so every admin number treats them as nothing.
  const realPosts = posts.filter((p: any) => !String(p.id).startsWith('demo-seed-') && !String(p.id).startsWith('sample-'));
  const saveEverything = async () => {
    setWeddingBusy(true);
    try {
      const mergedDet = {
        ...(detDraft || {}),
        giftInfo: {
          enabled: true,
          bank: (giftDraft.bank || '').trim(),
          accountNumber: (giftDraft.accountNumber || '').trim(),
          accountName: (giftDraft.accountName || '').trim(),
          note: (giftDraft.note || '').trim()
        },
        footer: {
          message: (footerDraft.message || '').trim(),
          caption: (footerDraft.caption || '').trim()
        }
      };
      setDetDraft(mergedDet);
      await onSaveWeddingSection({ story: storyDraft, weddingDetails: mergedDet, events: evDraft });
      onUpdateHeroImages(heroImgDraft.slice(0, 20));
      onUpdateHeroLabels(heroLabelDraft || {});
      if (onUpdateHeroTemplate) await onUpdateHeroTemplate(heroTplDraft, true);
      if (onUpdateFooterStyle) await onUpdateFooterStyle(footerStyleDraft, true, (footerThanksDraft || '').trim());
      draftBaseRef.current = {
        story: storyDraft,
        det: JSON.stringify(mergedDet),
        ev: JSON.stringify(evDraft),
        hero: JSON.stringify(heroImgDraft.slice(0, 20)),
        heroLabels: JSON.stringify(heroLabelDraft || {}),
        heroTpl: heroTplDraft,
        footerStyle: footerStyleDraft,
        footerThanks: (footerThanksDraft || '').trim(),
        gift: JSON.stringify(giftDraft || {}),
        footer: JSON.stringify(footerDraft || {})
      };
      showToast('Saved. Your app now shows these changes.', 'success');
    } finally { setWeddingBusy(false); }
  };
  // Section eye toggles (Events & photos): 'story', 'details' and 'gifts' keys
  // hide whole home sections; single events carry their own hidden flag.
  const toggleSectionHidden = (key: string) => {
    const cur: string[] = detDraft?.hiddenSections || [];
    const next = cur.includes(key) ? cur.filter((k: string) => k !== key) : [...cur, key];
    setDetDraft({ ...(detDraft || {}), hiddenSections: next });
  };
  // Gifts & support (Events & photos tab): the couple's account details for
  // guests who want to send money. Lives on weddingDetails.giftInfo; the eye
  // button (hiddenSections 'gifts') decides who sees it, not a toggle. There
  // is no separate save: the fields ride the page's single Save changes bar.
  // QR code (Settings): the couple's app link as a scannable code. Guests scan
  // it from a printed banner and land straight in the app. Only the couple
  // sees it here; they download it as an image or PDF for their banner designer.
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrUrl, setQrUrl] = useState<string>('');
  // Click feedback: each QR button flips to a busy label while it works and a
  // short Saved/Copied state when it finishes, so a tap is never silent.
  const [qrBusy, setQrBusy] = useState<'' | 'png' | 'pdf'>('');
  const [qrDone, setQrDone] = useState<'' | 'png' | 'pdf' | 'copied'>('');
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    p.delete('nochrome');
    p.delete('home');
    const url = window.location.origin + window.location.pathname + (p.toString() ? `?${p.toString()}` : '');
    setQrUrl(url);
    let dead = false;
    (async () => {
      try {
        const mod: any = await import('qrcode-generator');
        const make = mod.default || mod;
        const qr = make(0, 'M');
        qr.addData(url);
        qr.make();
        const n = qr.getModuleCount();
        const scale = 8;
        const margin = 4;
        const dim = (n + margin * 2) * scale;
        const cv = document.createElement('canvas');
        cv.width = dim;
        cv.height = dim;
        const ctx = cv.getContext('2d');
        if (!ctx) throw new Error('no canvas');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, dim, dim);
        ctx.fillStyle = '#14122b';
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
        const d = cv.toDataURL('image/png');
        if (!dead) setQrDataUrl(d);
      } catch { /* keep the placeholder if the QR chunk fails */ }
    })();
    return () => { dead = true; };
  }, []);
  const downloadQrPng = () => {
    if (qrBusy) return;
    if (!qrDataUrl) { showToast('Still preparing the QR code. Try again in a moment.', 'info'); return; }
    setQrBusy('png');
    window.setTimeout(() => {
      try {
        const a = document.createElement('a');
        a.href = qrDataUrl;
        a.download = `eventicor-qr-${(activeCode || 'app').toLowerCase()}.png`;
        a.click();
        showToast('QR image saved to your device.', 'success');
        setQrDone('png');
        window.setTimeout(() => setQrDone((cur) => (cur === 'png' ? '' : cur)), 1800);
      } catch {}
      setQrBusy('');
    }, 450);
  };
  const downloadQrPdf = async () => {
    if (qrBusy) return;
    if (!qrDataUrl) { showToast('Still preparing the QR code. Try again in a moment.', 'info'); return; }
    setQrBusy('pdf');
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const W = 297;
      const size = 92;
      const x = (W - size) / 2;
      const y = 50;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(26);
      pdf.setTextColor(20, 18, 43);
      pdf.text('Scan to open our wedding memories', W / 2, 26, { align: 'center' });
      pdf.addImage(qrDataUrl, 'PNG', x, y, size, size);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(90, 105, 112);
      pdf.text(qrUrl, W / 2, y + size + 13, { align: 'center' });
      pdf.save(`eventicor-qr-${(activeCode || 'app').toLowerCase()}.pdf`);
      showToast('QR PDF saved to your device.', 'success');
      setQrDone('pdf');
      window.setTimeout(() => setQrDone((cur) => (cur === 'pdf' ? '' : cur)), 1800);
    } catch {} finally { setQrBusy(''); }
  };
  // Eventicor admin contact + payment account details (super admin only).
  const [contactDraft, setContactDraft] = useState<any>(null);
  useEffect(() => {
    if (contactSettings && !contactDraft) setContactDraft({
      adminWhatsapp: contactSettings.adminWhatsapp || '',
      payBankName: contactSettings.payBankName || '',
      payAccountNumber: contactSettings.payAccountNumber || '',
      payAccountName: contactSettings.payAccountName || ''
    });
  }, [contactSettings]);
  const saveContactSettings = async () => {
    if (!contactDraft) return;
    await onSaveWeddingSection({
      adminWhatsapp: (contactDraft.adminWhatsapp || '').trim(),
      payBankName: (contactDraft.payBankName || '').trim(),
      payAccountNumber: (contactDraft.payAccountNumber || '').trim(),
      payAccountName: (contactDraft.payAccountName || '').trim()
    });
  };
  // Journey step photos (dashboard): up to 2 images per event step, uploaded
  // two at a time, kept as a draft until Save changes.
  const [evUpBusy, setEvUpBusy] = useState<string | null>(null);
  const uploadEventStepPhotos = async (eid: string, files: File[]) => {
    const ev = evDraft.find((x) => x.id === eid) as any;
    const existing: string[] = ev?.images || [];
    const room = 2 - existing.length;
    if (room <= 0) { showToast('Each step holds 2 photos. Remove one first.', 'info'); return; }
    const use = files.slice(0, room);
    if (files.length > room) showToast(`Only ${room} slot${room === 1 ? '' : 's'} left on this step.`, 'info');
    if (!use.length) return;
    setEvUpBusy(eid);
    try {
      const urls: string[] = [];
      for (const f of use) urls.push(DEMO ? await demoImageDataUrl(f) : await uploadToCloudinary(f as any, 'programme'));
      const next = evDraft.map((x) => (x.id === eid ? { ...x, images: [...existing, ...urls].slice(0, 2) } : x)) as WeddingEvent[];
      // Draft only: step photos reach the app when Save changes is tapped.
      setEvDraft(next);
    } catch (err: any) {
      console.error('Event step photo upload error:', err);
      showToast(err?.message || 'Photo upload failed.', 'error');
    } finally {
      setEvUpBusy(null);
    }
  };
  const removeEventStepPhoto = (eid: string, idx: number) => {
    const next = evDraft.map((x) => (x.id === eid ? { ...x, images: (((x as any).images || []) as string[]).filter((_: string, i: number) => i !== idx) } : x)) as WeddingEvent[];
    setEvDraft(next);
  };
  const previewSite = () => {
    // Preview is only a look, never a save: it opens the in-dashboard popup
    // right away without writing anything.
    setSitePreviewOpen(true);
  };

  // The mockup is drawn right here from the dashboard's current state: no
  // iframe, no routing, nothing loads, the same idea as the landing page's
  // template preview. The countdown day follows the app's own rule: the
  // couple's chosen date, then the church, the reception, the latest event.
  const previewWedDate = () => {
    const church = evDraft.find((e: any) => e.id === 'church');
    const reception = evDraft.find((e: any) => e.id === 'reception');
    const latest = evDraft.map((e: any) => e.date).filter(Boolean).sort().pop() as string | undefined;
    return ((leadOverride()?.weddingDate) || church?.date || reception?.date || latest || WEDDING_DATE) as string;
  };

  const saveWedding = async () => {
    setWeddingBusy(true);
    try {
      await onSaveWedding(evDraft, storyDraft, detDraft);
    } finally {
      setWeddingBusy(false);
    }
  };

  const [dangerText, setDangerText] = useState('');
  const [deleteAllBusy, setDeleteAllBusy] = useState(false);
  const [postTypeFilter, setPostTypeFilter] = useState<string>('all');
  // Recycle bin: confirm before restoring or permanently removing a post.
  const [binConfirm, setBinConfirm] = useState<{ id: string; action: 'restore' | 'remove' } | null>(null);
  const [sitePreviewOpen, setSitePreviewOpen] = useState(false);
  // Photo albums: media uploaded by photographers and vendors.
  const [albums, setAlbums] = useState<any[]>([]);
  const [albumBusy, setAlbumBusy] = useState(false);
  // Album view: new uploads save one document per album (a media array);
  // older flat uploads (one document per photo) group into pseudo-albums by
  // uploader and day so nothing the vendors already sent disappears.
  const albumGroups = useMemo(() => {
    const tsOf = (a: any) => (a.uploadedAt?.toMillis?.() ?? 0);
    const groups: any[] = [];
    const legacy = new Map<string, any>();
    (albums as any[]).slice().sort((a, b) => tsOf(b) - tsOf(a)).forEach((a: any) => {
      if (Array.isArray(a.media) && a.media.length) {
        groups.push({ id: a.id, docId: a.id, title: a.title || '', kind: a.mediaType === 'video' ? 'video' : 'photo', media: a.media, uploaderName: a.uploaderName, uploaderEmail: a.uploaderEmail, uploadedAt: a.uploadedAt, count: a.media.length });
      } else if (a.mediaUrl) {
        const day = a.uploadedAt?.toDate ? new Intl.DateTimeFormat('en-CA').format(a.uploadedAt.toDate()) : 'unknown';
        const kind = a.mediaType === 'video' ? 'video' : 'photo';
        const key = `${a.uploaderEmail || 'admin'}|${day}|${kind}`;
        let g = legacy.get(key);
        if (!g) {
          g = { id: 'legacy-' + key, docIds: [] as string[], title: '', kind, media: [] as any[], uploaderName: a.uploaderName, uploaderEmail: a.uploaderEmail, uploadedAt: a.uploadedAt, legacy: true, count: 0 };
          legacy.set(key, g);
          groups.push(g);
        }
        g.media.push({ url: a.mediaUrl, type: kind === 'video' ? 'video' : 'image' });
        g.docIds.push(a.id);
        g.count = g.media.length;
      }
    });
    return groups;
  }, [albums]);
  const nowHour = new Date().getHours();
  const greeting = nowHour < 12 ? 'Good morning' : nowHour < 17 ? 'Good afternoon' : 'Good evening';
  const pendCount = posts.filter((p: any) => p.pending).length;
  const reportCount = posts.filter((p: any) => ((p as any).reports || 0) > 0).length;
  const modTotal = pendCount + reportCount + vendorRequests.length;
  const relTime = (d: Date | null) => {
    if (!d) return 'just now';
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const dd = Math.floor(h / 24); if (dd < 7) return `${dd}d ago`;
    const w = Math.floor(dd / 7); if (w < 5) return `${w}w ago`;
    const mo = Math.floor(dd / 30); if (mo < 12) return `${mo} month${mo === 1 ? '' : 's'} ago`;
    return `${Math.floor(dd / 365)}y ago`;
  };
  const postTypeOf = (p: any): 'Photo' | 'Video' | 'Reel' | 'Wish' => {
    const isVid = (p.mediaTypes || []).some((t: string) => t === 'video') || (p.mediaUrls || []).some((u: string) => /\.(mp4|webm|mov)(\?|$)/i.test(u));
    if (isVid) return ((p.videoOrientation || (videoOrientations as any)[p.id]) === 'portrait' ? 'Reel' : 'Video');
    const hasImg = (p.mediaTypes || []).some((t: string) => t === 'image') || (p.mediaUrls || []).some((u: string) => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(u));
    return hasImg ? 'Photo' : 'Wish';
  };
  const handleDismissReport = async (id: string) => {
    try {
      await updateDoc(doc(db, scopedPath('posts'), id), { reports: 0 });
      showToast('Report dismissed', 'success');
    } catch (err) {
      console.error('Dismiss error:', err);
      showToast('Could not dismiss the report.', 'error');
    }
  };

  const normalizedNewCode = normalizeCode(newCode);
  const normalizedActiveCode = normalizeCode(activeCode ?? '');
  const isCodeValid = normalizedNewCode.length >= 4;
  const isCodeChanged = normalizedNewCode !== normalizedActiveCode;
  const canSaveCode = isCodeValid && isCodeChanged;

  // Saves a post's media file straight to the admin's device from the All posts
  // list (the Download button on each row).
  const adminDownloadMedia = async (p: any) => {
    const urls = Array.isArray(p.mediaUrls) ? p.mediaUrls : (p.mediaUrl ? [p.mediaUrl] : []);
    if (!urls.length) { if (showToast) showToast('There is no photo or video on this post.', 'error'); return; }
    try {
      const res = await fetch(urls[0]);
      if (!res.ok) throw new Error('fetch failed');
      const blob = await res.blob();
      const u = urls[0];
      const isVideo = p.mediaTypes?.[0] === 'video' || u.toLowerCase().includes('.mp4') || u.toLowerCase().includes('.webm') || u.toLowerCase().includes('.mov') || u.includes('/video/');
      const ext = isVideo ? 'mp4' : (u.split('?')[0].split('.').pop() || 'jpg').slice(0, 5);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `dara-femi-${String(p.authorName || 'memory').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      if (showToast) showToast('Saved to your device.', 'success');
    } catch (err) {
      console.error('Admin media download failed:', err);
      if (showToast) showToast('Could not download the file. Please try again.', 'error');
    }
  };

  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim() || !newAdminEmail.includes('@')) return;
    try {
      await setDoc(doc(db, scopedPath('admins'), newAdminEmail.toLowerCase().trim()), {
        email: newAdminEmail.toLowerCase().trim(),
        permissions: {
          canDeletePosts: true,
          canUploadImages: true,
          canSetAccessCode: true
        },
        addedAt: serverTimestamp(),
        addedBy: currentUserEmail
      });
      setNewAdminEmail('');
      showToast(`${newAdminEmail.toLowerCase().trim()} added to administrators.`, 'success');
    } catch (err) {
      console.error("Add admin error:", err);
      showToast('Could not add that administrator.', 'error');
    }
  };

  // Team actions run through the auth-admin function so the invited person's
  // login account is created, suspended or deleted alongside their record here.
  const authAdminCall = async (action: string, extra: Record<string, any> = {}) => {
    const cu = auth.currentUser;
    const token = cu ? await cu.getIdToken() : '';
    const res = await fetch('/api/auth-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, app: APP_ID, ...extra })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || 'That did not go through. Try again.');
    return data;
  };
  const handleSuspendAdmin = async (email: string, suspend: boolean) => {
    try {
      await authAdminCall(suspend ? 'suspend' : 'reinstate', { email });
      showToast(suspend ? `${email} can no longer sign in.` : `${email} can sign in again.`);
    } catch (err: any) {
      console.error('Suspend admin error:', err);
      showToast(err?.message || 'Could not update that administrator.', 'error');
    }
  };
  const handleRemoveAdmin = (email: string) => {
    setConfirmAsk({
      title: 'Remove administrator?',
      message: `${email} loses access immediately. This cannot be undone.`,
      confirmLabel: 'Remove',
      action: async () => {
        try {
          await authAdminCall('remove', { email });
          showToast(`${email} removed from administrators.`);
        } catch (err) {
          console.error("Remove admin error:", err);
          showToast('Could not remove that administrator.', 'error');
        }
      }
    });
  };

  const handleResendInvite = async (email: string) => {
    setInviteResendBusy(email);
    try {
      const cu = auth.currentUser;
      const token = cu ? await cu.getIdToken() : '';
      const res = await fetch('/api/auth-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'resend', email, app: APP_ID, appUrl: window.location.origin + window.location.pathname + window.location.search.replace(/#.*$/, '') })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        showToast(data.emailed ? `Invite resent to ${email}. The new temporary password went to their email.` : `The invite email failed to send${data.mailError ? ` (${data.mailError})` : ''}. Try again or share the password another way.`, data.emailed ? 'success' : 'error');
      } else {
        showToast(data.error || 'Could not resend the invite. Try again.', 'error');
      }
    } catch (err: any) {
      console.error('Resend invite error:', err);
      showToast('Could not resend the invite.', 'error');
    } finally {
      setInviteResendBusy(null);
    }
  };

  const togglePermission = async (email: string, perm: string, currentVal: boolean) => {
    try {
      const adminRef = doc(db, scopedPath('admins'), email);
      await setDoc(adminRef, {
        permissions: {
          [perm]: !currentVal
        }
      }, { merge: true });
      showToast('Permissions updated.');
    } catch (err) {
      console.error("Toggle permission error:", err);
      showToast('Could not update the permission.', 'error');
    }
  };

  // --- Security: change password and session length ---
  const [pwForm, setPwForm] = useState({ cur: '', next: '', confirm: '' });
  const [pwShow, setPwShow] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [sessionChoice, setSessionChoice] = useState<number>(30);
  const [sessionDraft, setSessionDraft] = useState<number>(30);
  const [sessionBusy, setSessionBusy] = useState(false);
  useEffect(() => {
    const mins = Number(myAdminDoc?.sessionMinutes);
    if (mins >= 5) {
      const v = Math.min(mins, 10080);
      setSessionChoice(v);
      setSessionDraft(v);
    }
  }, [myAdminDoc?.sessionMinutes]);
  const sessionLabel = (m: number) => m < 60 ? `${m} minutes` : m < 1440 ? (m === 60 ? '1 hour' : `${m / 60} hours`) : m < 10080 ? (m === 1440 ? '1 day' : `${m / 1440} days`) : '1 week';
  const handleChangePassword = async () => {
    if (!pwForm.cur || !pwForm.next || !pwForm.confirm) { showToast('Fill in all three password fields.', 'error'); return; }
    if (pwForm.next !== pwForm.confirm) { showToast('The new passwords do not match.', 'error'); return; }
    if (pwForm.next.length < 8) { showToast('Use at least 8 characters for the new password.', 'error'); return; }
    setPwBusy(true);
    try {
      const cu = auth.currentUser as any;
      if (!cu?.email) throw new Error('Sign in again to change your password.');
      await reauthenticateWithCredential(cu, EmailAuthProvider.credential(cu.email, pwForm.cur));
      await updatePassword(cu, pwForm.next);
      setPwForm({ cur: '', next: '', confirm: '' });
      showToast('Password updated.');
    } catch (err: any) {
      const code = err?.code || '';
      const msg = code === 'auth/wrong-password' || code === 'auth/invalid-credential' ? 'The current password is not correct.'
        : code === 'auth/weak-password' ? 'That password is too weak.'
        : code === 'auth/too-many-requests' ? 'Too many attempts. Try again shortly.'
        : (err?.message || 'Could not update the password.');
      showToast(msg, 'error');
    } finally { setPwBusy(false); }
  };
  const handleUpdateSession = async (mins: number) => {
    setSessionBusy(true);
    try {
      await setDoc(doc(db, scopedPath('admins'), currentUserEmail || ''), { sessionMinutes: mins }, { merge: true });
      setSessionChoice(mins);
      setSessionDraft(mins);
      showToast(`Auto sign-out set: ${sessionLabel(mins)}. The server enforces it too.`);
    } catch (err) {
      console.error('Session update error:', err);
      showToast('Could not save the session length.', 'error');
    } finally {
      setSessionBusy(false);
    }
  };
  const roleLabel = (r?: string) => r === 'owner' ? 'Super Admin' : (!r || r === 'couple' || r === 'admin') ? 'Owner' : r === 'bride' ? 'Bride' : r === 'groom' ? 'Groom' : r === 'photographer' ? 'Photographer' : r === 'videographer' ? 'Videographer' : 'Vendor';
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {!asPage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-[110] backdrop-blur-sm"
          />
          )}
          <motion.div 
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className={`fixed inset-0 z-[111] p-0 shadow-2xl overflow-hidden flex flex-col ${isDarkMode ? 'bg-[#13232A]' : 'bg-white'}`}
          >
            {/* Couple dashboard shell */}
            <div className="relative flex flex-1 min-h-0 w-full flex-col md:flex-row">
              {/* Mobile top bar with sidebar toggle */}
              <div className="md:hidden relative flex items-center gap-2 px-4 py-3 bg-[#0B171C] shrink-0">
                <button onClick={() => setMobileAdminNavOpen(true)} className="p-2 rounded-xl bg-white/10 text-white active:bg-white/20" aria-label="Open menu">
                  <Menu className="w-5 h-5" />
                </button>
                <p className="font-display text-white text-base font-medium">{demoHeader()}</p>
                <div className="relative ml-auto">
                  <button onClick={() => setProfileMenuOpen((v) => !v)} className="w-8 h-8 rounded-full bg-[var(--ann-accent)] text-white grid place-items-center font-black text-[0.8rem]" aria-label="Profile">{(currentUserEmail || 'A').charAt(0).toUpperCase()}</button>
                  {profileMenuOpen && (
                    <div className={`absolute right-0 top-10 w-56 rounded-2xl border p-2 shadow-2xl z-[130] ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                      <p className="px-3 py-2 text-[0.72rem] opacity-60 break-all">{currentUserEmail}</p>
                      <button onClick={handleAdminSignOut} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[0.85rem] font-bold text-left text-[#C4453B] hover:bg-[#C4453B]/10">
                        <LogOut className="w-4 h-4" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  )}
                </div>
                <button onClick={onClose} className="shrink-0 p-2 rounded-full bg-white/10 text-white" aria-label="Close dashboard"><X className="w-4 h-4" /></button>

              </div>

                {/* Slide-in sidebar (mobile) */}
                {mobileAdminNavOpen && (
                  <div className="absolute inset-0 z-[120] flex" onClick={() => setMobileAdminNavOpen(false)}>
                    <div className="absolute inset-0 bg-black/50" />
                    <div
                      className="relative w-[264px] max-w-[80vw] h-full bg-[#0B171C] text-white p-5 overflow-y-auto shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="mb-6">
                        <p className="font-display text-[1.25rem] font-medium">{demoHeader()}</p>
                        <p className="text-[0.66rem] uppercase tracking-widest text-white/40 font-black mt-0.5">Couple dashboard</p>
                      </div>
                      <nav className="flex flex-col gap-1">
                        {[
                          { id: 'overview', label: 'Overview', icon: Home },
                          { id: 'moderation', label: 'Moderation', icon: ShieldCheck, badge: modTotal },
                          { id: 'posts', label: 'All posts', icon: Film },
                          { id: 'events', label: 'Events & photos', icon: Calendar },
                          { id: 'invite', label: 'Inbox invite', icon: Mail },
                          { id: 'albums', label: 'Vendor albums', icon: Images },
                          { id: 'settings', label: 'Settings', icon: Settings },
                                                                        { id: 'security', label: 'Security', icon: Lock },
                        ].filter((t: any) => !restrictedRole || t.id === 'albums').map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => { setActiveAdminTab(tab.id); setMobileAdminNavOpen(false); }}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[0.9rem] font-bold text-left transition-all ${activeAdminTab === tab.id ? 'bg-[var(--ann-accent)] text-white shadow-lg' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
                          >
                            <tab.icon className="w-[18px] h-[18px] shrink-0" />
                            <span>{tab.label}</span>
                      {(tab as any).badge ? (<span className="ml-auto px-2 py-0.5 rounded-full bg-[#C8932A] text-white text-[0.6rem] font-black">{(tab as any).badge}</span>) : null}
                          </button>
                        ))}
                      </nav>
                      <p className="mt-5 mb-1 px-3 text-[0.62rem] uppercase tracking-widest text-white/30 font-black">More</p>
                      <nav className="flex flex-col gap-1">
                        {[
                          { id: 'ads', label: 'Ads', icon: Megaphone, show: isSuper && !restrictedRole },
                          
                          { id: 'recycle', label: 'Bin', icon: Trash, show: !restrictedRole && (adminPermissions ? adminPermissions.canDeletePosts : true) },
                        ].filter((t) => t.show).map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => { setActiveAdminTab(tab.id); setMobileAdminNavOpen(false); }}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[0.9rem] font-bold text-left transition-all ${activeAdminTab === tab.id ? 'bg-[var(--ann-accent)] text-white shadow-lg' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
                          >
                            <tab.icon className="w-[18px] h-[18px] shrink-0" />
                            <span>{tab.label}</span>
                      {(tab as any).badge ? (<span className="ml-auto px-2 py-0.5 rounded-full bg-[#C8932A] text-white text-[0.6rem] font-black">{(tab as any).badge}</span>) : null}
                          </button>
                        ))}
                      </nav>
                      <button onClick={onClose} className="mt-6 pt-4 flex items-center gap-3 px-3 py-2.5 rounded-xl text-[0.9rem] font-bold text-white/60 hover:bg-white/10 hover:text-white text-left border-t border-white/10">
                        <Globe className="w-[18px] h-[18px] shrink-0" />
                        <span>View app</span>
                      </button>
                    </div>
                  </div>

                )}
              {/* Sidebar (desktop) */}
              <aside className="hidden md:flex flex-col w-[250px] shrink-0 bg-[#0B171C] text-white p-5 overflow-y-auto">
                <div className="mb-6 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-[1.25rem] font-medium">{demoHeader()}</p>
                    <p className="text-[0.66rem] uppercase tracking-widest text-white/40 font-black mt-0.5">Couple dashboard</p>
                  </div>
                  <div className="relative shrink-0">
                    <button onClick={() => setProfileMenuOpen((v) => !v)} className="w-9 h-9 rounded-full bg-[var(--ann-accent)] text-white grid place-items-center font-black" aria-label="Profile">{(currentUserEmail || 'A').charAt(0).toUpperCase()}</button>
                    {profileMenuOpen && (
                      <div className={`absolute right-0 top-11 w-56 rounded-2xl border p-2 shadow-2xl z-[130] ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                        <p className="px-3 py-2 text-[0.72rem] opacity-60 break-all">{currentUserEmail}</p>
                        <button onClick={handleAdminSignOut} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[0.85rem] font-bold text-left text-[#C4453B] hover:bg-[#C4453B]/10">
                          <LogOut className="w-4 h-4" />
                          <span>Sign out</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <nav className="flex flex-col gap-1">
                  {[
                    { id: 'overview', label: 'Overview', icon: Home },
                    { id: 'moderation', label: 'Moderation', icon: ShieldCheck, badge: modTotal },
                    { id: 'posts', label: 'All posts', icon: Film },
                    { id: 'events', label: 'Events & photos', icon: Calendar },
                          { id: 'invite', label: 'Inbox invite', icon: Mail },
                    { id: 'albums', label: 'Vendor albums', icon: Images },
                    { id: 'settings', label: 'Settings', icon: Settings },
                    { id: 'security', label: 'Security', icon: Lock },
                  ].filter((t: any) => !restrictedRole || t.id === 'albums').map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveAdminTab(tab.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[0.9rem] font-bold text-left transition-all ${activeAdminTab === tab.id ? 'bg-[var(--ann-accent)] text-white shadow-lg' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
                    >
                      <tab.icon className="w-[18px] h-[18px] shrink-0" />
                      <span>{tab.label}</span>
                      {(tab as any).badge ? (<span className="ml-auto px-2 py-0.5 rounded-full bg-[#C8932A] text-white text-[0.6rem] font-black">{(tab as any).badge}</span>) : null}
                    </button>
                  ))}
                </nav>
                <p className="mt-5 mb-1 px-3 text-[0.62rem] uppercase tracking-widest text-white/30 font-black">More</p>
                <nav className="flex flex-col gap-1">
                  {[
                    { id: 'ads', label: 'Ads', icon: Megaphone, show: isSuper && !restrictedRole },
                    
                    { id: 'recycle', label: 'Bin', icon: Trash, show: !restrictedRole && (adminPermissions ? adminPermissions.canDeletePosts : true) },
                  ].filter((t) => t.show).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveAdminTab(tab.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[0.9rem] font-bold text-left transition-all ${activeAdminTab === tab.id ? 'bg-[var(--ann-accent)] text-white shadow-lg' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
                    >
                      <tab.icon className="w-[18px] h-[18px] shrink-0" />
                      <span>{tab.label}</span>
                      {(tab as any).badge ? (<span className="ml-auto px-2 py-0.5 rounded-full bg-[#C8932A] text-white text-[0.6rem] font-black">{(tab as any).badge}</span>) : null}
                    </button>
                  ))}
                </nav>
                <button onClick={onClose} className="mt-auto pt-4 flex items-center gap-3 px-3 py-2.5 rounded-xl text-[0.9rem] font-bold text-white/60 hover:bg-white/10 hover:text-white text-left">
                  <Globe className="w-[18px] h-[18px] shrink-0" />
                  <span>View app</span>
                </button>
              </aside>

              {/* Modal Body */}
              <div id="admin-dash-scroll" className="flex-1 overflow-y-auto overscroll-contain p-6 md:p-8 pt-6">
              <TabErrorBoundary label={activeAdminTab} isDarkMode={isDarkMode}>
              {activeAdminTab === 'overview' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-black font-display tracking-tight">{greeting}, {demoHeader()}</h2>
                    <p className="text-sm opacity-60 mt-0.5">{daysToWedding} days to the wedding. Here is what needs you.</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(() => {
                      const reelCount = realPosts.filter((p: any) => postTypeOf(p) === 'Reel').length;
                      const commentTotal = realPosts.reduce((s: number, p: any) => s + (p.commentCount || 0), 0);
                      const authors = new Set(realPosts.map((p: any) => (p.authorName || '').trim()).filter(Boolean));
                      const stats: [string, number][] = [
                        ['Posts', realPosts.length],
                        ['Reels', reelCount],
                        ['Comments', commentTotal],
                        ['Guests joined', authors.size],
                      ];
                      return stats.map(([label, value]) => (
                        <div key={label} className={`rounded-[20px] p-4 border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                          <b className="block text-2xl font-black font-display">{value}</b>
                          <span className="block text-[0.68rem] font-black uppercase tracking-widest opacity-60 mt-1">{label}</span>
                        </div>
                      ));
                    })()}
                  </div>
                  <div className={`rounded-[20px] p-5 border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                    <h3 className="font-black font-display text-lg mb-3">Needs your attention</h3>
                    <div className="space-y-3">
                      {([['pending', pendCount, 'post waiting for approval', 'posts waiting for approval'], ['reports', reportCount, 'reported item', 'reported items']] as [string, number, string, string][]).map(([q, n, one, many]) => (
                        <div key={q} className="flex items-center justify-between gap-3">
                          <div><b>{n}</b> {n === 1 ? one : many}</div>
                          <button onClick={() => { setActiveAdminTab('moderation'); setModQueue(q as 'pending' | 'reports' | 'vendors'); }} className={`px-4 py-2 rounded-full text-[0.7rem] font-black uppercase tracking-widest ${n ? 'bg-[var(--ann-accent)] text-white' : 'border border-[#DAD8E3] opacity-60'}`}>{n ? 'Review' : 'All clear'}</button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className={`rounded-[20px] p-5 border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                    <h3 className="font-black font-display text-lg mb-3">Posts in the last 14 days</h3>
                    <div className="flex items-end gap-1 h-28">
                      {(() => {
                        const buckets = new Array(14).fill(0);
                        const today = new Date(); today.setHours(0, 0, 0, 0);
                        realPosts.forEach((p: any) => {
                          const t = p.timestamp?.toDate ? p.timestamp.toDate() : (p.createdAt?.toDate ? p.createdAt.toDate() : null);
                          if (!t) return;
                          const d = new Date(t); d.setHours(0, 0, 0, 0);
                          const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
                          if (diff >= 0 && diff < 14) buckets[13 - diff]++;
                        });
                        const max = Math.max(1, ...buckets);
                        return buckets.map((v, i) => (
                          <div key={i} className="flex-1 bg-[var(--ann-accent)]/25 rounded-t-md" style={{ height: `${Math.max(4, (v / max) * 100)}%` }} title={`${v} ${v === 1 ? 'post' : 'posts'}`} />
                        ));
                      })()}
                    </div>
                    <small className="block mt-2 opacity-50">Activity picks up as the wedding gets closer.</small>
                  </div>
                  <div className={`rounded-[20px] p-5 border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                    <h3 className="font-black font-display text-lg mb-3">Latest activity</h3>
                    <div className="space-y-3">
                      {realPosts.slice(0, 5).map((p: any) => (
                        <div key={p.id} className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[var(--ann-accent)]/15 text-[var(--ann-accent)] flex items-center justify-center font-black shrink-0">{(p.authorName || 'G').charAt(0).toUpperCase()}</div>
                          <div className="min-w-0">
                            <p className="font-bold text-[0.92rem] truncate">{p.authorName || 'A guest'} shared a memory</p>
                            <small className="block opacity-50 truncate">{p.text || p.caption || ''}</small>
                          </div>
                        </div>
                      ))}
                      {realPosts.length === 0 && <p className="opacity-50 text-sm">No memories yet. Guest posts will show up here the moment they land.</p>}
                    </div>
                    {realPosts.length > 5 && (
                      <button type="button" onClick={() => setActivityOpen(true)} className="mt-3 px-5 py-2.5 rounded-full bg-[var(--ann-accent)] text-white text-[0.7rem] font-black uppercase tracking-widest">View more</button>
                    )}
                  </div>
                </div>
              )}

              {activeAdminTab === 'moderation' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-black font-display tracking-tight">Moderation</h2>
                    <p className="text-sm opacity-60 mt-0.5">Approve, reject and handle reports.</p>
                  </div>
                  <div className={`flex p-1 rounded-2xl border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-[#EEEDF3] border-[#DAD8E3]'}`}>
                    {([['pending', `Posts (${pendCount})`], ['reports', `Reports (${reportCount})`], ['vendors', `Vendor requests (${vendorRequests.length})`]] as [string, string][]).map(([q, label]) => (
                      <button key={q} onClick={() => setModQueue(q as 'pending' | 'reports' | 'vendors')} className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${modQueue === q ? 'bg-[var(--ann-accent)] text-white shadow-sm' : 'opacity-60 hover:opacity-100'}`}>{label}</button>
                    ))}
                  </div>
                  {modQueue === 'pending' && (
                    pendCount === 0 ? (
                      <div className={`rounded-[20px] p-5 border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                        <p className="opacity-50 text-sm">Nothing waiting. New guest posts will appear here when approval is on.</p>
                      </div>
                    ) : (
                      <div className={`rounded-[20px] border divide-y ${isDarkMode ? 'bg-[#0B171C] border-[#22363E] divide-[#22363E]' : 'bg-white border-[#DAD8E3] divide-[#DAD8E3]/70'}`}>
                        {posts.filter((p: any) => p.pending).map((p: any) => (
                          <div key={p.id} className="flex items-center gap-3 p-4">
                            <div className="w-11 h-11 rounded-2xl bg-[var(--ann-accent)]/15 text-[var(--ann-accent)] flex items-center justify-center font-black shrink-0">{(p.authorName || 'G').charAt(0).toUpperCase()}</div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-[0.92rem] truncate">{p.authorName || 'A guest'}</p>
                              <small className="block opacity-50 truncate">{p.text || p.caption || 'Shared a memory'}</small>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button onClick={async () => { try { await updateDoc(doc(db, scopedPath('posts'), p.id), { pending: false }); showToast(DEMO ? 'Approved. The couple\u2019s guests can now see it' : `Approved. ${demoHeader()}\u2019s guests can now see it`, 'success'); } catch (err) { console.error(err); showToast('Could not approve the post.', 'error'); } }} className="px-4 py-2 rounded-full bg-[var(--ann-accent)] text-white text-[0.7rem] font-black uppercase tracking-widest">Approve</button>
                              <button onClick={() => onDeletePost(p.id)} className="px-4 py-2 rounded-full border border-[#DAD8E3] text-[0.7rem] font-black uppercase tracking-widest">Reject</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                  {modQueue === 'reports' && (
                    reportCount === 0 ? (
                      <div className={`rounded-[20px] p-5 border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                        <p className="opacity-50 text-sm">No reports. Guests can report a problem from their Settings screen.</p>
                      </div>
                    ) : (
                      <div className={`rounded-[20px] border divide-y ${isDarkMode ? 'bg-[#0B171C] border-[#22363E] divide-[#22363E]' : 'bg-white border-[#DAD8E3] divide-[#DAD8E3]/70'}`}>
                        {posts.filter((p: any) => ((p as any).reports || 0) > 0).map((p: any) => (
                          <div key={p.id} className="flex items-center gap-3 p-4">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-[0.92rem] truncate">Reported by a guest</p>
                              <small className="block opacity-50 truncate">Post by {p.authorName || 'a guest'} · {p.text || p.caption || ''}</small>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button onClick={() => handleDismissReport(p.id)} className="px-4 py-2 rounded-full border border-[#DAD8E3] text-[0.7rem] font-black uppercase tracking-widest">Dismiss</button>
                              <button onClick={() => onDeletePost(p.id)} className="px-4 py-2 rounded-full border border-red-500/30 text-red-500 text-[0.7rem] font-black uppercase tracking-widest">Remove post</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                  {modQueue === 'vendors' && (
                    vendorRequests.length === 0 ? (
                      <div className={`rounded-[20px] p-5 border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                        <p className="opacity-50 text-sm">No pending vendor requests. A guest asks by turning on &ldquo;I&rsquo;m an official vendor&rdquo; in their Settings.</p>
                      </div>
                    ) : (
                      <div className={`rounded-[20px] border divide-y ${isDarkMode ? 'bg-[#0B171C] border-[#22363E] divide-[#22363E]' : 'bg-white border-[#DAD8E3] divide-[#DAD8E3]/70'}`}>
                        {vendorRequests.map((v: any) => (
                          <div key={v.uid} className="flex items-center gap-3 p-4">
                            <div className="w-11 h-11 rounded-2xl bg-[#C8932A]/15 text-[#C8932A] flex items-center justify-center font-black shrink-0">{(v.displayName || 'V').charAt(0).toUpperCase()}</div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-[0.92rem] truncate">{v.displayName || 'A guest'}</p>
                              <small className="block opacity-50 truncate">{v.vendorRequest?.why || 'Wants to post as an official vendor'}</small>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button onClick={() => onVendorAction(v.uid, v.displayName || 'A guest', true)} className="px-4 py-2 rounded-full bg-[var(--ann-accent)] text-white text-[0.7rem] font-black uppercase tracking-widest">Approve as vendor</button>
                              <button onClick={() => onVendorAction(v.uid, v.displayName || 'A guest', false)} className="px-4 py-2 rounded-full border border-[#DAD8E3] text-[0.7rem] font-black uppercase tracking-widest">Decline</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
              )}

              {activeAdminTab === 'posts' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-black font-display tracking-tight">All posts</h2>
                    <p className="text-sm opacity-60 mt-0.5">{realPosts.length} {realPosts.length === 1 ? 'memory' : 'memories'} shared by your people.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <BrandedSelect value={postEventFilter} onChange={(v: string) => setPostEventFilter(v)} ariaLabel="Filter by event" isDarkMode={isDarkMode} options={[{ value: 'all', label: 'All events' }, ...(events || []).map((e: any) => ({ value: e.id, label: e.name }))]} />
                    <BrandedSelect value={postTypeFilter} onChange={(v: string) => setPostTypeFilter(v)} ariaLabel="Filter by type" isDarkMode={isDarkMode} options={['all', 'Photo', 'Video', 'Reel', 'Wish'].map((t: string) => ({ value: t, label: t === 'all' ? 'All types' : t }))} />
                  </div>
                  <div className={`rounded-[20px] border divide-y ${isDarkMode ? 'bg-[#0B171C] border-[#22363E] divide-[#22363E]' : 'bg-white border-[#DAD8E3] divide-[#DAD8E3]/70'}`}>
                    {(() => {
                      const filtered = realPosts.filter((p: any) => (postEventFilter === 'all' || p.eventId === postEventFilter) && (postTypeFilter === 'all' || postTypeOf(p) === postTypeFilter));
                      if (filtered.length === 0) return <p className="p-5 opacity-50 text-sm">No posts match. Memories your guests share will show up here.</p>;
                      // How many posts each person has made, shown next to their
                      // name on every row so the couple sees a guest's history.
                      const postCountByKey: Record<string, number> = {};
                      realPosts.forEach((q: any) => {
                        const k = q.authorUid || `name:${(q.authorName || '').trim().toLowerCase()}`;
                        postCountByKey[k] = (postCountByKey[k] || 0) + 1;
                      });
                      return filtered.map((p: any) => {
                        const t = postTypeOf(p);
                        const authorKey = p.authorUid || `name:${(p.authorName || '').trim().toLowerCase()}`;
                        const evName = (events || []).find((e) => e.id === p.eventId)?.name;
                        const when = p.timestamp?.toDate ? p.timestamp.toDate() : (p.createdAt?.toDate ? p.createdAt.toDate() : null);
                        return (
                          <div key={p.id} className="flex items-center gap-3 p-4">
                            {/* Small preview: tap to watch a video or view the photo full-screen. */}
                            {(() => {
                              const urls = Array.isArray(p.mediaUrls) ? p.mediaUrls : (p.mediaUrl ? [p.mediaUrl] : []);
                              const isVid = urls.length > 0 && (p.mediaTypes?.[0] === 'video' || urls[0].toLowerCase().includes('.mp4') || urls[0].toLowerCase().includes('.webm') || urls[0].toLowerCase().includes('.mov') || urls[0].includes('/video/'));
                              return urls.length ? (
                                <button type="button" onClick={() => setAdminViewerPost(p)} className="relative w-14 h-14 rounded-2xl overflow-hidden bg-black shrink-0 border border-[#DAD8E3] dark:border-[#22363E]" title="Open preview">
                                  {isVid ? (
                                    <>
                                      <video src={urls[0]} className="w-full h-full object-cover" muted playsInline />
                                      <span className="absolute inset-0 grid place-items-center bg-black/30"><Play className="w-5 h-5 text-white fill-current" /></span>
                                    </>
                                  ) : (
                                    <img src={urls[0]} className="w-full h-full object-cover" alt="" />
                                  )}
                                </button>
                              ) : (
                                <div className="w-11 h-11 rounded-2xl bg-[var(--ann-accent)]/15 text-[var(--ann-accent)] flex items-center justify-center font-black shrink-0">{(p.authorName || 'G').charAt(0).toUpperCase()}</div>
                              );
                            })()}
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-[0.92rem] truncate">
                                {p.authorName || 'A guest'}
                                <span className="ml-2 px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[0.6rem] font-black uppercase tracking-widest opacity-70">{t}</span>
                                {evName && <span className="ml-1.5 px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[0.6rem] font-black uppercase tracking-widest opacity-70">{evName}</span>}
                                {(postCountByKey[authorKey] || 1) > 1 && <span className="ml-1.5 px-2 py-0.5 rounded-full bg-[var(--ann-accent)]/10 text-[var(--ann-accent)] dark:text-[#4FC3CF] text-[0.6rem] font-black uppercase tracking-widest shrink-0">{postCountByKey[authorKey]} posts</span>}
                              </p>
                              <small className="block opacity-50 truncate">{p.text || p.caption || 'Shared a memory'}</small>
                              <small className="block opacity-40">{(p.likeCount || 0) + (p.loveCount || 0)} likes · {p.commentCount || 0} comments · {relTime(when)}</small>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              {(adminPermissions ? adminPermissions.canDeletePosts : true) && (
                                <button onClick={() => onDeletePost(p.id)} className="px-4 py-2 rounded-full border border-red-500/30 text-red-500 text-[0.7rem] font-black uppercase tracking-widest">Remove</button>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {activeAdminTab === 'events' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-2xl font-black font-display tracking-tight">Events &amp; photos</h2>
                    <p className="text-sm opacity-60 mt-0.5">Everything about the day in one place. Edits show in the preview straight away; the Save bar at the bottom sends them to your app. The eye button on a section hides it from your app until you bring it back.</p>
                  </div>

                  {adminPermissions?.canUploadImages && (
                    <section>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-[0.7rem] uppercase tracking-widest font-black opacity-50">
                          Hero photos ({heroShown.length} / 20)
                        </label>
                        {heroShown.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setConfirmAsk({ title: 'Remove all hero photos?', message: 'Every hero photo comes out. This cannot be undone.', confirmLabel: 'Remove all', action: () => setHeroImgDraft([]) })}
                            className="text-[10px] font-black uppercase tracking-wider text-red-500 hover:underline"
                          >
                            Clear All
                          </button>
                        )}
                      </div>
                      {/* Label attached to every photo added from the tile below. */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Label for new photos</span>
                        <BrandedSelect value={newHeroLabel} onChange={(v: string) => setNewHeroLabel(v)} isDarkMode={isDarkMode} options={[{ value: '', label: 'No label' }, ...evDraft.map((ev: any) => ({ value: ev.name, label: ev.name }))]} />
                      </div>
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        {heroShown.slice(0, 20).map((img: string, idx: number) => (
                          <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 border dark:border-[#22363E] group">
                            <img src={img} loading="eager" decoding="async" onLoad={(e) => e.currentTarget.classList.add('hero-loaded')} className="hero-tile-img w-full h-full object-cover" alt="" />
                            <div className="absolute top-1 right-1 flex gap-1">
                              {idx > 0 && (
                                <button type="button" onClick={() => { const u = [...heroShown]; const t = u[idx - 1]; u[idx - 1] = u[idx]; u[idx] = t; setHeroImgDraft(u); }} className="p-1 bg-black/70 text-white rounded-full" title="Move earlier">
                                  <ChevronLeft className="w-3 h-3" />
                                </button>
                              )}
                              {idx < heroShown.length - 1 && (
                                <button type="button" onClick={() => { const u = [...heroShown]; const t = u[idx + 1]; u[idx + 1] = u[idx]; u[idx] = t; setHeroImgDraft(u); }} className="p-1 bg-black/70 text-white rounded-full" title="Move later">
                                  <ChevronRight className="w-3 h-3" />
                                </button>
                              )}
                              <button type="button" onClick={() => setConfirmAsk({ title: 'Remove photo?', message: 'This photo comes out of your hero photos. This cannot be undone.', confirmLabel: 'Remove', action: () => setHeroImgDraft(heroShown.filter((_: string, i: number) => i !== idx)) })} className="p-1 bg-black/70 text-white rounded-full" title="Remove image">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            {/* Event label attached to this photo, editable any time. */}
                            <div className="absolute bottom-0 inset-x-0 p-1 bg-black/55">
                              <BrandedSelect value={heroLabelDraft?.[img] || ''} onChange={(v: string) => setHeroLabelDraft({ ...(heroLabelDraft || {}), [img]: v })} isDarkMode={isDarkMode} compact className="p-1.5 rounded-lg border-none bg-transparent text-white text-[9px] font-bold w-full" options={[{ value: '', label: 'No label' }, ...evDraft.map((ev: any) => ({ value: ev.name, label: ev.name }))]} />
                            </div>
                          </div>
                        ))}
                        {heroShown.length < 20 && (
                          <label className="aspect-square rounded-lg border-2 border-dashed border-[var(--ann-accent)]/30 flex flex-col items-center justify-center cursor-pointer hover:bg-[var(--ann-accent)]/5 transition-colors">
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              className="hidden"
                              disabled={isBulkUploading}
                              onChange={async (e) => {
                                const files = Array.from(e.target.files || []);
                                if (files.length === 0) return;

                                const remainingSlots = 20 - heroShown.length;
                                const filesToUpload = files.slice(0, remainingSlots);
                                if (files.length > remainingSlots) {
                                  showToast(`Maximum 20 hero images allowed. Uploading first ${remainingSlots}.`, 'info');
                                }

                                setIsBulkUploading(true);
                                const uploadedUrls: string[] = [];

                                try {
                                  for (const file of filesToUpload) {
                                    const url = DEMO ? await demoImageDataUrl(file as any) : await uploadToCloudinary(file as any, 'hero');
                                    uploadedUrls.push(url);
                                    await new Promise(resolve => setTimeout(resolve, 100));
                                  }

                                  if (uploadedUrls.length > 0) {
                                    // Draft only: the new photos reach the app when Save changes is tapped.
                                    setHeroImgDraft([...heroShown, ...uploadedUrls].slice(0, 20));
                                    // Attach the chosen label to every newly added photo.
                                    if (newHeroLabel) {
                                      const labelMap = { ...(heroLabelDraft || {}) };
                                      uploadedUrls.forEach((u) => { labelMap[u] = newHeroLabel; });
                                      setHeroLabelDraft(labelMap);
                                    }
                                  }
                                } catch (err: any) {
                                  console.error("Bulk upload error:", err);
                                  showToast(err?.message || "Failed to upload hero images.", "error");
                                } finally {
                                  setIsBulkUploading(false);
                                  e.target.value = '';
                                }
                              }}
                            />
                            {isBulkUploading ? (
                              <RefreshCw className="w-5 h-5 text-[var(--ann-accent)] animate-spin" />
                            ) : (
                              <>
                                <Plus className="w-5 h-5 text-[var(--ann-accent)]" />
                                <span className="text-[10px] font-bold mt-1 uppercase">Add ({20 - heroShown.length})</span>
                              </>
                            )}
                          </label>
                        )}
                      </div>
                      <p className="text-[0.75rem] opacity-60 italic">Upload up to 20 images for the hero banner (scrolls 2 images at a time).{!heroImgDraft.length && ' These are the placeholder photos currently in the app: remove any of them or add your own, and your list takes over the hero.'}</p>
                    </section>
                  )}

                  <section>
                    <h3 className="font-black font-display text-lg mb-1">Hero style</h3>
                    <p className="text-sm opacity-60 mb-3">The design of the photo hero at the top of Home. Tap one and the preview switches to it; it goes live when you save.</p>
                    <div className="flex gap-2 flex-wrap">
                      {([['classic', 'Classic'], ['halo', 'Halo Arc'], ['hero', 'Hero Deck'], ['book', 'Open Book']] as [string, string][]).map(([tk, label]) => (
                        <button key={tk} type="button" onClick={() => setHeroTplDraft(tk as any)} className={`px-4 py-2.5 rounded-full text-[0.7rem] font-black uppercase tracking-widest border transition-colors ${heroTplDraft === tk ? 'bg-[var(--ann-accent)] text-white border-[var(--ann-accent)]' : (isDarkMode ? 'border-[#22363E] text-[#93A4AB]' : 'border-[#DAD8E3] text-[#5A6970]')}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[0.7rem] opacity-50 mt-2">Classic · Halo Arc · Hero Deck · Open Book</p>
                  </section>

                  <section>
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <h3 className="font-black font-display text-lg">Accent color</h3>
                      <button type="button" onClick={() => setSitePreviewOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#DAD8E3] dark:border-[#22363E] text-[0.6rem] font-black uppercase tracking-widest opacity-70 hover:opacity-100" style={{ touchAction: 'manipulation' }} title="Preview the accent color">
                        <Eye className="w-3.5 h-3.5" /> Preview
                      </button>
                    </div>
                    <p className="text-sm opacity-60 mb-3">The color your app is dressed in: buttons, highlights and headings. Tap one and the preview switches to it; it goes live when you save.</p>
                    <div className="flex gap-2 flex-wrap">
                      {ACCENT_CHOICES.map(([k, label, hex]) => (
                        <button key={k} type="button" onClick={() => onUpdateAccent(k)} className={`flex items-center gap-2 px-3.5 py-2 rounded-full border transition-all ${accentKey === k ? 'shadow-md' : (isDarkMode ? 'border-[#22363E]' : 'border-[#DAD8E3]')}`} style={accentKey === k ? { borderColor: hex, boxShadow: `0 0 0 2px ${hex}33` } : undefined}>
                          <span className="w-4 h-4 rounded-full border border-black/10 shrink-0" style={{ background: hex }} />
                          <span className="text-[0.7rem] font-black uppercase tracking-widest">{label}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <div className={`rounded-[20px] p-5 border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h3 className="font-black font-display text-lg">Our story</h3>
                      <SectionEyeBtn hidden={(detDraft?.hiddenSections || []).includes('story')} onClick={() => toggleSectionHidden('story')} isDarkMode={isDarkMode} />
                    </div>
                    <textarea value={storyDraft} onChange={(e) => setStoryDraft(e.target.value)} rows={4} placeholder="How you met, in your own words." className={`w-full p-4 rounded-xl border-none outline-none text-sm leading-relaxed resize-y ${isDarkMode ? 'bg-[#0B171C] text-white placeholder-[#5A6970]' : 'bg-[#EEEDF3] text-[#14262D] placeholder-[#93A4AB]'}`} />
                  </div>

                  <div className={`rounded-[20px] p-5 border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h3 className="font-black font-display text-lg">Wedding day details</h3>
                      <SectionEyeBtn hidden={(detDraft?.hiddenSections || []).includes('details')} onClick={() => toggleSectionHidden('details')} isDarkMode={isDarkMode} />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {([['churchTime', 'Church time'], ['churchVenue', 'Church venue'], ['receptionTime', 'Reception time'], ['receptionVenue', 'Reception venue'], ['hashtag', 'Hashtag']] as [string, string][]).map(([k, label]) => (
                        <div key={k}>
                          <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-1.5">{label}</span>
                          {k === 'churchTime' || k === 'receptionTime' ? (
                            <BrandedTimeField value={detDraft?.[k] || ''} onChange={(v: string) => setDetDraft({ ...(detDraft || {}), [k]: v })} isDarkMode={isDarkMode} inputCls={inputCls} />
                          ) : (
                            <input value={detDraft?.[k] || ''} onChange={(e) => setDetDraft({ ...(detDraft || {}), [k]: e.target.value })} className={inputCls} />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3">
                      <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-2">Aso-ebi colours</span>
                      <ColorSwatchesRow colors={detColors} onChange={(next: string[]) => saveColorsLive(next)} isDarkMode={isDarkMode} />
                      <p className="text-[10px] opacity-50 mt-1">The colours of the day. They show on the home page and on the invitation card.</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-black font-display text-lg mb-3">The journey</h3>
                    <div className="space-y-4">
                      {evDraft.map((e, i) => (
                        <div key={e.id} className={`rounded-[20px] p-5 border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                          <div className="grid sm:grid-cols-2 gap-3">
                            <label className="block">
                              <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-1.5">Event</span>
                              <input value={e.name} onChange={(ev) => setEvDraft(evDraft.map((x, xi) => xi === i ? { ...x, name: ev.target.value } : x))} className={inputCls} />
                            </label>
                            <div>
                              <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-1.5">Date</span>
                              <BrandedDateField value={e.date} onChange={(v: string) => setEvDraft(evDraft.map((x, xi) => xi === i ? { ...x, date: v } : x))} isDarkMode={isDarkMode} inputCls={inputCls} />
                            </div>
                            <label className="block">
                              <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-1.5">Venue</span>
                              <input value={e.venue || ''} onChange={(ev) => setEvDraft(evDraft.map((x, xi) => xi === i ? { ...x, venue: ev.target.value } : x))} className={inputCls} />
                            </label>
                            <label className="block">
                              <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-1.5">Short description</span>
                              <input value={e.desc} onChange={(ev) => setEvDraft(evDraft.map((x, xi) => xi === i ? { ...x, desc: ev.target.value } : x))} className={inputCls} />
                            </label>
                          </div>
                          <div className="mt-3">
                            <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-1.5">Step photos (up to 2 at a time)</span>
                            <div className="flex gap-2 flex-wrap items-center">
                              {(((e as any).images || []) as string[]).map((u: string, ii: number) => (
                                <div key={ii} className="relative w-[64px] h-[64px] rounded-[10px] overflow-hidden">
                                  <img src={u} alt="" className="w-full h-full object-cover" />
                                  <button type="button" onClick={() => setConfirmAsk({ title: 'Remove photo?', message: 'This photo comes out of the event. This cannot be undone.', confirmLabel: 'Remove', action: () => removeEventStepPhoto(e.id, ii) })} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white grid place-items-center text-[0.7rem]" title="Remove">×</button>
                                </div>
                              ))}
                              {(((e as any).images || []) as string[]).length < 2 && (
                                <label className="w-[64px] h-[64px] rounded-[10px] border-2 border-dashed border-[var(--ann-accent)]/40 flex flex-col items-center justify-center cursor-pointer text-[var(--ann-accent)] hover:bg-[var(--ann-accent)]/5">
                                  <input type="file" accept="image/*" multiple hidden disabled={evUpBusy === e.id} onChange={async (ev) => { const fs = Array.from((ev.target as HTMLInputElement).files || []); (ev.target as HTMLInputElement).value = ''; await uploadEventStepPhotos(e.id, fs); }} />
                                  <span className="text-[0.6rem] font-black text-center leading-tight px-1">{evUpBusy === e.id ? '…' : '+ Add'}</span>
                                </label>
                              )}
                            </div>
                            <p className="text-[0.7rem] opacity-50 mt-1">Guests see these when the event opens in the journey dropdown.</p>
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                            <div>
                              <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-1.5">Status shown to guests</span>
                              <div className="flex rounded-full border border-[#DAD8E3] dark:border-[#22363E] overflow-hidden">
                                {(['done', 'next', 'up'] as const).map((s) => (
                                  <button key={s} type="button" onClick={() => setEvDraft(evDraft.map((x) => x.id === e.id ? { ...x, status: s } : (s === 'next' && x.status === 'next' ? { ...x, status: 'up' } : x)))} className={`px-4 py-2 text-[0.65rem] font-black uppercase tracking-widest ${e.status === s || (!e.status && s === 'up') ? 'bg-[var(--ann-accent)] text-white' : 'opacity-60'}`}>
                                    {s === 'done' ? 'Done' : s === 'next' ? 'Next up' : 'Upcoming'}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <SectionEyeBtn hidden={!!(e as any).hidden} onClick={() => setEvDraft(evDraft.map((x) => (x.id === e.id ? { ...(x as any), hidden: !(x as any).hidden } : x)))} isDarkMode={isDarkMode} />
                              {i > 0 && (
                                <button type="button" onClick={() => { const u = [...evDraft]; const t = u[i - 1]; u[i - 1] = u[i]; u[i] = t; setEvDraft(u); }} className="px-4 py-2 rounded-full border border-[#DAD8E3] dark:border-[#22363E] text-[0.65rem] font-black uppercase tracking-widest">Move up</button>
                              )}
                              <button type="button" onClick={() => setEvDraft(evDraft.filter((_, xi) => xi !== i))} className="px-4 py-2 rounded-full border border-[#C4453B]/40 text-[#C4453B] text-[0.65rem] font-black uppercase tracking-widest">Delete</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => setEvDraft([...evDraft, { id: `ev${Date.now()}`, name: '', type: '', date: '', venue: '', desc: '', status: 'up' } as WeddingEvent])} className="mt-4 px-5 py-3 rounded-full border border-dashed border-[var(--ann-accent)] text-[var(--ann-accent)] text-[0.7rem] font-black uppercase tracking-widest">+ Add event</button>
                  </div>

                                    <section className={`rounded-[20px] p-5 border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-black font-display text-lg mb-1">Gifts &amp; support</h3>
                        <p className="text-sm opacity-60">Guests who want to gift you money see this on your home page, right before the photo wall. Tap hide and nobody sees it until you bring it back.</p>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 mt-4">
                      <div>
                        <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-1.5">Bank name</span>
                        <input type="text" value={giftDraft?.bank ?? ''} onChange={(e) => setGiftDraft({ ...(giftDraft || {}), bank: e.target.value })} placeholder="GTBank" className={`${inputCls} w-full`} />
                      </div>
                      <div>
                        <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-1.5">Account number</span>
                        <input type="text" inputMode="numeric" value={giftDraft?.accountNumber ?? ''} onChange={(e) => setGiftDraft({ ...(giftDraft || {}), accountNumber: e.target.value.replace(/[^0-9]/g, '') })} placeholder="0123456789" className={`${inputCls} w-full`} />
                      </div>
                      <div className="sm:col-span-2">
                        <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-1.5">Account name</span>
                        <input type="text" value={giftDraft?.accountName ?? ''} onChange={(e) => setGiftDraft({ ...(giftDraft || {}), accountName: e.target.value })} placeholder="Amara &amp; Daniel" className={`${inputCls} w-full`} />
                      </div>
                      <div className="sm:col-span-2">
                        <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-1.5">Message to guests</span>
                        <textarea rows={2} value={giftDraft?.note ?? ''} onChange={(e) => setGiftDraft({ ...(giftDraft || {}), note: e.target.value })} className={`w-full p-4 rounded-xl border-none outline-none text-sm leading-relaxed resize-y ${isDarkMode ? 'bg-[#0B171C] text-white' : 'bg-[#EEEDF3] text-[#14262D]'}`} />
                      </div>
                    </div>
                    <div className="mt-2">
                      <SectionEyeBtn hidden={(detDraft?.hiddenSections || []).includes('gifts')} onClick={() => toggleSectionHidden('gifts')} isDarkMode={isDarkMode} />
                    </div>
                  </section>

                  {/* Partners — under Gifts & support (user direction Nov 21 2026): one card in
                      Events & photos, with its own hide/unhide eye like the other sections. */}
                  <section>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-black font-display text-lg mb-1">Partners</h3>
                        <p className="text-sm opacity-60">The people, brands and businesses you want your guests to know: photographers, planners, aso-ebi sellers, anyone behind your occasion. Whatever you save here shows on the app's home page under Our partners, right after Gifts &amp; support. Tap hide and nobody sees it until you bring it back.</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-4">
    <div id="partner-form-card" className={`rounded-[20px] p-5 border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                      <h3 className="font-black font-display text-lg mb-1">{partnerEditing ? `Edit ${partnerEditing.name || 'partner'}` : 'Add a partner'}</h3>
                      <p className="text-sm opacity-60 mb-4">{partnerEditing ? 'Change anything and save. Updates show on the app straight away.' : 'Name is the only required field; everything else makes the card richer.'}</p>
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-1.5">Name</span>
                            <input type="text" value={partnerForm.name} onChange={(e) => setPartnerForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="e.g. Lens & Light Studio" className={inputCls} />
                          </div>
                          <div>
                            <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-1.5">What they do</span>
                            <input type="text" value={partnerForm.category} onChange={(e) => setPartnerForm((f: any) => ({ ...f, category: e.target.value }))} placeholder="e.g. Photography, Catering, Aso-ebi" className={inputCls} />
                          </div>
                        </div>
                        <div>
                          <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-1.5">Description</span>
                          <textarea value={partnerForm.description} onChange={(e) => setPartnerForm((f: any) => ({ ...f, description: e.target.value }))} rows={3} placeholder="A line or two your guests will read about them." className={`${inputCls} resize-none`} />
                        </div>
                        <div>
                          <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-1.5">Logo</span>
                          {partnerForm.photo ? (
                            <div className="flex items-center gap-3">
                              <img src={partnerForm.photo} alt="Partner logo" className="w-14 h-14 rounded-full object-cover border border-[#DAD8E3] dark:border-[#22363E]" />
                              <button type="button" onClick={() => setPartnerForm((f: any) => ({ ...f, photo: '' }))} className="px-4 py-2 rounded-full border border-[#DAD8E3] dark:border-[#22363E] text-[0.65rem] font-black uppercase tracking-widest">Remove</button>
                            </div>
                          ) : (
                            <label className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer ${partnerLogoBusy ? 'opacity-50 pointer-events-none' : ''} ${isDarkMode ? 'border-[#22363E] text-[#93A4AB]' : 'border-[#DAD8E3] text-[#5A6970]'}`}>
                              <Camera className="w-4 h-4" />
                              {partnerLogoBusy ? 'Uploading…' : 'Upload a logo'}
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPartnerLogo(f); e.currentTarget.value = ''; }} />
                            </label>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-1.5">WhatsApp / phone</span>
                            <input type="text" value={partnerForm.whatsapp} onChange={(e) => setPartnerForm((f: any) => ({ ...f, whatsapp: e.target.value }))} placeholder="e.g. 2348012345678" className={inputCls} />
                          </div>
                          <div>
                            <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-1.5">Instagram</span>
                            <input type="text" value={partnerForm.instagram} onChange={(e) => setPartnerForm((f: any) => ({ ...f, instagram: e.target.value }))} placeholder="@handle" className={inputCls} />
                          </div>
                          <div>
                            <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-1.5">Website</span>
                            <input type="text" value={partnerForm.website} onChange={(e) => setPartnerForm((f: any) => ({ ...f, website: e.target.value }))} placeholder="https://…" className={inputCls} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-1.5">TikTok</span>
                            <input type="text" value={partnerForm.tiktok} onChange={(e) => setPartnerForm((f: any) => ({ ...f, tiktok: e.target.value }))} placeholder="e.g. @handle" className={inputCls} />
                          </div>
                          <div>
                            <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-1.5">Facebook</span>
                            <input type="text" value={partnerForm.facebook} onChange={(e) => setPartnerForm((f: any) => ({ ...f, facebook: e.target.value }))} placeholder="Page or profile name" className={inputCls} />
                          </div>
                          <div>
                            <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-1.5">YouTube</span>
                            <input type="text" value={partnerForm.youtube} onChange={(e) => setPartnerForm((f: any) => ({ ...f, youtube: e.target.value }))} placeholder="Channel name" className={inputCls} />
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap pt-1">
                          <button type="button" onClick={savePartner} className="px-6 py-3 rounded-full bg-[var(--ann-accent)] text-white text-[0.7rem] font-black uppercase tracking-widest">{partnerEditing ? 'Save changes' : 'Add partner'}</button>
                          {partnerEditing && (
                            <button type="button" onClick={() => { setPartnerEditing(null); setPartnerForm({ name: '', category: '', description: '', photo: '', whatsapp: '', instagram: '', website: '', tiktok: '', facebook: '', youtube: '' }); }} className="px-6 py-3 rounded-full border border-[#DAD8E3] dark:border-[#22363E] text-[0.7rem] font-black uppercase tracking-widest">Cancel</button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {partnersList.length === 0 ? (
                        <p className="text-sm opacity-60">No partners yet. Add the first one above and it appears on the app's home page immediately.</p>
                      ) : partnersList.map((p: any) => (
                        <div key={p.id || p.name} className={`rounded-[20px] p-5 border flex items-start gap-3 ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                          {p.photo
                            ? <img src={p.photo} alt={p.name || 'Partner'} className="w-11 h-11 rounded-full object-cover shrink-0" />
                            : <span className="w-11 h-11 rounded-full shrink-0 flex items-center justify-center text-white font-black" style={{ background: 'var(--ann-accent)' }}>{(p.name || '?').slice(0, 1).toUpperCase()}</span>}
                          <div className="min-w-0 flex-1">
                            <b className="block text-[0.95rem] font-serif-display">{p.name}</b>
                            {p.category ? <span className="block text-[0.7rem] opacity-60">{p.category}</span> : null}
                            {p.description ? <p className="m-0 text-[0.8rem] opacity-70 mt-1">{p.description}</p> : null}
                            <div className="flex gap-3 flex-wrap mt-1.5 text-[0.7rem] opacity-70">
                              {p.whatsapp ? <span>WhatsApp {p.whatsapp}</span> : null}
                              {p.instagram ? <span>Instagram {p.instagram}</span> : null}
                              {p.website ? <span className="truncate max-w-[200px]">{p.website}</span> : null}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 shrink-0">
                            <button type="button" onClick={() => { setPartnerEditing(p); setPartnerForm({ name: p.name || '', category: p.category || '', description: p.description || '', photo: p.photo || '', whatsapp: p.whatsapp || '', instagram: p.instagram || '', website: p.website || '', tiktok: p.tiktok || '', facebook: p.facebook || '', youtube: p.youtube || '' }); try { document.getElementById('partner-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch {} }} className="px-4 py-2 rounded-full border border-[#DAD8E3] dark:border-[#22363E] text-[0.65rem] font-black uppercase tracking-widest">Edit</button>
                            <button type="button" onClick={() => setPartnerDelete(p)} className="px-4 py-2 rounded-full border border-red-400 text-red-500 text-[0.65rem] font-black uppercase tracking-widest">Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <DeleteConfirmationModal
                      isOpen={!!partnerDelete}
                      onClose={() => setPartnerDelete(null)}
                      onConfirm={removePartner}
                      isDarkMode={isDarkMode}
                      title="Remove partner?"
                      message={`${partnerDelete?.name || 'This partner'} will stop showing on the app's home page right away.`}
                      confirmLabel="Remove partner"
                    />
                    </div>
                    <div className="mt-3">
                      <SectionEyeBtn hidden={(detDraft?.hiddenSections || []).includes('partners')} onClick={() => toggleSectionHidden('partners')} isDarkMode={isDarkMode} />
                    </div>
                  </section>

{adminPermissions?.canUploadImages && (
                    <section>
                      <h3 className="font-black font-display text-lg mb-1">Giant footer style</h3>
                      <p className="text-sm opacity-60 mb-3">How the big photo wall at the bottom of Home looks. Tap a style, then the round eye button on the right to watch it.</p>
                      <div className="flex gap-2 flex-wrap">
                        {(['wall', 'marquee', 'tunnel', 'globe'] as const).map((st) => (
                          <button key={st} type="button" onClick={() => setFooterStyleDraft(st)} className={`px-4 py-2.5 rounded-full text-[0.7rem] font-black uppercase tracking-widest border transition-colors ${footerStyleDraft === st ? 'bg-[var(--ann-accent)] text-white border-[var(--ann-accent)]' : (isDarkMode ? 'border-[#22363E] text-[#93A4AB]' : 'border-[#DAD8E3] text-[#5A6970]')}`}>
                            {st === 'wall' ? 'Style 1 · Photo wall' : st === 'marquee' ? 'Style 2 · Marquee' : st === 'tunnel' ? 'Style 3 · Photo tunnel' : 'Style 4 · Photo globe'}
                          </button>
                        ))}
                      </div>
                      <p className="text-[0.7rem] opacity-50 mt-2">Style 1 · grey photo grid with a light scan · Style 2 · dark wall with rounded rows · Style 3 · travel down a 3D tunnel of photos (drag to spin, drag up/down for speed) · Style 4 · photos wrap a ball that turns slowly (drag to spin it)</p>
                      <div className="mt-4">
                        <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-1.5">Thank-you line</span>
                        <input type="text" value={footerThanksDraft} onChange={(e) => setFooterThanksDraft(e.target.value)} placeholder="Thank you for celebrating with us" className={`${inputCls} w-full`} />
                        <p className="text-[0.7rem] opacity-50 mt-1.5">The small line above your names on every giant footer style. Leave it empty to keep the default.</p>
                      </div>
                      <p className="text-[0.75rem] opacity-60 italic mt-3">Nobody uploads the giant footer photos: it starts as placeholders of the hero images, and every photo posted to the feed replaces a tile, newest first, until all 40 tiles come from the feed.</p>
                    </section>
                  )}

                  {/* Footer (user direction Nov 21 2026): the wording under the photo wall is
                      editable; empty fields keep the default text. */}
                  <section>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-black font-display text-lg mb-1">Footer</h3>
                        <p className="text-sm opacity-60">The words at the very bottom of your home page, after the photo wall. Leave a field empty and the app keeps its default wording.</p>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 mt-4">
                      <div className="sm:col-span-2">
                        <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-1.5">Footer message</span>
                        <textarea rows={2} value={footerDraft?.message ?? ''} onChange={(e) => setFooterDraft({ ...(footerDraft || {}), message: e.target.value })} placeholder={`Happy Wedding · ${WED_LONG}`} className={`${inputCls} resize-none`} />
                      </div>
                      <div className="sm:col-span-2">
                        <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-1.5">Footer caption</span>
                        <input type="text" value={footerDraft?.caption ?? ''} onChange={(e) => setFooterDraft({ ...(footerDraft || {}), caption: e.target.value })} placeholder="Wedding memories, kept for life" className={`${inputCls} w-full`} />
                      </div>
                    </div>
                  </section>

                  {/* One save for the whole page. */}
                  <div className={`mt-8 flex items-center gap-4 flex-wrap border-t pt-4 ${isDarkMode ? 'border-[#22363E]' : 'border-[#DAD8E3]'}`}>
                    <p className={`text-xs font-bold flex-1 min-w-[220px] ${pageDirty ? 'text-[var(--ann-accent)]' : 'opacity-50'}`}>
                      {pageDirty ? 'You have unsaved changes. Tap Save changes for them to reach your app.' : 'All saved. Your app shows exactly what you see here.'}
                    </p>
                    <button onClick={saveEverything} disabled={weddingBusy} className="px-6 py-3 rounded-full bg-[var(--ann-accent)] text-white text-[0.7rem] font-black uppercase tracking-widest disabled:opacity-60 shrink-0">
                      {weddingBusy ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>

                  {/* Back to top (user direction Nov 21 2026, moved bottom-right same day): arrow on
                      Events & photos; one tap takes the page back to the top. */}
                  <button
                    onClick={() => { try { document.getElementById('admin-dash-scroll')?.scrollTo({ top: 0, behavior: 'smooth' }); } catch { document.getElementById('admin-dash-scroll')?.scrollTo(0, 0); } }}
                    title="Back to top"
                    aria-label="Back to top"
                    className="fixed right-4 bottom-6 z-[130] w-12 h-12 rounded-full bg-[var(--ann-accent)] text-white grid place-items-center shadow-2xl active:scale-95 transition-transform"
                  >
                    <ArrowUp className="w-6 h-6" />
                  </button>

                  {/* Floating preview: opens the in-page mockup, saves nothing. */}
                  <button onClick={previewSite} title="Preview the app" aria-label="Preview the app" className="fixed right-4 top-1/2 -translate-y-1/2 z-[130] w-14 h-14 rounded-full bg-[var(--ann-accent)] text-white grid place-items-center shadow-2xl active:scale-95 transition-transform">
                    <Eye className="w-6 h-6" />
                  </button>
                </div>
              )}

              <AnimatePresence>
                {sitePreviewOpen && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => setSitePreviewOpen(false)}
                      className="fixed inset-0 bg-black/70 z-[140] backdrop-blur-sm"
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.94, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: 8 }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                      className="fixed inset-0 z-[141] flex flex-col items-center justify-center px-4 pointer-events-none"
                    >
                      <div className="pointer-events-auto flex flex-col items-center">
                        <div className="flex items-center justify-between gap-4 w-[340px] max-w-[92vw] mb-3">
                          <p className="font-display text-white text-sm font-bold">Preview · your latest changes</p>
                          <button
                            onClick={() => setSitePreviewOpen(false)}
                            className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white text-[0.6rem] font-black uppercase tracking-widest"
                          >
                            Close
                          </button>
                        </div>
                        <div className="relative w-[340px] max-w-[92vw] h-[660px] max-h-[calc(100vh-120px)] rounded-[2.6rem] bg-[#0B171C] p-[10px] shadow-2xl shrink-0">
                          <div className="w-full h-full rounded-[2rem] overflow-hidden bg-white">
                            <PreviewHomeMockup
                              bride={demoBride()}
                              groom={demoGroom()}
                              city={demoCity()}
                              wedDate={previewWedDate()}
                              events={evDraft}
                              story={storyDraft}
                              details={withGiftDefaults(detDraft)}
                              heroImages={heroImgDraft.length ? heroImgDraft : PLACEHOLDER_IMAGES}
                              tpl={heroTplDraft}
                              wallStyle={footerStyleDraft}
                              thanks={(footerThanksDraft || '').trim()}
                              partners={partnersList}
                            />
                          </div>
                        </div>
                        <p className="mt-3 text-[0.6rem] font-black uppercase tracking-widest text-white/40">Just the home page · scroll inside the mockup</p>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              {activeAdminTab === 'invite' && (
                <InviteCardSection isDarkMode={isDarkMode} weddingDetails={weddingDetails} story={story} wedDate={previewWedDate()} showToast={showToast} />
              )}

              {activeAdminTab === 'albums' && ( 
                <div className="space-y-8">
                  <div className={`rounded-[20px] p-5 border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                    <h3 className="font-black font-display text-lg mb-1">Vendor albums</h3>
                    <p className="text-sm opacity-60">Photos and videos from the photographers and vendors, arranged as albums. Every album carries the name of who uploaded it and the date. Tap an album to see everything inside.</p>
                  </div>
                  {([['photo', 'Photos', 'Add photos'], ['video', 'Videos', 'Add videos']] as [string, string, string][]).map(([kind, label, btnLabel]) => {
                    const groups = albumGroups.filter((g: any) => g.kind === kind);
                    return (
                      <div key={kind}>
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <h4 className="text-[0.7rem] uppercase tracking-widest font-black opacity-50">{label}</h4>
                          <button onClick={() => openAlbumPopup(kind as 'photo' | 'video')} className="px-4 py-2.5 rounded-xl text-[0.65rem] font-black uppercase tracking-widest bg-[var(--ann-accent)] text-white active:scale-[0.97] transition-transform" style={{ touchAction: 'manipulation' }}>{btnLabel}</button>
                        </div>
                        {groups.length === 0 ? (
                          <p className="text-xs opacity-40 py-8 text-center">Nothing here yet.</p>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {groups.map((g: any) => {
                              const cover = g.media[0];
                              return (
                                <div key={g.id} className={`relative rounded-2xl overflow-hidden border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                                  <button onClick={() => setAlbumViewer(g)} className="block w-full text-left" style={{ touchAction: 'manipulation' }}>
                                    <div className="aspect-square bg-black relative">
                                      {cover?.type === 'video' ? (
                                        <video src={cover.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                                      ) : (
                                        <img src={cover?.url} className="w-full h-full object-cover" alt={g.title || 'Album'} loading="lazy" />
                                      )}
                                      {cover?.type === 'video' && (
                                        <span className="absolute inset-0 grid place-items-center pointer-events-none">
                                          <span className="w-10 h-10 rounded-full bg-black/55 text-white grid place-items-center"><Play className="w-4 h-4 fill-current" /></span>
                                        </span>
                                      )}
                                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[0.6rem] font-black">{g.kind === 'video' ? 'Video' : 'Photo'} album · {g.count}</span>
                                    </div>
                                    <div className="p-3">
                                      <p className="text-sm font-black truncate">{g.title || (g.kind === 'video' ? 'Video album' : 'Photo album')}</p>
                                      <p className="text-[0.6rem] uppercase tracking-widest opacity-50 mt-0.5">
                                        {g.uploadedAt?.toDate ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(g.uploadedAt.toDate()) : 'Just added'}
                                      </p>
                                      <p className="text-xs font-bold opacity-70 truncate mt-0.5">By {g.uploaderName || g.uploaderEmail || 'Admin'}</p>
                                    </div>
                                  </button>
                                  {adminPermissions?.canDeletePosts && (
                                    <button onClick={() => setConfirmAsk({ title: 'Remove album?', message: 'The whole album and everything in it comes out. This cannot be undone.', confirmLabel: 'Remove', action: () => deleteAlbumGroup(g) })} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white grid place-items-center" title="Remove album" style={{ touchAction: 'manipulation' }}>
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {/* MASS DOWNLOAD and MASS DELETE for the whole album. */}
                                  <div className="px-3 pb-3 -mt-1 flex gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); downloadAlbumZip(g); }} disabled={albumZipBusy === g.id} className="flex-1 py-2 rounded-lg text-[0.6rem] font-black uppercase tracking-widest border border-[var(--ann-accent)]/40 text-[var(--ann-accent)] active:scale-[0.97] transition-transform disabled:opacity-50" style={{ touchAction: 'manipulation' }}>
                                      {albumZipBusy === g.id ? 'Packing…' : 'Download all'}
                                    </button>
                                    {adminPermissions?.canDeletePosts && (
                                      <button onClick={(e) => { e.stopPropagation(); setConfirmAsk({ title: 'Delete everything in this album?', message: 'Every photo and video in it comes out. This cannot be undone.', confirmLabel: 'Delete all', action: () => deleteAlbumGroup(g) }) }} className="flex-1 py-2 rounded-lg text-[0.6rem] font-black uppercase tracking-widest border border-red-500/40 text-red-500 active:scale-[0.97] transition-transform" style={{ touchAction: 'manipulation' }}>
                                        Delete all
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* UPLOAD POPUP: the button opens this first; the picking and
                      the actual upload happen inside it, as many files as they
                      like, all going into one album. */}
                  {albumPopupKind && (
                    <div className="fixed inset-0 z-[570] flex items-center justify-center p-4 bg-black/60" onClick={() => { if (!albumUploading) { albumPicked.forEach((pp) => { try { URL.revokeObjectURL(pp.preview); } catch { /* already gone */ } }); setAlbumPicked([]); setAlbumPopupKind(null); setAlbumAddTarget(null); } }}>
                      <div className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden ${isDarkMode ? 'bg-[#0B171C] border-[#22363E] text-[#E8EEF0]' : 'bg-white border-[#DAD8E3] text-[#14262D]'}`} onClick={(e) => e.stopPropagation()}>
                        <div className="p-5 pb-3 flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-black font-display text-lg">{albumAddTarget ? `Add to "${albumAddTarget.title || (albumPopupKind === 'video' ? 'Video album' : 'Photo album')}"` : (albumPopupKind === 'video' ? 'Upload videos' : 'Upload photos')}</h3>
                            <p className="text-xs opacity-60 mt-0.5">{albumAddTarget ? 'The new ones join the rest of this album.' : 'Pick as many as you like, there is no limit. They all go into one album with your name and today\'s date on it.'}</p>
                          </div>
                          {!albumUploading && (
                            <button onClick={() => { albumPicked.forEach((pp) => { try { URL.revokeObjectURL(pp.preview); } catch { /* already gone */ } }); setAlbumPicked([]); setAlbumPopupKind(null); setAlbumAddTarget(null); }} className={`p-2 rounded-xl shrink-0 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}><X className="w-5 h-5" /></button>
                          )}
                        </div>
                        <div className="px-5 pb-5 space-y-4 max-h-[70vh] overflow-y-auto">
                          {!albumAddTarget && (
                            <input value={albumTitle} onChange={(e) => setAlbumTitle(e.target.value)} disabled={albumUploading} placeholder={albumPopupKind === 'video' ? 'Name this album (e.g. Reception highlights)' : 'Name this album (e.g. Church wedding)'} className={`w-full px-4 py-3 rounded-xl border text-sm ${isDarkMode ? 'bg-[#13232A] border-[#22363E]' : 'bg-[#F6F5F9] border-[#DAD8E3]'}`} />
                          )}
                          <label htmlFor="album-popup-files" className={`block border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer ${isDarkMode ? 'border-[#22363E] hover:border-[var(--ann-accent)]' : 'border-[#DAD8E3] hover:border-[var(--ann-accent)]'}`} style={{ touchAction: 'manipulation' }}>
                            <Plus className="w-6 h-6 mx-auto opacity-60 mb-1" />
                            <span className="block text-sm font-black">{albumPicked.length ? 'Add more' : (albumPopupKind === 'video' ? 'Choose videos' : 'Choose photos')}</span>
                            <span className="block text-[0.65rem] opacity-50 mt-0.5">No limit on how many</span>
                            <input id="album-popup-files" type="file" multiple accept={albumPopupKind === 'video' ? 'video/*' : 'image/*'} className="hidden" onChange={(e) => { pickAlbumFiles(e.target.files); e.currentTarget.value = ''; }} />
                          </label>
                          {albumPicked.length > 0 && (
                            <>
                              <div className="grid grid-cols-4 gap-2">
                                {albumPicked.map((pp, i) => (
                                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-black">
                                    {isVideoFile(pp.file) ? (
                                      <video src={pp.preview} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                                    ) : (
                                      <img src={pp.preview} className="w-full h-full object-cover" alt="" />
                                    )}
                                    {!albumUploading && (
                                      <button onClick={() => dropAlbumFile(i)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white grid place-items-center"><X className="w-3 h-3" /></button>
                                    )}
                                  </div>
                                ))}
                              </div>
                              <p className="text-[0.65rem] opacity-50 text-center">{albumPicked.length} selected</p>
                            </>
                          )}
                          {albumUploading && (
                            <div>
                              <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full bg-[var(--ann-accent)] transition-all" style={{ width: `${albumProgressPct}%` }} /></div>
                              <p className="text-[0.65rem] opacity-60 text-center mt-1.5">{albumProgressPct >= 100 ? 'Saving your album…' : `Uploading… ${albumProgressPct}%`}</p>
                            </div>
                          )}
                          <button onClick={uploadAlbumBatch} disabled={!albumPicked.length || albumUploading} className={`w-full py-3.5 rounded-xl font-black text-sm ${!albumPicked.length || albumUploading ? 'opacity-40 cursor-not-allowed bg-black/10 dark:bg-white/10' : 'bg-[var(--ann-accent)] text-white active:scale-[0.99] transition-transform'}`} style={{ touchAction: 'manipulation' }}>
                            {albumUploading ? 'Uploading…' : (albumAddTarget ? `Add ${albumPicked.length || ''} ${albumPopupKind === 'video' ? 'video' : 'photo'}${albumPicked.length === 1 ? '' : 's'}` : `Upload ${albumPicked.length || ''} ${albumPopupKind === 'video' ? 'video' : 'photo'}${albumPicked.length === 1 ? '' : 's'}`).trim()}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ALBUM VIEWER: everything inside one album, in a grid.
                      Tap a photo to flip through it full screen; tap a video
                      to play it, and it rolls into the next one when it ends. */}
                  {albumViewer && (() => {
                    const g = albumViewer;
                    const dateLabel = g.uploadedAt?.toDate ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(g.uploadedAt.toDate()) : 'Just added';
                    return (
                      <div className="fixed inset-0 z-[550] flex items-center justify-center p-4 bg-black/60" onClick={() => setAlbumViewer(null)}>
                        <div className={`w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[86vh] ${isDarkMode ? 'bg-[#0B171C] border-[#22363E] text-[#E8EEF0]' : 'bg-white border-[#DAD8E3] text-[#14262D]'}`} onClick={(e) => e.stopPropagation()}>
                          <div className="p-5 pb-3 flex items-start justify-between gap-3 shrink-0">
                            <div className="min-w-0">
                              <h3 className="font-black font-display text-lg truncate">{g.title || (g.kind === 'video' ? 'Video album' : 'Photo album')}</h3>
                              <p className="text-xs opacity-60 mt-0.5">By {g.uploaderName || g.uploaderEmail || 'Admin'} · {dateLabel} · {g.count} {g.kind === 'video' ? (g.count === 1 ? 'video' : 'videos') : (g.count === 1 ? 'photo' : 'photos')}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {adminPermissions?.canUploadImages && (
                                <button onClick={() => openAlbumPopup(g.kind as 'photo' | 'video', g)} className="px-4 py-2.5 rounded-xl text-[0.65rem] font-black uppercase tracking-widest bg-[var(--ann-accent)] text-white active:scale-[0.97] transition-transform" style={{ touchAction: 'manipulation' }}>Add more</button>
                              )}
                              <button onClick={() => setAlbumViewer(null)} className={`p-2 rounded-xl ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}><X className="w-5 h-5" /></button>
                            </div>
                          </div>
                          <div className="flex-1 overflow-y-auto p-4 pt-0">
                            <div className="grid grid-cols-3 gap-2">
                              {g.media.map((m: any, i: number) => (
                                <button key={i} onClick={() => setAlbumMediaView({ items: g.media, index: i })} className="relative aspect-square rounded-xl overflow-hidden bg-black" style={{ touchAction: 'manipulation' }}>
                                  {m.type === 'video' ? (
                                    <>
                                      <video src={m.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                                      <span className="absolute inset-0 grid place-items-center pointer-events-none">
                                        <span className="w-8 h-8 rounded-full bg-black/55 text-white grid place-items-center"><Play className="w-3.5 h-3.5 fill-current" /></span>
                                      </span>
                                    </>
                                  ) : (
                                    <img src={m.url} className="w-full h-full object-cover" alt="" loading="lazy" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {albumMediaView && (
                    <AlbumMediaViewer
                      items={albumMediaView.items}
                      startIndex={albumMediaView.index}
                      onClose={() => setAlbumMediaView(null)}
                      onDownload={(item: any) => downloadMediaFile(item.url, `${albumFileBase(albumViewer)}-${albumMediaView.index + 1}.${item.type === 'video' ? 'mp4' : 'jpg'}`)}
                      onDelete={(item: any) => setConfirmAsk({ title: 'Remove from album?', message: 'This one comes out of the album. This cannot be undone.', confirmLabel: 'Remove', action: () => deleteAlbumMedia(albumViewer, item) })}
                      onPostToFeed={canPostToFeed ? (item: any) => { setQuickPostToFeed({ url: item.url, type: item.type || 'image' }); setAlbumMediaView(null); } : undefined}
                    />
                  )}

                  {quickPostToFeed && (
                    <QuickPostToFeedModal
                      media={quickPostToFeed}
                      coupleName={(() => { const b = (weddingDetails as any)?.bride; const g = (weddingDetails as any)?.groom; return b && g ? `${b} & ${g}` : demoHeader(); })()}
                      events={Array.isArray(events) && events.length ? events : (demoEvents() as any[])}
                      isDarkMode={isDarkMode}
                      onClose={() => setQuickPostToFeed(null)}
                      onPosted={(res: any) => {
                        if (res === 'error') { showToast('Could not post to the feed. Try again.', 'error'); setQuickPostToFeed(null); return; }
                        if (res) onAdminDemoPost && onAdminDemoPost(res);
                        showToast('Posted to your feed.');
                        setQuickPostToFeed(null);
                      }}
                    />
                  )}
                </div>
              )}
              {activeAdminTab === 'security' && (
                <div className="space-y-8">
                  {ownerAdmin && (
                  <div className={`rounded-[20px] p-5 border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                    <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                      <h3 className="font-black font-display text-lg">Administrators</h3>
                      <button onClick={openInviteModal} className="px-5 py-2.5 rounded-full bg-[var(--ann-accent)] text-white text-[0.7rem] font-black uppercase tracking-widest shadow-md flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Invite admin
                      </button>
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-[0.7rem] uppercase tracking-widest font-black opacity-50">Current team</h4>
                      {teamList.map((adm: any) => (
                        <div key={adm.id} className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-[#F8F8FA] border-[#DAD8E3]'}`}>
                          <div className="flex items-center justify-between mb-3 gap-2">
                            <span className="font-bold text-sm break-all">{adm.name ? `${adm.name} · ` : ''}{adm.email}{adm.isSelf ? ' (you)' : ''}</span>
                            {!adm.isSelf && (
                              <div className="flex items-center gap-1 shrink-0">
                                {adm.status === 'suspended' ? (
                                  <button onClick={() => handleSuspendAdmin(adm.email, false)} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border border-[var(--ann-accent)] text-[var(--ann-accent)]">Reinstate</button>
                                ) : (
                                  <button onClick={() => handleSuspendAdmin(adm.email, true)} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border border-[#C8932A] text-[#C8932A]">Suspend</button>
                                )}
                                {adm.mustSetPassword === true && (
                                  <button onClick={() => handleResendInvite(adm.email)} disabled={inviteResendBusy === adm.email} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border border-[var(--ann-accent)] text-[var(--ann-accent)] disabled:opacity-50">{inviteResendBusy === adm.email ? 'Resending…' : 'Resend invite'}</button>
                                )}
                                <button onClick={() => handleRemoveAdmin(adm.email)} className="text-red-500 p-1 hover:bg-red-500/10 rounded-lg shrink-0" title="Remove">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${!adm.role || ['owner', 'couple', 'admin', 'bride', 'groom'].includes(adm.role) ? 'bg-[var(--ann-accent)] border-[var(--ann-accent)] text-white' : 'bg-[#C8932A] border-[#C8932A] text-white'}`}>
                              {roleLabel(adm.role)}
                            </span>
                            {adm.status === 'suspended' ? (
                              <span className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border bg-red-500/10 text-red-500 border-red-500/40">Suspended</span>
                            ) : adm.mustSetPassword === true ? (
                              <span className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border bg-[#C8932A]/10 text-[#C8932A] border-[#C8932A]/40">Inactive</span>
                            ) : (
                              <span className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border bg-[var(--ann-accent)]/10 text-[var(--ann-accent)] border-[var(--ann-accent)]/40">Active</span>
                            )}
                            <button onClick={() => setTeamDetail(adm)} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border border-[#DAD8E3] dark:border-[#22363E] transition-all hover:border-[var(--ann-accent)] hover:text-[var(--ann-accent)]">
                              View details
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <AnimatePresence>
                      {teamDetail && (() => {
                        const adm = teamDetail;
                        const FULL_DASH = ['owner', 'couple', 'admin', 'bride', 'groom'];
                        const full = !adm.role || FULL_DASH.includes(adm.role);
                        const perms = adm.permissions || {};
                        const canUpload = full ? perms.canUploadImages !== false : perms.canUploadImages !== false;
                        const canDelete = full ? perms.canDeletePosts !== false : !!perms.canDeletePosts;
                        const canCode = full ? perms.canSetAccessCode !== false : !!perms.canSetAccessCode;
                        const status = adm.status === 'suspended' ? 'Suspended' : (adm.mustSetPassword === true || adm.status === 'invited') ? 'Inactive' : 'Active';
                        const roleNote = full
                          ? 'Sees and manages the whole dashboard: overview, moderation, all posts, events & photos, vendor albums, settings and security.'
                          : adm.role === 'photographer'
                            ? 'Vendor albums only. Uploads photos to the Photo albums section and sees nothing else.'
                            : adm.role === 'videographer'
                              ? 'Vendor albums only. Uploads videos to the Video albums section and sees nothing else.'
                              : 'Vendor albums only. Uploads photos and videos to the album sections and sees nothing else.';
                        const addedWhen = adm.addedAt?.toDate ? adm.addedAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
                        return (
                          <>
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setTeamDetail(null)} className="fixed inset-0 bg-black/60 z-[200] backdrop-blur-sm" />
                            <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.97 }} transition={{ type: 'spring', damping: 26, stiffness: 320 }} className={`fixed inset-x-4 top-1/2 -translate-y-1/2 z-[201] mx-auto max-w-md rounded-[24px] p-6 border shadow-2xl ${isDarkMode ? 'bg-[#0B171C] border-[#22363E] text-white' : 'bg-white border-[#DAD8E3] text-[#1A2B32]'}`}>
                              <div className="flex items-start justify-between gap-3 mb-4">
                                <h3 className="font-black font-display text-lg">Team member details</h3>
                                <button onClick={() => setTeamDetail(null)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10" aria-label="Close details"><X className="w-4 h-4" /></button>
                              </div>
                              <p className="font-bold break-all">{adm.name || (adm.email || '').split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
                              <p className="text-[0.8rem] opacity-60 break-all mb-3">{adm.email}</p>
                              <div className="flex flex-wrap gap-2 mb-4">
                                <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${full ? 'bg-[var(--ann-accent)] border-[var(--ann-accent)] text-white' : 'bg-[#C8932A] border-[#C8932A] text-white'}`}>{roleLabel(adm.role)}</span>
                                <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${status === 'Suspended' ? 'bg-red-500/10 text-red-500 border-red-500/40' : status === 'Inactive' ? 'bg-[#C8932A]/10 text-[#C8932A] border-[#C8932A]/40' : 'bg-[var(--ann-accent)]/10 text-[var(--ann-accent)] border-[var(--ann-accent)]/40'}`}>{status}</span>
                              </div>
                              <p className="text-[0.65rem] uppercase tracking-widest font-black opacity-50 mb-2">What they can do</p>
                              <p className="text-[0.85rem] opacity-80 mb-3">{roleNote}</p>
                              <div className="space-y-1.5 text-[0.8rem] mb-4">
                                <p>Upload images or videos: <b>{canUpload ? 'Yes' : 'No'}</b></p>
                                <p>Delete posts: <b>{canDelete ? 'Yes' : 'No'}</b></p>
                                <p>Set the guest access code: <b>{canCode ? 'Yes' : 'No'}</b></p>
                                {full && <p>Invite, suspend and remove team members: <b>Yes</b></p>}
                              </div>
                              <div className="space-y-1 text-[0.75rem] opacity-60">
                                {adm.sessionMinutes ? <p>Session timeout: {adm.sessionMinutes} min</p> : null}
                                {adm.addedBy ? <p>Added by {adm.addedBy}{addedWhen ? ` on ${addedWhen}` : ''}</p> : null}
                                {status === 'Inactive' && <p>Inactive: the invite is in their inbox. They show as active once they sign in and set their own password.</p>}
                                {status === 'Suspended' && <p>Suspended: they cannot sign in until reinstated.</p>}
                              </div>
                            </motion.div>
                          </>
                        );
                      })()}
                    </AnimatePresence>
                    <AnimatePresence>
                      {showInviteModal && (
                        <>
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowInviteModal(false)}
                            className="fixed inset-0 bg-black/60 z-[200] backdrop-blur-sm"
                          />
                          <motion.div
                            initial={{ opacity: 0, y: 24, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 24, scale: 0.97 }}
                            className={`fixed z-[201] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-[480px] max-h-[85vh] overflow-y-auto rounded-[28px] p-6 shadow-2xl ${isDarkMode ? 'bg-[#13232A] border border-[#22363E] text-white' : 'bg-white border border-[#DAD8E3] text-[#14262D]'}`}
                          >
                            {inviteStep === 'form' ? (
                              <>
                                <div className="flex items-start justify-between gap-3 mb-4">
                                  <div>
                                    <h4 className="font-black font-display text-lg">Invite an administrator</h4>
                                    <p className="text-[0.8rem] opacity-60 mt-1">Choose what they can see and do. We email them a temporary password they replace with their own at first sign-in.</p>
                                  </div>
                                  <button onClick={() => setShowInviteModal(false)} aria-label="Close" className={`p-2 rounded-full shrink-0 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
                                    <X className="w-5 h-5" />
                                  </button>
                                </div>
                                <label className="block text-[0.7rem] uppercase tracking-widest font-black mb-2 opacity-50">Who are they?</label>
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                  {([['bride', 'Bride', 'Full dashboard'], ['groom', 'Groom', 'Full dashboard'], ['photographer', 'Photographer', 'Vendor albums only'], ['videographer', 'Videographer', 'Vendor albums only']] as [string, string, string][]).map(([r, label, sub]) => (
                                    <button key={r} type="button" onClick={() => applyInviteRole(r)} className={`p-3 rounded-2xl border text-left transition-all ${inviteRole === r ? 'bg-[var(--ann-accent)] text-white border-[var(--ann-accent)] shadow-md' : (isDarkMode ? 'border-[#22363E]' : 'border-[#DAD8E3]')}`}>
                                      <span className="block text-[0.65rem] font-black uppercase tracking-widest">{label}</span>
                                      <span className={`block text-[0.6rem] mt-1 ${inviteRole === r ? 'text-white/70' : 'opacity-50'}`}>{sub}</span>
                                    </button>
                                  ))}
                                </div>
                                <label className="block text-[0.7rem] uppercase tracking-widest font-black mb-2 opacity-50">Their email</label>
                                <input
                                  type="email"
                                  value={inviteEmail}
                                  onChange={(e) => setInviteEmail(e.target.value)}
                                  placeholder="name@email.com"
                                  className={`w-full p-4 rounded-xl border-none outline-none font-bold mb-3 ${isDarkMode ? 'bg-[#0B171C] text-white placeholder-[#5A6970]' : 'bg-[#EEEDF3] text-[#14262D] placeholder-[#93A4AB]'}`}
                                />
                                <label className="block text-[0.7rem] uppercase tracking-widest font-black mb-2 opacity-50">Their name</label>
                                <input
                                  type="text"
                                  value={inviteName}
                                  onChange={(e) => setInviteName(e.target.value)}
                                  placeholder="Shown on the administrators list"
                                  className={`w-full p-4 rounded-xl border-none outline-none font-bold mb-4 ${isDarkMode ? 'bg-[#0B171C] text-white placeholder-[#5A6970]' : 'bg-[#EEEDF3] text-[#14262D] placeholder-[#93A4AB]'}`}
                                />
                                <label className="block text-[0.7rem] uppercase tracking-widest font-black mb-2 opacity-50">What they can see and do</label>
                                <div className="space-y-2 mb-5">
                                  {([['canUploadImages', 'Upload photos & videos', 'Add memories to the albums and the feed'], ['canDeletePosts', 'Delete posts & reels', 'Remove anything from the feed'], ['canSetAccessCode', 'Manage the access code', 'Change the guest code and app settings']] as [string, string, string][]).map(([pid, label, sub]) => (
                                    <button key={pid} type="button" onClick={() => setInvitePerms((prev) => ({ ...prev, [pid]: !prev[pid] }))} className={`w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl border text-left transition-all ${invitePerms[pid] ? (isDarkMode ? 'bg-[var(--ann-accent)]/20 border-[var(--ann-accent)]' : 'bg-[var(--ann-accent)]/5 border-[var(--ann-accent)]') : (isDarkMode ? 'border-[#22363E]' : 'border-[#DAD8E3]')}`}>
                                      <span>
                                        <span className="block text-[0.85rem] font-bold">{label}</span>
                                        <span className="block text-[0.7rem] opacity-50">{sub}</span>
                                      </span>
                                      <span className={`w-5 h-5 rounded-full border-2 grid place-items-center shrink-0 ${invitePerms[pid] ? 'bg-[var(--ann-accent)] border-[var(--ann-accent)]' : 'border-current opacity-40'}`}>
                                        {invitePerms[pid] && <Check className="w-3 h-3 text-white" />}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                                <button onClick={() => inviteDashboardAccess(invitePerms)} disabled={inviteBusy} className="w-full py-4 rounded-full bg-[var(--ann-accent)] text-white font-black text-xs uppercase tracking-widest shadow-lg disabled:opacity-50">
                                  {inviteBusy ? 'Creating account…' : 'Create account & send invite'}
                                </button>
                              </>
                            ) : (
                              <>
                                <div className="w-14 h-14 rounded-full bg-[var(--ann-accent)]/10 text-[var(--ann-accent)] grid place-items-center mx-auto mb-4">
                                  <Check className="w-7 h-7" />
                                </div>
                                <h4 className="text-center font-black font-display text-lg">{inviteResult?.email} is invited</h4>
                                <p className="text-center text-[0.8rem] opacity-60 mt-1 mb-4">A temporary password was emailed to them. They sign in with it once, then choose their own. Until then they show as Invited on the list.</p>
                                {inviteResult && !inviteResult.emailed && (
                                  <p className="text-center text-[0.78rem] text-red-500 mb-4">We couldn't send the email{inviteResult.mailError ? ` (${inviteResult.mailError})` : ''}. The account exists, so share the temporary password with them another way.</p>
                                )}
                                <div className="flex gap-2">
                                  <button onClick={() => setShowInviteModal(false)} className={`flex-1 py-3.5 rounded-full border text-[0.7rem] font-black uppercase tracking-widest ${isDarkMode ? 'border-[#22363E]' : 'border-[#DAD8E3]'}`}>Done</button>
                                </div>
                              </>
                            )}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                  )}
<div className={`rounded-[20px] p-5 border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                    <h3 className="font-black font-display text-lg mb-1">Security</h3>
                    <p className="text-sm opacity-60 mb-4">Change your password and choose how long your admin session stays open.</p>
                    <div className="space-y-2 mb-4">
                      {([['cur', 'Current password'], ['next', 'New password'], ['confirm', 'Confirm new password']] as ['cur' | 'next' | 'confirm', string][]).map(([k, label]) => (
                        <div key={k} className="relative">
                          <input
                            type={pwShow ? 'text' : 'password'}
                            value={pwForm[k]}
                            onChange={(e) => setPwForm((prev) => ({ ...prev, [k]: e.target.value }))}
                            placeholder={label}
                            autoComplete="new-password"
                            className={`${inputCls} w-full pr-12`}
                          />
                          <button type="button" aria-label={pwShow ? 'Hide passwords' : 'Show passwords'} onClick={() => setPwShow((v) => !v)} className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
                            {pwShow ? <EyeOff className="w-4 h-4 opacity-60" /> : <Eye className="w-4 h-4 opacity-60" />}
                          </button>
                        </div>
                      ))}
                    </div>
                    <button onClick={handleChangePassword} disabled={pwBusy} className={`w-full py-3.5 rounded-full text-[0.7rem] font-black uppercase tracking-widest mb-1 ${pwBusy ? 'bg-slate-200 text-slate-400' : 'bg-[var(--ann-accent)] text-white'}`}>
                      {pwBusy ? 'Updating…' : 'Update password'}
                    </button>
                    <p className="text-[0.7rem] opacity-50 mb-6">You confirm your current password first. At least 8 characters.</p>
                    <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-1.5">Auto sign-out</span>
                    <p className="text-sm opacity-60 mb-3">How long your admin session stays open before it signs you out. The length you set is enforced on the server too.</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <BrandedSessionSelect value={sessionDraft} onChange={(m: number) => setSessionDraft(m)} isDarkMode={isDarkMode} inputCls={inputCls} />
                      <button type="button" onClick={() => handleUpdateSession(sessionDraft)} disabled={sessionBusy} className={`px-4 py-2.5 rounded-full text-[0.7rem] font-black uppercase tracking-widest ${sessionBusy ? 'bg-slate-200 text-slate-400' : 'bg-[var(--ann-accent)] text-white'}`}>{sessionBusy ? 'Saving…' : 'Save'}</button>
                      <span className="text-[0.7rem] opacity-50">Now: {sessionLabel(sessionChoice)}</span>
                    </div>
                  </div>
                                    {isSuper && (
                  <div className={`rounded-[20px] p-5 border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                    <h3 className="font-black font-display text-lg mb-1">Security rules</h3>
                    <p className="text-sm opacity-60 mb-4">Republishes the app's database security rules. This is what keeps guest posts waiting for approval hidden from everyone except their author and admins, even outside the app.</p>
                    <button type="button" onClick={publishSecurityRules} disabled={rulesBusy} className={`px-5 py-3 rounded-xl text-[0.7rem] font-black uppercase tracking-widest transition-colors ${rulesBusy ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-[var(--ann-accent)] text-white'}`}>{rulesBusy ? 'Publishing…' : 'Publish rules'}</button>
                  </div>
                  )}
                </div>
              )}
              
              {activeAdminTab === 'settings' && (
                <div className="space-y-8">
                  <div className={`rounded-[20px] p-5 border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                    <h3 className="font-black font-display text-lg mb-1">Guest access code</h3>
                    <p className="text-sm opacity-60 mb-4">One code for everything: guests enter it to post, and the same code opens the private feed when the feed is private. Revoking wipes it everywhere at once, live.</p>
                    <div className="flex items-center gap-3 flex-wrap mb-4">
                      <b className="font-display text-2xl tracking-[0.2em]">{activeCode || 'No code set'}</b>
                      {activeCode && (
                        <button type="button" onClick={() => { navigator.clipboard?.writeText(activeCode || ''); showToast('Access code copied'); }} className="px-4 py-2 rounded-full border border-[#DAD8E3] dark:border-[#22363E] text-[0.65rem] font-black uppercase tracking-widest">Copy</button>
                      )}
                      {adminPermissions?.canSetAccessCode && activeCode && (
                        <button type="button" onClick={() => { if (revokeArmed) { setRevokeArmed(false); revokeAccessCode(); } else { setRevokeArmed(true); window.setTimeout(() => setRevokeArmed(false), 3000); } }} className={`px-5 py-2.5 rounded-xl text-[0.7rem] font-black uppercase tracking-widest transition-colors ${revokeArmed ? 'bg-red-500 text-white border border-red-500' : 'border border-red-400 text-red-500 hover:bg-red-500/10'}`}>{revokeArmed ? 'Tap again to revoke' : 'Revoke'}</button>
                      )}
                    </div>
                    {!activeCode && (
                      <p className="text-sm mb-4 text-red-500">No code is set. Guests cannot post and the private feed stays locked until you set a new code.</p>
                    )}
                    {adminPermissions?.canSetAccessCode && (
                      <div>
                        <span className="block text-[0.65rem] font-black uppercase tracking-widest opacity-50 mb-1.5">Set your own code</span>
                        <div className="flex gap-2 flex-wrap">
                          <input type="text" value={newCode} maxLength={20} onChange={(e) => { const val = e.target.value.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase(); setNewCode(val); setIsDirty(true); }} placeholder="E.G. DARAFEMI26" className={`${inputCls} flex-1 min-w-[200px] tracking-widest`} />
                          <button onClick={async () => { await onUpdateCode(newCode); setIsDirty(false); }} disabled={!canSaveCode} className={`px-5 py-3 rounded-xl text-[0.7rem] font-black uppercase tracking-widest ${canSaveCode ? 'bg-[var(--ann-accent)] text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>Save code</button>
                                                  </div>
                        <p className="text-[0.7rem] opacity-50 mt-2">4 to 16 letters or numbers. Changing it stops the old code working.</p>
                      </div>
                    )}
                  </div>
                  <div className={`rounded-[20px] p-5 border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                    <h3 className="font-black font-display text-lg mb-1">QR code</h3>
                    <p className="text-sm opacity-60 mb-4">Print this on your banner or programme. Guests scan it at your event and land straight in the app, no link to type. Download it and send it to your printer or banner designer.</p>
                    <div className="flex items-start gap-4 flex-wrap">
                      <div className={`rounded-2xl p-3 ${isDarkMode ? 'bg-white' : 'bg-white border border-[#DAD8E3]'}`}>
                        {qrDataUrl ? (
                          <img src={qrDataUrl} alt="Your app QR code" width={148} height={148} className="block" />
                        ) : (
                          <div className="w-[148px] h-[148px] flex items-center justify-center text-xs opacity-40">Making QR…</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex gap-2 flex-wrap">
                          <button type="button" onClick={() => { navigator.clipboard?.writeText(qrUrl || ''); showToast('App link copied'); setQrDone('copied'); window.setTimeout(() => setQrDone((cur) => (cur === 'copied' ? '' : cur)), 1800); }} className={`px-4 py-2 rounded-full border text-[0.65rem] font-black uppercase tracking-widest transition-colors ${qrDone === 'copied' ? 'bg-[var(--ann-accent)] text-white border-[var(--ann-accent)]' : 'border-[#DAD8E3] dark:border-[#22363E]'}`}>{qrDone === 'copied' ? 'Copied' : 'Copy link'}</button>
                          <button type="button" onClick={downloadQrPng} disabled={!qrDataUrl || qrBusy !== ''} className="px-4 py-2 rounded-full bg-[var(--ann-accent)] text-white text-[0.65rem] font-black uppercase tracking-widest disabled:opacity-40">{qrBusy === 'png' ? 'Saving…' : qrDone === 'png' ? 'Saved' : 'Save as image'}</button>
                          <button type="button" onClick={downloadQrPdf} disabled={!qrDataUrl || qrBusy !== ''} className="px-4 py-2 rounded-full border border-[var(--ann-accent)] text-[var(--ann-accent)] text-[0.65rem] font-black uppercase tracking-widest disabled:opacity-40">{qrBusy === 'pdf' ? 'Building PDF…' : qrDone === 'pdf' ? 'Saved' : 'Save as PDF'}</button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={`rounded-[20px] p-5 border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                    <h3 className="font-black font-display text-lg mb-4">Behaviour</h3>
                    <div className="space-y-4">
                      {([['approve', 'Approve guest posts first', 'New guest posts stay hidden until you approve them. Vendors skip this.', approveGuestPosts], ['push', 'Push notifications', 'Get a notification on this device when someone posts or comments.', pushEnabled], ['archive', 'Archive mode after the wedding', 'Keeps every memory viewable for life but stops new posts and comments.', archiveMode], ['private', 'Public feed', 'Toggle off keeps the feed private: the feed page shows a banner and guests enter your guest access code to see posts and reels. Revoking the code locks the feed again live.', !feedPrivate]] as [string, string, string, boolean][]).map(([k, label, sub, on]) => {
                        const archiveLocked = k === 'archive' && feedPrivate;
                        return (
                        <div key={k} className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <b className="block text-[0.95rem]">{label}</b>
                            <small className="block opacity-50 text-sm">{archiveLocked ? `${sub} Turn the feed public first.` : sub}</small>
                          </div>
                          <button type="button" aria-label={label} disabled={archiveLocked} onClick={() => k === 'private' ? updateFeedPrivacy(!on) : onUpdateAppFlags(k === 'approve' ? { approveGuestPosts: !on } : k === 'push' ? { pushEnabled: !on } : { archiveMode: !on }, `${label}: ${on ? 'off' : 'on'}.`)} className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${on ? 'bg-[var(--ann-accent)]' : 'bg-black/20 dark:bg-white/20'} ${archiveLocked ? 'opacity-40 cursor-not-allowed' : ''}`}>
                            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${on ? 'left-6' : 'left-1'}`} />
                          </button>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* Storage: how far this app's photos and videos have gone
                      against the plan's allowance (Eventicor platform settings),
                      with the upgrade flow when the space runs out. */}
                  <div className={`rounded-[20px] p-5 border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                    <h3 className="font-black font-display text-lg mb-1">Storage</h3>
                    <p className="text-sm opacity-60 mb-4">How much of your plan's photo and video storage the app has used. When it is full, new uploads are stopped until you upgrade.</p>
                    <div className="flex items-baseline justify-between mb-2 flex-wrap gap-1">
                      <b className="text-[0.95rem]">{(planGB ? planGB.toFixed(planGB >= 10 ? 0 : 1) : '0')} GB plan</b>
                      <small className="opacity-50 text-sm">{usedGB >= 0.01 ? usedGB.toFixed(usedGB >= 10 ? 1 : 2) : '0.00'} GB used · {(freeBytes / 1073741824).toFixed(freeBytes / 1073741824 >= 10 ? 0 : 2)} GB left</small>
                    </div>
                    <div className="flex h-4 rounded-full overflow-hidden" style={{ background: isDarkMode ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)' }}>
                      {usedBytes > 0 && <div style={{ width: `${Math.min(100, (imagesGB / Math.max(planGB, 0.01)) * 100)}%`, background: 'var(--ann-accent)' }} title={`Photos: ${imagesGB.toFixed(2)} GB`} />}
                      {videosGB > 0 && <div style={{ width: `${Math.min(100 - Math.min(100, (imagesGB / Math.max(planGB, 0.01)) * 100), (videosGB / Math.max(planGB, 0.01)) * 100)}%`, background: 'color-mix(in srgb, var(--ann-accent) 55%, #7a4b9e)' }} title={`Videos: ${videosGB.toFixed(2)} GB`} />}
                    </div>
                    <div className="flex gap-4 mt-3 flex-wrap text-[0.8rem]">
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: 'var(--ann-accent)' }} /> Photos {imagesGB >= 0.01 ? imagesGB.toFixed(2) : '0.00'} GB</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: 'color-mix(in srgb, var(--ann-accent) 55%, #7a4b9e)' }} /> Videos {videosGB >= 0.01 ? videosGB.toFixed(2) : '0.00'} GB</span>
                      <span className="opacity-50">Balance {(freeBytes / 1073741824) >= 0.01 ? (freeBytes / 1073741824).toFixed(2) : '0.00'} GB</span>
                    </div>
                    {usageRec?.syncedAt && (() => {
                      const t = usageRec.syncedAt?.seconds ? usageRec.syncedAt.seconds * 1000 : (usageRec.syncedAt instanceof Date ? usageRec.syncedAt.getTime() : null);
                      return t ? <small className="opacity-40 text-[0.7rem] block mt-1">Checked against Cloudinary · {new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</small> : null;
                    })()}
                    {storageFull && (
                      <p className="mt-3 text-[0.85rem]" style={{ color: '#b3261e', fontWeight: 700 }}>Your storage is full. Guests cannot post new photos or videos, and you cannot upload any, until you upgrade.</p>
                    )}
                    <button type="button" onClick={() => setUpgradeOpen(true)} className="mt-4 w-full py-3.5 rounded-full bg-[var(--ann-accent)] text-white text-[0.7rem] font-black uppercase tracking-widest">
                      {storageFull ? 'Upgrade to keep uploading' : 'Upgrade your plan'}
                    </button>
                  </div>
                  <div className={`rounded-[20px] p-5 border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]'}`}>
                    <h3 className="font-black font-display text-lg mb-4">Keep the memories</h3>
                    <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                      <div className="min-w-0">
                        <b className="block text-[0.95rem]">Download everything</b>
                        <small className="block opacity-50 text-sm">Every photo and video in one zip, organised by event.</small>
                      </div>
                      <button onClick={onDownloadEverything} className="px-5 py-3 rounded-full bg-[var(--ann-accent)] text-white text-[0.7rem] font-black uppercase tracking-widest shrink-0">Download</button>
                    </div>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <b className="block text-[0.95rem]">Memory book</b>
                        <small className="block opacity-50 text-sm">A printable PDF of the best posts and wishes.</small>
                      </div>
                      <button onClick={onCreateMemoryBook} className="px-5 py-3 rounded-full border border-[#DAD8E3] dark:border-[#22363E] text-[0.7rem] font-black uppercase tracking-widest shrink-0">Create</button>
                    </div>
                  </div>
                  <div className="rounded-[20px] p-5 border border-[#C4453B]/40">
                    <h3 className="font-black font-display text-lg mb-1 text-[#C4453B]">Danger zone</h3>
                    <p className="text-sm opacity-60 mb-3">Delete every guest post and wish. This cannot be undone.</p>
                    <div className="flex gap-2 flex-wrap">
                      <input value={dangerText} onChange={(e) => setDangerText(e.target.value.toUpperCase())} placeholder="TYPE DELETE" className={`${inputCls} max-w-[220px]`} />
                      <button disabled={dangerText !== 'DELETE' || deleteAllBusy} onClick={async () => { setDeleteAllBusy(true); try { await onDeleteAllGuestData(); setDangerText(''); } finally { setDeleteAllBusy(false); } }} className="px-5 py-3 rounded-full bg-[#C4453B] text-white text-[0.7rem] font-black uppercase tracking-widest disabled:opacity-40">Delete everything</button>
                    </div>
                  </div>
                </div>
              )}

              {activeAdminTab === 'ads' && isSuper && (
                <div className="space-y-6">
                  {/* Segmented selector for Post Ads vs Reel Video Ads */}
                  <div className={`flex p-1 rounded-2xl border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-[#EEEDF3] border-[#DAD8E3]'}`}>
                    <button
                      onClick={() => {
                        setAdTypeTab('post');
                        resetAdForm('post');
                      }}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                        adTypeTab === 'post' ? 'bg-[var(--ann-accent)] text-white shadow-sm' : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      Post Feed Ads ({postAds.length})
                    </button>
                    <button
                      onClick={() => {
                        setAdTypeTab('reel');
                        resetAdForm('reel');
                      }}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                        adTypeTab === 'reel' ? 'bg-[var(--ann-accent)] text-white shadow-sm' : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      Reels Video Ads ({reelAds.length})
                    </button>
                  </div>

                  <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-[#F8F8FA] border-[#DAD8E3]'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-black uppercase tracking-widest text-[var(--ann-accent)]">
                        {editingAdId
                          ? `Edit ${adTypeTab === 'post' ? 'Post Ad' : 'Reel Video Ad'}`
                          : (adTypeTab === 'post' ? 'Create Post Ad (Every 5 Posts · Shuffled)' : 'Create Reel Video Ad (Every 3 Reels)')}
                      </h4>
                      {editingAdId && (
                        <button
                          type="button"
                          onClick={() => resetAdForm(adTypeTab)}
                          className="text-[10px] font-black uppercase tracking-wider text-red-500 hover:underline"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Sponsor / Business Name *"
                        value={adSponsor}
                        onChange={(e) => setAdSponsor(e.target.value)}
                        className={`w-full p-3 rounded-xl border-none outline-none text-sm font-bold ${isDarkMode ? 'bg-[#13232A] text-white' : 'bg-white text-[#14262D]'}`}
                      />
                      <input
                        type="text"
                        placeholder="Ad Headline *"
                        value={adHeadline}
                        onChange={(e) => setAdHeadline(e.target.value)}
                        className={`w-full p-3 rounded-xl border-none outline-none text-sm font-medium ${isDarkMode ? 'bg-[#13232A] text-white' : 'bg-white text-[#14262D]'}`}
                      />
                      <textarea
                        placeholder="Short description (optional)"
                        rows={2}
                        value={adDescription}
                        onChange={(e) => setAdDescription(e.target.value)}
                        className={`w-full p-3 rounded-xl border-none outline-none text-sm resize-none ${isDarkMode ? 'bg-[#13232A] text-white' : 'bg-white text-[#14262D]'}`}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Button Text (e.g. Learn More)"
                          value={adCtaText}
                          onChange={(e) => setAdCtaText(e.target.value)}
                          className={`w-full p-3 rounded-xl border-none outline-none text-xs font-bold ${isDarkMode ? 'bg-[#13232A] text-white' : 'bg-white text-[#14262D]'}`}
                        />
                        <input
                          type="url"
                          placeholder="Link URL (https://...)"
                          value={adCtaUrl}
                          onChange={(e) => setAdCtaUrl(e.target.value)}
                          className={`w-full p-3 rounded-xl border-none outline-none text-xs font-medium ${isDarkMode ? 'bg-[#13232A] text-white' : 'bg-white text-[#14262D]'}`}
                        />
                      </div>

                      {/* Media Upload (Multiple images supported for Post Ads) */}
                      <div className="pt-1">
                        <label className={`w-full py-3 px-4 rounded-xl border-2 border-dashed border-[var(--ann-accent)]/40 flex items-center justify-center gap-2 cursor-pointer hover:bg-[var(--ann-accent)]/5 transition-colors text-xs font-bold text-[var(--ann-accent)]`}>
                          <input
                            type="file"
                            multiple={adTypeTab === 'post'}
                            accept={adTypeTab === 'reel' ? 'video/*' : 'image/*,video/*'}
                            className="hidden"
                            disabled={isAdUploading}
                            onChange={async (e) => {
                              const files = Array.from(e.target.files || []) as File[];
                              if (files.length === 0) return;
                              setIsAdUploading(true);
                              try {
                                if (adTypeTab === 'reel') {
                                  const file = files[0];
                                  const isVid = Boolean(file.type && file.type.startsWith('video/'));
                                  if (!isVid) {
                                    showToast('Reels ads require a video file.', 'error');
                                    setIsAdUploading(false);
                                    return;
                                  }
                                  const uploadedUrl = await uploadToCloudinary(file as any, 'ads');
                                  setAdMediaUrls([uploadedUrl]);
                                  setAdMediaTypes(['video']);
                                  showToast('Reel video ad uploaded!');
                                } else {
                                  const newUrls: string[] = [];
                                  const newTypes: ('image' | 'video')[] = [];
                                  for (const file of files) {
                                    const isVid = Boolean(file.type && file.type.startsWith('video/'));
                                    const uploadedUrl = await uploadToCloudinary(file as any, 'ads');
                                    newUrls.push(uploadedUrl);
                                    newTypes.push(isVid ? 'video' : 'image');
                                  }
                                  setAdMediaUrls(prev => [...prev, ...newUrls]);
                                  setAdMediaTypes(prev => [...prev, ...newTypes]);
                                  showToast(`${newUrls.length} media file${newUrls.length > 1 ? 's' : ''} uploaded!`);
                                }
                              } catch (err: any) {
                                console.error('Ad upload error:', err);
                                showToast(err?.message || 'Failed to upload ad media.', 'error');
                              } finally {
                                setIsAdUploading(false);
                                e.target.value = '';
                              }
                            }}
                          />
                          {isAdUploading ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Uploading Media...</span>
                            </>
                          ) : (
                            <>
                              {adTypeTab === 'reel' ? <VideoIcon className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                              <span>
                                {adTypeTab === 'reel'
                                  ? (adMediaUrls.length > 0 ? 'Replace Portrait Video Ad' : 'Upload Portrait Video Ad *')
                                  : (adMediaUrls.length > 0 ? `Add More Images / Media (${adMediaUrls.length} attached)` : 'Upload Ad Images (Multiple) or Video *')}
                              </span>
                            </>
                          )}
                        </label>

                        {adMediaUrls.length > 0 && (
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            {adMediaUrls.map((url, i) => {
                              const type = adMediaTypes[i] || (url.toLowerCase().includes('.mp4') || url.includes('/video/') ? 'video' : 'image');
                              return (
                                <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-[#DAD8E3] dark:border-[#22363E] bg-black flex items-center justify-center group">
                                  {type === 'video' ? (
                                    <video src={url} className="w-full h-full object-cover" muted playsInline />
                                  ) : (
                                    <img src={url} className="w-full h-full object-cover" alt={`Ad media ${i + 1}`} />
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAdMediaUrls(prev => prev.filter((_, idx) => idx !== i));
                                      setAdMediaTypes(prev => prev.filter((_, idx) => idx !== i));
                                    }}
                                    className="absolute top-1 right-1 p-1 bg-black/70 text-white rounded-full hover:bg-red-500 transition-colors"
                                    title="Remove media"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <button
                        disabled={!adSponsor.trim() || !adHeadline.trim() || adMediaUrls.length === 0 || isAdUploading}
                        onClick={async () => {
                          const primaryType = adTypeTab === 'reel'
                            ? 'video'
                            : (adMediaTypes[0] || 'image');

                          const adPayload: AdItem = {
                            id: editingAdId || `ad_${Date.now()}`,
                            sponsorName: adSponsor.trim(),
                            headline: adHeadline.trim(),
                            description: adDescription.trim(),
                            mediaUrl: adMediaUrls[0],
                            mediaUrls: adMediaUrls,
                            mediaType: primaryType,
                            mediaTypes: adMediaTypes,
                            ctaText: adCtaText.trim() || 'Learn More',
                            ctaUrl: formatExternalUrl(adCtaUrl),
                            createdAt: Date.now()
                          };

                          if (adTypeTab === 'post') {
                            const updatedList = editingAdId
                              ? postAds.map((a: AdItem) => a.id === editingAdId ? adPayload : a)
                              : [...postAds, adPayload];
                            await onUpdatePostAds(updatedList);
                          } else {
                            const updatedList = editingAdId
                              ? reelAds.map((a: AdItem) => a.id === editingAdId ? adPayload : a)
                              : [...reelAds, adPayload];
                            await onUpdateReelAds(updatedList);
                          }

                          resetAdForm(adTypeTab);
                        }}
                        className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                          adSponsor.trim() && adHeadline.trim() && adMediaUrls.length > 0 && !isAdUploading
                            ? 'bg-[var(--ann-accent)] text-white shadow-lg hover:opacity-95'
                            : 'bg-slate-200 dark:bg-white/10 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {editingAdId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        <span>
                          {editingAdId
                            ? `Save Changes to ${adTypeTab === 'post' ? 'Post Ad' : 'Reel Video Ad'}`
                            : `Publish ${adTypeTab === 'post' ? 'Post Ad' : 'Reel Video Ad'}`}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Active Ads List */}
                  <div className="space-y-3">
                    <h4 className="text-[0.7rem] uppercase tracking-widest font-black opacity-50">
                      Active {adTypeTab === 'post' ? 'Post Feed Ads (Shuffled every 5 posts)' : 'Reels Video Ads (Placed every 3 reels)'}
                    </h4>

                    {(adTypeTab === 'post' ? postAds : reelAds).length === 0 ? (
                      <div className="py-8 text-center opacity-40 text-xs font-bold">
                        No {adTypeTab === 'post' ? 'post ads' : 'reel video ads'} active yet.
                      </div>
                    ) : (
                      (adTypeTab === 'post' ? postAds : reelAds).map((ad: AdItem) => {
                        const adUrls = ad.mediaUrls && ad.mediaUrls.length > 0 ? ad.mediaUrls : (ad.mediaUrl ? [ad.mediaUrl] : []);
                        const isBeingEdited = editingAdId === ad.id;
                        return (
                          <div
                            key={ad.id}
                            className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                              isBeingEdited
                                ? 'border-[var(--ann-accent)] ring-2 ring-[var(--ann-accent)]/20 bg-[var(--ann-accent)]/5'
                                : (isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-white border-[#DAD8E3]')
                            }`}
                          >
                            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-black shrink-0 border border-white/10">
                              {ad.mediaType === 'video' ? (
                                <video src={adUrls[0]} className="w-full h-full object-cover" muted playsInline />
                              ) : (
                                <img src={adUrls[0]} className="w-full h-full object-cover" alt="" />
                              )}
                              {adUrls.length > 1 && (
                                <span className="absolute bottom-0.5 right-0.5 px-1.5 py-0.2 rounded bg-black/80 text-white text-[9px] font-black">
                                  +{adUrls.length - 1}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] font-black uppercase tracking-wider text-[#C9A24B] block">
                                {ad.sponsorName}
                              </span>
                              <strong className="text-sm block truncate">{ad.headline}</strong>
                              {ad.ctaUrl && (
                                <span className="text-[11px] opacity-50 block truncate">{ad.ctaUrl}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingAdId(ad.id);
                                  setAdSponsor(ad.sponsorName || '');
                                  setAdHeadline(ad.headline || '');
                                  setAdDescription(ad.description || '');
                                  setAdCtaText(ad.ctaText || 'Learn More');
                                  setAdCtaUrl(ad.ctaUrl || '');
                                  const urls = ad.mediaUrls && ad.mediaUrls.length > 0 ? ad.mediaUrls : (ad.mediaUrl ? [ad.mediaUrl] : []);
                                  setAdMediaUrls(urls);
                                  setAdMediaTypes(
                                    ad.mediaTypes && ad.mediaTypes.length === urls.length
                                      ? ad.mediaTypes
                                      : urls.map((u) => (ad.mediaType === 'video' || u.toLowerCase().includes('.mp4') || u.includes('/video/') ? 'video' : 'image'))
                                  );
                                }}
                                className="p-2 text-[var(--ann-accent)] hover:bg-[var(--ann-accent)]/10 rounded-xl transition-colors"
                                title="Edit Ad"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (editingAdId === ad.id) {
                                    resetAdForm(adTypeTab);
                                  }
                                  if (adTypeTab === 'post') {
                                    await onUpdatePostAds(postAds.filter((a: AdItem) => a.id !== ad.id));
                                  } else {
                                    await onUpdateReelAds(reelAds.filter((a: AdItem) => a.id !== ad.id));
                                  }
                                }}
                                className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                                title="Remove Ad"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {activeAdminTab === 'recycle' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[0.7rem] uppercase tracking-widest font-black opacity-50">Recycle Bin (3 Day Retention)</h4>
                    <span className="text-[10px] font-bold opacity-30">{deletedPosts.length} items</span>
                  </div>
                  
                  {deletedPosts.length === 0 && (
                    <div className="py-12 text-center opacity-20">
                      <Trash className="w-12 h-12 mx-auto mb-3" />
                      <p className="text-xs font-black uppercase tracking-widest">Bin is empty</p>
                    </div>
                  )}

                  {deletedPosts.map((dp) => {
                    const d: any = dp.postData || dp;
                    return (
                    <div key={dp.id} className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-[#0B171C] border-[#22363E]' : 'bg-[#F8F8FA] border-[#DAD8E3]'}`}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate mb-1">By {d.authorName || 'a guest'}</p>
                          <p className="text-[10px] opacity-40 line-clamp-2">{d.text || d.caption || ''}</p>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <button 
                            onClick={() => setBinConfirm({ id: dp.id, action: 'restore' })}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[var(--ann-accent)] text-white rounded-xl shadow-sm text-[0.65rem] font-black uppercase tracking-widest active:scale-95 transition-transform"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Restore
                          </button>
                          <button 
                            onClick={() => setBinConfirm({ id: dp.id, action: 'remove' })}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-red-500 text-white rounded-xl shadow-sm text-[0.65rem] font-black uppercase tracking-widest active:scale-95 transition-transform"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-30 text-[9px] font-black uppercase tracking-widest pt-2 border-t border-black/5">
                        <span>Deleted {new Date(dp.deletedAt?.toDate?.() || Date.now()).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>By {dp.deletedBy || 'admin'}</span>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}

              {binConfirm && (
                <div className="fixed inset-0 z-[140] grid place-items-center bg-black/60 p-6" onClick={() => setBinConfirm(null)}>
                  <div className={`w-full max-w-sm rounded-[24px] p-6 shadow-2xl ${isDarkMode ? 'bg-[#0B171C] text-white' : 'bg-white text-[#14262D]'}`} onClick={(e) => e.stopPropagation()}>
                    <h3 className="font-display font-black text-xl mb-2">{binConfirm.action === 'restore' ? 'Restore this memory?' : 'Remove this memory forever?'}</h3>
                    <p className="text-sm opacity-60 mb-6">{binConfirm.action === 'restore' ? 'It goes back to the feed exactly as it was.' : 'This deletes it permanently. It cannot be undone.'}</p>
                    <div className="flex gap-3">
                      <button onClick={() => setBinConfirm(null)} className="flex-1 py-3 rounded-xl border border-[#DAD8E3] dark:border-[#22363E] text-[0.7rem] font-black uppercase tracking-widest">Cancel</button>
                      <button onClick={async () => { const target = binConfirm; setBinConfirm(null); if (target.action === 'restore') { await onRestorePost(target.id); showToast('Memory restored.', 'success'); } else { await onPermanentDelete(target.id); showToast('Removed permanently.', 'success'); } }} className={`flex-1 py-3 rounded-xl text-[0.7rem] font-black uppercase tracking-widest text-white ${binConfirm.action === 'restore' ? 'bg-[var(--ann-accent)]' : 'bg-red-500'}`}>{binConfirm.action === 'restore' ? 'Restore' : 'Remove'}</button>
                    </div>
                  </div>
                </div>
              )}
              {/* Admin preview: watch a video or view a photo from All posts full-screen. */}
              {adminViewerPost && (
                <MediaLightbox post={adminViewerPost} initialIndex={0} isDarkMode={isDarkMode} onClose={() => setAdminViewerPost(null)} />
              )}
              {/* Storage > Upgrade: the plan chooser over the dashboard. */}
              {paymentPanel}
              {/* Latest activity popup: the recorded activity, newest first,
                  capped at the last 30 records. */}
              {activityOpen && (
                <div className="fixed inset-0 z-[380] flex items-center justify-center p-4" style={{ background: 'rgba(10,10,22,.6)' }} onClick={(e) => { if (e.target === e.currentTarget) setActivityOpen(false) }}>
                  <div className="relative w-full max-w-md max-h-[80vh] overflow-y-auto rounded-[24px] p-6" style={{ background: isDarkMode ? '#0B171C' : '#fff' }} onClick={(e) => e.stopPropagation()}>
                    <button type="button" aria-label="Close" onClick={() => setActivityOpen(false)} className="absolute right-4 top-4 w-9 h-9 rounded-full border border-[#DAD8E3] text-[#5A6970] flex items-center justify-center font-black">×</button>
                    <h3 className="font-black font-display text-xl mb-1 pr-10">Latest activity</h3>
                    <p className="text-sm opacity-60 mb-4">Everything recorded in your app, newest first. Only the last 30 records are kept.</p>
                    <div className="space-y-3">
                      {realPosts.slice(0, 30).map((p: any) => {
                        const t = p.timestamp?.toDate ? p.timestamp.toDate() : (p.createdAt?.toDate ? p.createdAt.toDate() : null);
                        return (
                          <div key={p.id} className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[var(--ann-accent)]/15 text-[var(--ann-accent)] flex items-center justify-center font-black shrink-0">{(p.authorName || 'G').charAt(0).toUpperCase()}</div>
                            <div className="min-w-0">
                              <p className="font-bold text-[0.92rem]">{p.authorName || 'A guest'} shared a memory</p>
                              <small className="block opacity-50 truncate">{p.text || p.caption || 'Photo or video post'}</small>
                              {t && <small className="block opacity-40 text-[0.72rem]">{t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</small>}
                            </div>
                          </div>
                        );
                      })}
                      {realPosts.length === 0 && <p className="opacity-50 text-sm">Nothing recorded yet.</p>}
                      {realPosts.length > 30 && <p className="opacity-40 text-xs pt-2">Older records than these 30 are not kept.</p>}
                    </div>
                  </div>
                </div>
              )}
              {/* Branded confirmation shared by every delete action in the dashboard. */}
              <DeleteConfirmationModal
                isOpen={!!confirmAsk}
                onClose={() => setConfirmAsk(null)}
                onConfirm={() => { const ask = confirmAsk; setConfirmAsk(null); if (ask) ask.action(); }}
                isDarkMode={isDarkMode}
                title={confirmAsk?.title}
                message={confirmAsk?.message}
                confirmLabel={confirmAsk?.confirmLabel}
              />
              </TabErrorBoundary>
            </div>

            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface FloatingPhotoCardProps {
  images: string[];
  imgOffset: number;
  slot: number;
  column: number;
  constraintsRef: React.RefObject<HTMLDivElement | null>;
  eventNames?: string[];
}

// Hero runs as a 2x2 grid: two cards in the upper half, two in the lower half, at all times.
// Each column is a conveyor of four slots spaced half a screen apart; as the top card of a
// column clears the top it wraps to the bottom, so the grid never empties.
// Cards are purely decorative: no drag and no tap handlers, so touching one can never move,
// hide or dislodge it, and the page always scrolls normally over the hero.
const HERO_TRAVERSE_SECONDS = 11; // Time for one card to travel one screen height

const FloatingPhotoCard: React.FC<FloatingPhotoCardProps> = ({ images, imgOffset, slot, column, constraintsRef, eventNames }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(1000);
  const initialized = useRef(false);
  const baseH = useRef(0);
  const pxPerSecond = useRef(0);
  const [imgIdx, setImgIdx] = useState(slot + imgOffset);
  const [shownImage, setShownImage] = useState<string>('');
  const prefersReducedMotion = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

  useAnimationFrame((_, delta) => {
    if (!constraintsRef.current || !cardRef.current) return;
    const containerHeight = constraintsRef.current.offsetHeight;
    if (containerHeight === 0) return;
    const cardHeight = cardRef.current.offsetHeight || 220;

    // Lane geometry is frozen from the first measured height. Live re-measuring
    // (mobile URL bars resizing, tab switches, reflow) used to shift the lanes
    // mid-flight and let cards pile onto each other; a frozen base keeps the
    // formation exact no matter how far the page is scrolled.
    if (!initialized.current) {
      baseH.current = containerHeight;
      pxPerSecond.current = (containerHeight + cardHeight) / HERO_TRAVERSE_SECONDS;
      y.set(baseH.current * 0.12 + slot * (baseH.current / 2));
      initialized.current = true;
    }

    const halfStep = baseH.current / 2;
    const cycleLength = halfStep * 4;
    const dt = Math.min(delta, 100) / 1000;
    const speedMultiplier = prefersReducedMotion ? 0.05 : 1.0;
    let nextY = y.get() - (pxPerSecond.current * dt * speedMultiplier);

    if (nextY < -(cardHeight + 60)) {
      nextY += cycleLength;
      x.set(0);
      setImgIdx((prev) => (prev + 4) % Math.max(1, images.length));
    }

    y.set(nextY);
  });

  const currentImage = images.length > 0 ? images[imgIdx % images.length] : PLACEHOLDER_IMAGES[imgIdx % PLACEHOLDER_IMAGES.length];
  const caption = eventNames && eventNames.length > 0 ? eventNames[(imgIdx + imgOffset) % eventNames.length] : ((() => { const eds = eventsData(); return eds.length > 0 ? eds[(imgIdx + imgOffset) % eds.length].name : undefined; })());

  return (
    <motion.div
      ref={cardRef}
      initial={{ rotate: column === 0 ? (slot % 2 === 0 ? -4 : 3) : (slot % 2 === 0 ? 3 : -4) }}
      style={{
        left: column === 0 ? '6%' : '54%',
        width: 'clamp(140px, 46%, 280px)',
        position: 'absolute',
        x,
        y,
        zIndex: 10
      }}
    >
      <div className="bg-white p-2 pb-2 shadow-2xl shadow-black/20 rounded-sm">
        <div className="relative w-full h-[calc(32.5vh-80px)] sm:h-[calc(40vh-80px)] overflow-hidden pointer-events-none">
          {shownImage && shownImage !== currentImage && (
            <img src={shownImage} className="absolute inset-0 w-full h-full object-cover object-center" alt="" draggable={false} />
          )}
          <img
            src={currentImage}
            onLoad={() => setShownImage(currentImage)}
            className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-300 ${shownImage === currentImage ? 'opacity-100' : 'opacity-0'}`}
            alt=""
            draggable={false}
          />
        </div>
        {caption && (
          <p className="text-center text-[0.78rem] font-bold font-display text-[#14262D] pt-2 pb-1 leading-tight">{caption}</p>
        )}
      </div>
    </motion.div>
  );
}

// Live countdown to the wedding day, ticking every second; shown under the
// date and location inside the names banner.
// One countdown number as a tiny vertical odometer: the fresh figure rolls in
// from above and the previous one drops out below, so the figures visibly tick
// downward every time they change.
function RollNum({ value }: { value: string }) {
  const [state, setState] = useState<{ cur: string; prev: string | null }>({ cur: value, prev: null });
  useEffect(() => {
    setState((s) => (value === s.cur ? s : { cur: value, prev: s.cur }));
  }, [value]);
  useEffect(() => {
    if (!state.prev) return;
    const t = window.setTimeout(() => setState((s) => ({ ...s, prev: null })), 480);
    return () => window.clearTimeout(t);
  }, [state.prev]);
  return (
    <span className="cnt-cell">
      <span className="cnt-in" key={`in-${state.cur}`}>{state.cur}</span>
      {state.prev != null && (
        <span className="cnt-out" key={`out-${state.prev}-${state.cur}`}>{state.prev}</span>
      )}
    </span>
  );
}

function CountdownRow({ date, time }: { date: string; time: string }) {
  const target = new Date(`${date}T${time}:00`).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const left = Math.max(0, target - now);
  const d = Math.floor(left / 86400000);
  const h = Math.floor((left % 86400000) / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const sec = Math.floor((left % 60000) / 1000);
  const units: [string, string][] = [
    [String(d), 'Days'],
    [String(h).padStart(2, '0'), 'Hours'],
    [String(m).padStart(2, '0'), 'Mins'],
    [String(sec).padStart(2, '0'), 'Secs'],
  ];
  return (
    <div className="mt-3 pt-3 border-t border-white/25 flex items-stretch justify-center divide-x divide-white/20">
      {units.map(([v, l]) => (
        <div key={l} className="px-3 sm:px-4 text-center min-w-[52px]">
          <b className="block text-[1.05rem] font-serif-display leading-none tabular-nums"><RollNum value={v} /></b>
          <span className="block text-[0.6rem] uppercase tracking-wider opacity-75 mt-1">{l}</span>
        </div>
      ))}
    </div>
  );
}

// URLs already pulled into the browser cache this session; lets a remounted
// hero show its cards immediately instead of waiting on a fresh preload.
const heroPreloadedUrls = new Set<string>();

function FloatingHeroSection({ isDarkMode, images, eventNames, compact = false }: { isDarkMode: boolean, images: string[], eventNames?: string[], compact?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cardsReady, setCardsReady] = useState(false);

  const baseImages = images.length > 0 ? images : (DEMO ? DEMO_PHOTOS : PLACEHOLDER_IMAGES);
  const baseKey = baseImages.join('|');

  // Keep every hero image warm in the browser cache, and only mount the cards
  // once the first batch has loaded, so pictures never pop in or out.
  useEffect(() => {
    let cancelled = false;
    const missing = baseImages.filter((src: string) => !heroPreloadedUrls.has(src));
    if (missing.length === 0) {
      setCardsReady(true);
      return;
    }
    let doneCount = 0;
    missing.forEach((src: string) => {
      const img = new Image();
      const done = () => {
        heroPreloadedUrls.add(src);
        doneCount += 1;
        if (!cancelled && doneCount >= missing.length) setCardsReady(true);
      };
      img.onload = done;
      img.onerror = done;
      img.src = src;
    });
    const fallback = setTimeout(() => { if (!cancelled) setCardsReady(true); }, 2000);
    return () => { cancelled = true; clearTimeout(fallback); };
  }, [baseKey]);

  return (
    <section
      ref={containerRef}
      className={`relative overflow-hidden bg-[var(--ann-accent)] shadow-inner ${compact ? 'w-full h-[238px]' : 'w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] h-[65vh] sm:h-[80vh] mb-12'}`}
    >
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.2),transparent)]" />
      </div>

      <div className="absolute inset-0 overflow-hidden">
        {!cardsReady && (
          <div className="absolute inset-0 grid grid-cols-2 gap-[6%] px-[9%] py-[7%] pointer-events-none ev-hero-skel" aria-hidden="true">
            {[0, 1].map((c) => (
              <div key={c} className={`flex flex-col gap-[7%] ${c === 0 ? 'items-start -rotate-6 translate-y-3' : 'items-end rotate-6'}`}>
                {[0, 1, 2].map((r) => (
                  <div key={r} className={`ev-hero-skel-card w-[64%] ${r === 1 ? 'self-stretch' : ''} ${r === 2 ? 'w-[52%]' : ''}`} style={{ height: r === 1 ? '34%' : '30%' }} />
                ))}
              </div>
            ))}
          </div>
        )}
        {cardsReady && [0, 1].map((column) =>
          [0, 1, 2, 3].map((slot) => (
            <FloatingPhotoCard
              key={`hero-${column}-${slot}`}
              images={baseImages}
              imgOffset={column * 2}
              eventNames={eventNames}
              slot={slot}
              column={column}
              constraintsRef={containerRef}
            />
          ))
        )}
      </div>
    </section>
  );
}

function ProfilePromptModal({ isOpen, onClose, onGoToSettings, isDarkMode }: any) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-[150] backdrop-blur-sm"
          />
          <motion.div 
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[520px] z-[151] rounded-t-[32px] p-6 pt-4 pb-10 shadow-2xl text-center ${isDarkMode ? 'bg-[#13232A] border-t border-[#22363E]' : 'bg-white border-t border-[#DAD8E3]'}`}
          >
            <div className="w-12 h-1.5 bg-[#DAD8E3] dark:bg-[#22363E] rounded-full mx-auto mb-6" />
            <div className="w-20 h-20 rounded-full bg-[var(--ann-accent)]/10 text-[var(--ann-accent)] flex items-center justify-center mx-auto mb-6">
              <User className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-black font-display tracking-tight mb-2">Set up your profile</h3>
            <p className="text-sm opacity-60 mb-8">Please add your name and a profile picture before sharing memories with the guests.</p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={onGoToSettings}
                className="w-full py-4 rounded-full bg-[var(--ann-accent)] text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-[var(--ann-accent)]/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                Go to Settings
              </button>
              <button 
                onClick={onClose}
                className={`w-full py-4 rounded-full font-bold text-xs uppercase tracking-widest ${isDarkMode ? 'text-white/40' : 'text-[#5A6970]'}`}
              >
                Maybe later
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
