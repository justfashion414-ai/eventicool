import io
p = 'src/main.tsx'
s = io.open(p, encoding='utf-8').read()

old1 = """const dropSplash = () => {
  if (document.getElementById('root')?.hasChildNodes()) { document.getElementById('boot-splash')?.remove(); return }
  requestAnimationFrame(dropSplash)
}
requestAnimationFrame(dropSplash)
setTimeout(() => document.getElementById('boot-splash')?.remove(), 6000)"""
new1 = """const dropSplash = () => {
  if (document.getElementById('root')?.hasChildNodes()) {
    document.getElementById('boot-splash')?.remove()
    // The app painted: clear the one-shot boot retry guards so a much later
    // failure (a new deploy, a flaky network) can save itself again.
    try { sessionStorage.removeItem('ev-boot-retry'); sessionStorage.removeItem('ev-preload-retry') } catch { /* private mode */ }
    return
  }
  requestAnimationFrame(dropSplash)
}
requestAnimationFrame(dropSplash)
setTimeout(() => document.getElementById('boot-splash')?.remove(), 6000)

// A failed lazy chunk (flaky network, or a chunk a new deploy replaced while
// this page was open) used to leave the app on its loader forever. Reload
// once; the retry guard keeps it from ever looping.
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault();
  let retried = false;
  try { retried = !!sessionStorage.getItem('ev-preload-retry') } catch { /* private mode */ }
  if (retried) return;
  try { sessionStorage.setItem('ev-preload-retry', '1') } catch { /* private mode */ }
  window.location.reload();
})"""
assert old1 in s, 'dropSplash anchor not found'
s = s.replace(old1, new1, 1)

old2 = """window.addEventListener('focus', () => { if (hiddenAt && Date.now() - hiddenAt > 60_000) checkDeployChanged(); hiddenAt = 0; });"""
new2 = """window.addEventListener('focus', () => { if (hiddenAt && Date.now() - hiddenAt > 60_000) checkDeployChanged(); hiddenAt = 0; });
// A back/forward restore or a page the browser kept while it was closed comes
// back on its own the same way: check the served bundle the moment it shows.
window.addEventListener('pageshow', (e) => { if ((e as PageTransitionEvent).persisted) checkDeployChanged(); });
// And check once shortly after every open, so an app opened straight onto a
// deploy that replaced its bundle brings itself up to date without a tap.
setTimeout(checkDeployChanged, 4000);"""
assert old2 in s, 'focus anchor not found'
s = s.replace(old2, new2, 1)

io.open(p, 'w', encoding='utf-8').write(s)
print('main.tsx ok')
