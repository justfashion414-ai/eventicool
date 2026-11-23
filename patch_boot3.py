import io
p = 'src/couple/AnniversaryPortal.tsx'
s = io.open(p, encoding='utf-8').read()

old1 = """  const adminRetryCountRef = useRef(0);
  const [adminRetryNonce, setAdminRetryNonce] = useState(0);"""
new1 = """  const adminRetryCountRef = useRef(0);
  const [adminRetryNonce, setAdminRetryNonce] = useState(0);
  // Bounded boot gate: the "Opening your dashboard" loader must never hold
  // forever. On a very slow or offline network the auth session or the admins
  // lookup can hang without erroring, which used to leave a spinner until the
  // admin refreshed by hand. After 12 seconds the gate releases itself; the
  // dashboard-reopen effect still opens the dashboard the moment the role
  // actually confirms.
  const [bootGateTimedOut, setBootGateTimedOut] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setBootGateTimedOut(true), 12000);
    return () => window.clearTimeout(t);
  }, []);"""
assert old1 in s, 'anchor 1 not found'
s = s.replace(old1, new1, 1)

old2 = """  const adminRestorePending = !noChrome && adminMode === 'real'
    && wasAdminOpenOnLoadRef.current
    && !("""
new2 = """  const adminRestorePending = !noChrome && adminMode === 'real'
    && wasAdminOpenOnLoadRef.current
    && !bootGateTimedOut
    && !("""
assert old2 in s, 'anchor 2 not found'
s = s.replace(old2, new2, 1)

old3 = """        (authChecked && !(user && !user.isAnonymous && !adminStatusChecked) && !adminRestorePending && !authTransient) ? ("""
new3 = """        ((authChecked && !(user && !user.isAnonymous && !adminStatusChecked) && !adminRestorePending && !authTransient) || bootGateTimedOut) ? ("""
assert old3 in s, 'anchor 3 not found'
s = s.replace(old3, new3, 1)

io.open(p, 'w', encoding='utf-8').write(s)
print('portal ok')
