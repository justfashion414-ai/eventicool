import { Suspense, useEffect, useState } from 'react';

import AnniversaryPortal from './AnniversaryPortal';
import { APP_ID } from './lib/appScope';
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
interface LeadData { bride?: string; groom?: string; city?: string; email?: string; source?: string; weddingDate?: string; weddingTime?: string; heroImages?: string[]; footerImages?: string[]; feedImages?: string[]; expiresAt?: number; status?: string; adminWhatsapp?: string; plan?: string; platform?: any }


// The boot loader must be fast (user direction Nov 23 2026): index.html kicks
// the lookup off in parallel with the bundle download, and these lookups pick
// up that result instead of paying a second round trip once the app mounts.
function preloadedLookup(id: string): Promise<LeadData | null> | null {
  const pre = (window as any).__evLeadPre;
  if (pre && pre.id === id && pre.p && typeof pre.p.then === 'function') {
    return Promise.resolve(pre.p)
      .then((j: any) => (j && (j.bride || j.groom) ? (j as LeadData) : null))
      .catch(() => null);
  }
  return null;
}

async function loadLead(id: string): Promise<LeadData | null> {
  // Sample apps built in the demo console live in this browser only.
  try {
    const ls = localStorage.getItem(`ev-lead-${id}`);
    if (ls) {
      const j = JSON.parse(ls);
      if (j && (j.bride || j.title)) return j;
    }
  } catch { /* ignore */ }
  const pre = preloadedLookup(id);
  if (pre) { const j = await pre; if (j) return j; }
  // Real console leads live in Firestore and must open on any device. The
  // leads collection carries the couple's email and is not readable from the
  // client, so resolution goes through the read-only /api/couple endpoint,
  // which returns only the fields the app shows.
  try {
    const r = await fetch(`/api/couple?site=${encodeURIComponent(id)}`);
    if (!r.ok) return null;
    const j = await r.json();
    if (j && (j.bride || j.groom)) return j as LeadData;
  } catch { /* offline: fall back to the generic demo */ }
  return null;
}

// A real couple's app link (?site=<events doc id>) resolves their events doc
// before render: the names, wedding date, city and the photos seeded at
// onboarding, so their app opens on THEIR day, not the seeded placeholder.
// The events collection is not publicly readable, so the resolution goes
// through the read-only /api/couple endpoint, which returns only the fields
// the app needs and never the couple's contact details or access code.
async function loadSite(id: string): Promise<LeadData | null> {
  const pre = preloadedLookup(id);
  if (pre) { const j = await pre; if (j) return j; }
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

function AccountScreen({ accent, kind, adminWhatsapp }: { accent: string; kind: 'deleted' | 'suspended' | 'unavailable'; adminWhatsapp?: string }) {
  const wa = (adminWhatsapp || ADMIN_WHATSAPP).replace(/[^0-9]/g, '');
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 28, background: '#faf7f2' }}>
      <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 32, lineHeight: 1.15, color: accent, fontWeight: 600 }}>
        {kind === 'deleted' ? 'This app does not exist anymore' : kind === 'suspended' ? 'This app is currently suspended' : "This app isn't available right now"}
      </div>
      <p style={{ color: '#5a6970', maxWidth: 340, marginTop: 14, lineHeight: 1.55, fontSize: 15 }}>
        {kind === 'deleted'
          ? 'The link you followed has been removed. If you think this is a mistake, contact the couple or an Eventicor admin.'
          : kind === 'suspended'
            ? 'This account is not available right now. Contact an Eventicor admin to have it restored.'
            : 'Check the link or your connection and try again. If it still does not open, contact the couple or an Eventicor admin.'}
      </p>
      {kind === 'suspended' && wa && (
        <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" style={{ marginTop: 22, background: '#25d366', color: '#fff', textDecoration: 'none', padding: '14px 26px', borderRadius: 999, fontWeight: 700, fontSize: 14 }}>
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

// Customer trial-expired payment flow (Nov 20 2026, user spec): a customer's
// app whose 24-hour trial ended shows its OWN screen pointing at payment,
// never the sample-app expiry screen. Step 1 picks a plan (features + a
// see-more toggle per plan), step 2 presents the bank account gateway-style
// (a "session account" with a five-minute window and a copy button), and
// step 3 takes the receipt: upload, send, then WhatsApp support unlocks.
// "I've made the payment" itself has no backend effect; the sent receipt is
// what the admin sees. The bank details live in the platform/payment Firestore
// doc, editable in the console's Payment details section, with these defaults.

const pillBtn = (accent: string): React.CSSProperties => ({ display: 'inline-block', background: accent, color: '#fff', textDecoration: 'none', padding: '14px 26px', borderRadius: 999, fontWeight: 700, fontSize: 14, letterSpacing: '.05em', border: 'none', cursor: 'pointer', fontFamily: 'inherit' });

function TrialEnded({ accent, lead, appId }: { accent: string; lead: LeadData | null; appId: string }) {
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('nochrome')) return null;
  return (
    <div style={{ minHeight: '100vh', background: '#faf7f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '38px 20px 60px', textAlign: 'center', fontFamily: "'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <PaymentFlow
        accent={accent}
        appName={`${lead?.bride || 'Bride'} & ${lead?.groom || 'Groom'}`}
        email={lead?.email || ''}
        appId={appId}
        titles={['Your free trial has ended', 'Make your transfer', 'Confirming your payment', 'Almost there']}
        intro={'Your free trial has ended. To keep the app running for your wedding and your guests, choose a plan below.'}
      />
      <small style={{ marginTop: 26, color: '#93a4ab', textAlign: 'center', lineHeight: 1.6, fontSize: 12.5, maxWidth: 340 }}>
        A free trial does not have a fixed end date. Choosing a plan keeps your app online and your guests posting.
      </small>
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

function SampleInfoButton({ accent, selfServe, active, onPay }: { accent: string; selfServe?: boolean; active?: boolean; onPay?: () => void }) {
  // Hidden in the dashboard's preview mockup (?nochrome=1): the mockup shows
  // the home page only, with no floating buttons.
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('nochrome')) return null;
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
            ? 'Pay now to keep your app online, or join the Eventicor community on WhatsApp and request the live webinar: our team walks you through managing your app for your event.'
            : 'Want it with your own names, photos and events? Create your own app on the Eventicor website in seconds.'}
        </p>
        {selfServe && onPay ? (
          <>
            <button
              onClick={() => { setOpen(false); onPay(); }}
              style={{ display: 'block', width: '100%', background: accent, color: '#fff', textDecoration: 'none', padding: '13px 20px', borderRadius: 999, fontWeight: 700, fontSize: 13, letterSpacing: '.06em', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              MAKE PAYMENT
            </button>
            <a
              href={SAMPLE_COMMUNITY_URL}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'block', marginTop: 10, padding: '12px 20px', borderRadius: 999, fontWeight: 700, fontSize: 13, letterSpacing: '.04em', color: accent, border: `1.5px solid ${accent}`, textDecoration: 'none' }}
            >
              JOIN THE EVENTICOR COMMUNITY
            </a>
          </>
        ) : selfServe ? (
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
  // A dashboard-chosen accent wins over the link's ?acc= (same rule as the
  // hero style: the dashboard choice always wins over the link).
  const savedAcc = (() => { try { return localStorage.getItem(`ann-${APP_ID}-accent`); } catch { return ''; } })();
  const accKey = (ACCENTS[savedAcc || ''] ? (savedAcc || '') : (ACCENTS[params.get('acc') || ''] ? params.get('acc')! : (TPL_ACCENT[tpl] || 'midnight')));
  const acc = ACCENTS[accKey];
  const expRaw = Number(params.get('exp') || 0);
  const leadId = params.get('lead') || '';
  const siteId = params.get('site') || '';
  const isSample = expRaw > 0 || !!leadId;
  const expired = expRaw > 0 && Date.now() > (expRaw > 1e12 ? expRaw : expRaw * 1000);
  // The lead is resolved before the app renders so its names and uploaded
  // images are in place from the first paint. A lead/site link never shows
  // the generic demo while resolving or when the lookup fails (user rule
  // Nov 23 2026): it holds on a boot screen, then a not-available screen.
  const [lead, setLead] = useState<LeadData | null | undefined>(() => (leadId || siteId ? undefined : null));
  const [leadExpired, setLeadExpired] = useState(false);
  // The floating i popup on a trial app carries a payment button (user
  // direction Nov 21 2026): a couple who wants to pay before their trial ends
  // opens the same plan -> transfer -> receipt flow the expiry screen uses.
  const [infoPayOpen, setInfoPayOpen] = useState(false);
  // An expired trial shows the entry banner first (the couple sees the app is
  // theirs), and only the tap opens the payment flow (user direction Nov 20 2026).
  const [paywallEntered, setPaywallEntered] = useState(false);
  useEffect(() => {
    if (!leadId && !siteId) return;
    let alive = true;
    const bail = window.setTimeout(() => { if (alive) setLead((l) => (l === undefined ? null : l)); }, 4000);
    const applyLead = (l: LeadData | null) => {
      if (!alive) return;
      if (l && l.expiresAt && Date.now() > l.expiresAt && !(l as any).activatedAt) setLeadExpired(true);
      setLeadOverride(l ? { bride: l.bride || 'Bride', groom: l.groom || 'Groom', city: l.city, heroImages: l.heroImages, weddingDate: l.weddingDate, weddingTime: l.weddingTime } : null);
      setLead(l || null);
      if (l) trackAppEvent(siteId || leadId, 'open');
      try { setCoupleInfo((l as any)?.plan, (l as any)?.platform) } catch { /* defaults stay */ }
    };
    (leadId ? loadLead(leadId) : loadSite(siteId)).then((l) => {
      if (!alive) return;
      window.clearTimeout(bail);
      const staleExpired = !!(l && l.expiresAt && Date.now() > l.expiresAt && !(l as any).activatedAt);
      if (!staleExpired) { applyLead(l); return; }
      // A cached or preloaded lead copy can be older than the live lead doc
      // (user report Nov 25 2026: active trial apps briefly flashed the
      // expired screen). The live doc decides before any expired screen shows.
      fetch(`/api/couple?site=${encodeURIComponent(leadId || siteId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j: any) => { applyLead(j && (j.bride || j.groom) ? (j as LeadData) : l); })
        .catch(() => { applyLead(l); });
    });
    return () => { alive = false; window.clearTimeout(bail); };
  }, [leadId, siteId]);

  // The tab always shows the couple's own names and their first hero photo as
  // the favicon (user direction Nov 22 2026), on mobile and desktop alike.
  // Titles and icons come alive once the app's data is in; the share-card
  // version is injected server-side, this keeps the open tab in step.
  useEffect(() => {
    try {
      const b = String((lead as any)?.bride || '').trim();
      const g = String((lead as any)?.groom || '').trim();
      if (b && g) document.title = `${b} & ${g}`;
      else if (b || g) document.title = b || g;
      const hero = (Array.isArray((lead as any)?.heroImages) ? (lead as any).heroImages.filter(Boolean) : [])[0] as string | undefined;
      if (!hero) return;
      let icon = String(hero);
      const cld = icon.match(/(res\.cloudinary\.com\/.+\/upload\/)/);
      if (cld && !/f_png/.test(icon)) icon = icon.replace('/upload/', '/upload/f_png,w_64,c_fill/');
      const setIcon = (rel: string, href: string, type?: string) => {
        let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
        if (!el) { el = document.createElement('link'); el.rel = rel; document.head.appendChild(el); }
        if (type) el.type = type;
        el.href = href;
      };
      setIcon('icon', icon, cld ? 'image/png' : undefined);
      let apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
      if (!apple) { apple = document.createElement('link'); apple.rel = 'apple-touch-icon'; document.head.appendChild(apple); }
      apple.href = icon;
    } catch { /* cosmetic only */ }
  }, [lead]);


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
  // Placeholder rule (user direction Nov 23 2026): on any sample-app or real
  // app link the demo data (Amara & Daniel) must never paint — not while the
  // lead/site lookup is in flight and not when it fails. Hold on a boot
  // screen while resolving, show the not-available screen if it cannot.
  if ((leadId || siteId) && lead === null) return <AccountScreen accent={acc.accent} kind="unavailable" />;
  const leadStatus = (lead as any)?.status as string | undefined;
  if (lead && leadStatus === 'deleted') return <AccountScreen accent={acc.accent} kind="deleted" />;
  if (lead && leadStatus === 'suspended') return <AccountScreen accent={acc.accent} kind="suspended" adminWhatsapp={lead.adminWhatsapp} />;
  // A customer's own app (a landing lead) is governed by its lead doc: the
  // lead's expiresAt ends the trial and activatedAt renews it. A stale ?exp=
  // riding on a copied link must never demote a real customer to the
  // sample-expired screen (user report Nov 20 2026), so the URL countdown is
  // ignored for landing leads and the ?lead resolution is awaited first.
  const landingLead = !!(lead && (lead as any).source === 'landing');
  if (lead !== undefined && ((expired && !landingLead) || (leadExpired && !activatedAt))) {
    // Sample links (their own ?exp countdown) point back to the landing page;
    // a customer's own app whose 24-hour trial ended gets the entry banner
    // first and then the payment flow on tap (user direction Nov 20 2026).
    if (leadId && landingLead && leadExpired) {
      if (paywallEntered) return <TrialEnded accent={acc.accent} lead={lead} appId={leadId} />;
    } else {
      return <SampleExpired accent={acc.accent} />;
    }
  }
  return (
    <div
      className="ev-couple-root"
      style={{ ['--ann-accent' as any]: acc.accent, ['--ann-hero' as any]: acc.hero, ['--ann-soft' as any]: acc.soft }}
    >
      {lead === undefined ? <BootLoader /> : (
        <Suspense fallback={<BootLoader />}>
          <AnniversaryPortal previewMode={false} onBackToMain={() => { window.location.href = '/'; }} template={tpl as any} adminMode={adminMode} installable={!!lead && (lead as any).source === 'landing'} paywallEnter={leadExpired && landingLead && !activatedAt && !paywallEntered ? () => setPaywallEntered(true) : undefined} />
        </Suspense>
      )}
      {isSample && expRaw > 0 && !!lead && !landingLead && !(lead as any).activatedAt && <SampleChip exp={expRaw} trial={false} />}
      {/* A customer's own app on its 24-hour free trial shows the same floating countdown (user report Nov 20 2026). */}
      {isSample && landingLead && !!lead && !activatedAt && !leadExpired && (lead as any).expiresAt && <SampleChip exp={(lead as any).expiresAt} trial />}
      {isSample && !!lead && !(lead as any).activatedAt && <SampleInfoButton accent={acc.accent} selfServe={lead?.source === 'landing'} active={!!(lead as any).activatedAt} onPay={lead?.source === 'landing' ? () => setInfoPayOpen(true) : undefined} />}
      {isSample && infoPayOpen && lead && lead.source === 'landing' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: '#faf7f0', overflowY: 'auto' }}>
          <button
            onClick={() => setInfoPayOpen(false)}
            aria-label="Close payment"
            style={{ position: 'fixed', top: 14, right: 14, zIndex: 5, width: 40, height: 40, borderRadius: 999, border: '1.5px solid rgba(6,6,14,.14)', background: '#fff', color: '#5a6970', fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: '0 4px 14px rgba(6,6,14,.14)' }}
          >
            ×
          </button>
          <div style={{ maxWidth: 560, margin: '46px auto 60px', padding: '0 18px', fontFamily: "'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
            <PaymentFlow
              accent={acc.accent}
              appName={`${lead.bride || 'Bride'} & ${lead.groom || 'Groom'}`}
              email={lead.email || ''}
              appId={leadId}
              titles={['Pick your plan', 'Make your transfer', 'Confirming your payment', 'Almost there']}
              intro={'Your free trial is running. Choosing a plan now keeps your app online for your wedding and your guests with no interruption.'}
            />
          </div>
        </div>
      )}
    </div>
  );
}

import { setLeadOverride, goLive } from './lib/demoMode';
import { trackAppEvent } from './lib/track';
import { setCoupleInfo } from './lib/platformInfo';
import PaymentFlow from './PaymentFlow';
