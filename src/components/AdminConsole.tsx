import { useEffect, useRef, useState } from 'react'
import {
  LayoutDashboard, CalendarDays, LayoutTemplate, Settings as SettingsIcon,
  Menu, X, ChevronDown, LogOut, Globe, LoaderCircle,
} from 'lucide-react'
import { signOutEverywhere, type User } from '../auth'
import { proxyCall } from '../firebase'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'events', label: 'Events', icon: CalendarDays },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
] as const

type TabId = (typeof TABS)[number]['id']
const KEY = 'ev-admin-ui'

interface EventRow {
  id: string
  title?: string
  template?: string
  createdAt?: { seconds?: number }
}

function fmtDate(ev?: { seconds?: number }) {
  if (!ev?.seconds) return '—'
  return new Date(ev.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminConsole({ user, onSignOut }: { user: User | null; onSignOut: () => void }) {
  const [tab, setTab] = useState<TabId>(() => {
    const saved = localStorage.getItem(KEY)
    return (TABS.some((t) => t.id === saved) ? saved : 'dashboard') as TabId
  })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [events, setEvents] = useState<EventRow[] | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => { localStorage.setItem(KEY, tab) }, [tab])
  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])
  useEffect(() => {
    let alive = true
    proxyCall('list', { collection: 'events', limit: 50 })
      .then((res) => { if (alive) setEvents(res.docs as EventRow[]) })
      .catch(() => { if (alive) setEvents([]) })
    return () => { alive = false }
  }, [])

  function pickTab(id: TabId) {
    setTab(id)
    setDrawerOpen(false)
  }

  async function signOut() {
    await signOutEverywhere()
    onSignOut()
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => pickTab(id)}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
            tab === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </nav>
  )

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="px-5 py-5 text-lg font-bold tracking-tight">Eventicool</div>
        {nav}
        <div className="border-t border-slate-200 p-3">
          <a href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">
            <Globe className="h-4 w-4" /> View website
          </a>
        </div>
      </aside>

      {/* Mobile drawer: full-height, slides from the left */}
      {drawerOpen && <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setDrawerOpen(false)} />}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:hidden ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <span className="text-lg font-bold tracking-tight">Eventicool</span>
          <button onClick={() => setDrawerOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        {nav}
        <div className="border-t border-slate-200 p-3">
          <a href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">
            <Globe className="h-4 w-4" /> View website
          </a>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:px-8">
          <button className="rounded-md p-1.5 hover:bg-slate-100 lg:hidden" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="flex-1 truncate text-lg font-semibold">{TABS.find((t) => t.id === tab)?.label}</h1>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Account menu"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white hover:bg-slate-700"
            >
              {(user?.email || '?')[0].toUpperCase()}
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-500">
                  <div className="truncate font-medium text-slate-900">{user?.email}</div>
                  Administrator
                </div>
                <button
                  onClick={signOut}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          {tab === 'dashboard' && (
            <section className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-sm text-slate-500">Events</div>
                  <div className="mt-1 text-3xl font-bold">{events === null ? <LoaderCircle className="h-6 w-6 animate-spin text-slate-400" /> : events.length}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-sm text-slate-500">Templates</div>
                  <div className="mt-1 text-3xl font-bold">—</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-sm text-slate-500">Guest posts</div>
                  <div className="mt-1 text-3xl font-bold">—</div>
                </div>
              </div>
              <p className="text-sm text-slate-500">Dashboards fill in as events, templates and posts arrive.</p>
            </section>
          )}

          {tab === 'events' && (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {events === null ? (
                <div className="flex items-center gap-2 p-6 text-sm text-slate-500">
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Loading events…
                </div>
              ) : events.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">No events yet. Create the first one from Settings.</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <tr><th className="px-5 py-3 font-medium">Code</th><th className="px-5 py-3 font-medium">Title</th><th className="px-5 py-3 font-medium">Template</th><th className="px-5 py-3 font-medium">Created</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {events.map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-medium">{ev.id}</td>
                        <td className="px-5 py-3">{ev.title || '—'}</td>
                        <td className="px-5 py-3">{ev.template || '—'}</td>
                        <td className="px-5 py-3">{fmtDate(ev.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}

          {tab === 'templates' && (
            <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Template gallery lands in the next build.</p>
          )}
          {tab === 'settings' && (
            <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Event creation, invite management and account settings land in the next build.</p>
          )}
        </main>
      </div>
    </div>
  )
}
