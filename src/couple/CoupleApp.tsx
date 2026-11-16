import { lazy, Suspense } from 'react'
import type { Tpl } from './TemplateApp'

const TemplateApp = lazy(() => import('./TemplateApp'))

// Six Eventicor accents mapped onto the templateable couple app: --b background,
// --f foreground, --a accent (the landing's TP palette, verbatim).
const ACCENTS: Record<string, { b: string; f: string; a: string }> = {
  midnight: { b: '#14122b', f: '#f4e9d3', a: '#d8b06a' },
  blush:    { b: '#fbe1e8', f: '#4a1530', a: '#d6285f' },
  emerald:  { b: '#0c4a36', f: '#f2f8ee', a: '#f4b393' },
  royal:    { b: '#2236b4', f: '#ffffff', a: '#f6d36b' },
  sunset:   { b: '#2b1a12', f: '#fdeedd', a: '#e07a4f' },
  sage:     { b: '#1f2b25', f: '#eef5ef', a: '#8fbfa3' },
}
const TPL_ACCENT: Record<Tpl, string> = { classic: 'midnight', halo: 'blush', hero: 'emerald', book: 'royal' }

export default function CoupleApp() {
  const params = new URLSearchParams(window.location.search)
  const tplRaw = (params.get('tpl') || 'classic') as Tpl
  const tpl: Tpl = ['classic', 'halo', 'hero', 'book'].includes(tplRaw) ? tplRaw : 'classic'
  const accKey = ACCENTS[params.get('acc') || ''] ? params.get('acc')! : (TPL_ACCENT[tpl] || 'midnight')
  const acc = ACCENTS[accKey]
  return (
    <div
      className="ev-couple-root"
      style={{ ['--b' as any]: acc.b, ['--f' as any]: acc.f, ['--a' as any]: acc.a }}
    >
      <Suspense fallback={null}>
        <TemplateApp tpl={tpl} />
      </Suspense>
    </div>
  )
}
