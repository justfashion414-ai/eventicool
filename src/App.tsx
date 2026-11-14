import { useEffect, useState, lazy, Suspense } from 'react'
import LandingMarketing from './landing/LandingMarketing'
import Login from './components/Login'
import GuestEntry from './components/GuestEntry'
import AdminConsole from './components/AdminConsole'
import MailTest from './components/MailTest'
import { getAdminDoc, signOutEverywhere, watchAuth, type User } from './auth'
import SetPassword from './components/SetPassword'
const CoupleApp = lazy(() => import('./couple/CoupleApp'))

type AdminState = 'loading' | 'admin' | 'must-change' | 'not-admin' | 'signed-out'

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
        const doc = await getAdminDoc(u)
        setAdminState(!doc ? 'not-admin' : doc.mustChangePassword ? 'must-change' : 'admin')
      }),
    [],
  )

  // Direct visits to /admin: signed-in non-admins get signed out and sent to the login page.
  useEffect(() => {
    if (route === '/admin' && adminState === 'not-admin') {
      signOutEverywhere().then(() => navigate('/login'))
    }
  }, [route, adminState])

  if (route === '/app') {
    return <Suspense fallback={null}><CoupleApp /></Suspense>
  }
  if (route === '/admin') {
    if (adminState === 'admin') return <AdminConsole user={user} onSignOut={() => navigate('/')} />
    if (adminState === 'must-change') {
      return <SetPassword user={user} onDone={() => setAdminState('admin')} onSignOut={() => navigate('/')} />
    }
    if (adminState === 'signed-out') {
      return <Login onDone={() => navigate('/admin')} />
    }
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <span className="text-sm text-slate-500">Checking your access…</span>
      </main>
    )
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
