import { useEffect, useState, lazy, Suspense } from 'react'
import LandingMarketing from './landing/LandingMarketing'
import Login from './components/Login'
import GuestEntry from './components/GuestEntry'
import MailTest from './components/MailTest'
import { getAdminDoc, signOutEverywhere, watchAuth, type User } from './auth'
import SetPassword from './components/SetPassword'
import BootLoader from './components/BootLoader'
const AdminConsole = lazy(() => import('./components/AdminConsole'))
const CoupleApp = lazy(() => import('./couple/CoupleApp'))
const InstallPage = lazy(() => import('./components/InstallPage'))

type AdminState = 'loading' | 'admin' | 'must-change' | 'not-admin' | 'signed-out' | 'check-error'

function navigate(to: string) {
  window.history.pushState({}, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function App() {
  const [route, setRoute] = useState(window.location.pathname)
  const [user, setUser] = useState<User | null>(null)
  const [adminState, setAdminState] = useState<AdminState>('loading')

  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(
    () =>
      watchAuth(async (u) => {
        setUser(u)
        if (!u) {
          setAdminState('signed-out')
          return
        }
        setAdminState('loading')
        try {
          const doc = await getAdminDoc(u)
          setAdminState(!doc ? 'not-admin' : doc.mustChangePassword ? 'must-change' : 'admin')
        } catch {
          // A failed access check (network, proxy hiccup) must never log the admin out.
          setAdminState('check-error')
        }
      }),
    [],
  )

  // Direct visits to /admin: signed-in non-admins get signed out and sent to the login page.
  useEffect(() => {
    if (route === '/admin' && adminState === 'not-admin') {
      signOutEverywhere().then(() => navigate('/login'))
    }
  }, [route, adminState])

  function retryAdminCheck() {
    setAdminState('loading')
    const u = user
    if (!u) { setAdminState('signed-out'); return }
    getAdminDoc(u)
      .then((doc) => setAdminState(!doc ? 'not-admin' : (doc as any).mustChangePassword ? 'must-change' : 'admin'))
      .catch(() => setAdminState('check-error'))
  }

  // The couple app also lives under its own install scope paths
  // (/app/lead/<id>/, /app/site/<id>/, /app/demo/), which Chrome opens as the
  // installed app's start_url. Every /app* path renders the couple app; the
  // couple's names, template and accent come from the query string.
  if (route === '/app' || route.startsWith('/app/')) {
    return <Suspense fallback={<BootLoader />}><CoupleApp /></Suspense>
  }
  if (route === '/install') {
    return <Suspense fallback={<BootLoader />}><InstallPage /></Suspense>
  }
  if (route === '/admin') {
    if (adminState === 'admin') return <Suspense fallback={<BootLoader />}><AdminConsole user={user} onSignOut={() => navigate('/')} /></Suspense>
    if (adminState === 'must-change') {
      return <SetPassword user={user} onDone={() => setAdminState('admin')} onSignOut={() => navigate('/')} />
    }
    if (adminState === 'signed-out') {
      return <Login onDone={() => navigate('/admin')} />
    }
    if (adminState === 'check-error') {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
          <span className="max-w-xs text-sm text-slate-600">
            We could not verify your access just now. You are still signed in. Check your connection and try again.
          </span>
          <button
            onClick={retryAdminCheck}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Try again
          </button>
        </main>
      )
    }
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <span className="text-sm text-slate-500">Checking your access…</span>
      </main>
    )
  }

  // Design/demo route: renders the console with a fake admin, no auth or data writes needed.
  if (route === '/console-demo') {
    const drawer = new URLSearchParams(window.location.search).has('drawer')
    return <AdminConsole user={{ uid: 'demo', email: 'ola@eventicor.name.ng' } as User} onSignOut={() => navigate('/')} initialNavOpen={drawer} />
  }
  if (route === '/mail-test') {
    return <MailTest />
  }

  if (route === '/login') {
    return <Login onDone={() => navigate('/admin')} />
  }

  if (route === '/guest') {
    return (
      <GuestEntry
        onDone={(code) => {
          // The event page itself lands in a later build; keep the code until then.
          navigate('/')
        }}
      />
    )
  }

  return <LandingMarketing />
}
