import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// The boot splash lives in index.html so it paints before any JavaScript. It
// stays up until React has actually committed its first frame (the loading
// screen or the page itself), then hands the screen over; the timeout is a
// safety net so a crashed bundle can never trap the user on the splash.
const dropSplash = () => {
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
})

// AUTO-REFRESH: when the app has sat open for a while (a phone left
// overnight, a tab left in the background), the next time it is seen it
// should bring itself up to date on its own, exactly what tapping refresh
// does. The served page names the current bundle; when it no longer matches
// the bundle actually running, the app reloads once. Its own position memory
// (dashboard tab, feed choice, scroll restore) puts the user back where they were.
const MY_BUNDLE = (() => {
  const el = document.querySelector('script[src*="/assets/"]');
  const src = el ? (el.getAttribute('src') || '') : '';
  return src ? src.split('/').pop() : '';
})();
let deployChecking = false;
const checkDeployChanged = async () => {
  if (deployChecking || !MY_BUNDLE || !navigator.onLine) return;
  deployChecking = true;
  try {
    const res = await fetch(window.location.pathname, { cache: 'no-store' });
    if (!res.ok) return;
    const html = await res.text();
    const m = html.match(/src="(\/assets\/[^"]+\.js)"/);
    if (!m) return;
    const served = m[1].split('/').pop() || '';
    if (served && served !== MY_BUNDLE) {
      const key = 'ev-reloaded-' + served;
      try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch { /* private mode */ }
      window.location.reload();
    }
  } catch { /* offline or blocked: keep what we have */ }
  finally { deployChecking = false; }
};
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  // Coming back after a while away: refresh itself, no tap needed.
  if (hiddenAt && Date.now() - hiddenAt > 60_000) checkDeployChanged();
  hiddenAt = 0;
});
window.addEventListener('focus', () => { if (hiddenAt && Date.now() - hiddenAt > 60_000) checkDeployChanged(); hiddenAt = 0; });
// A back/forward restore or a page the browser kept while it was closed comes
// back on its own the same way: check the served bundle the moment it shows.
window.addEventListener('pageshow', (e) => { if ((e as PageTransitionEvent).persisted) checkDeployChanged(); });
// And check once shortly after every open, so an app opened straight onto a
// deploy that replaced its bundle brings itself up to date without a tap.
setTimeout(checkDeployChanged, 4000);

