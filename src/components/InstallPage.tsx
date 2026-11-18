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

export default function InstallPage({ guideOnly, names, installable: installableProp }: { guideOnly?: boolean; names?: string; installable?: boolean }) {
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
  // Outside a lead (a preview or a couple's own app), the caller names the couple.
  const appName = (lead?.bride && lead?.groom) ? `${bride} & ${groom}` : (names || `${bride} & ${groom}`)

  // Only a customer's own app (created on the landing page, 24-hour trial)
  // can be installed. Sample apps and previews show the guide as marketing:
  // no install button and no manifest, so nothing can ever install there.
  // The in-app overlay passes the answer in; the standalone page reads it
  // from the lead it loads.
  const installable = installableProp !== undefined
    ? installableProp
    : (leadId ? (lead ? lead.source === 'landing' : true) : false)
  const splash = lead?.heroImages?.[0] || '/demo/photo1.jpg'
  const initials = (bride.charAt(0) + groom.charAt(0)).toUpperCase()

  useEffect(() => {
    if (leadId) loadLead(leadId).then(setLead)
    // The service worker keeps the app working offline. The manifest is what
    // makes the browser's install prompt work, and the installed app carries
    // the couple's names and their first photo as its icon. It is injected
    // ONLY for a customer's own app: a sample page never gets a manifest, so
    // no install prompt can ever fire there.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    const link = installable ? document.createElement('link') : null
    if (link) {
      link.rel = 'manifest'
      const q = new URLSearchParams({ tpl })
      if (params.get('acc')) q.set('acc', params.get('acc')!)
      if (params.get('exp')) q.set('exp', params.get('exp')!)
      if (leadId) q.set('lead', leadId)
      link.href = `/api/manifest?${q.toString()}`
      document.head.appendChild(link)
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
      link?.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, installable])

  const appPath = `/app?${(() => {
    const q = new URLSearchParams({ tpl })
    if (params.get('acc')) q.set('acc', params.get('acc')!)
    if (params.get('exp')) q.set('exp', params.get('exp')!)
    if (leadId) q.set('lead', leadId)
    return q.toString()
  })()}`
  const webUrl = `${window.location.origin}${appPath}`

  const androidSteps = [
    'Tap the INSTALL APP button under the phone.',
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

  const [installMsg, setInstallMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [copyErr, setCopyErr] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const install = () => {
    if (deferred) {
      deferred.prompt()
      setDeferred(null)
      setInstallMsg('')
      setWaiting(false)
      return
    }
    // Chrome offers its install popup a moment after the page loads; wait for it.
    setInstallMsg('')
    setWaiting(true)
  }
  useEffect(() => {
    if (!waiting) return
    if (deferred) {
      deferred.prompt()
      setDeferred(null)
      setWaiting(false)
      return
    }
    const t = window.setTimeout(() => {
      setWaiting(false)
      setInstallMsg(onDesktop
        ? 'Open this page on your phone in Chrome, then tap Install app.'
        : "Chrome didn't show its popup. Use Chrome's menu (three dots) and choose Add to Home screen.")
    }, 6000)
    return () => window.clearTimeout(t)
  }, [waiting, deferred])
  // If the app is already on this phone, the button says so instead of offering to install again.
  useEffect(() => {
    try {
      if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) setInstalled(true);
    } catch { /* ignore */ }
    const relApps = (navigator as any).getInstalledRelatedApps;
    if (typeof relApps === 'function') relApps.call(navigator).then((l: any[]) => { if (Array.isArray(l) && l.length) setInstalled(true); }).catch(() => {});
  }, []);
  const canInstall = os === 'android' && !!deferred && !installed

  // ---- the animated phone screen ----
  const screen = (
    <div style={{ width: 250, height: 512, borderRadius: 40, border: '3px solid rgba(255,255,255,.35)', background: '#000', boxShadow: `0 30px 80px ${acc.hero}`, position: 'relative', overflow: 'hidden', flex: '0 0 auto' }}>
      {os === 'ios' && st < 3 ? (
        st < 2 ? (
          /* stages 0-1: Safari's share sheet slides up, then Add to Home Screen is tapped */
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,#20242e,#111520 70%)', display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ width: '100%', borderRadius: '18px 18px 0 0', background: '#f2f2f7', color: '#111', padding: '14px 14px 18px', animation: 'ipUp .45s cubic-bezier(.2,.8,.25,1) both', maxHeight: 250, overflow: 'hidden' }}>
              <div style={{ fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 8 }}>⌒</div>
              {['Copy', 'Add to Favorites', 'Mark as Unread', 'Add to Home Screen'].map((r) => (
                <div key={r} style={{
                  padding: '12px 12px', fontSize: 14.5, borderBottom: '1px solid #e2e2e7',
                  background: r === 'Add to Home Screen' && st === 1 ? '#d7e9ff' : 'transparent', borderRadius: 8,
                  fontWeight: r === 'Add to Home Screen' ? 700 : 400, color: r === 'Add to Home Screen' ? '#0a84ff' : '#111',
                  animation: r === 'Add to Home Screen' && st === 0 ? 'ipPulse2 1.4s ease-in-out infinite' : undefined,
                }}>
                  ＋ {r}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* stage 2: adding to the home screen */
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,#20242e,#111520 70%)', display: 'grid', placeItems: 'center' }}>
            <div style={{ width: '72%' }}>
              <div style={{ fontSize: 13.5, color: '#fff', opacity: .9, textAlign: 'center', marginBottom: 10, fontWeight: 700 }}>Adding {appName} to your Home Screen…</div>
              <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,.22)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '100%', borderRadius: 99, background: acc.accent, animation: 'ipLoad 1.5s ease-in-out infinite' }} />
              </div>
            </div>
          </div>
        )
            ) : os === 'android' && st < 3 ? (
        st < 2 ? (
          /* stages 0-1: Chrome's install popup slides up, then Install is tapped */
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,#20242e,#111520 70%)', display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ width: '100%', background: '#fff', color: '#1f1f1f', borderRadius: '24px 24px 0 0', padding: '22px 18px 18px', animation: 'ipUp .45s cubic-bezier(.2,.8,.25,1) both', boxShadow: '0 -12px 40px rgba(0,0,0,.45)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: acc.accent, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 17 }}>{initials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 15.5 }}>Install app</div>
                  <div style={{ fontSize: 12.5, color: '#5f6368', marginTop: 2 }}>Add {appName} to your home screen</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 18 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: acc.accent, padding: '10px 14px', borderRadius: 10 }}>Cancel</span>
                <span style={{
                  fontSize: 13.5, fontWeight: 800, color: st === 1 ? '#fff' : acc.accent,
                  background: st === 1 ? acc.accent : 'transparent',
                  padding: '10px 20px', borderRadius: 10,
                  animation: st === 0 ? 'ipPulse2 1.4s ease-in-out infinite' : undefined,
                  boxShadow: st === 1 ? `0 4px 14px ${acc.accent}66` : undefined,
                }}>Install</span>
              </div>
            </div>
          </div>
        ) : (
          /* stage 2: installing */
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,#20242e,#111520 70%)', display: 'grid', placeItems: 'center' }}>
            <div style={{ width: '72%' }}>
              <div style={{ fontSize: 13.5, color: '#fff', opacity: .9, textAlign: 'center', marginBottom: 10, fontWeight: 700 }}>Installing {appName}…</div>
              <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,.22)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '100%', borderRadius: 99, background: acc.accent, animation: 'ipLoad 1.5s ease-in-out infinite' }} />
              </div>
            </div>
          </div>
        )
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
        .ip-row{display:flex;gap:44px;align-items:flex-start;justify-content:center;flex-wrap:wrap}
        .ip-phone{flex:0 0 250px;display:grid;justify-items:center;gap:16px}
        .ip-screenbox{width:250px;height:512px;position:relative;overflow:visible}
        .ip-scale{width:250px;transform-origin:top left}
        .ip-guide{flex:1 1 380px;max-width:470px;min-width:0}
        .ip-below{margin:44px auto 0;max-width:720px;display:grid;gap:18px}
        .ip-install{border:none;cursor:pointer;background:${acc.accent};color:#fff;padding:16px 40px;border-radius:999px;font-weight:800;font-size:15.5px;letter-spacing:.06em;box-shadow:0 10px 30px ${acc.accent}66;touch-action:manipulation}
        @media(max-width:760px){
          .ip-row{gap:14px;flex-wrap:nowrap;padding:0 10px}
          .ip-phone{flex:0 0 154px;gap:12px}
          .ip-screenbox{width:154px;height:310px}
          .ip-scale{transform:scale(.6)}
          .ip-guide h1{font-size:25px !important}
          .ip-guide p{font-size:14px !important}
          .ip-guide b{font-size:13.5px !important}
          .ip-install{padding:12px 26px !important;font-size:13px !important}
          .ip-phone p{font-size:11.5px !important;max-width:170px !important}
        }
      `}</style>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: guideOnly ? '18px 68px 18px 26px' : '18px 26px' }}>
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
        <div className="ip-row">
          {/* Left: the animated phone screen, with the real install button under it */}
          <div className="ip-phone">
            <div className="ip-screenbox"><div className="ip-scale"><div style={{ animation: 'ipFloat 5s ease-in-out infinite', width: 250 }}>{screen}</div></div></div>
            {os === 'android' && installable && (
              <>
                <button onClick={installed ? () => setInstalled(true) : install} className="ip-install">
                  {installed ? 'APP INSTALLED' : 'INSTALL APP'}
                </button>
                {installed ? (
                  <p style={{ margin: 0, fontSize: 13, opacity: .85, maxWidth: 260, textAlign: 'center', lineHeight: 1.5 }}>
                    Your app is already installed. Check your home screen for the {appName} icon.
                  </p>
                ) : (installMsg || waiting) && (
                  <p style={{ margin: 0, fontSize: 13, opacity: .85, maxWidth: 260, textAlign: 'center', lineHeight: 1.5 }}>{waiting ? "Getting Chrome's install popup ready…" : installMsg}</p>
                )}
              </>
            )}
          </div>
          {/* Right: the guide */}
          <div className="ip-guide">
            <>
                <h1 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 40, lineHeight: 1.1, margin: 0 }}>Install your app</h1>
                <p style={{ fontSize: 16.5, lineHeight: 1.6, opacity: .9, marginTop: 14, fontWeight: 700 }}>
                  {installable
                    ? <>Put {appName} on your home screen. It works like a real app, with your name on the icon.</>
                    : <>Here is how your own app will sit on your home screen, with your names on the icon.</>}
                </p>
                {installed && (
                  <p style={{ marginTop: 16, padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,.08)', border: `1px solid ${acc.accent}55`, fontSize: 15, fontWeight: 800, lineHeight: 1.5 }}>
                    Your app is installed. Check your home screen for the {appName} icon.
                  </p>
                )}
                <ol style={{ listStyle: 'none', padding: 0, margin: '24px 0 0', display: 'grid', gap: 14 }}>
                  {steps.map((s, i) => (
                    <li key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                      <span style={{ flex: '0 0 34px', height: 34, borderRadius: 999, background: acc.accent, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 15 }}>{i + 1}</span>
                      <b style={{ fontSize: 16.5, lineHeight: 1.5, paddingTop: 4 }}>{s}</b>
                    </li>
                  ))}
                </ol>
                {!installable && (
                  <div style={{ marginTop: 20, padding: '16px 18px', borderRadius: 14, background: 'rgba(255,255,255,.08)', border: `1px solid ${acc.accent}55` }}>
                    <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, fontWeight: 700 }}>
                      This is exactly how your own app will download and stay saved on your phone permanently, once you create it yourself on the Eventicor website. This one is only a sample, so there is nothing to install here yet.
                    </p>
                    <a href="https://eventicor.name.ng" target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 12, background: acc.accent, color: '#fff', textDecoration: 'none', padding: '13px 22px', borderRadius: 999, fontWeight: 800, fontSize: 14 }}>
                      Create your own app
                    </a>
                  </div>
                )}
              </>
          </div>
        </div>
        {!guideOnly && (
          <div className="ip-below">
                {!installed && onDesktop && installable && (
                  <p style={{ margin: 0, fontSize: 14.5, opacity: .85, lineHeight: 1.55 }}>
                    You are on a computer right now. Open this page on your phone to install the app there.
                  </p>
                )}
                {!installed && installable && os === 'android' && !deferred && (
                  <p style={{ margin: 0, fontSize: 14.5, opacity: .85, lineHeight: 1.55 }}>
                    No install prompt? In Chrome, tap the menu (three dots) and choose <b>Add to Home screen</b>.
                  </p>
                )}
                <div style={{ marginTop: 0, padding: '18px 20px', borderRadius: 18, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.14)' }}>
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
                <div style={{ margin: 0, padding: '18px 20px', borderRadius: 18, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.14)' }}>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, fontWeight: 700 }}>You can also open your app on the web.</p>
                  <p style={{ margin: '6px 0 12px', fontSize: 13.5, opacity: .85, lineHeight: 1.55 }}>
                    Everything you set up appears in both the web app and the installed app: same app, two ways in.
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input readOnly value={webUrl} onFocus={(e) => e.currentTarget.select()} style={{ flex: '1 1 220px', minWidth: 0, background: 'rgba(0,0,0,.35)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 12, color: '#fff', padding: '11px 12px', fontSize: 13 }} />
                    <button
                      onClick={async () => {
                        // Answer the tap right away: execCommand copies
                        // synchronously on a real click, so the label flips
                        // instantly; async clipboard is only the fallback, and
                        // it is raced with a short timer so a stuck clipboard
                        // permission can never leave the button silent.
                        let ok = false
                        try {
                          const ta = document.createElement('textarea')
                          ta.value = webUrl
                          ta.style.position = 'fixed'
                          ta.style.opacity = '0'
                          document.body.appendChild(ta)
                          ta.focus()
                          ta.select()
                          ok = document.execCommand('copy')
                          ta.remove()
                        } catch { /* fall through to clipboard */ }
                        if (!ok) {
                          try {
                            await Promise.race([
                              navigator.clipboard.writeText(webUrl),
                              new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 800)),
                            ])
                            ok = true
                          } catch { /* clipboard refused */ }
                        }
                        setCopied(ok)
                        setCopyErr(!ok)
                        window.setTimeout(() => { setCopied(false); setCopyErr(false) }, ok ? 1800 : 2200)
                      }}
                      style={{ border: 'none', cursor: 'pointer', borderRadius: 12, padding: '11px 16px', fontWeight: 700, background: copied ? 'rgba(31,175,84,.35)' : 'rgba(255,255,255,.14)', color: '#fff', fontSize: 13 }}
                    >
                      {copied ? 'Copied ✓' : copyErr ? 'Copy failed' : 'Copy link'}
                    </button>

                  </div>
                </div>
          </div>
        )}
      </main>
    </div>
  )
}
