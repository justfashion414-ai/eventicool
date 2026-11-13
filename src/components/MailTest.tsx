import { useState } from 'react'

// TEMPORARY test panel: verifies the ZeptoMail credential email end to end.
// Remove after the email pipeline is confirmed working.
type Variant = 'landing' | 'admin'

const OPTIONS: { value: Variant; label: string }[] = [
  { value: 'landing', label: '24-hour trial (landing page template)' },
  { value: 'admin', label: '30-day trial (admin dashboard template)' },
]

export default function MailTest() {
  const [email, setEmail] = useState('')
  const [variant, setVariant] = useState<Variant>('landing')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string>('')

  async function fire(e: React.FormEvent) {
    e.preventDefault()
    setResult('')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setResult('Enter a valid email address first.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/send-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source: variant, preview_url: window.location.origin }),
      })
      const body = await res.json().catch(() => ({}))
      setResult(res.ok && body.ok ? `SENT — the email is on its way to ${email.trim()}. Check the inbox (and spam).` : `FAILED — ${body.error || 'HTTP ' + res.status}${body.detail ? '\n' + body.detail : ''}`)
    } catch (err) {
      setResult(`FAILED — ${String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-600">Temporary test panel</p>
        <h1 className="text-xl font-bold text-slate-900">ZeptoMail delivery check</h1>
        <p className="mt-1 text-sm text-slate-500">Fires the real credential email so we can confirm sending works. Removed after testing.</p>
        <form onSubmit={fire} className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Recipient email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Template</span>
            <select
              value={variant}
              onChange={(e) => setVariant(e.target.value as Variant)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
            >
              {OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {busy ? 'Firing…' : 'Fire up'}
          </button>
        </form>
        {result && (
          <div className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800">{result}</div>
        )}
      </div>
    </main>
  )
}
