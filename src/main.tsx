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
  if (document.getElementById('root')?.hasChildNodes()) { document.getElementById('boot-splash')?.remove(); return }
  requestAnimationFrame(dropSplash)
}
requestAnimationFrame(dropSplash)
setTimeout(() => document.getElementById('boot-splash')?.remove(), 6000)

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

