import { lazy, Suspense } from 'react';

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
// its own 3-day expiry (?exp=unix seconds), so a lead needs no email: it opens
// on its own, and after 3 days it points back to the Eventicor landing page.
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

export default function CoupleApp() {
  const params = new URLSearchParams(window.location.search);
  const tplRaw = params.get('tpl') || 'classic';
  const tpl = ['classic', 'halo', 'hero', 'book'].includes(tplRaw) ? tplRaw : 'classic';
  const accKey = ACCENTS[params.get('acc') || ''] ? params.get('acc')! : (TPL_ACCENT[tpl] || 'midnight');
  const acc = ACCENTS[accKey];
  const expRaw = Number(params.get('exp') || 0);
  const isSample = expRaw > 0;
  const expired = isSample && Date.now() / 1000 > expRaw;
  if (expired) return <SampleExpired accent={acc.accent} />;
  return (
    <div
      className="ev-couple-root"
      style={{ ['--ann-accent' as any]: acc.accent, ['--ann-hero' as any]: acc.hero, ['--ann-soft' as any]: acc.soft }}
    >
      <Suspense fallback={null}>
        <AnniversaryPortal previewMode onBackToMain={() => { window.location.href = '/'; }} template={tpl as any} />
      </Suspense>
      {isSample && (
        <div style={{ position: 'fixed', left: 12, bottom: 112, zIndex: 60, background: 'rgba(10,10,22,.72)', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '.07em', padding: '6px 12px', borderRadius: 999, pointerEvents: 'none', textTransform: 'uppercase' }}>
          Sample app
        </div>
      )}
    </div>
  );
}
