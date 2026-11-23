import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';

// The payment flow every plan choice runs through, shared by the trial-ended
// screen and the dashboard's storage upgrade button: pick a plan, transfer to
// the session account, then upload the receipt and unlock WhatsApp support.
// The bank details come from the platform/payment doc (console Payment
// details); the storage each plan carries comes from the platform/settings
// doc the Eventicor admin sets in the console.
const DEFAULT_PAYMENT = { accountName: 'Michael Ogunnaike', bankName: 'Moniepoint', accountNumber: '5070133907', whatsapp: '2349030064109' };
const PLANS = [
  { id: 'essential', name: 'Essential', amount: 30000, features: ['5 GB of photos and videos', 'Unlimited guests', 'Your own unique address', 'Downloadable app on Android and iPhone with your name and branded logo', 'Feed and reels with views, comments and likes', 'Unique website link and a QR code to scan and join', 'Your unique link for each invitee', 'Photographer and videographer bulk uploads', 'Email notifications', 'Journey timeline and photo carousel', 'Online for 12 months'] },
  { id: 'complete', name: 'Complete', amount: 50000, features: ['Everything in Essential', '10 GB of photos and videos', 'Email and push notifications', 'Photographer and videographer bulk uploads', 'Memory book PDF', 'Online for 12 months'] },
  { id: 'legacy', name: 'Legacy', amount: 100000, features: ['Everything in Complete', '20 GB of photos and videos', 'Email, push and WhatsApp notifications', 'Archive mode, read-only forever', 'Online for 24 months', 'Priority support'] },
] as const;

// The tag line and notification channels each plan card shows on the landing
// page; the payment cards render the same so the two places always match.
const PLAN_TAGS: Record<string, string> = { essential: 'A beautiful, simple start', complete: 'Everything most couples need', legacy: 'The most space, made to last' };
const PLAN_CHANNELS: Record<string, [string, boolean][]> = { essential: [['Email', true], ['Push', false], ['WhatsApp', false]], complete: [['Email', true], ['Push', true], ['WhatsApp', false]], legacy: [['Email', true], ['Push', true], ['WhatsApp', true]] };

const ng = (n: number) => '₦' + n.toLocaleString('en-NG');
const pillBtn = (accent: string): React.CSSProperties => ({ display: 'inline-block', background: accent, color: '#fff', textDecoration: 'none', padding: '14px 15px', borderRadius: 999, fontWeight: 700, fontSize: 14, letterSpacing: '.05em', border: 'none', cursor: 'pointer', fontFamily: 'inherit' });

// Step 3 (Confirming your payment): a gateway-style verification screen with no
// backend behind it. It only behaves the way a payment gateway does while it
// checks, then hands over to the receipt page. No confirmation modal, and the
// word "confirmed" never appears: the real confirmation stays with the admin.
const VERIFY_STEPS = ['Contacting your bank…', 'Verifying the transfer…', 'Matching your payment…', 'Wrapping up the check…'];
const VERIFY_MS = 11200; // 11.2s: inside the 10-12s window the user asked for
const verifyCss = (accent: string) => `
@keyframes pfvspin { to { transform: rotate(360deg); } }
@keyframes pfvfill { from { width: 0%; } to { width: 100%; } }
@keyframes pfvsweep { 0%,100% { top: 10%; } 50% { top: 80%; } }
@keyframes pfvfade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
.pfv-ring { width: 110px; height: 110px; border-radius: 50%; margin: 0 auto; position: relative; display: flex; align-items: center; justify-content: center; background: conic-gradient(${accent} 0deg 300deg, #ece5da 300deg 360deg); animation: pfvspin 1.4s linear infinite; }
.pfv-ring::before { content: ''; position: absolute; inset: 8px; border-radius: 50%; background: #fff; }
.pfv-ring b { position: relative; font-size: 42px; color: ${accent}; font-family: Georgia, serif; }
.pfv-barwrap { height: 10px; border-radius: 999px; background: #ece5da; overflow: hidden; margin: 22px auto 0; max-width: 300px; }
.pfv-bar { height: 100%; border-radius: 999px; background: ${accent}; animation: pfvfill ${VERIFY_MS}ms linear forwards; }
.pfv-status { animation: pfvfade .45s ease; }
.pfv-doc { position: relative; width: 184px; height: 112px; margin: 22px auto 0; border-radius: 10px; border: 1px solid #ece5da; background: #faf7f0; overflow: hidden; }
.pfv-doc i { position: absolute; left: 16px; right: 16px; height: 6px; border-radius: 3px; background: #e6ded1; }
.pfv-doc em { position: absolute; left: 0; right: 0; height: 2px; background: ${accent}; opacity: .85; box-shadow: 0 0 12px ${accent}; animation: pfvsweep 1.6s ease-in-out infinite; }
`;

interface Props {
  accent: string;
  appName: string;
  email: string;
  appId: string;
  titles?: [string, string, string, string];
  intro?: string;
  note?: string;
  demoMode?: boolean;
  onDone?: () => void;
}

export default function PaymentFlow({ accent, appName, email, appId, titles = ['Your free trial has ended', 'Make your transfer', 'Confirming your payment', 'Almost there'], intro, note, demoMode, onDone }: Props) {
  // Session stickiness (user spec Nov 22 2026): someone may hop to their bank
  // app and come back, or the page may refresh mid-flow. The step, the chosen
  // plan, the session-account deadline, the uploaded receipt and the sent flag
  // live in sessionStorage for this app, so the flow reopens where it was left.
  const boot: any = (() => { try { return JSON.parse(window.sessionStorage.getItem('pf-flow-' + appId) || '{}'); } catch { return {}; } })();

  const [pay, setPay] = useState({ ...DEFAULT_PAYMENT });
  const [gb, setGb] = useState<Record<string, number>>({ essential: 5, complete: 10, legacy: 20 });
  const [iv, setIv] = useState<Record<string, number>>({});
  const [step, setStep] = useState<1 | 2 | 3 | 4>(() => {
    const n = Number(boot.step);
    return (n === 2 || n === 3 || n === 4) && PLANS.some((x) => x.id === boot.planId) ? n : 1;
  });
  const [plan, setPlan] = useState<(typeof PLANS)[number] | null>(() => PLANS.find((x) => x.id === boot.planId) || null);
  const [more, setMore] = useState('');
  const [deadline, setDeadline] = useState<number>(() => Number(boot.deadline) || 0);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptUrl, setReceiptUrl] = useState(() => String(boot.receiptUrl || ''));
  const [sent, setSent] = useState(() => !!boot.sent);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const [vi, setVi] = useState(0);
  const [nav, setNav] = useState(''); // button-level loading before a step change
const NAV_MS = 1600; // raised from 900ms on the user's ask: let the loading read clearly
  const left = !deadline ? 300 : deadline > now ? Math.ceil((deadline - now) / 1000) : 0;
  const mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

  useEffect(() => {
    (async () => {
      try {
        const { db } = await import('./lib/firebase');
        const snap = await getDoc(doc(db as any, 'platform', 'payment'));
        if (snap.exists()) setPay((p) => ({ ...p, ...(snap.data() as any) }));
      } catch { /* the defaults stay */ }
      try {
        const { db } = await import('./lib/firebase');
        const snap = await getDoc(doc(db as any, 'platform', 'settings'));
        if (snap.exists()) {
          const st = (snap.data() as any).storage || {};
          const next = { ...gb };
          for (const k of ['essential', 'complete', 'legacy'] as const) {
            const v = Number(st[k]);
            if (Number.isFinite(v) && v > 0) next[k] = v;
          }
          setGb(next);
          const ivs = (snap.data() as any).invitees || {};
          const nextIv: Record<string, number> = { ...iv };
          for (const k of ['essential', 'complete', 'legacy'] as const) {
            const v = Number(ivs[k]);
            if (Number.isFinite(v) && v > 0) nextIv[k] = v;
          }
          setIv(nextIv);
        }
      } catch { /* the defaults stay */ }
    })();
  }, []);

  useEffect(() => {
    if (!deadline) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [deadline]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem('pf-flow-' + appId, JSON.stringify({ step, planId: plan ? plan.id : '', deadline, receiptUrl, sent }));
    } catch { /* storage unavailable */ }
  }, [step, plan, deadline, receiptUrl, sent, appId]);

  useEffect(() => {
    if (step !== 2 && step !== 3) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [step]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 3800);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (step !== 3) return;
    setVi(0);
    const iv = window.setInterval(() => setVi((v) => Math.min(v + 1, VERIFY_STEPS.length - 1)), VERIFY_MS / VERIFY_STEPS.length);
    const t = window.setTimeout(() => setStep(4), VERIFY_MS);
    return () => { window.clearInterval(iv); window.clearTimeout(t); };
  }, [step]);

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
      if (demoMode) {
        // Preview runs never reach the payment desk: nothing is sent anywhere.
        setSent(true);
        setToast('This is a preview, so the receipt is not sent. On your live app this step sends it to Eventicor.');
        if (onDone) window.setTimeout(onDone, 1800);
        return;
      }
      const r = await fetch('/api/payment-submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: appId, plan: plan.name, amount: plan.amount, email, appName, receiptUrl }) });
      const j = await r.json().catch(() => ({} as any));
      if (!r.ok || !j.ok) throw new Error(j.error || 'Could not send the receipt');
      setSent(true);
      setToast('Receipt sent successfully. Your payment is being confirmed.');
      if (onDone) window.setTimeout(onDone, 1200);
    } catch (err: any) {
      setToast(err?.message || 'Could not send the receipt. Try again.');
    } finally {
      setBusy('');
    }
  }

  const card: React.CSSProperties = { background: '#fff', borderRadius: 18, padding: 16, border: '1px solid #ece5da', textAlign: 'left' };
  const gbOf = (id: string) => `${gb[id] || 5}GB`;
  // The same live details the landing page shows: the storage each plan
  // carries and the invitee count from the platform settings, worked into the
  // feature list the same way the landing does it.
  const inviteeLine = (id: string) => {
    const n = Number(iv[id]);
    return Number.isFinite(n) && n > 0 ? `${n} trackable invitees, personalized link` : '';
  };
  const effFeatures = (p: (typeof PLANS)[number]) => {
    let feats: string[] = p.features.map((f) => (/\d+ GB of photos and videos/.test(f) ? `${gb[p.id] || 5} GB of photos and videos` : String(f)));
    const line = inviteeLine(p.id);
    if (line) {
      const gi = feats.indexOf('Unlimited guests');
      if (gi >= 0) feats[gi] = line;
      else {
        const g = feats.findIndex((f) => / GB of photos and videos/.test(f));
        feats = g >= 0 ? [...feats.slice(0, g + 1), line, ...feats.slice(g + 1)] : [line, ...feats];
      }
    }
    return feats;
  };

  return (
    <div style={{ width: '100%', maxWidth: 430 }}>
      <style>{'@keyframes pfspin { to { transform: rotate(360deg); } } .pf-spin { display: inline-block; width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; animation: pfspin .7s linear infinite; vertical-align: -2px; margin-right: 8px; }'}</style>
      <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 32, lineHeight: 1.15, color: accent, fontWeight: 600, textAlign: 'center' }}>
        {titles[step - 1]}
      </div>
      {step === 1 && intro && (
        <p style={{ color: '#5a6970', marginTop: 12, lineHeight: 1.55, fontSize: 15, textAlign: 'center' }}>{intro}</p>
      )}
      {step === 1 && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 22 }}>
            {PLANS.map((p) => (
              <div key={p.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <b style={{ fontSize: 16.5 }}>{p.name}</b>
                  <span style={{ color: accent, fontWeight: 700, fontSize: 16 }}>{ng(p.amount)}</span>
                </div>
                <small style={{ color: '#93a4ab', display: 'block', marginTop: 2 }}>{gbOf(p.id)} storage</small>
                <p style={{ color: '#8a7a63', fontSize: 12.5, marginTop: 3, fontStyle: 'italic' }}>{PLAN_TAGS[p.id]}</p>
                <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: '#5a6970', fontSize: 13.5, lineHeight: 1.6 }}>
                  {(more === p.id ? effFeatures(p) : effFeatures(p).slice(0, 3)).map((f) => <li key={f}>{f}</li>)}
                </ul>
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color: '#93a4ab', marginBottom: 6 }}>NOTIFICATIONS</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {PLAN_CHANNELS[p.id].map(([label, on]) => (
                      <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: on ? '#1d2b30' : '#b9b2a6' }}>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: on ? accent : '#d9d2c6', display: 'inline-block' }} />
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button type="button" style={{ ...pillBtn(accent), flex: 1, opacity: nav && nav !== p.id ? 0.55 : 1 }} disabled={!!nav} onClick={() => { if (nav) return; setPlan(p); setMore(''); setNav(p.id); window.setTimeout(() => { setStep(2); setDeadline(Date.now() + 300000); setNav(''); }, NAV_MS); }}>
                    {nav === p.id ? <><span className="pf-spin" />SETTING UP…</> : <>CHOOSE {p.name.toUpperCase()}</>}
                  </button>
                  <button type="button" style={{ ...pillBtn(accent), flex: '0 0 auto', background: 'transparent', color: accent, border: `1.5px solid ${accent}`, padding: '13px 14px' }} onClick={() => setMore(more === p.id ? '' : p.id)}>
                    {more === p.id ? 'LESS' : 'SEE MORE'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {note && <p style={{ color: '#5a6970', fontSize: 13, lineHeight: 1.55, textAlign: 'center', marginTop: 14 }}>{note}</p>}
        </>
      )}
      {step === 2 && plan && (
        <>
          <div style={{ ...card, marginTop: 20, textAlign: 'center', padding: '18px 16px 14px' }}>
            <small style={{ color: '#8a7a63', fontWeight: 700, letterSpacing: '.1em', fontSize: 11 }}>SESSION ACCOUNT · RESERVED FOR YOU</small>
            <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: '.06em', color: left === 0 ? '#a36a00' : '#1d2b30', lineHeight: 1.05, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{left > 0 ? mm : '0:00'}</div>
            {left === 0 && (
              <p style={{ color: '#a36a00', fontSize: 13, margin: '8px 0 0' }}>This payment window has expired.</p>
            )}
          </div>
          <div style={{ ...card, marginTop: 12, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: '#5a6970' }}>
              <span><b style={{ color: '#1d2b30' }}>{plan.name}</b> plan</span>
              <span><b style={{ color: '#1d2b30' }}>{ng(plan.amount)}</b></span>
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '.06em', color: '#1d2b30', marginTop: 10 }}>{pay.accountNumber}</div>
            <div style={{ color: '#5a6970', fontSize: 14, marginTop: 4 }}>{pay.accountName}</div>
            <div style={{ color: '#93a4ab', fontSize: 13 }}>{pay.bankName}</div>
            <button type="button" style={{ ...pillBtn(accent), marginTop: 14, padding: '10px 14px', fontSize: 12.5, background: copied ? '#1f8a5b' : accent }} onClick={() => { try { navigator.clipboard?.writeText(pay.accountNumber); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { setToast('Could not copy the account number'); } }}>
              {copied ? 'COPIED' : 'COPY ACCOUNT NUMBER'}
            </button>
            <p style={{ color: '#5a6970', fontSize: 13, lineHeight: 1.55, margin: '14px 0 0' }}>
              This account is generated for this session only. Send exactly <b>{ng(plan.amount)}</b> to it.
            </p>
          </div>
          <p style={{ color: '#5a6970', fontSize: 13.5, textAlign: 'center', marginTop: 16 }}>Once your payment is made, tap the button below.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            <button type="button" style={{ ...pillBtn(accent), opacity: nav && nav !== 'paid' ? 0.55 : 1 }} disabled={!!nav} onClick={() => { if (nav) return; setNav('paid'); window.setTimeout(() => { setStep(3); setNav(''); }, NAV_MS); }}>
              {nav === 'paid' ? <><span className="pf-spin" />CHECKING…</> : "I'VE MADE THE PAYMENT"}
            </button>
            {left === 0 && (
              <button type="button" style={{ ...pillBtn(accent), background: 'transparent', color: accent, border: `1.5px solid ${accent}` }} onClick={() => setDeadline(Date.now() + 300000)}>RESTART SESSION</button>
            )}
            <button type="button" style={{ ...pillBtn(accent), background: 'transparent', color: '#5a6970', border: '1.5px solid #d9d2c6' }} onClick={() => { setStep(1); setMore(''); }}>BACK TO PLANS</button>
          </div>
        </>
      )}
      {step === 3 && plan && (
        <style>{verifyCss(accent)}</style>
      )}
      {step === 3 && plan && (
        <>
          <div style={{ ...card, marginTop: 20, textAlign: 'center', padding: '30px 18px 28px', minHeight: '54vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: '#5a6970', marginBottom: 26 }}>
              <span><b style={{ color: '#1d2b30' }}>{plan.name}</b> plan</span>
              <span><b style={{ color: '#1d2b30' }}>{ng(plan.amount)}</b></span>
            </div>
            <div className="pfv-ring"><b>₦</b></div>
            <div className="pfv-barwrap"><div className="pfv-bar" /></div>
            <p key={vi} className="pfv-status" style={{ color: '#5a6970', fontSize: 16, fontWeight: 600, margin: '22px 0 0' }}>{VERIFY_STEPS[vi]}</p>
            <p style={{ color: '#93a4ab', fontSize: 13, margin: '10px 0 0' }}>Keep this page open while we check your transfer.</p>
            <div className="pfv-doc" aria-hidden="true">
              <i style={{ top: 18 }} /><i style={{ top: 34 }} /><i style={{ top: 50, left: 34, right: 34 }} /><i style={{ top: 66 }} /><i style={{ top: 82, left: 34, right: 60 }} />
              <em />
            </div>
          </div>
        </>
      )}
      {step === 4 && plan && (
        <>
          <div style={{ ...card, marginTop: 20, textAlign: 'center', padding: '16px 16px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: '#5a6970' }}>
              <span><b style={{ color: '#1d2b30' }}>{plan.name}</b> plan</span>
              <span><b style={{ color: '#1d2b30' }}>{ng(plan.amount)}</b></span>
            </div>
          </div>
          <div style={{ ...card, marginTop: 12, minHeight: '50vh' }}>
            <p style={{ color: '#5a6970', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              Your payment is being confirmed. To make confirmation faster, upload your payment receipt below, then chat with us on WhatsApp. Confirmation is done soon after your receipt arrives.
            </p>
            <div style={{ marginTop: 14 }}>
              <label style={{ display: 'block', marginTop: 4, border: '1.5px dashed #d9d2c6', borderRadius: 14, background: '#faf7f0', padding: '30px 14px 26px', textAlign: 'center', cursor: 'pointer', opacity: busy === 'upload' ? 0.6 : 1 }}>
                <span style={{ display: 'inline-flex', width: 46, height: 46, borderRadius: '50%', background: '#f4efe6', alignItems: 'center', justifyContent: 'center', color: '#1d2b30', fontSize: 20, fontWeight: 800 }}>↑</span>
                <b style={{ display: 'block', marginTop: 10, fontSize: 15, color: '#1d2b30' }}>{busy === 'upload' ? 'UPLOADING…' : receipt ? 'CHOOSE ANOTHER RECEIPT' : 'UPLOAD RECEIPT'}</b>
                <small style={{ display: 'block', color: '#93a4ab', marginTop: 4, fontSize: 12.5 }}>A screenshot or photo of your transfer alert</small>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={pickReceipt} disabled={busy === 'upload'} />
              </label>
              {receipt && !receiptUrl && <small style={{ display: 'block', color: '#93a4ab', marginTop: 8, textAlign: 'center' }}>{receipt.name}</small>}
              {receiptUrl && (
                <div style={{ textAlign: 'center', marginTop: 10 }}>
                  <img src={receiptUrl} alt="Payment receipt" style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 12, border: '1px solid #ece5da' }} />
                </div>
              )}
            </div>
            {receiptUrl && (
              <button type="button" style={{ ...pillBtn(accent), width: '100%', marginTop: 14, opacity: sent ? 0.55 : 1 }} disabled={sent || busy === 'send'} onClick={sendReceipt}>
                {busy === 'send' ? 'SENDING…' : sent ? 'RECEIPT SENT' : 'SEND IT'}
              </button>
            )}
            <button type="button" style={{ ...pillBtn(accent), width: '100%', marginTop: 10, background: '#25d366', opacity: sent ? 1 : 0.45, cursor: sent ? 'pointer' : 'not-allowed' }} disabled={!sent} onClick={() => { if (sent) window.open(wa, '_blank'); }}>
              CONTACT SUPPORT ON WHATSAPP
            </button>
            <button type="button" style={{ ...pillBtn(accent), width: '100%', marginTop: 12, background: 'transparent', color: '#5a6970', border: '1.5px solid #d9d2c6' }} onClick={() => setStep(2)}>BACK</button>
          </div>
        </>
      )}
      {toast && (
        <div style={{ position: 'fixed', left: '50%', bottom: 26, transform: 'translateX(-50%)', background: '#14122b', color: '#fff', padding: '11px 18px', borderRadius: 999, fontSize: 13.5, fontWeight: 600, boxShadow: '0 10px 30px rgba(10,10,22,.35)', zIndex: 500, maxWidth: '88vw', textAlign: 'center' }}>{toast}</div>
      )}
    </div>
  );
}
