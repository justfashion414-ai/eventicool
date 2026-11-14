import { useEffect, useMemo, useRef, useState } from 'react'
import { LogOut, LoaderCircle } from 'lucide-react'
import '../admin.css'
import { signOutEverywhere, type User } from '../auth'
import { proxyCall } from '../firebase'

/* ---- catalog constants (real product values) ---- */
const PL: Record<string, { name: string; price: number; gb: number }> = {
  essential: { name: 'Essential', price: 30000, gb: 5 },
  complete: { name: 'Complete', price: 50000, gb: 10 },
  legacy: { name: 'Legacy', price: 100000, gb: 20 },
}
const TP: Record<string, { name: string; tagline: string; bg: string; fg: string; ac: string }> = {
  classic: { name: 'Classic', tagline: 'The signature look', bg: '#14122b', fg: '#f4e9d3', ac: '#d8b06a' },
  halo: { name: 'Halo Arc', tagline: 'A crown of photos above your names', bg: '#fbe1e8', fg: '#4a1530', ac: '#d6285f' },
  hero: { name: 'Hero Deck', tagline: 'A sliding cover of your best moments', bg: '#0c4a36', fg: '#f2f8ee', ac: '#f4b393' },
  book: { name: 'Open Book', tagline: 'A hardback book of your photos that turns its own pages', bg: '#2236b4', fg: '#ffffff', ac: '#f6d36b' },
}
const ACC6: Record<string, { bg: string; ac: string }> = {
  midnight: { bg: '#14122b', ac: '#d8b06a' },
  blush: { bg: '#fbe1e8', ac: '#d6285f' },
  emerald: { bg: '#0c4a36', ac: '#f4b393' },
  royal: { bg: '#2236b4', ac: '#f6d36b' },
  sunset: { bg: '#2b1a12', ac: '#e07a4f' },
  sage: { bg: '#1f2b25', ac: '#8fbfa3' },
}
const DEF_ACC: Record<string, string> = { classic: 'midnight', halo: 'blush', hero: 'emerald', book: 'royal' }
const CHANNELS = ['Email', 'Push', 'WhatsApp']
const STG = ['New previews', 'Contacted', 'Quoted', 'Paid']
const NAV = [
  { id: 'over', label: 'Overview' },
  { id: 'pipe', label: 'Pipeline' },
  { id: 'onb', label: 'Onboard a couple' },
  { id: 'sites', label: 'Sites' },
  { id: 'ord', label: 'Orders' },
  { id: 'cat', label: 'Plans and templates' },
  { id: 'team', label: 'Team and audit' },
] as const
type SecId = (typeof NAV)[number]['id']
const KEY = 'ev-admin-sec'

const ng = (n: number) => '₦' + n.toLocaleString('en-NG')
const slugOf = (b: string, g: string) => `${b}-${g}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

interface EvDoc {
  id: string
  title?: string
  bride?: string
  groom?: string
  city?: string
  weddingDate?: string
  contact?: string
  template?: string
  plan?: string
  pay?: string
  slug?: string
  status?: string
  accessCode?: string
  createdAt?: { seconds?: number }
}
interface Site {
  id: string
  couple: string
  slug: string
  plan?: string
  status?: string
  tpl?: string
  since: string
}
interface AuditRow { id: string; actor?: string; action: string; at?: number; createdAt?: { seconds?: number } }
interface TplMeta { name?: string; d?: string; acc?: string }
interface Cat { prices: Record<string, number>; channels: Record<string, boolean[]>; templates: Record<string, boolean>; tplmeta: Record<string, TplMeta> }

const DEFAULT_CAT: Cat = {
  prices: { essential: 30000, complete: 50000, legacy: 100000 },
  channels: { essential: [true, false, false], complete: [true, true, false], legacy: [true, true, true] },
  templates: { classic: true, halo: true, hero: true, book: true },
  tplmeta: {},
}

function fmtDate(ev?: { seconds?: number }) {
  if (!ev?.seconds) return '—'
  return new Date(ev.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const ICONS: Record<SecId, string> = {
  over: '<path d="M3 12l9-9 9 9M5 10v10h14V10"/>',
  pipe: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="6" rx="1"/>',
  onb: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  sites: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18M8 22h8"/>',
  ord: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>',
  cat: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  team: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6M17 4a4 4 0 0 1 0 8"/>',
}
function Icon({ id }: { id: SecId }) {
  return <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: ICONS[id] }} />
}

const pill = (s?: string) => (s ? <span className={`pl ${s}`}>{s[0].toUpperCase() + s.slice(1)}</span> : <span>—</span>)

export default function AdminConsole({ user, onSignOut }: { user: User | null; onSignOut: () => void }) {
  const [sec, setSec] = useState<SecId>(() => {
    const saved = localStorage.getItem(KEY)
    return (NAV.some((n) => n.id === saved) ? saved : 'over') as SecId
  })
  const [events, setEvents] = useState<EvDoc[] | null>(null)
  const [audit, setAudit] = useState<AuditRow[] | null>(null)
  const [cat, setCat] = useState<Cat | null>(null)
  const [toast, setToast] = useState('')
  const [drawerId, setDrawerId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // onboarding form
  const [ob, setOb] = useState({ b: '', g: '', date: '2027-03-06', city: 'Lagos', contact: '', tpl: 'book', plan: 'complete', pay: 'paid', slug: '', man: false })
  const [prov, setProv] = useState<{ step: number; done: boolean; error?: string; slug?: string; code?: string } | null>(null)

  // sites filters
  const [sf, setSf] = useState<'all' | 'live' | 'draft' | 'suspended'>('all')
  const [sq, setSq] = useState('')
  // orders filter
  const [of, setOf] = useState<'all' | 'paid' | 'pending' | 'failed'>('all')
  // delete confirmation
  const [delText, setDelText] = useState('')
  const [busy, setBusy] = useState(false)

  const sites: Site[] = useMemo(
    () =>
      (events || []).map((ev) => ({
        id: ev.id,
        couple: ev.title || [ev.bride, ev.groom].filter(Boolean).join(' & ') || ev.id,
        slug: ev.slug || ev.id,
        plan: ev.plan,
        status: ev.status,
        tpl: ev.template,
        since: fmtDate(ev.createdAt),
      })),
    [events],
  )

  const say = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(''), 2400)
  }

  async function logAudit(action: string) {
    const row: AuditRow = { id: `local-${Date.now()}`, actor: user?.email, action, at: Date.now() }
    setAudit((a) => [row, ...(a || [])])
    proxyCall('add', { collection: 'platform_audit', data: { actor: user?.email || '', action, at: Date.now() } }).catch(() => {})
  }

  useEffect(() => { localStorage.setItem(KEY, sec) }, [sec])
  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])
  useEffect(() => {
    let alive = true
    proxyCall('list', { collection: 'events', limit: 50 })
      .then((res) => { if (alive) setEvents(res.docs as EvDoc[]) })
      .catch(() => { if (alive) setEvents([]) })
    proxyCall('list', { collection: 'platform_audit', limit: 20 })
      .then((res) => {
        if (!alive) return
        const rows = (res.docs as AuditRow[]).sort((x, y) => (y.at || (y.createdAt?.seconds || 0) * 1000 || 0) - (x.at || (x.createdAt?.seconds || 0) * 1000 || 0))
        setAudit(rows)
      })
      .catch(() => { if (alive) setAudit([]) })
    proxyCall('get', { collection: 'platform', id: 'catalog' })
      .then((doc) => {
        if (!alive) return
        if (!doc) { setCat(DEFAULT_CAT); return }
        setCat({
          prices: { ...DEFAULT_CAT.prices, ...(doc.prices || {}) },
          channels: { ...DEFAULT_CAT.channels, ...(doc.channels || {}) },
          templates: { ...DEFAULT_CAT.templates, ...(doc.templates || {}) },
          tplmeta: { ...(doc.tplmeta || {}) },
        })
      })
      .catch(() => { if (alive) setCat(DEFAULT_CAT) })
    return () => { alive = false }
  }, [])

  function go(id: SecId) { setSec(id); window.scrollTo(0, 0) }

  async function signOut() { await signOutEverywhere(); onSignOut() }

  /* ---- onboarding ---- */
  const o = ob
  const slug = o.slug || slugOf(o.b, o.g)
  const slugTaken = slug ? sites.some((s) => s.slug === slug) : false
  const slugMsg = slug
    ? slugTaken
      ? <span className="av no">{slug}.eventicor.com is taken</span>
      : <span className="av ok">✓ {slug}.eventicor.com is available</span>
    : null
  const days = Math.max(0, Math.ceil((new Date(o.date + 'T10:00').getTime() - Date.now()) / 864e5))

  function setObField(k: keyof typeof ob, v: string | boolean) {
    setOb((prev) => {
      const next = { ...prev, [k]: v } as typeof ob
      if (!prev.man && (k === 'b' || k === 'g')) next.slug = ''
      return next
    })
  }

  async function createSite() {
    if (!o.b || !o.g) { say('Enter the bride’s and groom’s names'); return }
    if (!slug || slugTaken) { say(slugTaken ? 'That address is taken. Pick another' : 'Pick an address for the couple'); return }
    const code = (o.b + o.g).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 13) + o.date.slice(2, 4)
    const steps = [
      `Create ${o.b} & ${o.g}’s private space`,
      `Reserve ${slug}.eventicor.com`,
      'Seed the wedding stages for their tradition',
      `Generate the guest access code ${code}`,
      'Save the event record',
    ]
    setProv({ step: 0, done: false, slug, code })
    let i = 0
    const t = window.setInterval(async () => {
      i++
      if (i < steps.length) { setProv((p) => (p ? { ...p, step: i } : p)); return }
      window.clearInterval(t)
      try {
        await proxyCall('add', {
          collection: 'events',
          data: {
            title: `${o.b} & ${o.g}`,
            bride: o.b, groom: o.g,
            weddingDate: o.date, city: o.city, contact: o.contact,
            template: o.tpl, plan: o.plan, pay: o.pay,
            slug, status: o.pay === 'link' ? 'draft' : 'live',
            accessCode: code,
          },
        })
        logAudit(`Onboarded ${o.b} & ${o.g} (${slug}) on ${PL[o.plan].name}`)
        setEvents((evs) => [
          { id: `new-${Date.now()}`, title: `${o.b} & ${o.g}`, bride: o.b, groom: o.g, weddingDate: o.date, city: o.city, contact: o.contact, template: o.tpl, plan: o.plan, pay: o.pay, slug, status: o.pay === 'link' ? 'draft' : 'live', accessCode: code },
          ...(evs || []),
        ])
        setProv({ step: steps.length, done: true, slug, code })
      } catch (e) {
        window.clearInterval(t)
        setProv({ step: steps.length, done: false, error: String((e as Error)?.message || e), slug, code })
      }
    }, 700)
  }

  function provDone() {
    setProv(null)
    setOb({ b: '', g: '', date: '2027-03-06', city: 'Lagos', contact: '', tpl: 'book', plan: 'complete', pay: 'paid', slug: '', man: false })
    go('sites')
  }
  function copyDetails() {
    if (!prov?.slug || !prov.code) return
    navigator.clipboard?.writeText(`${prov.slug}.eventicor.com — guest access code ${prov.code}`)
    say('Link and access code copied')
  }

  /* ---- site drawer actions ---- */
  const drawer = drawerId ? sites.find((s) => s.id === drawerId) : null
  const drawerDoc = drawerId ? (events || []).find((e) => e.id === drawerId) : null

  async function patchEvent(id: string, data: Record<string, unknown>, note: string) {
    setBusy(true)
    try {
      await proxyCall('update', { collection: 'events', id, data })
      setEvents((evs) => (evs || []).map((e) => (e.id === id ? { ...e, ...data } as EvDoc : e)))
      logAudit(note)
      say('Saved')
    } catch (e) { say('Could not save. Try again') }
    setBusy(false)
  }
  async function deleteEvent(id: string, s: string) {
    if (delText !== s) { say('Type the address exactly to delete'); return }
    setBusy(true)
    try {
      await proxyCall('delete', { collection: 'events', id })
      setEvents((evs) => (evs || []).filter((e) => e.id !== id))
      logAudit(`Deleted site ${s}`)
      setDrawerId(null)
      say('Site deleted')
    } catch { say('Could not delete. Try again') }
    setBusy(false)
  }

  async function saveCatalog() {
    if (!cat) return
    setBusy(true)
    try {
      await proxyCall('set', { collection: 'platform', id: 'catalog', data: cat })
      logAudit('Saved plan prices and template availability')
      say('Changes saved')
    } catch { say('Could not save. Try again') }
    setBusy(false)
  }

  /* ---- shared pieces ---- */
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const first = (user?.email || 'admin').split('@')[0].replace(/[^a-zA-Z]+/g, ' ').trim()
  const name = first ? first[0].toUpperCase() + first.slice(1) : 'Admin'

  function head(t: string, s: string, right?: React.ReactNode) {
    return (
      <div className="top">
        <div>
          <h1>{t}</h1>
          <p>{s}</p>
        </div>
        <div className="row" style={{ alignItems: 'center' }}>
          {right}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Account menu"
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ background: 'var(--acc)' }}
            >
              {(user?.email || '?')[0].toUpperCase()}
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-500">
                  <div className="truncate font-medium text-slate-900">{user?.email}</div>
                  Administrator
                </div>
                <button onClick={signOut} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50">
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const liveCount = sites.filter((s) => s.status === 'live').length
  const draftCount = sites.filter((s) => s.status === 'draft').length
  const suspCount = sites.filter((s) => s.status === 'suspended').length

  function overview() {
    const attention: { n: number; one: string; many: string; go: SecId }[] = [
      { n: draftCount, one: 'site waiting to be set up', many: 'sites waiting to be set up', go: 'sites' as const },
      { n: suspCount, one: 'suspended site to review', many: 'suspended sites to review', go: 'sites' as const },
    ].filter((x) => x.n > 0)
    return (
      <>
        {head(`${greeting}, ${name}`, 'Here’s how Eventicor is doing today.', <button className="btn" onClick={() => go('onb')}>+ Onboard a couple</button>)}
        <div className="g4">
          <div className="k"><small>Couples’ sites</small><b>{events === null ? '…' : sites.length}</b><span>{liveCount} live</span></div>
          <div className="k"><small>Orders paid</small><b>₦0</b><span>No orders yet</span></div>
          <div className="k"><small>Templates available</small><b>{cat ? Object.values(cat.templates).filter(Boolean).length : '…'}</b><span>of {Object.keys(TP).length}</span></div>
          <div className="k"><small>Guest posts pending</small><b>—</b><span>Appears with the first event</span></div>
        </div>
        <div className="two">
          <div className="card">
            <h3>Latest sites</h3>
            <div style={{ marginTop: 6 }}>
              {events === null ? (
                <div className="st"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading…</div>
              ) : sites.length === 0 ? (
                <p style={{ color: 'var(--mut)', fontSize: 14, margin: 0 }}>No sites yet. Onboard your first couple.</p>
              ) : (
                sites.slice(0, 5).map((s) => (
                  <div className="att" key={s.id}>
                    <span><b>{s.couple}</b> · {s.slug}.eventicor.com</span>
                    <button className="btn g s" onClick={() => { setDrawerId(s.id) }}>Open</button>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="card">
            <h3>Needs your attention</h3>
            <div style={{ marginTop: 6 }}>
              {attention.length === 0 ? (
                <p style={{ color: 'var(--mut)', fontSize: 14, margin: 0 }}>Nothing needs your attention right now.</p>
              ) : (
                attention.map((x) => (
                  <div className="att" key={x.go + x.many}>
                    <span><b>{x.n}</b> {x.n === 1 ? x.one : x.many}</span>
                    <button className="btn g s" onClick={() => go(x.go)}>Open</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="card">
          <h3>Recent activity</h3>
          <div style={{ marginTop: 6 }}>
            {audit === null ? (
              <div className="st"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : audit.length === 0 ? (
              <p style={{ color: 'var(--mut)', fontSize: 14, margin: 0 }}>Actions you take in this console are logged here.</p>
            ) : (
              audit.slice(0, 5).map((a) => (
                <div className="rw" key={a.id}>
                  <div><b style={{ fontSize: 14 }}>{a.actor || 'Eventicor'}</b><small>{a.action}</small></div>
                  <small style={{ whiteSpace: 'nowrap' }}>{a.at ? new Date(a.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : fmtDate(a.createdAt)}</small>
                </div>
              ))
            )}
          </div>
        </div>
      </>
    )
  }

  function pipeline() {
    return (
      <>
        {head('Pipeline', 'Move each lead forward. Quoted and paid leads can be onboarded in one click.')}
        <div className="card">
          <div className="g4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', marginBottom: 0 }}>
            {STG.map((n) => (
              <div key={n} style={{ background: 'var(--soft)', borderRadius: 18, padding: 12, minHeight: 160 }}>
                <h3 style={{ font: '700 15px "Plus Jakarta Sans"', margin: '2px 4px 10px' }}>{n} <span style={{ color: 'var(--mut)', fontWeight: 600 }}>0</span></h3>
                <p style={{ color: 'var(--mut)', fontSize: 14, margin: 0 }}>No leads yet.</p>
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  function onboard() {
    const chip = (k: 'tpl' | 'plan' | 'pay', list: [string, string][]) => (
      <div className="row">
        {list.map(([v, label]) => (
          <button key={v} className={`chip ${o[k] === v ? 'on' : ''}`} onClick={() => setObField(k, v)}>{label}</button>
        ))}
      </div>
    )
    return (
      <>
        {head('Onboard a couple', 'Create a couple’s site in under a minute. Everything on the right updates as you type.')}
        <div className="ob">
          <div className="card">
            <div className="fs" style={{ marginTop: 0 }}>THE COUPLE</div>
            <div className="fg">
              <div><label htmlFor="ob_b">Bride</label><input id="ob_b" value={o.b} maxLength={14} onChange={(e) => setObField('b', e.target.value)} /></div>
              <div><label htmlFor="ob_g">Groom</label><input id="ob_g" value={o.g} maxLength={14} onChange={(e) => setObField('g', e.target.value)} /></div>
              <div><label htmlFor="ob_d">Wedding date</label><input id="ob_d" type="date" value={o.date} onChange={(e) => setObField('date', e.target.value)} /></div>
              <div><label htmlFor="ob_c">City</label><input id="ob_c" value={o.city} maxLength={16} onChange={(e) => setObField('city', e.target.value)} /></div>
              <div style={{ gridColumn: '1/-1' }}>
                <label htmlFor="ob_e">Couple’s email or WhatsApp number</label>
                <input id="ob_e" value={o.contact} placeholder="name@email.com or +234…" onChange={(e) => setObField('contact', e.target.value)} />
              </div>
            </div>
            <div className="fs">TEMPLATE</div>
            {chip('tpl', Object.keys(TP).filter((k) => !cat || cat.templates[k] !== false).map((k) => [k, TP[k].name] as [string, string]))}
            <div className="fs">PLAN</div>
            {chip('plan', Object.keys(PL).map((k) => [k, `${PL[k].name} · ${ng(PL[k].price)}`] as [string, string]))}
            <div className="fs">ADDRESS</div>
            <div className="sl">
              <input id="ob_s" value={slug} maxLength={30} style={{ textAlign: 'right' }} onChange={(e) => setOb((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''), man: true }))} />
              <span>.eventicor.com</span>
            </div>
            {slugMsg}
            <div className="fs">PAYMENT</div>
            {chip('pay', [['paid', 'Paid online'], ['bank', 'Bank transfer received'], ['link', 'Send payment link']])}
            <div style={{ marginTop: 20 }} className="row">
              <button className="btn" onClick={createSite}>Create site</button>
              <button className="btn g" onClick={() => setOb({ b: '', g: '', date: '2027-03-06', city: 'Lagos', contact: '', tpl: 'book', plan: 'complete', pay: 'paid', slug: '', man: false })}>Clear form</button>
            </div>
          </div>
          <div>
            <div className="pf">
              <MiniPreview b={o.b || 'Bride'} g={o.g || 'Groom'} tpl={TP[o.tpl]} city={o.city || 'City'} days={days} />
            </div>
          </div>
        </div>
      </>
    )
  }

  function sitesSection() {
    const L = sites.filter((s) => (sf === 'all' || s.status === sf) && `${s.couple} ${s.slug}`.toLowerCase().includes(sq.toLowerCase()))
    return (
      <>
        {head('Sites', `${sites.length} couples’ sites. Open one to manage billing, storage and access.`)}
        <div className="card">
          <div className="row" style={{ marginBottom: 12 }}>
            {(['all', 'live', 'draft', 'suspended'] as const).map((k) => (
              <button key={k} className={`chip ${sf === k ? 'on' : ''}`} onClick={() => setSf(k)}>{k[0].toUpperCase() + k.slice(1)}</button>
            ))}
            <input placeholder="Search couples or addresses" value={sq} onChange={(e) => setSq(e.target.value)} style={{ maxWidth: 260, marginLeft: 'auto' }} />
          </div>
          <div className="ov">
            <table className="tb">
              <thead>
                <tr><th>COUPLE</th><th>PLAN</th><th>STATUS</th><th>TEMPLATE</th><th>CREATED</th><th></th></tr>
              </thead>
              <tbody>
                {events === null ? (
                  <tr><td colSpan={6}><div className="st"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading events…</div></td></tr>
                ) : L.length === 0 ? (
                  <tr><td colSpan={6}>No sites match.</td></tr>
                ) : (
                  L.map((s) => (
                    <tr key={s.id}>
                      <td><b>{s.couple}</b><small>{s.slug}.eventicor.com</small></td>
                      <td>{s.plan ? PL[s.plan]?.name || s.plan : '—'}</td>
                      <td>{pill(s.status)}</td>
                      <td>{s.tpl ? TP[s.tpl]?.name || s.tpl : '—'}</td>
                      <td>{s.since}</td>
                      <td><button className="btn g s" onClick={() => { setDelText(''); setDrawerId(s.id) }}>Manage</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    )
  }

  function orders() {
    return (
      <>
        {head('Orders', 'Every payment, from every provider, in one place.')}
        <div className="g4">
          <div className="k"><small>Paid</small><b>₦0</b></div>
          <div className="k"><small>Pending</small><b>0</b></div>
          <div className="k"><small>Failed</small><b>0</b></div>
        </div>
        <div className="card">
          <div className="row" style={{ marginBottom: 12 }}>
            {(['all', 'paid', 'pending', 'failed'] as const).map((k) => (
              <button key={k} className={`chip ${of === k ? 'on' : ''}`} onClick={() => setOf(k)}>{k[0].toUpperCase() + k.slice(1)}</button>
            ))}
          </div>
          <div className="ov">
            <table className="tb">
              <thead><tr><th>ORDER</th><th>COUPLE</th><th>PLAN</th><th>AMOUNT</th><th>VIA</th><th>STATUS</th><th></th></tr></thead>
              <tbody><tr><td colSpan={7}>No orders yet. Payments appear here once couples check out.</td></tr></tbody>
            </table>
          </div>
        </div>
      </>
    )
  }

  function catalogSection() {
    if (!cat) {
      return <>{head('Plans and templates', 'Change what you sell. Changes apply to new sign-ups.')}<div className="card"><div className="st"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading…</div></div></>
    }
    return (
      <>
        {head('Plans and templates', 'Change what you sell. Changes apply to new sign-ups.', <button className="btn" onClick={saveCatalog}>Save changes</button>)}
        <div className="card">
          <h3>Plans</h3>
          {Object.keys(PL).map((k) => (
            <div className="rw" key={k}>
              <div style={{ flex: 1 }}><b>{PL[k].name}</b><small>{PL[k].gb} GB of photos and videos</small></div>
              <div className="row">
                <input
                  value={cat.prices[k] ?? PL[k].price}
                  style={{ width: 110 }}
                  aria-label={`${PL[k].name} price`}
                  onChange={(e) => setCat({ ...cat, prices: { ...cat.prices, [k]: Number(e.target.value.replace(/[^0-9]/g, '')) || 0 } })}
                />
                <span className="row">
                  {CHANNELS.map((n, i) => (
                    <button
                      key={n}
                      className={`chip ${(cat.channels[k] || DEFAULT_CAT.channels[k])[i] ? 'on' : ''}`}
                      onClick={() => {
                        const cur = [...(cat.channels[k] || DEFAULT_CAT.channels[k])]
                        cur[i] = !cur[i]
                        setCat({ ...cat, channels: { ...cat.channels, [k]: cur } })
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Wedding templates</h3>
          {Object.keys(TP).map((k) => {
            const meta = cat.tplmeta[k] || {}
            const acc = meta.acc || DEF_ACC[k]
            const pal = ACC6[acc] || TP[k]
            return (
              <div className="rw" key={k} style={{ flexWrap: 'wrap' }}>
                <div className="row" style={{ flex: 1, minWidth: 250 }}>
                  <i style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: `linear-gradient(135deg,${pal.bg},${pal.ac})` }} />
                  <input
                    value={meta.name ?? ''}
                    placeholder={TP[k].name}
                    aria-label={`${TP[k].name} display name`}
                    style={{ width: 110 }}
                    onChange={(e) => setCat({ ...cat, tplmeta: { ...cat.tplmeta, [k]: { ...meta, name: e.target.value } } })}
                  />
                  <input
                    value={meta.d ?? ''}
                    placeholder={TP[k].tagline}
                    aria-label={`${TP[k].name} tagline`}
                    style={{ flex: 1, minWidth: 150 }}
                    onChange={(e) => setCat({ ...cat, tplmeta: { ...cat.tplmeta, [k]: { ...meta, d: e.target.value } } })}
                  />
                </div>
                <div className="row">
                  {Object.keys(ACC6).map((ak) => (
                    <button
                      key={ak}
                      title={`${ak[0].toUpperCase() + ak.slice(1)} accent`}
                      aria-label={`Use the ${ak} accent for ${TP[k].name}`}
                      onClick={() => setCat({ ...cat, tplmeta: { ...cat.tplmeta, [k]: { ...meta, acc: ak } } })}
                      style={{ width: 20, height: 20, borderRadius: 999, padding: 0, flexShrink: 0, cursor: 'pointer', border: acc === ak ? '2px solid #2f3fb8' : '1px solid #d9d9e3', background: `linear-gradient(135deg,${ACC6[ak].bg} 58%,${ACC6[ak].ac} 58%)` }}
                    />
                  ))}
                  <button className="btn g" onClick={() => window.open(`${location.origin}/app?tpl=${k}${meta.acc ? `&acc=${meta.acc}` : ''}`, '_blank')}>Preview</button>
                  <button className={`sw ${cat.templates[k] ? 'on' : ''}`} aria-label={`Toggle ${TP[k].name}`} onClick={() => setCat({ ...cat, templates: { ...cat.templates, [k]: !cat.templates[k] } })} />
                </div>
              </div>
            )
          })}
          <div className="rw">
            <div><b>Birthdays and anniversaries</b><small>Shown as “soon” on the landing page</small></div>
            <span className="pl">Soon</span>
          </div>
        </div>
      </>
    )
  }

  function team() {
    return (
      <>
        {head('Team and audit', 'Who can do what, and everything that was done.', <button className="btn g" onClick={() => say('Teammate invites land in the next build')}>Invite teammate</button>)}
        <div className="two">
          <div className="card">
            <h3>Team</h3>
            <div className="rw">
              <b>{user?.email || 'Admin'}</b>
              <select style={{ width: 'auto' }} disabled><option>Owner</option></select>
            </div>
            <p style={{ color: 'var(--mut)', fontSize: 14, margin: '12px 0 0' }}>Support can open a couple’s dashboard only with a reason. Only Owners can refund, delete or change prices.</p>
          </div>
          <div className="card">
            <h3>Audit log</h3>
            {audit === null ? (
              <div className="st"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : audit.length === 0 ? (
              <p style={{ color: 'var(--mut)', fontSize: 14, margin: 0 }}>Actions you take in this console are logged here.</p>
            ) : (
              audit.map((a) => (
                <div className="rw" key={a.id}>
                  <div><b style={{ fontSize: 14 }}>{a.actor || 'Eventicor'}</b><small>{a.action}</small></div>
                  <small style={{ whiteSpace: 'nowrap' }}>{a.at ? new Date(a.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : fmtDate(a.createdAt)}</small>
                </div>
              ))
            )}
          </div>
        </div>
      </>
    )
  }

  const VIEWS: Record<SecId, () => React.ReactNode> = { over: overview, pipe: pipeline, onb: onboard, sites: sitesSection, ord: orders, cat: catalogSection, team: team }

  return (
    <div className="evad">
      <aside>
        <div className="br"><i /><div>Eventicor<small>PLATFORM ADMIN</small></div></div>
        {NAV.map((n) => (
          <button key={n.id} className={sec === n.id ? 'on' : ''} onClick={() => go(n.id)}>
            <Icon id={n.id} />
            {n.label}
          </button>
        ))}
        <a href="/" style={{ display: 'flex', width: '100%', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 12, fontWeight: 600, fontSize: 15, color: '#c3c1e4', textDecoration: 'none', marginTop: 10 }}>View website</a>
      </aside>
      <main>{VIEWS[sec]()}</main>

      {drawer && drawerDoc && (
        <div className="dr" onClick={(e) => { if (e.target === e.currentTarget) setDrawerId(null) }}>
          <div className="dp">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2>{drawer.couple}</h2>
              <button className="btn g s" onClick={() => setDrawerId(null)}>Close</button>
            </div>
            <p style={{ color: 'var(--mut)', margin: '4px 0 14px' }}>
              {drawer.slug}.eventicor.com · since {drawer.since} {drawer.status ? '· ' + drawer.status[0].toUpperCase() + drawer.status.slice(1) : ''}
            </p>
            <div className="g4" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="k"><small>Plan</small><b>{drawer.plan ? PL[drawer.plan]?.name || drawer.plan : '—'}</b></div>
              <div className="k"><small>Created</small><b style={{ fontSize: 20 }}>{drawer.since}</b></div>
            </div>
            <div className="rw">
              <div><b>Plan</b><small>{drawer.plan ? `${ng(PL[drawer.plan]?.price || 0)} · ${PL[drawer.plan]?.gb || '—'} GB` : 'Not set'}</small></div>
              <select style={{ width: 'auto' }} value={drawer.plan || ''} disabled={busy} onChange={(e) => patchEvent(drawer.id, { plan: e.target.value }, `Changed ${drawer.slug} to ${PL[e.target.value]?.name}`)}>
                <option value="">Not set</option>
                {Object.keys(PL).map((k) => <option key={k} value={k}>{PL[k].name}</option>)}
              </select>
            </div>
            <div className="rw">
              <div><b>Wedding date</b><small>{drawerDoc.weddingDate || '—'}</small></div>
              <div><b>City</b><small>{drawerDoc.city || '—'}</small></div>
            </div>
            <div className="rw">
              <div><b>Guest access code</b><small>{drawerDoc.accessCode || '—'}</small></div>
            </div>
            <div className="rw">
              <div><b>Hosting</b><small>Online for 12 months from {drawer.since}</small></div>
              <button className="btn g s" onClick={() => say('Hosting extensions land soon')}>Extend 12 months</button>
            </div>
            <div className="rw">
              <div><b>Custom domain</b><small>None connected</small></div>
              <button className="btn g s" onClick={() => say('Domain steps land soon')}>Connect domain</button>
            </div>
            <div className="fs">STATUS</div>
            <div className="row">
              <button className="btn g s" disabled={busy} onClick={() => patchEvent(drawer.id, { status: drawer.status === 'suspended' ? 'live' : 'suspended' }, `${drawer.status === 'suspended' ? 'Reactivated' : 'Suspended'} ${drawer.slug}`)}>
                {drawer.status === 'suspended' ? 'Reactivate' : 'Suspend'} site
              </button>
            </div>
            <div className="fs">DANGER ZONE</div>
            <label>Type <b>{drawer.slug}</b> to delete this site forever</label>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input placeholder={drawer.slug} value={delText} onChange={(e) => setDelText(e.target.value)} />
              <button className="btn d s" disabled={busy} onClick={() => deleteEvent(drawer.id, drawer.slug)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {prov && (
        <div className="md">
          <div className="mc2">
            {prov.error ? (
              <>
                <h2>Could not create the site</h2>
                <p style={{ color: 'var(--mut)' }}>{prov.error}</p>
                <div className="row"><button className="btn g" onClick={() => setProv(null)}>Close</button></div>
              </>
            ) : prov.done ? (
              <>
                <h2>Site is live</h2>
                <p style={{ margin: '0 0 6px', color: 'var(--mut)' }}>Share this with the couple.</p>
                <div className="card" style={{ margin: '0 0 10px' }}>
                  <b>{prov.slug}.eventicor.com</b><br />
                  <small>Guest access code: <b>{prov.code}</b></small>
                </div>
                <div className="row">
                  <button className="btn" onClick={provDone}>Done</button>
                  <button className="btn g" onClick={copyDetails}>Copy details</button>
                </div>
              </>
            ) : (
              <>
                <h2>Setting up…</h2>
                {[
                  `Create ${o.b} & ${o.g}’s private space`,
                  `Reserve ${slug}.eventicor.com`,
                  'Seed the wedding stages for their tradition',
                  `Generate the guest access code ${prov.code}`,
                  'Save the event record',
                ].map((s, k) => (
                  <div key={s} className={`st ${k < prov.step ? 'ok' : k === prov.step ? 'run' : ''}`}>
                    <i>{k < prov.step ? '✓' : ''}</i>{s}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

function MiniPreview({ b, g, tpl, city, days }: { b: string; g: string; tpl: { bg: string; fg: string; ac: string }; city: string; days: number }) {
  return (
    <div className="mp" style={{ ['--b' as string]: tpl.bg, ['--f' as string]: tpl.fg, ['--a' as string]: tpl.ac }}>
      <div className="mh">{b} & {g}</div>
      <div className="mm">
        <small>Together with their families</small>
        <b>{b}</b>
        <em>and</em>
        <b>{g}</b>
      </div>
      <div className="mc">
        <div><b>{days}</b>days</div>
        <div><b>{city}</b>city</div>
      </div>
      <div className="mr"><i />Engagement<span>Done</span></div>
      <div className="mr"><i />Bridal shower<span>Next up</span></div>
    </div>
  )
}
