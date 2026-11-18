import { lazy, Suspense, useEffect, useState } from 'react';

const AnniversaryPortal = lazy(() => import('./AnniversaryPortal'));

// Six Eventicor accents, mapped onto the couple app's palette.
const ACCENTS: Record<string, { accent: string; hero: string; soft: string }> = {
  midnight: { accent: '#14122b', hero: '#0a0917', soft: '#e9e6f2' },
  blush:    { accent: '#d6285f', hero: '#8f1c42', soft: '#fbe1e8' },
  emerald:  { accent: '#0c4a36', hero: '#07301f', soft: '#e4efe7' },
  royal:    { accent: '#2236b4', hero: '#151f63', soft: '#e6eaf9' },
  sunset:   { accent: '#e07a4f', hero: '#2b1a12', soft: '#fdeedd' },
  sage:     { accent: '#2e5c45', hero: '#1f2b25', soft: '#eef5ef' },
};
const TPL_ACCENT: Record<string, string> = { classic: 'midnight', halo: 'blush', hero: 'emerald', book: 'royal' };

// Sample apps are marketing leads an admin shares by hand. Their link carries
// its own 3-day expiry (?exp=unix seconds) plus the lead id (?lead=), so a
// lead needs no email: it opens on its own, shows the admin's uploaded
// placeholder images and names, and after 3 days it points back to the
// Eventicor landing page to create their own app.
interface LeadData { bride?: string; groom?: string; city?: string; email?: string; source?: string; heroImages?: string[]; footerImages?: string[]; feedImages?: string[]; expiresAt?: number }

async function loadLead(id: string): Promise<LeadData | null> {
  // Sample apps built in the demo console live in this browser only.
  try {
    const ls = localStorage.getItem(`ev-lead-${id}`);
    if (ls) {
      const j = JSON.parse(ls);
      if (j && (j.bride || j.title)) return j;
    }
  } catch { /* ignore */ }
  // Real console leads live in Firestore and must open on any device.
  try {
    const { db } = await import('../firebase');
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db as any, 'leads', id));
    if (snap.exists()) return snap.data() as LeadData;
  } catch { /* rules or offline: fall back to the generic demo */ }
  return null;
}

function SampleExpired({ accent }: { accent: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 28, background: '#faf7f2' }}>
      <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 38, lineHeight: 1.1, color: accent, fontWeight: 600 }}>
        This sample has expired
      </div>
      <p style={{ color: '#5a6970', maxWidth: 330, marginTop: 14, lineHeight: 1.55, fontSize: 15 }}>
        Eventicor sample apps stay live for 3 days. This one was just a preview of what yours could look like.
      </p>
      <a href="/" style={{ marginTop: 24, background: accent, color: '#fff', textDecoration: 'none', padding: '14px 26px', borderRadius: 999, fontWeight: 700, fontSize: 14, letterSpacing: '.05em' }}>
        CREATE YOUR OWN APP
      </a>
      <small style={{ color: '#93a4ab', marginTop: 16, fontSize: 12 }}>eventicor.name.ng</small>
    </div>
  );
}

function SampleChip({ exp, trial }: { exp: number; trial?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);
  const ms = Math.max(0, exp * 1000 - now);
  const d = Math.floor(ms / 864e5);
  const h = Math.floor((ms % 864e5) / 36e5);
  const m = Math.floor((ms % 36e5) / 6e4);
  const label = d > 0 ? `${d}d ${h}h left` : h > 0 ? `${h}h ${m}m left` : m > 0 ? `${m}m left` : 'expired';
  return (
    <div style={{ position: 'fixed', left: 12, bottom: 112, zIndex: 60, background: 'rgba(10,10,22,.72)', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '.07em', padding: '6px 12px', borderRadius: 999, pointerEvents: 'none', textTransform: 'uppercase' }}>
      {trial ? 'Free trial' : 'Sample app'} · {label}
    </div>
  );
}


// Floating helper on every sample app: one small button on the right edge,
// over every section. It explains that everything on the app is placeholder
// data and points the lead at the Eventicor website and the WhatsApp community.
const SAMPLE_SITE_URL = 'https://eventicor.name.ng';
const SAMPLE_COMMUNITY_URL = 'https://chat.whatsapp.com/KfSanIyOEU75q1bBvpqH31?s=sh&p=a&iam=2';

function SampleInfoButton({ accent, selfServe }: { accent: string; selfServe?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="About this sample app"
        style={{
          position: 'fixed', right: 12, bottom: 112, zIndex: 90, width: 40, height: 40,
          borderRadius: 999, border: 'none', cursor: 'pointer', padding: 0,
          background: 'rgba(10,10,22,.72)', color: '#fff', display: 'grid', placeItems: 'center',
          fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 19, fontWeight: 700,
          boxShadow: '0 4px 14px rgba(10,10,22,.35)',
        }}
      >
        i
      </button>
    );
  }
  return (
    <>
      <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 299, background: 'rgba(6,6,14,.55)' }} />
      <div
        role="dialog"
        aria-label="About this sample app"
        style={{
          position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', zIndex: 300,
          width: 'min(340px, calc(100vw - 40px))', background: '#fff', borderRadius: 24,
          padding: '26px 22px 20px', textAlign: 'center', boxShadow: '0 24px 60px rgba(6,6,14,.45)',
        }}
      >
        <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 22, fontWeight: 600, color: accent, lineHeight: 1.2 }}>
          {selfServe ? 'Your Eventicor app' : 'This is a sample app'}
        </div>
        <p style={{ color: '#3d4a50', fontSize: 13.5, lineHeight: 1.55, margin: '12px 0 0' }}>
          Everything you see here is placeholder information until you finish setting up your app.
        </p>
        <p style={{ color: '#3d4a50', fontSize: 13.5, lineHeight: 1.55, margin: '8px 0 16px' }}>
          {selfServe
            ? 'Join the Eventicor community on WhatsApp and request the live webinar: our team walks you through managing your app for your event.'
            : 'Want it with your own names, photos and events? Create your own app on the Eventicor website in seconds.'}
        </p>
        {selfServe ? (
          <a
            href={SAMPLE_COMMUNITY_URL}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'block', background: accent, color: '#fff', textDecoration: 'none', padding: '13px 20px', borderRadius: 999, fontWeight: 700, fontSize: 13, letterSpacing: '.06em' }}
          >
            JOIN THE EVENTICOR COMMUNITY
          </a>
        ) : (
          <a
            href={SAMPLE_SITE_URL}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'block', background: accent, color: '#fff', textDecoration: 'none', padding: '13px 20px', borderRadius: 999, fontWeight: 700, fontSize: 13, letterSpacing: '.06em' }}
          >
            CREATE YOUR OWN APP
          </a>
        )}
        <a
          href={SAMPLE_COMMUNITY_URL}
          target="_blank"
          rel="noreferrer"
          style={{ display: selfServe ? 'none' : 'block', margin: '10px 0 0', padding: '12px 20px', borderRadius: 999, fontWeight: 700, fontSize: 13, letterSpacing: '.04em', color: accent, border: `1.5px solid ${accent}`, textDecoration: 'none' }}
        >
          Join the Eventicor community on WhatsApp
        </a>
        <p style={{ color: '#7a8a91', fontSize: 11.5, lineHeight: 1.5, margin: '14px 0 0' }}>
          {selfServe
            ? 'Your free trial is running. Your login details are waiting in your email.'
            : 'This sample app stops working after the third day. Eventicor is on a free trial for now.'}
        </p>
        <button
          onClick={() => setOpen(false)}
          style={{ marginTop: 12, background: 'none', border: 'none', color: '#93a4ab', fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}
        >
          Got it
        </button>
      </div>
    </>
  );
}

export default function CoupleApp() {
  const params = new URLSearchParams(window.location.search);
  const tplRaw = params.get('tpl') || 'classic';
  const tpl = ['classic', 'halo', 'hero', 'book'].includes(tplRaw) ? tplRaw : 'classic';
  const accKey = ACCENTS[params.get('acc') || ''] ? params.get('acc')! : (TPL_ACCENT[tpl] || 'midnight');
  const acc = ACCENTS[accKey];
  const expRaw = Number(params.get('exp') || 0);
  const leadId = params.get('lead') || '';
  const isSample = expRaw > 0 || !!leadId;
  const expired = expRaw > 0 && Date.now() / 1000 > expRaw;
  // The lead is resolved before the app renders so its names and uploaded
  // images are in place from the first paint; a lookup that cannot settle
  // (offline, or a lead id we cannot read) falls back to the generic demo.
  const [lead, setLead] = useState<LeadData | null | undefined>(() => (leadId ? undefined : null));
  const [leadExpired, setLeadExpired] = useState(false);
  useEffect(() => {
    if (!leadId) return;
    let alive = true;
    const bail = window.setTimeout(() => { if (alive) setLead((l) => (l === undefined ? null : l)); }, 4000);
    loadLead(leadId).then((l) => {
      if (!alive) return;
      window.clearTimeout(bail);
      if (l && l.expiresAt && Date.now() > l.expiresAt) setLeadExpired(true);
      setLeadOverride(l ? { bride: l.bride || 'Bride', groom: l.groom || 'Groom', city: l.city, heroImages: l.heroImages } : null);
      setLead(l || null);
    });
    return () => { alive = false; window.clearTimeout(bail); };
  }, [leadId]);
  // A lead's app installs as a PWA under the couple's own names: inject the
  // per-lead manifest and the service worker once the lead is resolved.
  useEffect(() => {
    if (!lead) return;
    const link = (document.querySelector('link[rel="manifest"]') || (() => { const l = document.createElement('link'); l.rel = 'manifest'; document.head.appendChild(l); return l })()) as HTMLLinkElement;
    const q = new URLSearchParams({ tpl });
    if (params.get('acc')) q.set('acc', params.get('acc')!);
    if (expRaw) q.set('exp', String(expRaw));
    if (leadId) q.set('lead', leadId);
    link.href = `/api/manifest?${q.toString()}`;
    document.head.appendChild(link);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead]);
  if (expired || leadExpired) return <SampleExpired accent={acc.accent} />;
  return (
    <div
      className="ev-couple-root"
      style={{ ['--ann-accent' as any]: acc.accent, ['--ann-hero' as any]: acc.hero, ['--ann-soft' as any]: acc.soft }}
    >
      {lead === undefined ? null : (
        <Suspense fallback={null}>
          <AnniversaryPortal previewMode onBackToMain={() => { window.location.href = '/'; }} template={tpl as any} adminMode={(lead as any)?.source === 'landing' ? 'real' : lead ? 'none' : 'preview'} />
        </Suspense>
      )}
      {isSample && expRaw > 0 && <SampleChip exp={expRaw} trial={lead?.source === 'landing'} />}
      {isSample && lead !== undefined && <SampleInfoButton accent={acc.accent} selfServe={lead?.source === 'landing'} />}
    </div>
  );
}

import { setLeadOverride } from './lib/demoMode';
