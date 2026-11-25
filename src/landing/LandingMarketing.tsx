import { useEffect, useState } from 'react'
import './landing.css'
import landingHtml from './landing.html?raw'
import { runLandingScript } from './landingScript'
import CelebrationPicker from './CelebrationPicker'
import { pushRoute } from '../nav'
import { bySlug, getSavedCelebration, setSavedCelebration, type Celebration } from './celebrations'

// The prototype ships its own vanilla-JS layer; run it once per page load.
let ran = false

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Swap the wedding demo words for the active celebration's demo words.
// Reverse the current tokens first, then apply the new ones, so switching
// back and forth keeps working.
function applyStatic(from: Celebration | null, to: Celebration) {
  const root = document.getElementById('ev-l')
  const stepsPre: Array<[Celebration | null, Celebration]> = []
  if (from && from.slug !== to.slug && from.slug !== 'wedding') stepsPre.push([from, bySlug.wedding])
  if (to.slug !== 'wedding') stepsPre.push([bySlug.wedding, to])
  if (root && stepsPre.length) {
    const steps = stepsPre
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    let n: Node | null
    while ((n = walker.nextNode())) nodes.push(n as Text)
    nodes.forEach((t) => {
      let v = t.nodeValue || ''
      steps.forEach(([a, b]) => {
        if (!a || a.slug === b.slug) return
        const de = (z: string) => z.replace('&amp;', '&')
        const keys: Array<keyof Celebration> = ['b', 'g', 'sub', 'invite', 'rec', 's1', 's2', 'giftSub']
        const subs: Array<[string, string]> = []
        keys.forEach((k) => {
          const av = a.slug === 'wedding' ? String(a[k]) : String(bySlug.wedding[k])
          const bv = String((a.slug === 'wedding' ? b : bySlug.wedding)[k])
          if (av && av !== bv) {
            subs.push([de(av), de(bv)])
            // Stage names appear in two casings in the demo phones.
            const ca = av.charAt(0).toUpperCase() + av.slice(1)
            const cb = bv.charAt(0).toUpperCase() + bv.slice(1)
            if (ca !== av && ca !== bv) subs.push([de(ca), de(cb)])
          }
        })
        subs.forEach(([x, y]) => {
          if (!x) return
          v = v.replace(new RegExp('(^|[^A-Za-z])' + escRe(x) + '(?![A-Za-z])', 'g'), (m, p) => p + y)
        })
      })
      t.nodeValue = v
    })
  }
  // Builder labels
  try {
    const lb = root?.querySelector('label[for="b"]')
    const lg = root?.querySelector('label[for="g"]')
    if (lb) lb.textContent = to.labels[0]
    if (lg) lg.textContent = to.labels[1]
  } catch { /* ignore */ }
  // Wedding-only stage-pack section
  const st = document.getElementById('stages')
  if (st) st.style.display = to.slug === 'wedding' ? '' : 'none'
  // Page title and description
  try {
    document.title = to.slug === 'wedding'
      ? 'Eventicor: every photo, video and wish from your event, in one beautiful place'
      : 'Eventicor \u2014 ' + to.title
    const m = document.querySelector('meta[name="description"]')
    if (m) m.setAttribute('content', to.slug === 'wedding'
      ? 'Eventicor: beautiful event websites in minutes. Upload your photos, pick a template, share your day.'
      : 'Build a beautiful ' + to.label.toLowerCase() + ' event app in minutes. Photos, videos, wishes, gifts and security in one place.')
  } catch { /* ignore */ }
}

export default function LandingMarketing({ type, picker }: { type: string; picker?: boolean }) {
  const cel = bySlug[type] || bySlug.wedding
  const [current, setCurrent] = useState(cel.slug)
  const [open, setOpen] = useState(!!picker)

  useEffect(() => {
    if (ran) return
    ran = true
    try { runLandingScript() } catch (err) { console.error('Landing init failed', err) }
  }, [])

  useEffect(() => {
    // A direct visit to /<type> is itself a choice: remember it so the
    // picker doesn't come back on the next visit, without overwriting a
    // pick the user made explicitly.
    try { if (!getSavedCelebration() && bySlug[type]) setSavedCelebration(type) } catch { /* ignore */ }
    const prev = bySlug[current] || null
    applyStatic(prev, cel)
    const w = window as unknown as { __evCelebrate?: (o: { b: string; g: string; oc: string }) => void }
    try { w.__evCelebrate?.({ b: cel.b, g: cel.g, oc: cel.slug, gn: cel.giftNote }) } catch { /* ignore */ }
    try { (window as unknown as { __evHero?: (l: string[]) => void }).__evHero?.(cel.hero) } catch { /* ignore */ }
    setCurrent(cel.slug)
    if (picker) setOpen(true)
  }, [cel.slug, picker])

  function pick(slug: string) {
    setSavedCelebration(slug)
    setOpen(false)
    pushRoute('/' + slug)
  }

  const word = (bySlug[current] || cel).short.toUpperCase().split('')

  return (
    <>
      <div id="ev-l" dangerouslySetInnerHTML={{ __html: landingHtml }} />
      {!open && (
        <div className="ev-side">
          <div className="ev-side-word" aria-hidden="true">
            {word.map((ch, i) => <span key={i}>{ch}</span>)}
          </div>
          <button className="ev-side-open" aria-label="Change celebration" title="Change celebration" onClick={() => setOpen(true)}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
        </div>
      )}
      {open && <CelebrationPicker overlay current={current} onPick={pick} onClose={() => setOpen(false)} />}
    </>
  )
}
