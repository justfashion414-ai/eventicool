import { useEffect, useState } from 'react'
import React from 'react'

const KEY = 'ev-intro-seen'
const readSeen = () => { try { return localStorage.getItem(KEY) === '1' } catch { return true } }
const markSeen = () => { try { localStorage.setItem(KEY, '1') } catch { /* private mode */ } }

// First-visit logo intro (user direction Nov 23 2026): the dark-mode Eventicor
// logo animation plays once per browser on the first visit to any Eventicor
// address, the landing or a couple's app. A refresh or any later visit goes
// straight to the page underneath (the couple app's tap-to-enter splash shows
// right after). It sits above everything while it plays and respects
// reduced-motion by skipping itself.
export default function IntroLogo() {
  const [show, setShow] = useState(false)
  const [fade, setFade] = useState(false)
  const [size] = useState(() => Math.round(Math.min(220, Math.max(96, window.innerWidth * 0.42))))
  useEffect(() => {
    if (readSeen()) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { markSeen(); return }
    markSeen()
    setShow(true)
    const t1 = window.setTimeout(() => setFade(true), 7400)
    const t2 = window.setTimeout(() => setShow(false), 8100)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])
  if (!show) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: '#0B2A21', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: fade ? 0 : 1, transition: 'opacity .6s ease' }}>
      {React.createElement('eventicor-logo', { theme: 'dark', tagline: true, size })}
    </div>
  )
}
