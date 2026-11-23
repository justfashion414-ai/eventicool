import { useEffect, useRef, useState } from 'react'
import { Mail, Lock, ArrowRight, LoaderCircle, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react'
import { signInAdmin } from '../auth'
import { otpCall, lockTimeString, newPasswordOk, NEW_PASSWORD_HINT } from '../otpAuth'

const RESEND_SECONDS = 600

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function Login({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<'login' | 'email' | 'otp' | 'new'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  // Password reset by emailed code: three screens (email, code, new password).
  const [code, setCode] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  const tickRef = useRef<number | null>(null)
  const passRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    tickRef.current = window.setInterval(() => setResendIn((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => { if (tickRef.current) window.clearInterval(tickRef.current) }
  }, [])

  const startResend = (seconds: number) => setResendIn(seconds)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setBusy(true)
    try {
      await signInAdmin(email, password)
      onDone()
    } catch (err) {
      const code = (err as { code?: string }).code || ''
      const left = (err as { attemptsLeft?: number }).attemptsLeft
      const detail = (err as { detail?: string }).detail
      if (code === 'eventicor/locked') {
        setError(`Too many wrong attempts. Sign-in is locked ${detail || 'for 1 hour'}.`)
      } else if (code === 'auth/invalid-credential' && typeof left === 'number') {
        setError(`Wrong email or password. ${left} ${left === 1 ? 'attempt' : 'attempts'} left before a 1-hour lock.`)
      } else {
        setError(messages[code] || 'Sign-in failed. Try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function sendCode() {
    setError('')
    if (!email.trim()) { setError('Enter your email first.'); return }
    setBusy(true)
    const r = await otpCall('request', { email })
    setBusy(false)
    if (r.status === 200) {
      startResend(RESEND_SECONDS)
      setStep('otp')
      return
    }
    if (r.status === 429 && r.body?.error === 'rate') {
      const wait = Math.max(1, Number(r.body?.retryAfter) || RESEND_SECONDS)
      setError(`A code was already sent to this email. Request another in ${fmt(wait)}.`)
      startResend(wait)
      setStep('otp')
      return
    }
    if (r.status === 429 && r.body?.error === 'locked') {
      setError(`Too many attempts. This is locked ${lockTimeString(r.body?.retryAt)}.`)
      return
    }
    setError('Could not send the code. Check your connection and try again.')
  }

  async function verifyCode() {
    setError('')
    if (code.replace(/\D/g, '').length !== 6) { setError('Enter the 6-digit code from your email.'); return }
    setBusy(true)
    const r = await otpCall('verify', { email, code })
    setBusy(false)
    if (r.status === 200 && r.body?.token) {
      setResetToken(String(r.body.token))
      setCode('')
      setStep('new')
      return
    }
    if (r.status === 429 && r.body?.error === 'locked') {
      setError('Too many wrong codes. You can try again ' + lockTimeString(r.body?.retryAt) + '.')
      return
    }
    if (r.status === 400 && r.body?.error === 'expired') { setError('That code has expired. Request a new one.'); return }
    if (r.status === 400 && r.body?.error === 'none') { setError('No code is waiting for this email yet. Request one first.'); return }
    const left = r.body?.attemptsLeft
    setError(`That code is not right.${typeof left === 'number' ? ` ${left} ${left === 1 ? 'try' : 'tries'} left before a 1-hour lock.` : ' Try again.'}`)
  }

  async function resetPassword() {
    setError('')
    if (!newPasswordOk(newPass)) { setError('Use at least 6 characters.'); return }
    if (newPass !== confirmPass) { setError('The two passwords do not match.'); return }
    setBusy(true)
    const r = await otpCall('reset', { email, token: resetToken, password: newPass })
    setBusy(false)
    if (r.status === 200) {
      setResetToken('')
      setNewPass('')
      setConfirmPass('')
      setPassword('')
      setNotice('Password updated. Enter your new password to sign in.')
      setError('')
      setStep('login')
      setTimeout(() => passRef.current?.focus(), 50)
      return
    }
    if (r.status === 429 && r.body?.error === 'locked') { setError('Too many attempts. This is locked ' + lockTimeString(r.body?.retryAt) + '.'); return }
    if (r.status === 400 && (r.body?.error === 'weak')) { setError('Use at least 6 characters.'); return }
    if (r.status === 400 && (r.body?.error === 'token')) { setError('Your reset session expired. Start the reset again.'); setStep('email'); return }
    setError('Could not update the password. Try again.')
  }

  const messages: Record<string, string> = {
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/invalid-email': "That email address doesn't look right.",
    'auth/too-many-requests': 'Too many attempts. Try again in a minute.',
    'auth/network-request-failed': 'Network hiccup. Check your connection and try again.',
    'eventicool/not-admin': "That account isn't an administrator.",
    'eventicor/login-failed': 'Network hiccup. Check your connection and try again.',
  }

  const inputCls = 'w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900'

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm">
        <a href="/" className="mb-10 block text-center text-2xl font-bold tracking-tight text-slate-900">
          Eventicor
        </a>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {step === 'otp' ? (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <ShieldCheck className="h-6 w-6 text-slate-700" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">Check your email</h1>
              <p className="mt-1 text-sm text-slate-500">
                If <span className="font-medium text-slate-700">{email}</span> is on an admin account, a 6-digit code is waiting there. The code stops working in 10 minutes.
              </p>
              <form onSubmit={(e) => { e.preventDefault(); verifyCode() }} className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Enter the code</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-3 text-center text-2xl font-bold tracking-[0.4em] outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                    placeholder="000000"
                  />
                </label>
                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                >
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {busy ? 'Checking…' : 'Continue'}
                </button>
              </form>
              <button
                type="button"
                onClick={sendCode}
                disabled={busy || resendIn > 0}
                className="mt-4 w-full text-center text-sm font-medium text-slate-600 underline-offset-2 hover:underline disabled:no-underline disabled:opacity-50"
              >
                {resendIn > 0 ? `Request a new code in ${fmt(resendIn)}` : 'Request a new code'}
              </button>
              <button onClick={() => { setStep('login'); setError('') }} className="mt-3 w-full text-center text-sm text-slate-500">
                Back to sign in
              </button>
            </>
          ) : step === 'new' ? (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <KeyRound className="h-6 w-6 text-slate-700" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">Set a new password</h1>
              <p className="mt-1 text-sm text-slate-500">{NEW_PASSWORD_HINT}</p>
              <form onSubmit={(e) => { e.preventDefault(); resetPassword() }} className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">New password</span>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showNew ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      className={inputCls + ' pr-10'}
                      placeholder="At least 6 characters"
                    />
                    <button type="button" onClick={() => setShowNew(!showNew)} aria-label={showNew ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600">
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Confirm new password</span>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                      className={inputCls + ' pr-10'}
                      placeholder="Type it once more"
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} aria-label={showConfirm ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600">
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>
                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={busy || !newPass || !confirmPass}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                >
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {busy ? 'Saving…' : 'Continue'}
                </button>
              </form>
            </>
          ) : step === 'email' ? (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <KeyRound className="h-6 w-6 text-slate-700" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">Forgot password</h1>
              <p className="mt-1 text-sm text-slate-500">
                Enter the email on your admin account. If it is registered, a 6-digit reset code will be sent to it.
              </p>
              <form onSubmit={(e) => { e.preventDefault(); sendCode() }} className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputCls}
                      placeholder="you@example.com"
                    />
                  </div>
                </label>
                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                >
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {busy ? 'Sending…' : 'Send code'}
                </button>
              </form>
              <button onClick={() => { setStep('login'); setError('') }} className="mt-3 w-full text-center text-sm text-slate-500">
                Back to sign in
              </button>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-slate-900">Administrator sign-in</h1>
              <p className="mt-1 text-sm text-slate-500">Use the email you were invited with.</p>
              <form onSubmit={submit} className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputCls}
                      placeholder="you@example.com"
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      ref={passRef}
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputCls}
                      placeholder="••••••••"
                    />
                  </div>
                </label>
                {notice && (
                  <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">{notice}</p>
                )}
                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                >
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {busy ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
              <button onClick={() => { setNotice(''); setError(''); setStep('email') }} className="mt-4 text-sm font-medium text-slate-600 hover:underline">
                Forgot password?
              </button>
            </>
          )}
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          Invited to an event? <a href="/guest" className="font-medium text-slate-900 underline">Enter your event code</a>
        </p>
      </div>
    </main>
  )
}
