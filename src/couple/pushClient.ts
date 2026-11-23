// Web push plumbing for Eventicor couple apps. The service worker shows the
// notifications; the /api/push function stores subscriptions and sends them.
// Permission is only ever asked from an explicit user tap, never on its own.
import { APP_ID } from './lib/appScope';

let vapidKey: string | null = null;
async function getKey(): Promise<string> {
  if (vapidKey) return vapidKey;
  try { vapidKey = localStorage.getItem(`ev-vapid-${APP_ID}`); } catch { /* private mode */ }
  if (!vapidKey) {
    const r = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'key' }) });
    const j = await r.json().catch(() => null);
    if (j?.key) {
      vapidKey = j.key;
      try { localStorage.setItem(`ev-vapid-${APP_ID}`, j.key); } catch { /* private mode */ }
    }
  }
  if (!vapidKey) throw new Error('Push is not configured yet');
  return vapidKey;
}

const urlB64ToBytes = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

export type PushResult = 'granted' | 'denied' | 'unsupported';

// Registers the service worker (silent), asks for permission, subscribes this
// browser and stores the subscription with the app's /api/push endpoint.
export async function enablePush(role: 'admin' | 'guest', opts: { uid?: string; email?: string; token?: string } = {}): Promise<PushResult> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  const reg = await navigator.serviceWorker.register('/sw.js').catch(() => null);
  if (!reg) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  await navigator.serviceWorker.ready;
  const key = await getKey();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToBytes(key) });
  const json = sub.toJSON() as { endpoint?: string; keys?: Record<string, string> };
  await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'subscribe', appId: APP_ID, role, uid: opts.uid, email: opts.email, token: opts.token, subscription: { endpoint: json.endpoint, keys: json.keys } }) });
  return 'granted';
}

// Fired after every real post is created: feeds the 10-posts admin notification.
export function pingPostCreated() {
  fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'post-created', appId: APP_ID }) }).catch(() => {});
}

// Fired after an admin approves a post: the author hears back if subscribed.
export function pingPostApproved(postId: string, token: string) {
  fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'post-approved', appId: APP_ID, postId, token }) }).catch(() => {});
}
