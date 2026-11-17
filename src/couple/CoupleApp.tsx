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
interface LeadData { bride?: string; groom?: string; city?: string; heroImages?: string[]; footerImages?: string[]; feedImages?: string[]; expiresAt?: number }

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

function SampleChip({ exp }: { exp: number }) {
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
      Sample app · {label}
    </div>
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
      setLeadOverride(l ? { bride: l.bride || 'Bride', groom: l.groom || 'Groom', city: l.city, heroImages: l.heroImages, footerImages: l.footerImages, feedImages: l.feedImages } : null);
      setLead(l || null);
    });
    return () => { alive = false; window.clearTimeout(bail); };
  }, [leadId]);
  if (expired || leadExpired) return <SampleExpired accent={acc.accent} />;
  return (
    <div
      className="ev-couple-root"
      style={{ ['--ann-accent' as any]: acc.accent, ['--ann-hero' as any]: acc.hero, ['--ann-soft' as any]: acc.soft }}
    >
      {lead === undefined ? null : (
        <Suspense fallback={null}>
          <AnniversaryPortal previewMode onBackToMain={() => { window.location.href = '/'; }} template={tpl as any} />
        </Suspense>
      )}
      {isSample && expRaw > 0 && <SampleChip exp={expRaw} />}
    </div>
  );
}

import { setLeadOverride } from './lib/demoMode';
