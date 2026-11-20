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
interface LeadData { bride?: string; groom?: string; city?: string; email?: string; source?: string; weddingDate?: string; weddingTime?: string; heroImages?: string[]; footerImages?: string[]; feedImages?: string[]; expiresAt?: number; status?: string; adminWhatsapp?: string }

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

function AccountScreen({ accent, kind, adminWhatsapp }: { accent: string; kind: 'deleted' | 'suspended'; adminWhatsapp?: string }) {
  const wa = (adminWhatsapp || ADMIN_WHATSAPP).replace(/[^0-9]/g, '');
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
const DEFAULT_PAYMENT = { accountName: 'Michael Ogunnaike', bankName: 'Moniepoint', accountNumber: '5070133907', whatsapp: '2349030064109' };
const PAY_PLANS = [
  { id: 'essential', name: 'Essential', amount: 30000, storage: '5GB', features: ['Your wedding app with your names, city and hero photos', 'Guest wall: posts, comments and reactions', 'Photo albums and video reels', 'Wedding countdown, events and details', '5GB of storage', 'Online for one year'] },
  { id: 'complete', name: 'Complete', amount: 50000, storage: '10GB', features: ['Everything in Essential', 'Photographer and videographer accounts', 'Vendor accounts with their own uploads', 'Private albums with admin approval', '10GB of storage', 'Online for one year'] },
  { id: 'legacy', name: 'Legacy', amount: 100000, storage: '20GB', features: ['Everything in Complete', '20GB of storage for the full archive', 'Priority WhatsApp support', 'Longest archive keep after the wedding', 'Online for one year'] },
];

const ng = (n: number) => '\u20a6' + n.toLocaleString('en-NG');
const pillBtn = (accent: string): React.CSSProperties => ({ display: 'inline-block', background: accent, color: '#fff', textDecoration: 'none', padding: '14px 26px', borderRadius: 999, fontWeight: 700, fontSize: 14, letterSpacing: '.05em', border: 'none', cursor: 'pointer', fontFamily: 'inherit' });

function TrialEnded({ accent, lead, appId }: { accent: string; lead: LeadData | null; appId: string }) {
  const [pay, setPay] = useState({ ...DEFAULT_PAYMENT });
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [plan, setPlan] = useState<(typeof PAY_PLANS)[number] | null>(null);
  const [more, setMore] = useState('');
  const [left, setLeft] = useState(300);
  const [copied, setCopied] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const appName = lead?.bride && lead?.groom ? `${lead.bride} & ${lead.groom}` : 'this app';
  const email = (lead?.email || '').trim();
  const mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

  useEffect(() => {
    (async () => {
      try {
        const { db } = await import('../firebase');
        const { doc, getDoc } = await import('firebase/firestore');
        const snap = await getDoc(doc(db as any, 'platform', 'payment'));
        if (snap.exists()) setPay((p) => ({ ...p, ...(snap.data() as any) }));
      } catch { /* the defaults stay */ }
    })();
  }, []);

  useEffect(() => {
    if (step !== 2) return;
    const t = window.setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(t);
  }, [step]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 3800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const wa = `https://wa.me/${(pay.whatsapp || DEFAULT_PAYMENT.whatsapp).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello Eventicor! I just sent my payment receipt.\nApp: ${appName}\nEmail: ${email || 'not provided'}\nPlan: ${plan ? plan.name : ''}`)}`;

  async function pickReceipt(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setReceipt(f);
    setReceiptUrl('');
    setSent(false);
    setBusy('upload');
    try {
      const sigRes = await fetch(`/api/upload-signature?folder=${encodeURIComponent('eventicor-payment-receipts')}`);
      if (!sigRes.ok) throw new Error('Could not start the upload');
      const sig = await sigRes.json();
      const form = new FormData();
      form.append('file', f, f.name || 'receipt.jpg');
      form.append('api_key', String(sig.apiKey));
      form.append('timestamp', String(sig.timestamp));
      form.append('signature', String(sig.signature));
      form.append('folder', String(sig.folder || 'eventicor-payment-receipts'));
      const up = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, { method: 'POST', body: form });
      if (!up.ok) throw new Error('The receipt upload failed. Try again.');
      const j = await up.json();
      setReceiptUrl(String(j.secure_url || ''));
    } catch (err: any) {
      setReceipt(null);
      setToast(err?.message || 'The receipt upload failed. Try again.');
    } finally {
      setBusy('');
    }
  }

  async function sendReceipt() {
    if (!receiptUrl || !plan || sent) return;
    setBusy('send');
    try {
      const r = await fetch('/api/payment-submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: appId, plan: plan.name, amount: plan.amount, email, appName, receiptUrl }) });
      const j = await r.json().catch(() => ({} as any));
      if (!r.ok || !j.ok) throw new Error(j.error || 'Could not send the receipt');
      setSent(true);
      setToast('Receipt sent successfully. Your payment is being confirmed.');
    } catch (err: any) {
      setToast(err?.message || 'Could not send the receipt. Try again.');
    } finally {
      setBusy('');
    }
  }

  const card: React.CSSProperties = { background: '#fff', borderRadius: 18, padding: 16, border: '1px solid #ece5da', textAlign: 'left' };

  return (
    <div style={{ minHeight: '100vh', background: '#faf7f2', padding: '48px 20px 60px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 430 }}>
        <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 32, lineHeight: 1.15, color: accent, fontWeight: 600, textAlign: 'center' }}>
          {step === 1 ? 'Your free trial has ended' : step === 2 ? 'Make your transfer' : 'Almost there'}
        </div>
        {step === 1 && (
          <>
            <p style={{ color: '#5a6970', marginTop: 12, lineHeight: 1.55, fontSize: 15, textAlign: 'center' }}>
              Thanks for building with Eventicor. Your app is paused for now, but everything you uploaded is safe. Pick a plan to bring it back to life.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 22 }}>
              {PAY_PLANS.map((p) => (
                <div key={p.id} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <b style={{ fontSize: 16.5 }}>{p.name}</b>
                    <span style={{ color: accent, fontWeight: 700, fontSize: 16 }}>{ng(p.amount)}</span>
                  </div>
                  <small style={{ color: '#93a4ab', display: 'block', marginTop: 2 }}>{p.storage} storage</small>
                  <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: '#5a6970', fontSize: 13.5, lineHeight: 1.6 }}>
                    {(more === p.id ? p.features : p.features.slice(0, 3)).map((f) => <li key={f}>{f}</li>)}
                  </ul>
                  <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                    <button type="button" style={{ ...pillBtn(accent), flex: 1 }} onClick={() => { setPlan(p); setMore(''); setStep(2); setLeft(300); }}>CHOOSE {p.name.toUpperCase()}</button>
                    <button type="button" style={{ ...pillBtn(accent), flex: '0 0 auto', background: 'transparent', color: accent, border: `1.5px solid ${accent}`, padding: '13px 18px' }} onClick={() => setMore(more === p.id ? '' : p.id)}>
                      {more === p.id ? 'LESS' : 'SEE MORE'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {step === 2 && plan && (
          <>
            <div style={{ ...card, marginTop: 20, textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: '#5a6970' }}>
                <span><b style={{ color: '#1d2b30' }}>{plan.name}</b> plan</span>
                <span><b style={{ color: '#1d2b30' }}>{ng(plan.amount)}</b></span>
              </div>
              <div style={{ margin: '14px auto 0', padding: '10px 12px', borderRadius: 12, background: '#f4efe6', display: 'inline-block' }}>
                <small style={{ color: '#8a7a63', fontWeight: 700, letterSpacing: '.08em', fontSize: 10.5 }}>SESSION ACCOUNT · RESERVED {left > 0 ? mm : '0:00'}</small>
              </div>
              {left === 0 && (
                <p style={{ color: '#a36a00', fontSize: 13, margin: '10px 0 0' }}>This payment window has expired.</p>
              )}
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '.06em', color: '#1d2b30', marginTop: 10 }}>{pay.accountNumber}</div>
              <div style={{ color: '#5a6970', fontSize: 14, marginTop: 4 }}>{pay.accountName}</div>
              <div style={{ color: '#93a4ab', fontSize: 13 }}>{pay.bankName}</div>
              <button type="button" style={{ ...pillBtn(accent), marginTop: 14, padding: '10px 22px', fontSize: 12.5, background: copied ? '#1f8a5b' : accent }} onClick={() => { try { navigator.clipboard?.writeText(pay.accountNumber); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { setToast('Could not copy the account number'); } }}>
                {copied ? 'COPIED' : 'COPY ACCOUNT NUMBER'}
              </button>
              <p style={{ color: '#5a6970', fontSize: 13, lineHeight: 1.55, margin: '14px 0 0' }}>
                This account is generated for this session only. Send exactly <b>{ng(plan.amount)}</b> to it.
              </p>
            </div>
            <p style={{ color: '#5a6970', fontSize: 13.5, textAlign: 'center', marginTop: 16 }}>Once your payment is made, tap the button below.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              <button type="button" style={pillBtn(accent)} onClick={() => setStep(3)}>I'VE MADE THE PAYMENT</button>
              {left === 0 && (
                <button type="button" style={{ ...pillBtn(accent), background: 'transparent', color: accent, border: `1.5px solid ${accent}` }} onClick={() => setLeft(300)}>RESTART SESSION</button>
              )}
              <button type="button" style={{ ...pillBtn(accent), background: 'transparent', color: '#5a6970', border: '1.5px solid #d9d2c6' }} onClick={() => { setStep(1); setMore(''); }}>BACK TO PLANS</button>
            </div>
          </>
        )}
        {step === 3 && plan && (
          <>
            <div style={{ ...card, marginTop: 20 }}>
              <p style={{ color: '#5a6970', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                Your payment is being confirmed. To make confirmation faster, upload your payment receipt below, then chat with us on WhatsApp. Confirmation is done soon after your receipt arrives.
              </p>
              <div style={{ marginTop: 14 }}>
                <label style={{ ...pillBtn(accent), display: 'block', textAlign: 'center', opacity: busy === 'upload' ? 0.6 : 1 }}>
                  {busy === 'upload' ? 'UPLOADING…' : receipt ? 'CHOOSE ANOTHER RECEIPT' : 'UPLOAD RECEIPT'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={pickReceipt} disabled={busy === 'upload'} />
                </label>
                {receipt && !receiptUrl && <small style={{ display: 'block', color: '#93a4ab', marginTop: 8, textAlign: 'center' }}>{receipt.name}</small>}
                {receiptUrl && (
                  <div style={{ textAlign: 'center', marginTop: 10 }}>
                    <img src={receiptUrl} alt="Payment receipt" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 12, border: '1px solid #ece5da' }} />
                  </div>
                )}
              </div>
              {receiptUrl && (
                <button type="button" style={{ ...pillBtn(accent), width: '100%', marginTop: 14, opacity: sent ? 0.55 : 1 }} disabled={sent || busy === 'send'} onClick={sendReceipt}>
                  {busy === 'send' ? 'SENDING…' : sent ? 'RECEIPT SENT' : 'SEND IT'}
                </button>
              )}
              <button type="button" style={{ ...pillBtn('#25d366'), width: '100%', marginTop: 10, opacity: sent ? 1 : 0.45, cursor: sent ? 'pointer' : 'not-allowed', background: '#25d366' }} disabled={!sent} onClick={() => { if (sent) window.open(wa, '_blank'); }}>
                CONTACT SUPPORT ON WHATSAPP
              </button>
              <p style={{ color: '#93a4ab', fontSize: 12, textAlign: 'center', margin: '10px 0 0' }}>
                {sent ? 'WhatsApp is open for you above.' : 'WhatsApp unlocks after your receipt is sent.'}
              </p>
              <button type="button" style={{ ...pillBtn(accent), width: '100%', marginTop: 12, background: 'transparent', color: '#5a6970', border: '1.5px solid #d9d2c6' }} onClick={() => setStep(2)}>BACK</button>
            </div>
          </>
        )}
        <small style={{ display: 'block', color: '#93a4ab', marginTop: 24, textAlign: 'center', fontSize: 12 }}>eventicor.name.ng</small>
      </div>
      {toast && (
        <div style={{ position: 'fixed', left: '50%', bottom: 26, transform: 'translateX(-50%)', background: '#14122b', color: '#fff', padding: '11px 18px', borderRadius: 999, fontSize: 13.5, fontWeight: 600, boxShadow: '0 10px 30px rgba(10,10,22,.35)', zIndex: 500, maxWidth: '88vw', textAlign: 'center' }}>{toast}</div>
      )}
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
  if (lead && leadStatus === 'suspended') return <AccountScreen accent={acc.accent} kind="suspended" adminWhatsapp={lead.adminWhatsapp} />;
  // A customer's own app (a landing lead) is governed by its lead doc: the
  // lead's expiresAt ends the trial and activatedAt renews it. A stale ?exp=
  // riding on a copied link must never demote a real customer to the
  // sample-expired screen (user report Nov 20 2026), so the URL countdown is
  // ignored for landing leads and the ?lead resolution is awaited first.
  const landingLead = !!(lead && (lead as any).source === 'landing');
  if (lead !== undefined && ((expired && !landingLead) || (leadExpired && !activatedAt))) {
    // Sample links (their own ?exp countdown) point back to the landing page;
    // a customer's own app whose 24-hour trial ended gets the payment flow
    // instead (user direction Nov 20 2026).
    if (leadId && landingLead && leadExpired) {
      return <TrialEnded accent={acc.accent} lead={lead} appId={leadId} />;
    }
    return <SampleExpired accent={acc.accent} />;
  }
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
      {isSample && expRaw > 0 && !!lead && !landingLead && !(lead as any).activatedAt && <SampleChip exp={expRaw} trial={false} />}
      {isSample && !!lead && <SampleInfoButton accent={acc.accent} selfServe={lead?.source === 'landing'} active={!!(lead as any).activatedAt} />}
    </div>
  );
}

import { setLeadOverride, goLive } from './lib/demoMode';
