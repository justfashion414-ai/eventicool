import { useEffect } from 'react'
import { CELEBRATIONS } from './celebrations'

type Props = {
  current?: string | null
  onPick: (slug: string) => void
  onClose?: () => void
  overlay?: boolean
}

// Full-screen "What are you celebrating?" screen. Page mode is the first
// screen on the main URL; overlay mode reopens it from the side widget.
export default function CelebrationPicker({ current, onPick, onClose, overlay }: Props) {
  useEffect(() => {
    document.body.classList.add('ev-picker-open')
    return () => { document.body.classList.remove('ev-picker-open') }
  }, [])

  useEffect(() => {
    if (!overlay) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && onClose) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [overlay, onClose])

  return (
    <div className="ev-picker" role="dialog" aria-modal={overlay ? 'true' : undefined} aria-label="Choose your celebration">
      <div className="evc-in">
        <div className="evc-top">
          <b className="evc-brand">Eventicor</b>
          {overlay && onClose && (
            <button className="evc-x" aria-label="Close" onClick={onClose}>&times;</button>
          )}
        </div>
        <div className="evc-head">
          <h1>What are you celebrating?</h1>
          <p>Pick your event and watch your app build itself. Free to preview, live in minutes.</p>
        </div>
        <div className="evc-grid">
          {CELEBRATIONS.map((c) => (
            <button key={c.slug} className="evc-card" data-s={c.slug} onClick={() => onPick(c.slug)}>
              <i className="evc-dot" style={{ background: `linear-gradient(135deg, ${c.tint}, #151F63)` }} aria-hidden="true" />
              <b className="evc-name">{c.label}</b>
              <span className="evc-blurb">{c.blurb}</span>
              <span className="evc-go">{current === c.slug ? 'You are viewing this' : 'Explore'}{current === c.slug ? '' : ' \u2192'}</span>
            </button>
          ))}
        </div>
        <p className="evc-foot">One platform, every celebration. Your photos, videos, wishes, gifts and security in one place.</p>
      </div>
    </div>
  )
}
