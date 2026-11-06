import { useEffect, useState } from 'react'
import Landing from './components/Landing'
import Login from './components/Login'
import GuestEntry from './components/GuestEntry'
import AdminConsole from './components/AdminConsole'
import { isAdmin, signOutEverywhere, watchAuth, type User } from './auth'

type AdminState = 'loading' | 'admin' | 'not-admin' | 'signed-out'

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
        setAdminState((await isAdmin(u)) ? 'admin' : 'not-admin')
      }),
    [],
  )

  // Direct visits to /admin: signed-in non-admins get signed out and sent to the login page.
  useEffect(() => {
    if (route === '/admin' && adminState === 'not-admin') {
      signOutEverywhere().then(() => navigate('/login'))
    }
  }, [route, adminState])

  if (route === '/admin') {
    if (adminState === 'admin') return <AdminConsole user={user} onSignOut={() => navigate('/')} />
    if (adminState === 'signed-out') {
      return <Login onDone={() => navigate('/admin')} />
    }
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <span className="text-sm text-slate-500">Checking your access…</span>
      </main>
    )
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

  return <Landing />
}
