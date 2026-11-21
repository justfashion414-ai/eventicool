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
  { id: 'essential', name: 'Essential', amount: 30000, features: ['Your wedding app with your names, city and hero photos', 'Guest wall: posts, comments and reactions', 'Photo albums and video reels', 'Wedding countdown, events and details', 'Online for one year'] },
  { id: 'complete', name: 'Complete', amount: 50000, features: ['Everything in Essential', 'Photographer and videographer accounts', 'Vendor accounts with their own uploads', 'Private albums with admin approval', 'Online for one year'] },
  { id: 'legacy', name: 'Legacy', amount: 100000, features: ['Everything in Complete', 'Priority WhatsApp support', 'Longest archive keep after the wedding', 'Online for one year'] },
] as const;

const ng = (n: number) => '₦' + n.toLocaleString('en-NG');
const pillBtn = (accent: string): React.CSSProperties => ({ display: 'inline-block', background: accent, color: '#fff', textDecoration: 'none', padding: '14px 26px', borderRadius: 999, fontWeight: 700, fontSize: 14, letterSpacing: '.05em', border: 'none', cursor: 'pointer', fontFamily: 'inherit' });

interface Props {
  accent: string;
  appName: string;
  email: string;
  appId: string;
  titles?: [string, string, string];
  intro?: string;
  note?: string;
  demoMode?: boolean;
  onDone?: () => void;
}

export default function PaymentFlow({ accent, appName, email, appId, titles = ['Your free trial has ended', 'Make your transfer', 'Almost there'], intro, note, demoMode, onDone }: Props) {
  const [pay, setPay] = useState({ ...DEFAULT_PAYMENT });
  const [gb, setGb] = useState<Record<string, number>>({ essential: 5, complete: 10, legacy: 20 });
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [plan, setPlan] = useState<(typeof PLANS)[number] | null>(null);
  const [more, setMore] = useState('');
  const [left, setLeft] = useState(300);
  const [copied, setCopied] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
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
        }
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

  return (
    <div style={{ width: '100%', maxWidth: 430 }}>
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
                <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: '#5a6970', fontSize: 13.5, lineHeight: 1.6 }}>
                  {(more === p.id ? ([...p.features.slice(0, p.id === 'legacy' ? 1 : 3), `${gbOf(p.id)} of storage`, ...p.features.slice(p.id === 'legacy' ? 1 : 3)] as string[]) : ([...p.features.slice(0, 3), `${gbOf(p.id)} of storage`] as string[])).map((f) => <li key={f}>{f}</li>)}
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
          {note && <p style={{ color: '#5a6970', fontSize: 13, lineHeight: 1.55, textAlign: 'center', marginTop: 14 }}>{note}</p>}
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
            <button type="button" style={{ ...pillBtn(accent), width: '100%', marginTop: 10, background: '#25d366', opacity: sent ? 1 : 0.45, cursor: sent ? 'pointer' : 'not-allowed' }} disabled={!sent} onClick={() => { if (sent) window.open(wa, '_blank'); }}>
              CONTACT SUPPORT ON WHATSAPP
            </button>
            <p style={{ color: '#93a4ab', fontSize: 12, textAlign: 'center', margin: '10px 0 0' }}>
              {sent ? 'WhatsApp is open for you above.' : 'WhatsApp unlocks after your receipt is sent.'}
            </p>
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
