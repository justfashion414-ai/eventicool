import { Suspense, useEffect, useState } from 'react';

import AnniversaryPortal from './AnniversaryPortal';
import { enableRealAuth } from './lib/authShim';
import BootLoader from '../components/BootLoader';

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
interface LeadData { bride?: string; groom?: string; city?: string; email?: string; source?: string; weddingDate?: string; weddingTime?: string; heroImages?: string[]; footerImages?: string[]; feedImages?: string[]; expiresAt?: number; status?: string }

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

// A real couple's app link (?site=<events doc id>) resolves their events doc
// before render: the names, wedding date, city and the photos seeded at
// onboarding, so their app opens on THEIR day, not the seeded placeholder.
// The events collection is not publicly readable, so the resolution goes
// through the read-only /api/couple endpoint, which returns only the fields
// the app needs and never the couple's contact details or access code.
async function loadSite(id: string): Promise<LeadData | null> {
  try {
    const r = await fetch(`/api/couple?site=${encodeURIComponent(id)}`);
    if (!r.ok) return null;
    const j = await r.json();
    if (j && (j.bride || j.groom)) return j as LeadData;
  } catch { /* offline: fall back to the generic demo */ }
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

// Admin account actions (Nov 18 2026): a deleted account's link is revoked
// and tells the visitor the app no longer exists; a suspended one asks them
// to contact an Eventicor admin on WhatsApp. ADMIN_WHATSAPP holds that number.
const ADMIN_WHATSAPP = '2349030064109';

function AccountScreen({ accent, kind }: { accent: string; kind: 'deleted' | 'suspended' }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 28, background: '#faf7f2' }}>
      <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 32, lineHeight: 1.15, color: accent, fontWeight: 600 }}>
        {kind === 'deleted' ? 'This app does not exist anymore' : 'This app is currently suspended'}
      </div>
      <p style={{ color: '#5a6970', maxWidth: 340, marginTop: 14, lineHeight: 1.55, fontSize: 15 }}>
        {kind === 'deleted'
          ? 'The link you followed has been removed. If you think this is a mistake, contact the couple or an Eventicor admin.'
          : 'This account is not available right now. Contact an Eventicor admin to have it restored.'}
      </p>
      {kind === 'suspended' && ADMIN_WHATSAPP && (
        <a href={`https://wa.me/${ADMIN_WHATSAPP}`} target="_blank" rel="noreferrer" style={{ marginTop: 22, background: '#25d366', color: '#fff', textDecoration: 'none', padding: '14px 26px', borderRadius: 999, fontWeight: 700, fontSize: 14 }}>
          Contact an Eventicor admin on WhatsApp
        </a>
      )}
      <a href="/" style={{ marginTop: 18, background: accent, color: '#fff', textDecoration: 'none', padding: '14px 26px', borderRadius: 999, fontWeight: 700, fontSize: 14, letterSpacing: '.05em' }}>
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
  const expMs = exp > 1e12 ? exp : exp * 1000; // sample links carry unix seconds, real couple links the lead's ms expiresAt
  const ms = Math.max(0, expMs - now);
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

function SampleInfoButton({ accent, selfServe, active }: { accent: string; selfServe?: boolean; active?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label={selfServe ? 'About your app' : 'About this sample app'}
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
        {!active && (
          <p style={{ color: '#7a8a91', fontSize: 11.5, lineHeight: 1.5, margin: '14px 0 0' }}>
            {selfServe
              ? 'Your free trial is running. Your login details are waiting in your email.'
              : 'This sample app stops working after the third day. Eventicor is on a free trial for now.'}
          </p>
        )}
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
  // The landing names Hero Deck 'carousel'; normalize it onto the app's 'hero'
  // key so a Hero Deck app never falls back to Classic.
  const tpl: string = tplRaw === 'carousel' ? 'hero' : (['classic', 'halo', 'hero', 'book'].includes(tplRaw) ? tplRaw : 'classic');
  const accKey = ACCENTS[params.get('acc') || ''] ? params.get('acc')! : (TPL_ACCENT[tpl] || 'midnight');
  const acc = ACCENTS[accKey];
  const expRaw = Number(params.get('exp') || 0);
  const leadId = params.get('lead') || '';
  const siteId = params.get('site') || '';
  const isSample = expRaw > 0 || !!leadId;
  const expired = expRaw > 0 && Date.now() > (expRaw > 1e12 ? expRaw : expRaw * 1000);
  // The lead is resolved before the app renders so its names and uploaded
  // images are in place from the first paint; a lookup that cannot settle
  // (offline, or a lead id we cannot read) falls back to the generic demo.
  const [lead, setLead] = useState<LeadData | null | undefined>(() => (leadId ? undefined : null));
  const [leadExpired, setLeadExpired] = useState(false);
  useEffect(() => {
    if (!leadId && !siteId) return;
    let alive = true;
    const bail = window.setTimeout(() => { if (alive) setLead((l) => (l === undefined ? null : l)); }, 4000);
    (leadId ? loadLead(leadId) : loadSite(siteId)).then((l) => {
      if (!alive) return;
      window.clearTimeout(bail);
      if (l && l.expiresAt && Date.now() > l.expiresAt && !(l as any).activatedAt) setLeadExpired(true);
      setLeadOverride(l ? { bride: l.bride || 'Bride', groom: l.groom || 'Groom', city: l.city, heroImages: l.heroImages, weddingDate: l.weddingDate, weddingTime: l.weddingTime } : null);
      setLead(l || null);
    });
    return () => { alive = false; window.clearTimeout(bail); };
  }, [leadId, siteId]);
  // Temporary sign-in self-test (?authtest=1): reports which Firebase project the
  // browser is on and whether password and guest sign-in work, right on screen.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('authtest')) return;
    (async () => {
      const out: string[] = [];
      try {
        const { getAuth, signInWithEmailAndPassword, signInAnonymously } = await import('firebase/auth');
        const a = getAuth();
        const opts: any = (a as any).app?.options || {};
        out.push(`project ${opts.projectId} key ...${String(opts.apiKey || '').slice(-6)}`);
        try { const c = await signInWithEmailAndPassword(a, 'authtest.eventicor@mailto.plus', 'Ev-Authtest7'); out.push(`password sign-in OK uid ${c.user.uid}`); }
        catch (e: any) { out.push(`password sign-in FAILED ${e?.code || String(e)}`); }
        try { const g = await signInAnonymously(a); out.push(`guest sign-in OK uid ${g.user.uid}`); }
        catch (e: any) { out.push(`guest sign-in FAILED ${e?.code || String(e)}`); }
        try {
          const shim = await import('./lib/authShim') as any;
          // Real couple apps flip the shim to real auth once the lead resolves
          // (a beat after this effect runs), so wait briefly for that flip and
          // then test the exact path the admin gate uses.
          let real = false;
          for (let i = 0; i < 24; i++) {
            if ((shim.debugState() as any).realAuth) { real = true; break; }
            await new Promise((r) => setTimeout(r, 500));
          }
          if (!real) {
            out.push('shim sign-in SKIPPED real auth not active (preview)');
          } else {
            try { const c = await shim.signInWithEmailAndPassword(shim.auth, 'authtest.eventicor@mailto.plus', 'Ev-Authtest7'); out.push(`shim sign-in OK uid ${c.user.uid}`); }
            catch (e: any) { out.push(`shim sign-in FAILED ${e?.code || String(e)}`); }
            try {
              const { db: coupleDb } = await import('./lib/firebase');
              const { doc, getDoc } = await import('firebase/firestore');
              const snap = await getDoc(doc(coupleDb, 'admins', 'authtest.eventicor@mailto.plus'));
              out.push(`admins read ${snap.exists() ? 'OK' : 'MISSING'}`);
            } catch (e: any) { out.push(`admins read FAILED ${e?.code || String(e)}`); }
          }
        } catch (e: any) { out.push(`shim FAILED ${e?.code || String(e)}`); }
      } catch (e: any) { out.push(`auth init FAILED ${e?.code || String(e)}`); }
      let d = document.getElementById('authtest-banner');
      if (!d) { d = document.createElement('div'); d.id = 'authtest-banner'; d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#111;color:#4f4;padding:10px;font:12px monospace;white-space:pre-wrap'; document.body.appendChild(d); }
      d.textContent = 'AUTHTEST\n' + out.join('\n');
    })();
  }, []);

  // The service worker keeps every app working offline. The per-lead manifest
  // (and with it the browser's install prompt) is ONLY for a customer's own
  // app, created on the landing page: sample links carry no manifest, so they
  // can never be installed.
  useEffect(() => {
    if (!lead) return;
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    if ((lead as any).source !== 'landing') return;
    const link = (document.querySelector('link[rel="manifest"]') || (() => { const l = document.createElement('link'); l.rel = 'manifest'; document.head.appendChild(l); return l })()) as HTMLLinkElement;
    const q = new URLSearchParams({ tpl });
    if (params.get('acc')) q.set('acc', params.get('acc')!);
    if (expRaw) q.set('exp', String(expRaw));
    if (leadId) q.set('lead', leadId);
    if (siteId) q.set('site', siteId);
    link.href = `/api/manifest?${q.toString()}`;
    document.head.appendChild(link);
    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead]);
  // A confirmed payment makes the account active for a year from that moment:
  // the trial's expiry (URL exp and the lead's own expiresAt) no longer applies.
  const activatedAt = (lead as any)?.activatedAt as number | undefined;
  // Suspended and deleted accounts answer before any expiry logic: their link
  // resolves but the app itself is no longer served.
  const adminMode = ((lead as any)?.source === 'landing' ? 'real' : lead ? 'none' : 'preview') as 'real' | 'none' | 'preview';
  // Real couple apps authenticate against Firebase for real: the demo shim's
  // local guest is only for previews and sample apps.
  // Real couple apps flip out of demo mode (the demo fixtures and the
  // Firestore/auth shims all re-read DEMO at call time) and authenticate
  // against Firebase for real; previews and samples stay demo.
  if (adminMode === 'real') { goLive(); enableRealAuth(); }
  const leadStatus = (lead as any)?.status as string | undefined;
  if (lead && leadStatus === 'deleted') return <AccountScreen accent={acc.accent} kind="deleted" />;
  if (lead && leadStatus === 'suspended') return <AccountScreen accent={acc.accent} kind="suspended" />;
  if ((expired || leadExpired) && !activatedAt) return <SampleExpired accent={acc.accent} />;
  return (
    <div
      className="ev-couple-root"
      style={{ ['--ann-accent' as any]: acc.accent, ['--ann-hero' as any]: acc.hero, ['--ann-soft' as any]: acc.soft }}
    >
      {lead === undefined ? <BootLoader /> : (
        <Suspense fallback={<BootLoader />}>
          <AnniversaryPortal previewMode={false} onBackToMain={() => { window.location.href = '/'; }} template={tpl as any} adminMode={adminMode} installable={!!lead && (lead as any).source === 'landing'} />
        </Suspense>
      )}
      {isSample && expRaw > 0 && !!lead && !(lead as any).activatedAt && <SampleChip exp={expRaw} trial={lead?.source === 'landing'} />}
      {isSample && !!lead && <SampleInfoButton accent={acc.accent} selfServe={lead?.source === 'landing'} active={!!(lead as any).activatedAt} />}
    </div>
  );
}

import { setLeadOverride, goLive } from './lib/demoMode';
