import { useState } from 'react'
import { Lock, LoaderCircle, ArrowRight } from 'lucide-react'
import { updatePassword } from 'firebase/auth'
import { auth, signOutEverywhere, type User } from '../auth'
import { proxyCall } from '../firebase'

const messages: Record<string, string> = {
  'auth/weak-password': 'That password is too weak. Use at least 8 characters.',
  'auth/requires-recent-login': 'For safety, sign in again and try once more.',
  'auth/network-request-failed': 'Network hiccup. Check your connection and try again.',
}

export default function SetPassword({
  user,
  onDone,
  onSignOut,
}: {
  user: User | null
  onDone: () => void
  onSignOut: () => void
}) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (pw.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    if (pw !== pw2) {
      setError("The two passwords don't match.")
      return
    }
    setBusy(true)
    try {
      const cu = auth.currentUser
      if (!cu) throw Object.assign(new Error('signed-out'), { code: 'auth/requires-recent-login' })
      await updatePassword(cu, pw)
      const email = (user?.email || '').toLowerCase()
      await proxyCall('update', { collection: 'admins', id: email, data: { mustChangePassword: false } })
      onDone()
    } catch (err) {
      const code = (err as { code?: string }).code || ''
      setError(messages[code] || 'Could not save the password. Try again.')
    } finally {
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
          <h1 className="text-xl font-bold text-slate-900">Set your permanent password</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your account is still on a temporary password. Choose a permanent one before the dashboard opens.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">New password</span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="At least 8 characters"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Confirm new password</span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="Type it again"
                />
              </div>
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              {busy ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              Save and open dashboard
            </button>
          </form>
          <button
            type="button"
            onClick={() => signOutEverywhere().then(onSignOut)}
            className="mt-4 w-full text-center text-xs font-medium text-slate-400 transition hover:text-slate-600"
          >
            Cancel and sign out
          </button>
        </div>
      </div>
    </main>
  )
}
