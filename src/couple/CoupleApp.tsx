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

export default function CoupleApp() {
  const params = new URLSearchParams(window.location.search);
  const tpl = params.get('tpl') || 'classic';
  const accKey = ACCENTS[params.get('acc') || ''] ? params.get('acc')! : (TPL_ACCENT[tpl] || 'midnight');
  const acc = ACCENTS[accKey];
  return (
    <div
      className="ev-couple-root"
      style={{ ['--ann-accent' as any]: acc.accent, ['--ann-hero' as any]: acc.hero, ['--ann-soft' as any]: acc.soft }}
    >
      <Suspense fallback={null}>
        <AnniversaryPortal previewMode onBackToMain={() => { window.location.href = '/'; }} />
      </Suspense>
    </div>
  );
}
