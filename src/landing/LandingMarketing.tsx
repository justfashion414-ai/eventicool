import { useEffect } from 'react'
import './landing.css'
import landingHtml from './landing.html?raw'
import { runLandingScript } from './landingScript'

// The prototype ships its own vanilla-JS layer; run it once after the markup lands.
let ran = false

export default function LandingMarketing() {
  useEffect(() => {
    if (ran) return
    ran = true
    try {
      runLandingScript()
    } catch (err) {
      console.error('Landing init failed', err)
    }
  }, [])

  return <div id="ev-l" dangerouslySetInnerHTML={{ __html: landingHtml }} />
}
