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
