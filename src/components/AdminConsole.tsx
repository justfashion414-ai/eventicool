import { useEffect, useMemo, useRef, useState } from 'react'
import { LogOut, LoaderCircle, Menu } from 'lucide-react'
import '../admin.css'
import { consoleAuth, consoleAuthReady, signOutEverywhere, type User } from '../auth'
// Every console call rides the console's OWN auth session, never the couple
// apps' session, so the two can never act as each other.
const consoleCall = (op: string, payload?: Record<string, unknown>) => proxyCall(op, payload, consoleAuth)
// Last loaded lists, for painting the console instantly on a refresh.
const CONSOLE_CACHE_KEY = 'ev-console-cache-v1'
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
// Firestore serverTimestamp fields arrive as Timestamp objects, not numbers.
// Normalize before any new Date() so a landing-created customer's createdAt
// never renders as "Invalid Date".
const tsMs = (v: any): number => {
  if (typeof v === 'number') return v
  const sec = typeof v?.seconds === 'number' ? v.seconds : typeof v?._seconds === 'number' ? v._seconds : 0
  return sec ? sec * 1000 : 0
}

const DEF_ACC: Record<string, string> = { classic: 'midnight', halo: 'blush', hero: 'emerald', book: 'royal' }
const CHANNELS = ['Email', 'Push', 'WhatsApp']
const STG = ['New previews', 'Contacted', 'Quoted', 'Paid']
const NAV = [
  { id: 'over', label: 'Overview' },
  { id: 'pipe', label: 'Pipeline' },
  { id: 'leads', label: 'Leads' },
  { id: 'cust', label: 'Customers' },
  { id: 'onb', label: 'Onboard a couple' },
  { id: 'sites', label: 'Apps' },
  { id: 'ord', label: 'Orders' },
  { id: 'cat', label: 'Plans and templates' },
  { id: 'pay', label: 'Payment details' },
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
  contact?: string
  city?: string
}
interface LeadDoc { id: string; title?: string; bride?: string; groom?: string; city?: string; template?: string; accent?: string; createdAt?: number; expiresAt?: number; heroImages?: string[]; email?: string; plan?: string; source?: string; status?: string; activatedAt?: number; renewsAt?: number; lastPayment?: { plan?: string; amount?: number; email?: string; appName?: string; receiptUrl?: string; submittedAt?: number; status?: string } }
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
  leads: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.7-5.8 6.5-5.8s6.5 2.2 6.5 5.8"/><path d="M17.5 12a3.2 3.2 0 1 0-1.8-5.9"/><path d="M18.5 14.6c2 .8 3 2.4 3 4.9"/>',
  cust: '<circle cx="9" cy="8" r="3.4"/><path d="M2.5 20c.8-3.6 3.4-5.2 6.5-5.2s5.7 1.6 6.5 5.2"/><circle cx="17" cy="9" r="2.8"/><path d="M15.6 15c2.8.3 4.9 1.9 5.6 5"/>',
  onb: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  sites: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18M8 22h8"/>',
  ord: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>',
  cat: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  pay: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h5"/>',
  team: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6M17 4a4 4 0 0 1 0 8"/>',
}
function Icon({ id }: { id: SecId }) {
  return <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: ICONS[id] }} />
}

const pill = (s?: string) => (s ? <span className={`pl ${s}`}>{s[0].toUpperCase() + s.slice(1)}</span> : <span>—</span>)

/* Lead photos: the console uploads to Cloudinary (signed, same route the
   couple app uses) or, in the demo console, shrinks each pick to a data URL
   that lives in this browser only. */
async function shrinkToDataUrl(file: File): Promise<string> {
  const bmp = await createImageBitmap(file).catch(() => null)
  if (!bmp) throw new Error('not an image')
  const max = 900
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  return c.toDataURL('image/jpeg', 0.82)
}

async function uploadOneLead(file: File, kind: string): Promise<string> {
  const folder = `eventicor-leads-${kind}`
  for (const ep of [`/api/upload-signature?folder=${encodeURIComponent(folder)}`, `/.netlify/functions/upload-signature?folder=${encodeURIComponent(folder)}`]) {
    try {
      // The interim signer is cross-origin and sends no cookies, so omit credentials there.
      const res = await fetch(ep, { credentials: ep.startsWith('http') ? 'omit' : 'include' })
      if (!res.ok) continue
      const sig = await res.json()
      if (!sig?.signature || !sig?.cloudName || !sig?.apiKey) continue
      const form = new FormData()
      form.append('file', file, file.name)
      form.append('api_key', sig.apiKey)
      form.append('timestamp', String(sig.timestamp))
      form.append('signature', sig.signature)
      form.append('folder', sig.folder || folder)
      const up = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`, { method: 'POST', body: form })
      const j = await up.json()
      if (up.ok && j.secure_url) return j.secure_url as string
    } catch { /* try the next endpoint */ }
  }
  throw new Error('upload failed')
}


/* Demo console seed: /console-demo renders with a fake admin and no Firebase
   access, so give it three pretend apps to exercise the Sites table, the
   Manage drawer and the filters without touching real data. */
const DEMO_EVENTS: EvDoc[] = [
  { id: 'demo-1', title: 'Chidera & Emeka', slug: 'chidera-emeka', template: 'classic', plan: 'complete', status: 'live', city: 'Lagos', weddingDate: '2026-12-12', accessCode: 'DEMO12', createdAt: { seconds: 1762000000 } },
  { id: 'demo-2', title: 'Zainab & Yusuf', slug: 'zainab-yusuf', template: 'halo', plan: 'essential', status: 'draft', city: 'Abuja', weddingDate: '2027-01-30', accessCode: 'DEMO34', createdAt: { seconds: 1761200000 } },
  { id: 'demo-3', title: 'Ifeoma & Kunle', slug: 'ifeoma-kunle', template: 'book', plan: 'legacy', status: 'suspended', city: 'Enugu', weddingDate: '2026-11-28', accessCode: 'DEMO56', createdAt: { seconds: 1759900000 } },
]

/* Demo leads: sample apps an admin builds for outbound marketing. They carry
   no email and never count as couples' apps, customers or revenue. */
const DEMO_LEADS: LeadDoc[] = [
  { id: 'lead-d1', bride: 'Ada', groom: 'Obinna', title: 'Ada & Obinna', city: 'Lagos', template: 'halo', accent: 'blush', createdAt: Date.now() - 864e5, expiresAt: Date.now() + 2 * 864e5 },
  { id: 'lead-d2', bride: 'Ngozi', groom: 'Chike', title: 'Ngozi & Chike', city: 'Abuja', template: 'book', accent: 'royal', createdAt: Date.now() - 6 * 864e5, expiresAt: Date.now() - 36e5 },
  { id: 'lead-d3', bride: 'Amara', groom: 'Ifeanyi', title: 'Amara & Ifeanyi', city: 'Enugu', template: 'hero', accent: 'sunset', createdAt: Date.now() - 36e5, expiresAt: Date.now() + 2.9 * 864e5 },
]

export default function AdminConsole({ user, onSignOut, initialNavOpen = false }: { user: User | null; onSignOut: () => void; initialNavOpen?: boolean }) {
  const [sec, setSec] = useState<SecId>(() => {
    const saved = localStorage.getItem(KEY)
    return (NAV.some((n) => n.id === saved) ? saved : 'over') as SecId
  })
  const [events, setEvents] = useState<EvDoc[] | null>(null)
  const [audit, setAudit] = useState<AuditRow[] | null>(null)
  const [cat, setCat] = useState<Cat | null>(null)
  const [toast, setToast] = useState('')
  // Account management: extend trial, suspend or delete a customer's app.
  const [manage, setManage] = useState<LeadDoc | null>(null)
  const [extH, setExtH] = useState(24)
  const [drawerId, setDrawerId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editTpl, setEditTpl] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // onboarding form
  const [ob, setOb] = useState({ b: '', g: '', date: '2027-03-06', city: 'Lagos', contact: '', tpl: 'book', plan: 'complete', pay: 'paid', slug: '', man: false })
  const [prov, setProv] = useState<{ step: number; done: boolean; error?: string; slug?: string; code?: string } | null>(null)

  // sites filters
  const [leads, setLeads] = useState<LeadDoc[] | null>(null)
  // The sample takes after the template the admin was last checking: the
  // Preview buttons remember their template and the form opens on it.
  const [ld, setLd] = useState(() => {
    let t = 'halo'
    try { t = localStorage.getItem('ev-last-tpl') || 'halo' } catch { /* default */ }
    const acc = DEF_ACC[t] || 'blush'
    return { b: '', g: '', city: 'Lagos', tpl: t, acc, hero: [] as string[] }
  })
  const [leadCreated, setLeadCreated] = useState<{ link: string; title: string; tpl: string; acc: string; exp: number } | null>(null)
  const [upBusy, setUpBusy] = useState('')
  const [obImgs, setObImgs] = useState<{ hero: string[]; footer: string[]; feed: string[] }>({ hero: [], footer: [], feed: [] })
  const [lf, setLf] = useState<'all' | 'live' | 'expired'>('all')
  const [delLeadId, setDelLeadId] = useState<string | null>(null)
  const [sf, setSf] = useState<'all' | 'live' | 'draft' | 'suspended'>('all')
  const [sq, setSq] = useState('')
  // orders filter
  const [of, setOf] = useState<'all' | 'paid' | 'pending' | 'failed'>('all')
  // delete confirmation
  const [delText, setDelText] = useState('')
  const [busy, setBusy] = useState(false)
  const [payForm, setPayForm] = useState<{ accountName: string; bankName: string; accountNumber: string; whatsapp: string } | null>(null)
  const [paySaved, setPaySaved] = useState('')
  const [payView, setPayView] = useState<LeadDoc | null>(null)

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
        contact: ev.contact || '',
        city: ev.city || '',
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
    consoleCall('add', { collection: 'platform_audit', data: { actor: user?.email || '', action, at: Date.now() } }).catch(() => {})
  }

  useEffect(() => { localStorage.setItem(KEY, sec) }, [sec])
  useEffect(() => {
    let alive = true
    const fallback = { accountName: 'Michael Ogunnaike', bankName: 'Moniepoint', accountNumber: '5070133907', whatsapp: '2349030064109' }
    ;(async () => {
      await consoleAuthReady()
      if (!alive || !consoleAuth.currentUser) { if (alive) setPayForm(fallback); return }
      try {
        const d: any = await consoleCall('get', { collection: 'platform', id: 'payment' })
        if (!alive) return
        setPayForm(d && (d.accountNumber || d.accountName) ? { accountName: d.accountName || '', bankName: d.bankName || '', accountNumber: String(d.accountNumber || ''), whatsapp: String(d.whatsapp || '') } : fallback)
      } catch { if (alive) setPayForm(fallback) }
    })()
    return () => { alive = false }
  }, [])
  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])
  useEffect(() => {
    let alive = true
    if (user?.uid === 'demo') {
      setEvents(DEMO_EVENTS)
      let ids: string[] = []
      try { ids = JSON.parse(localStorage.getItem('eventicor-leads-demo') || '[]') as string[] } catch { /* fresh console */ }
      const stored = ids.map((id) => { try { return JSON.parse(localStorage.getItem(`ev-lead-${id}`) || 'null') } catch { return null } }).filter(Boolean) as LeadDoc[]
      setLeads([...stored, ...DEMO_LEADS])
      return () => { alive = false }
    }
    // Show the last loaded lists straight away so a refresh opens with data on
    // screen, then wait for the console session to settle before refreshing
    // from the server. Firing the calls while the session is still restoring
    // used to leave the Customers and Leads lists empty.
    try {
      const c = JSON.parse(localStorage.getItem(CONSOLE_CACHE_KEY) || 'null')
      if (c && Date.now() - (c.ts || 0) < 6 * 3600e3) {
        if (Array.isArray(c.leads)) setLeads(c.leads)
        if (Array.isArray(c.events)) setEvents(c.events)
        if (Array.isArray(c.audit)) setAudit(c.audit)
      }
    } catch { /* fresh console */ }
    ;(async () => {
      await consoleAuthReady()
      if (!alive || !consoleAuth.currentUser) return
      const save = (patch: Record<string, unknown>) => {
        try {
          const cur = JSON.parse(localStorage.getItem(CONSOLE_CACHE_KEY) || '{}')
          localStorage.setItem(CONSOLE_CACHE_KEY, JSON.stringify({ ...cur, ...patch, ts: Date.now() }))
        } catch { /* ignore */ }
      }
      consoleCall('list', { collection: 'events', limit: 50 })
        .then((res) => { if (alive) { setEvents(res.docs as EvDoc[]); save({ events: res.docs }) } })
        .catch(() => { /* keep what is on screen */ })
      consoleCall('list', { collection: 'leads', limit: 50 })
        .then((res) => { if (alive) { const rows = (res.docs as LeadDoc[]).sort((a, b) => tsMs(b.createdAt) - tsMs(a.createdAt)); setLeads(rows); save({ leads: rows }) } })
        .catch(() => { /* keep what is on screen */ })
      consoleCall('list', { collection: 'platform_audit', limit: 20 })
        .then((res) => {
          if (!alive) return
          const rows = (res.docs as AuditRow[]).sort((x, y) => (y.at || (y.createdAt?.seconds || 0) * 1000 || 0) - (x.at || (x.createdAt?.seconds || 0) * 1000 || 0))
          setAudit(rows)
          save({ audit: rows })
        })
        .catch(() => { /* keep what is on screen */ })
      consoleCall('get', { collection: 'platform', id: 'catalog' })
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
    })()
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
        await consoleCall('add', {
          collection: 'events',
          data: {
            title: `${o.b} & ${o.g}`,
            bride: o.b, groom: o.g,
            weddingDate: o.date, city: o.city, contact: o.contact,
            template: o.tpl, plan: o.plan, pay: o.pay,
            slug, status: o.pay === 'link' ? 'draft' : 'live',
            accessCode: code,
            heroImages: obImgs.hero, footerImages: obImgs.footer, feedImages: obImgs.feed,
          },
        })
        logAudit(`Onboarded ${o.b} & ${o.g} (${slug}) on ${PL[o.plan].name}`)
        setEvents((evs) => [
          { id: `new-${Date.now()}`, title: `${o.b} & ${o.g}`, bride: o.b, groom: o.g, weddingDate: o.date, city: o.city, contact: o.contact, template: o.tpl, plan: o.plan, pay: o.pay, slug, status: o.pay === 'link' ? 'draft' : 'live', accessCode: code, heroImages: obImgs.hero, footerImages: obImgs.footer, feedImages: obImgs.feed },
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
    setObImgs({ hero: [], footer: [], feed: [] })
    go('sites')
  }
  function copyDetails() {
    if (!prov?.slug || !prov.code) return
    navigator.clipboard?.writeText(`${prov.slug}.eventicor.com — guest access code ${prov.code}`)
    say('Link and access code copied')
  }

  /* ---- leads: sample apps built for outbound marketing ---- */
  // A sample app carries its own 3-day expiry (?exp=unix seconds) plus the
  // lead's id (?lead=), so the link opens with the admin's names and uploaded
  // placeholder images and needs no email: after 3 days it points back to the
  // Eventicor landing page. Leads live in their own collection and never
  // count as couples' apps or revenue.
  const leadLink = (t: string, a: string, exp: number, id?: string) =>
    `${window.location.origin}/app?tpl=${t}&acc=${a}&exp=${exp}${id ? `&lead=${id}` : ''}`
  const leadMsg = (title: string, t: string, a: string, exp: number, id?: string) =>
    `Hi ${title || 'there'}! Here's a sample of what your event app could look like: ${leadLink(t, a, exp, id)} It's just a sample and stays live for 3 days. To make your own permanent app, go to https://eventicor.name.ng, or tell us and we'll set it up for you.`
  const leadName = (l: LeadDoc) => (l.bride && l.groom ? `${l.bride} & ${l.groom}` : l.title || 'Lead')

  async function addLeadImages(files: FileList | null, kind: 'hero' | 'footer' | 'feed', cap: number, onb: boolean) {
    if (!files || files.length === 0) return
    setUpBusy(kind)
    const add: string[] = []
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue
      if (add.length >= cap) break
      try {
        add.push(user?.uid === 'demo' ? await shrinkToDataUrl(f) : await uploadOneLead(f, kind))
      } catch { say('One photo could not upload. Try a smaller file') }
    }
    const cur: string[] = onb ? obImgs[kind] : (ld as unknown as Record<string, string[]>)[kind] || []
    const next = [...cur, ...add].slice(0, cap)
    if (onb) setObImgs((p) => ({ ...p, [kind]: next }))
    else setLd((p) => ({ ...(p as unknown as Record<string, unknown>), [kind]: next } as unknown as typeof p))
    setUpBusy('')
    if (add.length > 0) say(`${add.length} photo${add.length > 1 ? 's' : ''} added`)
  }

  function imgRow(kind: 'hero' | 'footer' | 'feed', label: string, cap: number, onb: boolean) {
    const list: string[] = onb ? obImgs[kind] : (ld as unknown as Record<string, string[]>)[kind] || []
    const setList = (v: string[]) => (onb ? setObImgs((p) => ({ ...p, [kind]: v })) : setLd((p) => ({ ...(p as unknown as Record<string, unknown>), [kind]: v } as unknown as typeof p)))
    return (
      <div style={{ marginTop: 8 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ margin: 0 }}>{label} <small style={{ color: 'var(--mut)' }}>{list.length}/{cap}</small></label>
          <label className="btn g s" style={{ cursor: 'pointer' }}>
            {upBusy === kind ? 'Uploading…' : 'Add photos'}
            <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { addLeadImages(e.target.files, kind, cap, onb); e.currentTarget.value = '' }} />
          </label>
        </div>
        {list.length > 0 && (
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {list.map((src, i) => (
              <span key={i} style={{ position: 'relative', display: 'inline-block' }}>
                <img src={src} alt="" style={{ width: 46, height: 46, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                <button aria-label="Remove" onClick={() => setList(list.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 99, border: 'none', background: '#0f172a', color: '#fff', fontSize: 11, lineHeight: '18px', cursor: 'pointer', padding: 0 }}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  async function createLead() {
    const b = ld.b.trim()
    const g = ld.g.trim()
    if (!b || !g) { say('Enter the bride’s and groom’s names'); return }
    const exp = Math.floor(Date.now() / 1000) + 3 * 86400
    const title = `${b} & ${g}`
    const base = { bride: b, groom: g, title, city: ld.city, template: ld.tpl, accent: ld.acc, createdAt: Date.now(), expiresAt: exp * 1000, heroImages: ld.hero }
    const done = (id: string) => {
      const row: LeadDoc = { id, ...base }
      setLeads((l) => [row, ...(l || [])])
      setLeadCreated({ link: leadLink(ld.tpl, ld.acc, exp, id), title, tpl: ld.tpl, acc: ld.acc, exp })
      say('Sample app created. Send the link yourself; the message is one tap away')
      setLd((p) => ({ ...p, b: '', g: '', hero: [] }))
    }
    if (user?.uid === 'demo') {
      const id = `lead-${Date.now()}`
      try {
        localStorage.setItem(`ev-lead-${id}`, JSON.stringify({ id, ...base }))
        const ids = JSON.parse(localStorage.getItem('eventicor-leads-demo') || '[]') as string[]
        localStorage.setItem('eventicor-leads-demo', JSON.stringify([id, ...ids].slice(0, 20)))
      } catch { /* storage full: the link still works this session */ }
      done(id)
      return
    }
    setBusy(true)
    try {
      const res = await consoleCall('add', { collection: 'leads', data: base }) as any
      done(res?.id || `lead-${Date.now()}`)
      logAudit(`Created sample app for lead ${title} (${TP[ld.tpl].name})`)
    } catch { say('Could not save the lead. Try again') }
    setBusy(false)
  }
  async function deleteLead(id: string) {
    if (delLeadId !== id) { setDelLeadId(id); say('Tap again to delete this lead'); return }
    setDelLeadId(null)
    if (user?.uid === 'demo') {
      setLeads((l) => (l || []).filter((x) => x.id !== id))
      try {
        localStorage.removeItem(`ev-lead-${id}`)
        localStorage.setItem('eventicor-leads-demo', JSON.stringify((JSON.parse(localStorage.getItem('eventicor-leads-demo') || '[]') as string[]).filter((x) => x !== id)))
      } catch { /* ignore */ }
      say('Lead deleted')
      return
    }
    setBusy(true)
    try {
      await consoleCall('delete', { collection: 'leads', id })
      setLeads((l) => (l || []).filter((x) => x.id !== id))
      logAudit('Deleted a sample app lead')
      say('Lead deleted')
    } catch { say('Could not delete. Try again') }
    setBusy(false)
  }

  // Payment confirmation: once the admin has received the couple's payment,
  // this marks the account active for one year. The trial chip and its notice
  // disappear from their app for good and their link becomes permanent.
  async function confirmPayment(l: LeadDoc) {
    setBusy(true)
    try {
      const at = Date.now()
      const renews = at + 365 * 864e5
      await consoleCall('update', { collection: 'leads', id: l.id, data: { activatedAt: at, renewsAt: renews } })
      setLeads((ls) => (ls || []).map((x) => (x.id === l.id ? { ...x, activatedAt: at, renewsAt: renews } : x)))
      logAudit(`Confirmed payment for ${leadName(l)}; app active for one year`)
      say('Payment confirmed. The account is now active')
    } catch { say('Could not confirm the payment. Try again') }
    setBusy(false)
  }

  // Extend a customer's trial (or, for a paid account, its renewal date) by
  // the duration picked in the manage dialog. Takes effect immediately: the
  // app reads its own expiry from Firestore, so the trial chip updates live.
  async function extendCustomer(l: LeadDoc) {
    setBusy(true)
    try {
      const dur = extH * 3600e3
      const data: any = l.activatedAt
        ? { renewsAt: Math.max(Date.now(), l.renewsAt || Date.now()) + dur }
        : { expiresAt: Math.max(Date.now(), l.expiresAt || 0) + dur }
      await consoleCall('update', { collection: 'leads', id: l.id, data })
      setLeads((ls) => (ls || []).map((x) => (x.id === l.id ? { ...x, ...data } as LeadDoc : x)))
      logAudit(`Extended ${leadName(l)}${l.activatedAt ? "'s plan" : "'s trial"} by ${extH % 24 === 0 ? `${extH / 24} day${extH > 24 ? 's' : ''}` : `${extH} hours`}`)
      say('Extension applied. It takes effect immediately')
      setManage(null)
    } catch { say('Could not extend. Try again') }
    setBusy(false)
  }

  // Suspend or delete a customer's app. Both stay on the record (never a hard
  // delete) so their link can explain what happened instead of erroring.
  async function setCustomerStatus(l: LeadDoc, status: 'suspended' | 'deleted' | 'active') {
    setBusy(true)
    try {
      await consoleCall('update', { collection: 'leads', id: l.id, data: { status } })
      setLeads((ls) => (ls || []).map((x) => (x.id === l.id ? { ...x, status } as LeadDoc : x)))
      logAudit(`${status === 'deleted' ? 'Deleted' : status === 'suspended' ? 'Suspended' : 'Reinstated'} ${leadName(l)}`)
      say(status === 'deleted' ? 'App deleted. Its link now tells visitors it no longer exists' : status === 'suspended' ? 'App suspended. Visitors are asked to contact an Eventicor admin' : 'App reinstated')
      setManage(null)
    } catch { say('Could not update the account. Try again') }
    setBusy(false)
  }

  function leadsSection() {
    const now = Date.now()
    // Admin sample leads only. A customer's 24-hour trial app also lives in
    // this collection (source 'landing', with an email), and it belongs to
    // Customers, never here.
    const adminLeads = (leads || []).filter((l) => !l.email && l.source !== 'landing')
    const liveN = adminLeads.filter((l) => (l.expiresAt || 0) > now).length
    const rows = adminLeads
      .map((l) => ({ ...l, live: (l.expiresAt || 0) > now }))
      .filter((l) => (lf === 'all' ? true : lf === 'live' ? l.live : !l.live))
      .sort((a, b) => tsMs(b.createdAt) - tsMs(a.createdAt))
    const photos = [...ld.hero].slice(0, 3)
    return (
      <>
        {head('Leads', 'Sample apps you market with. A lead needs no email and never counts as a couple’s app or as revenue.')}
        {leadCreated && (
          <div className="card" style={{ marginBottom: 14 }}>
            <h3>Sample app ready</h3>
            <p style={{ color: 'var(--mut)', margin: '4px 0 10px' }}>{leadCreated.title} · live for 3 days</p>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <input readOnly value={leadCreated.link} onFocus={(e) => e.currentTarget.select()} style={{ flex: 1, minWidth: 200 }} />
              <button className="btn g s" onClick={() => { navigator.clipboard?.writeText(leadCreated.link); say('Link copied') }}>Copy link</button>
              <button className="btn g s" onClick={() => { navigator.clipboard?.writeText(leadMsg(leadCreated.title, leadCreated.tpl, leadCreated.acc, leadCreated.exp, leadCreated.link.split('lead=')[1] || undefined)); say('Message copied') }}>Copy message</button>
              <button className="btn g s" onClick={() => setLeadCreated(null)}>Close</button>
            </div>
            <p style={{ color: 'var(--mut)', fontSize: 13, margin: '10px 0 0' }}>Send the link yourself (WhatsApp, text, anywhere). The sample app shows its own expiry countdown, so you can follow up before it dies.</p>
          </div>
        )}
        <div className="ob">
          <div className="card">
            <h3>Create a sample app</h3>
            <div className="fg" style={{ marginTop: 8 }}>
              <div><label>Bride</label><input value={ld.b} maxLength={14} onChange={(e) => setLd({ ...ld, b: e.target.value })} placeholder="Bride’s first name" /></div>
              <div><label>Groom</label><input value={ld.g} maxLength={14} onChange={(e) => setLd({ ...ld, g: e.target.value })} placeholder="Groom’s first name" /></div>
              <div><label>City</label><input value={ld.city} maxLength={16} onChange={(e) => setLd({ ...ld, city: e.target.value })} /></div>
            </div>
            <label style={{ marginTop: 10 }}>Template</label>
            <div className="row">
              {Object.entries(TP).map(([k, t]) => (
                <button key={k} className={`chip${ld.tpl === k ? ' on' : ''}`} onClick={() => setLd({ ...ld, tpl: k, acc: DEF_ACC[k] })}>{t.name}</button>
              ))}
            </div>
            <label style={{ marginTop: 10 }}>Accent</label>
            <div className="row">
              {Object.entries(ACC6).map(([k]) => (
                <button key={k} className={`chip${ld.acc === k ? ' on' : ''}`} onClick={() => setLd({ ...ld, acc: k })}>{k[0].toUpperCase() + k.slice(1)}</button>
              ))}
            </div>
            <div className="fs" style={{ marginTop: 14 }}>PHOTOS THE SAMPLE USES AS PLACEHOLDERS</div>
            <p style={{ color: 'var(--mut)', fontSize: 13, margin: '4px 0 0' }}>Optional. Your hero uploads are the only photos this sample needs: the giant photo wall, the feed posts and the journey photos repeat them until the lead creates their own app and uploads everything. Reels keep their demo clips.</p>
            {imgRow('hero', 'Hero section', 14, false)}
            <p style={{ color: 'var(--mut)', fontSize: 13, margin: '10px 0 0' }}>No email is asked for and none is stored. The link expires after 3 days, and your message tells them to create their own app on the Eventicor landing page, or ask us and we onboard them.</p>
            <div style={{ marginTop: 16 }}><button className="btn" onClick={createLead} disabled={busy}>Create sample app</button></div>
          </div>
          <div>
            <div className="pf">
              <MiniPreview b={ld.b || 'Bride'} g={ld.g || 'Groom'} tpl={TP[ld.tpl]} city={ld.city || 'City'} days={3} photos={photos} />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>Sample apps ({liveN} live)</h3>
            <div className="row" style={{ gap: 6 }}>
              {(['all', 'live', 'expired'] as const).map((f) => (
                <button key={f} className={`chip${lf === f ? ' on' : ''}`} onClick={() => setLf(f)}>{f[0].toUpperCase() + f.slice(1)}</button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 6 }}>
            {leads === null ? (
              <div className="st"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : rows.length === 0 ? (
              <p style={{ color: 'var(--mut)', fontSize: 14, margin: 0 }}>No sample apps here yet.</p>
            ) : (
              rows.map((l) => {
                const expSec = Math.floor((l.expiresAt || 0) / 1000)
                const daysLeft = Math.ceil(((l.expiresAt || 0) - Date.now()) / 864e5)
                const imgs = l.heroImages?.length || 0
                return (
                  <div className="att" key={l.id} style={{ flexWrap: 'wrap' }}>
                    <span><b>{leadName(l)}</b> · {l.city} · {TP[l.template || 'classic'].name}{imgs > 0 ? ` · ${imgs} photo${imgs > 1 ? 's' : ''}` : ''}{' '}
                      <span className={`pl ${l.live ? 'live' : 'suspended'}`}>{l.live ? (daysLeft <= 1 ? 'Ends today' : `${daysLeft} days left`) : 'Expired'}</span>
                      {l.live && <small style={{ color: 'var(--mut)', marginLeft: 6 }}>{new Date(l.expiresAt || 0).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</small>}
                    </span>
                    <span className="row" style={{ gap: 6 }}>
                      <a className="btn g s" href={leadLink(l.template || 'classic', l.accent || 'midnight', expSec, l.id)} target="_blank" rel="noreferrer">Open</a>
                      <button className="btn g s" onClick={() => { navigator.clipboard?.writeText(leadLink(l.template || 'classic', l.accent || 'midnight', expSec, l.id)); say('Link copied') }}>Copy link</button>
                      <button className="btn g s" onClick={() => { navigator.clipboard?.writeText(leadMsg(leadName(l), l.template || 'classic', l.accent || 'midnight', expSec, l.id)); say('Message copied') }}>Copy message</button>
                      <button className="btn g s" onClick={() => deleteLead(l.id)}>{delLeadId === l.id ? 'Sure?' : 'Delete'}</button>
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </>
    )
  }

  /* ---- site drawer actions ---- */
  const drawer = drawerId ? sites.find((s) => s.id === drawerId) : null
  const drawerDoc = drawerId ? (events || []).find((e) => e.id === drawerId) : null

  async function patchEvent(id: string, data: Record<string, unknown>, note: string) {
    if (user?.uid === 'demo') {
      setEvents((evs) => (evs || []).map((e) => (e.id === id ? { ...e, ...data } as EvDoc : e)))
      say('Demo console: nothing is saved')
      return
    }
    setBusy(true)
    try {
      await consoleCall('update', { collection: 'events', id, data })
      setEvents((evs) => (evs || []).map((e) => (e.id === id ? { ...e, ...data } as EvDoc : e)))
      logAudit(note)
      say('Saved')
    } catch (e) { say('Could not save. Try again') }
    setBusy(false)
  }
  async function deleteEvent(id: string, s: string) {
    if (delText !== s) { say('Type the address exactly to delete'); return }
    if (user?.uid === 'demo') {
      setEvents((evs) => (evs || []).filter((e) => e.id !== id))
      setDrawerId(null)
      say('Demo console: nothing is saved')
      return
    }
    setBusy(true)
    try {
      await consoleCall('delete', { collection: 'events', id })
      setEvents((evs) => (evs || []).filter((e) => e.id !== id))
      logAudit(`Deleted app ${s}`)
      setDrawerId(null)
      say('App deleted')
    } catch { say('Could not delete. Try again') }
    setBusy(false)
  }

  async function saveCatalog() {
    if (!cat) return
    setBusy(true)
    try {
      await consoleCall('set', { collection: 'platform', id: 'catalog', data: cat })
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

  function head(t: string, s: string, right?: React.ReactNode, icon?: React.ReactNode) {
    return (
      <div className="top">
        <div style={icon ? { display: 'flex', alignItems: 'center', gap: 12 } : undefined}>
          {icon}
          <div>
            <h1>{t}</h1>
            <p>{s}</p>
          </div>
        </div>
        <div className="row" style={{ alignItems: 'center' }}>
          {right}
        </div>
      </div>
    )
  }

  const liveCount = sites.filter((s) => s.status === 'live').length
  const draftCount = sites.filter((s) => s.status === 'draft').length
  const suspCount = sites.filter((s) => s.status === 'suspended').length

  function overview() {
    const attention: { n: number; one: string; many: string; go: SecId }[] = [
      { n: draftCount, one: 'app waiting to be set up', many: 'apps waiting to be set up', go: 'sites' as const },
      { n: suspCount, one: 'suspended app to review', many: 'suspended apps to review', go: 'sites' as const },
    ].filter((x) => x.n > 0)
    return (
      <>
        {head(`${greeting}, ${name}`, 'Here’s how Eventicor is doing today.', <button className="btn" onClick={() => go('onb')}>+ Onboard a couple</button>)}
        <div className="g4">
          <div className="k"><small>Couples’ apps</small><b>{events === null ? '…' : sites.length}</b><span>{liveCount} live</span></div>
          <div className="k"><small>Orders paid</small><b>₦0</b><span>No orders yet</span></div>
          <div className="k"><small>Templates available</small><b>{cat ? Object.values(cat.templates).filter(Boolean).length : '…'}</b><span>of {Object.keys(TP).length}</span></div>
          <div className="k"><small>Leads</small><b>{leads === null ? '…' : (leads || []).filter((l) => (l.expiresAt || 0) > Date.now() && !l.email && l.source !== 'landing').length}</b><span>Sample apps live</span></div>
        </div>
        <div className="two">
          <div className="card">
            <h3>Latest apps</h3>
            <div style={{ marginTop: 6 }}>
              {events === null ? (
                <div className="st"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading…</div>
              ) : sites.length === 0 ? (
                <p style={{ color: 'var(--mut)', fontSize: 14, margin: 0 }}>No apps yet. Onboard your first couple.</p>
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
        {head('Onboard a couple', 'Create a couple’s app in under a minute. Everything on the right updates as you type.')}
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
            <div className="fs" style={{ marginTop: 14 }}>SEED PHOTOS (OPTIONAL)</div>
            <p style={{ color: 'var(--mut)', fontSize: 13, margin: '4px 0 0' }}>Photos the couple can start from. They are saved on the app record as hero, photo-wall and feed seed images.</p>
            {imgRow('hero', 'Hero section', 14, true)}
            {imgRow('footer', 'Giant photo wall', 40, true)}
            {imgRow('feed', 'Feed posts', 40, true)}
            <div style={{ marginTop: 20 }} className="row">
              <button className="btn" onClick={createSite}>Create app</button>
              <button className="btn g" onClick={() => setOb({ b: '', g: '', date: '2027-03-06', city: 'Lagos', contact: '', tpl: 'book', plan: 'complete', pay: 'paid', slug: '', man: false })}>Clear form</button>
            </div>
          </div>
          <div>
            <div className="pf">
              <MiniPreview b={o.b || 'Bride'} g={o.g || 'Groom'} tpl={TP[o.tpl]} city={o.city || 'City'} days={days} photos={[...obImgs.hero, ...obImgs.footer].slice(0, 3)} />
            </div>
          </div>
        </div>
      </>
    )
  }

  function sitesSection() {
    // A couple's app link binds to their own events doc, so it opens with
    // their names, chosen wedding date and city, not the generic demo.
    const appLink = (s: Site) => `${window.location.origin}/app?tpl=${s.tpl || 'classic'}&acc=${DEF_ACC[(s.tpl || 'classic') as keyof typeof DEF_ACC] || 'midnight'}&site=${s.id}`
    const L = sites.filter((s) => (sf === 'all' || s.status === sf) && `${s.couple} ${s.slug} ${s.contact || ''}`.toLowerCase().includes(sq.toLowerCase()))
    return (
      <>
        {head('Apps', `${sites.length} couples’ apps. Open one to manage billing, storage and access.`)}
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
                <tr><th>COUPLE</th><th>EMAIL</th><th>STATE</th><th>PLAN</th><th>STATUS</th><th>TEMPLATE</th><th>CREATED</th><th>APP LINK</th><th></th></tr>
              </thead>
              <tbody>
                {events === null ? (
                  <tr><td colSpan={9}><div className="st"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading events…</div></td></tr>
                ) : L.length === 0 ? (
                  <tr><td colSpan={9}>No apps match.</td></tr>
                ) : (
                  L.map((s) => (
                    <tr key={s.id}>
                      <td><b>{s.couple}</b><small>{s.slug}.eventicor.com</small></td>
                      <td><small>{s.contact || '—'}</small></td>
                      <td><small>{s.city || '—'}</small></td>
                      <td>{s.plan ? PL[s.plan]?.name || s.plan : '—'}</td>
                      <td>{pill(s.status)}</td>
                      <td>{s.tpl ? TP[s.tpl]?.name || s.tpl : '—'}</td>
                      <td>{s.since}</td>
                      <td>
                        <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                          <button className="chip" onClick={() => { try { navigator.clipboard?.writeText(appLink(s)); say('App link copied'); } catch { say('Could not copy the link') } }}>Copy link</button>
                          <button className="chip" onClick={() => window.open(appLink(s), '_blank')}>Open</button>
                        </div>
                      </td>
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
                  {editTpl === k ? (
                    <>
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
                      <button className="btn g s" aria-label={`Done editing ${TP[k].name}`} onClick={() => setEditTpl(null)}>Done</button>
                    </>
                  ) : (
                    <>
                      <div style={{ flex: 1, minWidth: 150 }}>
                        <b style={{ fontSize: 15, display: 'block' }}>{meta.name || TP[k].name}</b>
                        <div style={{ color: 'var(--mut)', fontSize: 13 }}>{meta.d || TP[k].tagline}</div>
                      </div>
                      <button className="btn g s" aria-label={`Edit ${TP[k].name} name`} onClick={() => setEditTpl(k)}>Edit</button>
                    </>
                  )}
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
                  <button className="btn g" onClick={() => { try { localStorage.setItem('ev-last-tpl', k) } catch { /* ignore */ } window.open(`${location.origin}/app?tpl=${k}${meta.acc ? `&acc=${meta.acc}` : ''}`, '_blank') }}>Preview</button>
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

  const [navOpen, setNavOpen] = useState(initialNavOpen)
  const [custTab, setCustTab] = useState<'active' | 'expired' | 'deleted'>('active')

  // Customers: couples who built their own app from the landing page. Every
  // landing signup lands in the leads collection with its email and the plan
  // the couple picked, so this section reads them straight out of there and
  // shows the trial countdown next to each one.
  function customersSection() {
    const now = Date.now()
    // Customers only: couples who created their app on the landing page (a
    // 24-hour trial). Admin sample leads carry no email and stay in Leads.
    const mine = (leads || []).filter((l) => !!l.email || l.source === 'landing')
    const demo = user?.uid === 'demo' && mine.length === 0
      ? ([
          { id: 'demo-cust-1', bride: 'Ada', groom: 'Obinna', email: 'ada.obinna@example.com', city: 'Lagos', template: 'halo', accent: 'blush', plan: 'Complete', status: 'trial', createdAt: now - 8 * 3600e3, expiresAt: now + 16 * 3600e3 },
          { id: 'demo-cust-2', bride: 'Tunde', groom: 'Sade', email: 'tunde.sade@example.com', city: 'Abuja', template: 'classic', accent: 'midnight', plan: 'Essential', status: 'trial', createdAt: now - 26 * 3600e3, expiresAt: now - 2 * 3600e3 },
          { id: 'demo-cust-3', bride: 'Ngozi', groom: 'Chike', email: 'ngozi.chike@example.com', city: 'Enugu', template: 'book', accent: 'royal', plan: 'Legacy', status: 'trial', createdAt: now - 50 * 3600e3, expiresAt: now - 26 * 3600e3 },
        ] as LeadDoc[])
      : []
    const rows = [...mine, ...demo].sort((a, b) => tsMs(b.createdAt) - tsMs(a.createdAt))
    const since = (l: LeadDoc) => { const ms = tsMs(l.createdAt); return ms ? new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' }
    const appLink = (l: LeadDoc) => {
      const t = l.template || 'classic'
      const a = l.accent || DEF_ACC[t as keyof typeof DEF_ACC] || 'midnight'
      // A paid, active account gets a permanent link: no trial expiry in it.
      // Real customers (landing leads) are governed by their lead doc too, so
      // their links never carry ?exp: a stale countdown would make an expired
      // trial read as a sample app. Only console sample links carry ?exp.
      const exp = l.source !== 'landing' && !l.activatedAt && l.expiresAt ? Math.floor(l.expiresAt / 1000) : ''
      return `${window.location.origin}/app?tpl=${t}&acc=${a}${exp ? `&exp=${exp}` : ''}&lead=${l.id}`
    }
    const planStatus = (l: LeadDoc) => {
      if (l.status === 'deleted') return { label: 'Deleted', live: false }
      if (l.status === 'suspended') return { label: 'Suspended', live: false }
      if (l.activatedAt) {
        const d = new Date(l.renewsAt || l.activatedAt + 365 * 864e5).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        return { label: `Active · renews ${d}`, live: true }
      }
      const left = (l.expiresAt || 0) - now
      if (left > 0) return { label: left >= 3600e3 ? `Trial · ${Math.ceil(left / 3600e3)} h left` : `Trial · ${Math.max(1, Math.ceil(left / 60e3))} min left`, live: true }
      return { label: 'Trial ended', live: false }
    }
    const custBucket = (l: LeadDoc): 'active' | 'expired' | 'deleted' => {
      if (l.status === 'deleted' || l.status === 'suspended') return 'deleted'
      if (l.activatedAt || (l.expiresAt || 0) > now) return 'active'
      return 'expired'
    }
    const counts = { active: 0, expired: 0, deleted: 0 } as Record<typeof custTab, number>
    rows.forEach((l) => { counts[custBucket(l)]++ })
    const shown = rows.filter((l) => custBucket(l) === custTab)
    return (
      <>
        {head('Customers', 'Couples who created their app on the landing page. Each carries their email, city, the plan they picked and their trial status; sample leads never appear here.', undefined, <span style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(216,176,106,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#a8842f" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="8" r="3.4"/><path d="M2.5 20c.8-3.6 3.4-5.2 6.5-5.2s5.7 1.6 6.5 5.2"/><circle cx="17" cy="9" r="2.8"/><path d="M15.6 15c2.8.3 4.9 1.9 5.6 5"/></svg></span>)}
        {rows.length === 0 ? (
          <div className="card"><p style={{ color: 'var(--mut)', margin: 0 }}>No customers yet. Every couple who creates an app on the landing page appears here automatically, nothing to add by hand.</p></div>
        ) : (
          <div className="card">
            <div className="row" style={{ marginBottom: 12 }}>
              {(['active', 'expired', 'deleted'] as const).map((k) => (
                <button key={k} className={`chip ${custTab === k ? 'on' : ''}`} onClick={() => setCustTab(k)}>
                  {k[0].toUpperCase() + k.slice(1)} · {counts[k]}
                </button>
              ))}
            </div>
            {shown.length === 0 ? (
              <p style={{ color: 'var(--mut)', margin: 0 }}>
                {custTab === 'active' ? 'No active customers right now.' : custTab === 'expired' ? 'No expired trials right now.' : 'No deleted apps here.'}
              </p>
            ) : (
            <div className="ov">
              <table className="tb">
                <thead><tr><th>COUPLE</th><th>EMAIL</th><th>CITY</th><th>PLAN</th><th>PLAN STATUS</th><th>TEMPLATE</th><th>CREATED</th><th>APP LINK</th><th>ACTIONS</th></tr></thead>
                <tbody>
                  {shown.map((l) => {
                    const st = planStatus(l)
                    return (
                      <tr key={l.id}>
                        <td>
                          <b>{(l.bride || '') + ' & ' + (l.groom || '')}</b>
                          {l.lastPayment && (
                            <button className="chip" style={{ display: 'inline-block', marginTop: 4, fontWeight: 700, background: 'rgba(216,176,106,.18)', color: '#8a6a1d' }} onClick={() => setPayView(l)}>
                              Receipt · {l.lastPayment.plan || 'plan'} · sent {l.lastPayment.submittedAt ? new Date(l.lastPayment.submittedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </button>
                          )}
                        </td>
                        <td><small>{l.email || '—'}</small></td>
                        <td><small>{l.city || '—'}</small></td>
                        <td>{l.plan ? PL[l.plan]?.name || l.plan : 'No plan picked'}</td>
                        <td><span style={{ display: 'inline-block', padding: '5px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, background: st.label === 'Suspended' ? 'rgba(214,140,0,.16)' : st.live ? 'rgba(31,138,91,.16)' : 'rgba(0,0,0,.08)', color: st.label === 'Suspended' ? '#a36a00' : st.live ? '#1f8a5b' : 'var(--mut)' }}>{st.label}</span></td>
                        <td>{l.template ? TP[l.template]?.name || l.template : '—'}</td>
                        <td><small>{since(l)}</small></td>
                        <td>
                          <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                            {!l.activatedAt && !l.id.startsWith('demo-cust') && (
                              <button className="chip" disabled={busy} style={{ fontWeight: 700 }} onClick={() => confirmPayment(l)}>Confirm payment</button>
                            )}
                            <button className="chip" onClick={() => { try { navigator.clipboard?.writeText(appLink(l)); say('App link copied'); } catch { say('Could not copy the link') } }}>Copy link</button>
                            <button className="chip" onClick={() => window.open(appLink(l), '_blank')}>Open</button>
                          </div>
                        </td>
                        <td><button className="chip" onClick={() => setManage(l)}>Manage</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            )}
          </div>
        )}
      </>
    )
  }

  async function savePay() {
    if (!payForm) return
    setBusy(true)
    try {
      await consoleCall('set', { collection: 'platform', id: 'payment', data: { accountName: payForm.accountName.trim(), bankName: payForm.bankName.trim(), accountNumber: payForm.accountNumber.trim(), whatsapp: payForm.whatsapp.replace(/[^0-9]/g, ''), updatedAt: Date.now() } })
      logAudit('Updated the payment account details')
      setPaySaved('Saved. Every app picks up the new details immediately.')
      window.setTimeout(() => setPaySaved(''), 4000)
    } catch (e: any) {
      say(e?.message || 'Could not save the payment details')
    } finally {
      setBusy(false)
    }
  }

  function paySection() {
    if (!payForm) return <div className="card"><p style={{ color: 'var(--mut)', margin: 0 }}>Loading payment details…</p></div>
    return (
      <>
        {head('Payment details', 'The bank account customers see in the payment flow after their trial ends. Change it here any time; every app picks it up immediately.', <button className="btn g" disabled={busy} onClick={savePay}>Save changes</button>)}
        <div className="card">
          <div className="rw" style={{ flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 200px' }}>Account name
              <input style={{ width: '100%' }} value={payForm.accountName} onChange={(e) => setPayForm({ ...payForm, accountName: e.target.value })} placeholder="e.g. Michael Ogunnaike" />
            </label>
            <label style={{ flex: '1 1 160px' }}>Bank name
              <input style={{ width: '100%' }} value={payForm.bankName} onChange={(e) => setPayForm({ ...payForm, bankName: e.target.value })} placeholder="e.g. Moniepoint" />
            </label>
          </div>
          <div className="rw" style={{ flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 200px' }}>Account number
              <input style={{ width: '100%' }} value={payForm.accountNumber} onChange={(e) => setPayForm({ ...payForm, accountNumber: e.target.value })} placeholder="10 digits" />
            </label>
            <label style={{ flex: '1 1 200px' }}>WhatsApp number (wa.me digits, e.g. 2349030064109)
              <input style={{ width: '100%' }} value={payForm.whatsapp} onChange={(e) => setPayForm({ ...payForm, whatsapp: e.target.value })} placeholder="2349030064109" />
            </label>
          </div>
          <p style={{ color: 'var(--mut)', fontSize: 13.5, margin: '12px 0 0' }}>Customers pay by bank transfer to this account. When a receipt is uploaded it appears on that customer's row in Customers; Confirm payment there activates their app for a year.</p>
          {paySaved && <p style={{ color: '#1f8a5b', fontSize: 13.5, margin: '10px 0 0' }}>{paySaved}</p>}
        </div>
      </>
    )
  }

  const VIEWS: Record<SecId, () => React.ReactNode> = { over: overview, pipe: pipeline, leads: leadsSection, cust: customersSection, onb: onboard, sites: sitesSection, ord: orders, cat: catalogSection, pay: paySection, team: team }

  return (
    <div className="evad">
      <div className={`evad-scrim${navOpen ? ' on' : ''}`} onClick={() => setNavOpen(false)} />
      <aside className={navOpen ? 'open' : ''}>
        <div className="br"><i /><div>Eventicor<small>PLATFORM ADMIN</small></div></div>
        {NAV.map((n) => (
          <button key={n.id} className={sec === n.id ? 'on' : ''} onClick={() => { go(n.id); setNavOpen(false); }}>
            <Icon id={n.id} />
            {n.label}
          </button>
        ))}
        <a href="/" style={{ display: 'flex', width: '100%', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 12, fontWeight: 600, fontSize: 15, color: '#c3c1e4', textDecoration: 'none', marginTop: 10 }}>View app</a>
      </aside>
      <main>
        <div className="evad-topbar">
          <button className="evad-burger" aria-label="Open menu" onClick={() => setNavOpen(true)}><Menu /></button>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen((v) => !v)} aria-label="Account menu" className="evad-avatar">
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
        {VIEWS[sec]()}
      </main>

      {drawer && drawerDoc && (
        <div className="dr" onClick={(e) => { if (e.target === e.currentTarget) setDrawerId(null) }}>
          <div className="dp" key={drawerId}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2>{drawer.couple}</h2>
              <button className="btn g s" onClick={() => setDrawerId(null)}>Close</button>
            </div>
            <p style={{ color: 'var(--mut)', margin: '4px 0 14px' }}>
              {drawer.slug}.eventicor.com · since {drawer.since} {drawer.status ? '· ' + drawer.status[0].toUpperCase() + drawer.status.slice(1) : ''}
            </p>
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
                {drawer.status === 'suspended' ? 'Reactivate' : 'Suspend'} app
              </button>
            </div>
            <div className="fs">DANGER ZONE</div>
            <label>Type <b>{drawer.slug}</b> to delete this app forever</label>
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
                <h2>Could not create the app</h2>
                <p style={{ color: 'var(--mut)' }}>{prov.error}</p>
                <div className="row"><button className="btn g" onClick={() => setProv(null)}>Close</button></div>
              </>
            ) : prov.done ? (
              <>
                <h2>App is live</h2>
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

      {payView && payView.lastPayment && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(10,10,22,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setPayView(null)}>
          <div style={{ background: 'var(--card)', borderRadius: 18, maxWidth: 430, width: '100%', padding: 20, boxShadow: '0 30px 60px rgba(10,10,22,.4)', maxHeight: '86vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: 19 }}>Payment receipt · {leadName(payView)}</h3>
            <p style={{ color: 'var(--mut)', fontSize: 13.5, margin: '6px 0 4px' }}>
              {payView.lastPayment.plan || '—'} · {ng(payView.lastPayment.amount || 0)} · sent {payView.lastPayment.submittedAt ? new Date(payView.lastPayment.submittedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
            </p>
            <p style={{ color: 'var(--mut)', fontSize: 13, margin: '0 0 12px' }}>Email {payView.lastPayment.email || '—'} · App {payView.lastPayment.appName || '—'}</p>
            {payView.lastPayment.receiptUrl && (
              <a href={payView.lastPayment.receiptUrl} target="_blank" rel="noreferrer">
                <img src={payView.lastPayment.receiptUrl} alt="Payment receipt" style={{ width: '100%', borderRadius: 12, border: '1px solid rgba(0,0,0,.08)' }} />
              </a>
            )}
            {!payView.activatedAt ? (
              <button className="btn g" style={{ width: '100%', marginTop: 12 }} disabled={busy} onClick={() => { confirmPayment(payView); setPayView(null) }}>Confirm payment</button>
            ) : (
              <p style={{ color: '#1f8a5b', fontSize: 13, margin: '12px 0 0' }}>Payment already confirmed; the account is active.</p>
            )}
            <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={() => setPayView(null)}>Close</button>
          </div>
        </div>
      )}

      {manage && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(10,10,22,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setManage(null)}>
          <div style={{ background: 'var(--card)', borderRadius: 18, maxWidth: 430, width: '100%', padding: 20, boxShadow: '0 30px 60px rgba(10,10,22,.4)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: 19 }}>{leadName(manage)}</h3>
            <p style={{ color: 'var(--mut)', fontSize: 13.5, margin: '6px 0 14px' }}>Manage this account. Extensions apply immediately; suspending or deleting revokes the app link for visitors.</p>
            {manage.lastPayment && (
              <button className="chip" style={{ width: '100%', marginBottom: 12, fontWeight: 700 }} onClick={() => { setManage(null); setPayView(manage) }}>
                Payment receipt uploaded{manage.lastPayment.plan ? ` · ${manage.lastPayment.plan}` : ''} — view it
              </button>
            )}
            {!manage.activatedAt && (
              <>
                <b style={{ fontSize: 13 }}>Extend the trial</b>
                <div className="rw" style={{ margin: '8px 0 4px', flexWrap: 'wrap' }}>
                  {([[24, '24 hours'], [72, '3 days'], [168, '7 days'], [336, '14 days'], [720, '30 days']] as [number, string][]).map(([h, lab]) => (
                    <button key={h} className={`chip ${extH === h ? 'on' : ''}`} onClick={() => setExtH(h)}>{lab}</button>
                  ))}
                </div>
                <button className="btn" style={{ width: '100%' }} disabled={busy} onClick={() => extendCustomer(manage)}>Extend by {extH % 24 === 0 ? `${extH / 24} day${extH > 24 ? 's' : ''}` : `${extH} hours`}</button>
              </>
            )}
            <div className="rw" style={{ marginTop: 14 }}>
              {manage.status !== 'suspended' ? (
                <button className="btn" style={{ flex: 1 }} disabled={busy} onClick={() => setCustomerStatus(manage, 'suspended')}>Suspend</button>
              ) : (
                <button className="btn" style={{ flex: 1 }} disabled={busy} onClick={() => setCustomerStatus(manage, 'active')}>Reinstate</button>
              )}
              <button className="btn" style={{ flex: 1, background: '#b3261e', borderColor: '#b3261e', color: '#fff' }} disabled={busy} onClick={() => setCustomerStatus(manage, 'deleted')}>Delete app</button>
            </div>
            <button className="btn g" style={{ width: '100%', marginTop: 10 }} onClick={() => setManage(null)}>Close</button>
          </div>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

function MiniPreview({ b, g, tpl, city, days, photos }: { b: string; g: string; tpl: { bg: string; fg: string; ac: string }; city: string; days: number; photos?: string[] }) {
  return (
    <div className="mp" style={{ ['--b' as string]: tpl.bg, ['--f' as string]: tpl.fg, ['--a' as string]: tpl.ac }}>
      <div className="mh">{b} & {g}</div>
      <div className="mm">
        <small>Together with their families</small>
        <b>{b}</b>
        <em>and</em>
        <b>{g}</b>
      </div>
      {photos && photos.length > 0 && (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', margin: '8px 0 0' }}>
          {photos.map((src, i) => (
            <img key={i} src={src} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8 }} />
          ))}
        </div>
      )}
      <div className="mc">
        <div><b>{days}</b>days</div>
        <div><b>{city}</b>city</div>
      </div>
      <div className="mr"><i />Engagement<span>Done</span></div>
      <div className="mr"><i />Bridal shower<span>Next up</span></div>
    </div>
  )
}
