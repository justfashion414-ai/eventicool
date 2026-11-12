import { useState } from 'react'
import { Ticket, ArrowRight, LoaderCircle } from 'lucide-react'
import { signInGuest } from '../auth'
import { proxyCall } from '../firebase'

const KEY = 'ev-guest-event'

const messages: Record<string, string> = {
  'auth/operation-not-allowed': 'Guest sign-in isn\'t switched on for this project yet. Try again soon.',
  'auth/network-request-failed': 'Network hiccup. Check your connection and try again.',
}

export default function GuestEntry({ onDone }: { onDone: (code: string) => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const trimmed = code.trim()
    if (!trimmed) {
      setError('Enter an event code first.')
      return
    }
    setBusy(true)
    try {
      await signInGuest()
    } catch (err) {
      const msg = messages[(err as { code?: string }).code || '']
      setError(msg || 'Guest sign-in failed. Try again.')
      setBusy(false)
      return
    }
    try {
      const event = await proxyCall('get', { collection: 'events', id: trimmed.toLowerCase() })
      if (!event) {
        setError('That code isn\'t live yet. Check it with the couple or organizer.')
        setBusy(false)
        return
      }
      localStorage.setItem(KEY, trimmed.toLowerCase())
      onDone(trimmed.toLowerCase())
    } catch {
      setError('We couldn\'t reach the event. Try again in a moment.')
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm">
        <a href="/" className="mb-10 block text-center text-2xl font-bold tracking-tight text-slate-900">
          Eventicor
        </a>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">Enter your event code</h1>
          <p className="mt-1 text-sm text-slate-500">The code the organizer shared with you.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Event code</span>
              <div className="relative">
                <Ticket className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm uppercase tracking-wide outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  placeholder="e.g. dara-femi"
                />
              </div>
            </label>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {busy ? 'Opening…' : 'Open event'}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          Organizer? <a href="/login" className="font-medium text-slate-900 underline">Sign in instead</a>
        </p>
      </div>
    </main>
  )
}
