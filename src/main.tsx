import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// The boot splash lives in index.html so it paints before any JavaScript; once
// the app has rendered its first frame, hand the screen over to it.
requestAnimationFrame(() => document.getElementById('boot-splash')?.remove())
