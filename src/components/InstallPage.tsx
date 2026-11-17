import { useEffect, useState } from 'react'

// The installation page: the last step of the landing's self-serve flow.
// It detects the visitor's phone, walks them through installing their PWA
// (Chrome's own prompt on Android, Share > Add to Home Screen on iPhone),
// and points them at the Eventicor community for the management webinar.
// A device override (?os=android|iphone) exists for testing on desktop.

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

type Os = 'android' | 'ios' | 'other'

function detectOs(): Os {
  const ua = navigator.userAgent || ''
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'other'
}

export default function InstallPage() {
  const params = new URLSearchParams(window.location.search)
  const leadId = params.get('lead') || ''
  const tpl = params.get('tpl') || 'classic'
  const accKey = ACCENTS[params.get('acc') || ''] ? params.get('acc')! : 'midnight'
  const acc = ACCENTS[accKey]
  const osOverride = params.get('os')

  const [lead, setLead] = useState<LeadData | null>(null)
  const [deferred, setDeferred] = useState<any>(null)
  const [installed, setInstalled] = useState(false)
  const [os, setOs] = useState<Os>(() => {
    const o = osOverride === 'android' || osOverride === 'iphone' ? osOverride : detectOs()
    return o === 'iphone' ? 'ios' : o === 'android' ? 'android' : 'other'
  })

  const bride = lead?.bride || 'Bride'
  const groom = lead?.groom || 'Groom'
  const appName = `${bride} & ${groom}`
  const splash = lead?.heroImages?.[0] || '/demo/photo1.jpg'

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

  const appUrl = `/app?${(() => {
    const q = new URLSearchParams({ tpl })
    if (params.get('acc')) q.set('acc', params.get('acc')!)
    if (params.get('exp')) q.set('exp', params.get('exp')!)
    if (leadId) q.set('lead', leadId)
    return q.toString()
  })()}`

  const androidSteps = [
    'Tap the glowing Install button below.',
    'Chrome will ask to confirm. Tap Install.',
    'Wait a moment. Your app appears on your home screen, named ' + appName + '.',
    'Open it. Your app opens straight in, ready for your event.',
  ]
  const iosSteps = [
    'Tap the Share button (the square with the arrow up) at the bottom of Safari.',
    'Scroll down the share sheet and tap Add to Home Screen.',
    'Tap Add. Your app lands on your home screen, named ' + appName + '.',
  ]

  const steps = os === 'ios' ? iosSteps : androidSteps
  const showInstallButton = os === 'android' && !!deferred && !installed

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0d0b1f 0%,#171129 55%,#0d0b1f 100%)', color: '#fff', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <style>{`
        @keyframes ipFloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
        @keyframes ipShine { 0% { transform: translateX(-120%) } 55%,100% { transform: translateX(220%) } }
        @keyframes ipPulse { 0%,100% { box-shadow: 0 0 0 0 ${acc.accent}aa, 0 14px 40px ${acc.accent}66 } 50% { box-shadow: 0 0 0 16px ${acc.accent}00, 0 14px 40px ${acc.accent}88 } }
        @keyframes ipSpin { to { transform: rotate(360deg) } }
      `}</style>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 26px' }}>
        <b style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 21, letterSpacing: '.02em' }}>Eventicor</b>
        <span style={{ fontSize: 12.5, opacity: .75 }}>{appName}</span>
      </header>
      <main style={{ display: 'flex', flexWrap: 'wrap', gap: 34, alignItems: 'center', justifyContent: 'center', padding: '26px 26px 70px', maxWidth: 1080, margin: '0 auto' }}>
        {/* Left: the animated phone screen */}
        <div style={{ flex: '0 1 340px', display: 'grid', placeItems: 'center', animation: 'ipFloat 5s ease-in-out infinite' }}>
          <div style={{ width: 250, height: 512, borderRadius: 40, border: '3px solid rgba(255,255,255,.35)', background: '#000', boxShadow: `0 30px 80px ${acc.hero}`, position: 'relative', overflow: 'hidden' }}>
            <img src={splash} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, transparent 45%, ${acc.hero}e6 100%)` }} />
            <div style={{ position: 'absolute', top: 0, left: 0, width: '55%', height: '100%', background: 'linear-gradient(100deg, transparent, rgba(255,255,255,.28), transparent)', animation: 'ipShine 3.2s ease-in-out infinite' }} />
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 84, textAlign: 'center' }}>
              <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 30, fontWeight: 600, textShadow: '0 2px 14px rgba(0,0,0,.5)' }}>{bride} &amp; {groom}</div>
              <div style={{ fontSize: 12.5, opacity: .85, marginTop: 4 }}>You are invited to celebrate with us</div>
            </div>
            <div style={{ position: 'absolute', left: '50%', bottom: 12, transform: 'translateX(-50%)', width: 96, height: 4, borderRadius: 99, background: 'rgba(255,255,255,.55)' }} />
          </div>
        </div>
        {/* Right: the guide */}
        <div style={{ flex: '1 1 380px', maxWidth: 470 }}>
          {installed ? (
            <>
              <h1 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 40, lineHeight: 1.1, margin: 0 }}>Your app is installed</h1>
              <p style={{ fontSize: 16.5, lineHeight: 1.6, opacity: .9, marginTop: 14, fontWeight: 600 }}>
                {appName} now lives on your home screen. Open it any time, no browser needed.
              </p>
              <a href={appUrl} style={{ display: 'inline-block', marginTop: 22, background: acc.accent, color: '#fff', textDecoration: 'none', padding: '16px 34px', borderRadius: 999, fontWeight: 800, fontSize: 15, letterSpacing: '.05em' }}>
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
              {os === 'other' && (
                <p style={{ marginTop: 18, fontSize: 14.5, opacity: .85, lineHeight: 1.55 }}>
                  You are on a computer right now. Open this page on your phone to install the app there.
                </p>
              )}
              {showInstallButton && (
                <button
                  onClick={() => { deferred.prompt(); setDeferred(null) }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginTop: 26, background: acc.accent, color: '#fff', border: 'none', padding: '18px 38px', borderRadius: 999, fontWeight: 800, fontSize: 16, letterSpacing: '.06em', cursor: 'pointer', animation: 'ipPulse 1.8s ease-in-out infinite' }}
                >
                  INSTALL THE APP
                </button>
              )}
              {os === 'android' && !deferred && !installed && (
                <p style={{ marginTop: 18, fontSize: 14.5, opacity: .85, lineHeight: 1.55 }}>
                  No install button? In Chrome, tap the menu (three dots) and choose <b>Add to Home screen</b>.
                </p>
              )}
              <div style={{ marginTop: 30, padding: '18px 20px', borderRadius: 18, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.14)' }}>
                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, fontWeight: 700 }}>
                  The link to our webinar, which shows you how to manage your app for your event, arrives right here below the install button. Join the Eventicor community on WhatsApp to get it.
                </p>
                <a href={COMMUNITY_URL} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 12, background: '#1faf54', color: '#fff', textDecoration: 'none', padding: '12px 24px', borderRadius: 999, fontWeight: 800, fontSize: 13.5, letterSpacing: '.04em' }}>
                  Join the Eventicor community on WhatsApp
                </a>
                {lead?.email && (
                  <p style={{ margin: '12px 0 0', fontSize: 13.5, opacity: .85, lineHeight: 1.55 }}>
                    Your login details have been sent to <b>{lead.email}</b>.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
