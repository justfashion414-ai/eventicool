import { useEffect, useState } from 'react'

// The installation page: the last step of the landing's self-serve flow.
// An Android / iPhone toggle sits at the top; the phone screen on the left
// plays a looping animation of the install flow, and on Android the install
// button sits at the bottom of the phone screen itself and taps through to
// Chrome's own install dialog. The guide is on the right, the webinar
// pointer and community button sit below it, and the couple's web link is
// there too: the app works on the web and as an installed app, and both
// reflect the same data.

const COMMUNITY_URL = 'https://chat.whatsapp.com/KfSanIyOEU75q1bBvpqH31?s=sh&p=a&iam=2'

const ACCENTS: Record<string, { accent: string; hero: string }> = {
  midnight: { accent: '#14122b', hero: '#0a0917' },
  blush: { accent: '#d6285f', hero: '#8f1c42' },
  emerald: { accent: '#0c4a36', hero: '#07301f' },
  royal: { accent: '#2236b4', hero: '#151f63' },
  sunset: { accent: '#e07a4f', hero: '#2b1a12' },
  sage: { accent: '#2e5c45', hero: '#1f2b25' },
}

interface LeadData { bride?: string; groom?: string; email?: string; heroImages?: string[]; source?: string }

async function loadLead(id: string): Promise<LeadData | null> {
  try {
    const ls = localStorage.getItem(`ev-lead-${id}`)
    if (ls) {
      const j = JSON.parse(ls)
      if (j && (j.bride || j.title)) return j
    }
  } catch { /* ignore */ }
  try {
    const { db } = await import('../firebase')
    const { doc, getDoc } = await import('firebase/firestore')
    const snap = await getDoc(doc(db as any, 'leads', id))
    if (snap.exists()) return snap.data() as LeadData
  } catch { /* offline or unreadable: the generic copy still works */ }
  return null
}

type Os = 'android' | 'ios'

function detectOs(): Os {
  const ua = navigator.userAgent || ''
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  return 'android'
}

export default function InstallPage() {
  const params = new URLSearchParams(window.location.search)
  const leadId = params.get('lead') || ''
  const tpl = params.get('tpl') || 'classic'
  const accKey = ACCENTS[params.get('acc') || ''] ? params.get('acc')! : 'midnight'
  const acc = ACCENTS[accKey]
  const osOverride = params.get('os')
  const onDesktop = !/iphone|ipad|ipod|android/i.test(navigator.userAgent || '')

  const [lead, setLead] = useState<LeadData | null>(null)
  const [deferred, setDeferred] = useState<any>(null)
  const [installed, setInstalled] = useState(false)
  const [os, setOs] = useState<Os>(() => {
    const o = osOverride === 'android' || osOverride === 'iphone' ? osOverride : detectOs()
    return o === 'iphone' ? 'ios' : 'android'
  })
  // The looping walkthrough on the phone screen: 4 stages per device.
  const [st, setSt] = useState(0)
  useEffect(() => {
    setSt(0)
    const t = window.setInterval(() => setSt((s) => (s + 1) % 4), 1900)
    return () => window.clearInterval(t)
  }, [os])

  const bride = lead?.bride || 'Bride'
  const groom = lead?.groom || 'Groom'
  const appName = `${bride} & ${groom}`
  const splash = lead?.heroImages?.[0] || '/demo/photo1.jpg'
  const initials = (bride.charAt(0) + groom.charAt(0)).toUpperCase()

  useEffect(() => {
    if (leadId) loadLead(leadId).then(setLead)
    // The manifest and service worker make the browser's install prompt work:
    // the installed app carries the couple's names and their first photo as its icon.
    const link = document.createElement('link')
    link.rel = 'manifest'
    const q = new URLSearchParams({ tpl })
    if (params.get('acc')) q.set('acc', params.get('acc')!)
    if (params.get('exp')) q.set('exp', params.get('exp')!)
    if (leadId) q.set('lead', leadId)
    link.href = `/api/manifest?${q.toString()}`
    document.head.appendChild(link)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    const onPrompt = (e: any) => {
      e.preventDefault()
      setDeferred(e)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      link.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId])

  const appPath = `/app?${(() => {
    const q = new URLSearchParams({ tpl })
    if (params.get('acc')) q.set('acc', params.get('acc')!)
    if (params.get('exp')) q.set('exp', params.get('exp')!)
    if (leadId) q.set('lead', leadId)
    return q.toString()
  })()}`
  const webUrl = `${window.location.origin}${appPath}`

  const androidSteps = [
    'Tap the install button at the bottom of the screen.',
    'Chrome will ask to confirm. Tap Install.',
    'Wait a moment. Your app appears on your home screen, named ' + appName + '.',
    'Open it. Your app opens straight in, ready for your event.',
  ]
  const iosSteps = [
    'Tap the Share button at the bottom of Safari (the square with the arrow up).',
    'Scroll down the share sheet and tap Add to Home Screen.',
    'Tap Add. Your app lands on your home screen, named ' + appName + '.',
  ]
  const steps = os === 'ios' ? iosSteps : androidSteps

  const install = () => {
    if (deferred) {
      deferred.prompt()
      setDeferred(null)
    }
  }
  const canInstall = os === 'android' && !!deferred && !installed

  // ---- the animated phone screen ----
  const screen = (
    <div style={{ width: 250, height: 512, borderRadius: 40, border: '3px solid rgba(255,255,255,.35)', background: '#000', boxShadow: `0 30px 80px ${acc.hero}`, position: 'relative', overflow: 'hidden', flex: '0 0 auto' }}>
      {st < 3 ? (
        <>
          <img src={splash} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, transparent 40%, ${acc.hero}ee 100%)` }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: os === 'android' ? 96 : 96, textAlign: 'center' }}>
            <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 30, fontWeight: 600, textShadow: '0 2px 14px rgba(0,0,0,.5)' }}>{bride} &amp; {groom}</div>
            <div style={{ fontSize: 12.5, opacity: .85, marginTop: 4 }}>You are invited to celebrate with us</div>
          </div>
          {os === 'android' ? (
            <button
              onClick={install}
              style={{
                position: 'absolute', left: 18, right: 18, bottom: 18, height: 52, borderRadius: 14,
                border: 'none', background: '#fff', color: '#111', fontWeight: 800, fontSize: 15,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer',
                animation: 'ipPulse2 1.8s ease-in-out infinite',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0 4-4m-4 4-4-4" stroke="#111" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 20h14" stroke="#111" strokeWidth="2.2" strokeLinecap="round"/></svg>
              Install app
            </button>
          ) : (
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 46, background: 'rgba(28,28,30,.92)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', backdropFilter: 'blur(6px)' }}>
              <span style={{ opacity: .85, fontSize: 17 }}>ᐸ</span>
              <span style={{ opacity: .85, fontSize: 15 }}>⇄</span>
              <span style={{ opacity: .55, fontSize: 15 }}>＋</span>
              <span style={{
                fontSize: 15, padding: '4px 14px', borderRadius: 10, background: 'rgba(255,255,255,.16)',
                animation: st === 0 ? 'ipPulse2 1.4s ease-in-out infinite' : undefined, transition: 'background .3s',
                background: st >= 1 ? 'rgba(10,132,255,.85)' : 'rgba(255,255,255,.16)',
              }}>⬆︎</span>
              <span style={{ opacity: .85, fontSize: 15 }}>☰</span>
            </div>
          )}
          {/* Android: Chrome's own dialog slides up (stage 1); iPhone: the share sheet (stage 1-2) */}
          {os === 'android' && st === 1 && (
            <div style={{ position: 'absolute', left: 18, right: 18, bottom: 82 }}>
              <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,.25)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '100%', borderRadius: 99, background: '#fff', animation: 'ipLoad 1.7s ease-in-out infinite' }} />
              </div>
            </div>
          )}
          {os === 'ios' && st >= 1 && st < 3 && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ width: '100%', borderRadius: '18px 18px 0 0', background: '#f2f2f7', color: '#111', padding: '14px 14px 18px', animation: 'ipUp .45s cubic-bezier(.2,.8,.25,1) both', maxHeight: 250, overflow: 'hidden' }}>
                <div style={{ fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 8 }}>⌒</div>
                {['Copy', 'Add to Favorites', 'Mark as Unread', 'Add to Home Screen'].map((r) => (
                  <div key={r} style={{
                    padding: '12px 12px', fontSize: 14.5, borderBottom: '1px solid #e2e2e7',
                    background: r === 'Add to Home Screen' && st === 2 ? '#d7e9ff' : 'transparent', borderRadius: 8,
                    fontWeight: r === 'Add to Home Screen' ? 700 : 400, color: r === 'Add to Home Screen' ? '#0a84ff' : '#111',
                  }}>
                    ＋ {r}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* stage 3: the home screen, with the app landing on it */
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,#20242e,#111520 70%)', padding: '34px 18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, background: ['rgba(255,255,255,.14)', 'rgba(255,255,255,.1)', 'rgba(255,255,255,.18)'][i % 3] }} />
                <div style={{ width: 26, height: 4, borderRadius: 4, background: 'rgba(255,255,255,.18)' }} />
              </div>
            ))}
            <div style={{ display: 'grid', justifyItems: 'center', gap: 4, animation: 'ipLand .55s cubic-bezier(.2,.8,.25,1) both' }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: acc.accent, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 15, boxShadow: `0 6px 18px ${acc.accent}88` }}>{initials}</div>
              <div style={{ fontSize: 8.5, color: '#fff', maxWidth: 46, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{appName}</div>
            </div>
          </div>
        </div>
      )}
      <div style={{ position: 'absolute', left: '50%', bottom: 6, transform: 'translateX(-50%)', width: 96, height: 4, borderRadius: 99, background: 'rgba(255,255,255,.55)', zIndex: 5 }} />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0d0b1f 0%,#171129 55%,#0d0b1f 100%)', color: '#fff', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <style>{`
        @keyframes ipFloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
        @keyframes ipPulse2 { 0%,100% { box-shadow: 0 0 0 0 ${acc.accent}00 } 50% { box-shadow: 0 0 0 14px ${acc.accent}55 } }
        @keyframes ipUp { from { opacity: 0; transform: translateY(36px) } to { opacity: 1; transform: none } }
        @keyframes ipLoad { 0% { transform: translateX(-100%) } 100% { transform: translateX(100%) } }
        @keyframes ipLand { from { opacity: 0; transform: scale(.5) translateY(-14px) } to { opacity: 1; transform: none } }
      `}</style>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 26px' }}>
        <b style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 21, letterSpacing: '.02em' }}>Eventicor</b>
        <span style={{ fontSize: 12.5, opacity: .75 }}>{appName}</span>
      </header>
      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '10px 26px 70px' }}>
        {/* the Android / iPhone toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 30 }}>
          <div style={{ display: 'inline-flex', gap: 4, padding: 5, borderRadius: 999, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)' }}>
            {([['android', 'Android'], ['ios', 'iPhone']] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setOs(k)}
                style={{
                  border: 'none', cursor: 'pointer', padding: '10px 26px', borderRadius: 999, fontSize: 14.5,
                  fontWeight: 700, background: os === k ? acc.accent : 'transparent', color: '#fff', opacity: os === k ? 1 : .7,
                  transition: 'background .25s, opacity .25s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 34, alignItems: 'center', justifyContent: 'center' }}>
          {/* Left: the animated phone screen */}
          <div style={{ display: 'grid', placeItems: 'center', animation: 'ipFloat 5s ease-in-out infinite' }}>{screen}</div>
          {/* Right: the guide */}
          <div style={{ flex: '1 1 380px', maxWidth: 470 }}>
            {installed ? (
              <>
                <h1 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 40, lineHeight: 1.1, margin: 0 }}>Your app is installed</h1>
                <p style={{ fontSize: 16.5, lineHeight: 1.6, opacity: .9, marginTop: 14, fontWeight: 600 }}>
                  {appName} now lives on your home screen. Open it any time, no browser needed.
                </p>
                <a href={appPath} style={{ display: 'inline-block', marginTop: 22, background: acc.accent, color: '#fff', textDecoration: 'none', padding: '16px 34px', borderRadius: 999, fontWeight: 800, letterSpacing: '.04em' }}>
                  OPEN YOUR APP
                </a>
              </>
            ) : (
              <>
                <h1 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 40, lineHeight: 1.1, margin: 0 }}>Install your app</h1>
                <p style={{ fontSize: 16.5, lineHeight: 1.6, opacity: .9, marginTop: 14, fontWeight: 700 }}>
                  Put {appName} on your home screen. It works like a real app, with your name on the icon.
                </p>
                <ol style={{ listStyle: 'none', padding: 0, margin: '24px 0 0', display: 'grid', gap: 14 }}>
                  {steps.map((s, i) => (
                    <li key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                      <span style={{ flex: '0 0 34px', height: 34, borderRadius: 999, background: acc.accent, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 15 }}>{i + 1}</span>
                      <b style={{ fontSize: 16.5, lineHeight: 1.5, paddingTop: 4 }}>{s}</b>
                    </li>
                  ))}
                </ol>
                {onDesktop && (
                  <p style={{ marginTop: 18, fontSize: 14.5, opacity: .85, lineHeight: 1.55 }}>
                    You are on a computer right now. Open this page on your phone to install the app there.
                  </p>
                )}
                {os === 'android' && !deferred && !installed && (
                  <p style={{ marginTop: 18, fontSize: 14.5, opacity: .85, lineHeight: 1.55 }}>
                    No install prompt? In Chrome, tap the menu (three dots) and choose <b>Add to Home screen</b>.
                  </p>
                )}
                <div style={{ marginTop: 30, padding: '18px 20px', borderRadius: 18, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.14)' }}>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, fontWeight: 700 }}>
                    The link to our webinar, which shows you how to manage your app for your event, arrives right here below the install button. Join the Eventicor community on WhatsApp to get it.
                  </p>
                  <a href={COMMUNITY_URL} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 12, background: '#1faf54', color: '#fff', textDecoration: 'none', padding: '14px 24px', borderRadius: 999, fontWeight: 800, fontSize: 14.5 }}>
                    Join the Eventicor community on WhatsApp
                  </a>
                  {lead?.email && (
                    <p style={{ margin: '12px 0 0', fontSize: 13.5, opacity: .85, lineHeight: 1.55 }}>
                      Your login details have been sent to <b>{lead.email}</b>.
                    </p>
                  )}
                </div>
                <div style={{ marginTop: 22, padding: '18px 20px', borderRadius: 18, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.14)' }}>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, fontWeight: 700 }}>You can also open your app on the web.</p>
                  <p style={{ margin: '6px 0 12px', fontSize: 13.5, opacity: .85, lineHeight: 1.55 }}>
                    Everything you set up appears in both the web app and the installed app: same app, two ways in.
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input readOnly value={webUrl} onFocus={(e) => e.currentTarget.select()} style={{ flex: '1 1 220px', minWidth: 0, background: 'rgba(0,0,0,.35)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 12, color: '#fff', padding: '11px 12px', fontSize: 13 }} />
                    <button onClick={() => { navigator.clipboard?.writeText(webUrl) }} style={{ border: 'none', cursor: 'pointer', borderRadius: 12, padding: '11px 16px', fontWeight: 700, background: 'rgba(255,255,255,.14)', color: '#fff', fontSize: 13 }}>
                      Copy link
                    </button>
                    <a href={appPath} style={{ display: 'inline-block', borderRadius: 12, padding: '11px 16px', fontWeight: 700, background: acc.accent, color: '#fff', textDecoration: 'none', fontSize: 13 }}>
                      Open on the web
                    </a>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
