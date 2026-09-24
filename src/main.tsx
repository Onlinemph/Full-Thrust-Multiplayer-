import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './ui/theme/tokens.css'
import './ui/theme/plot.css'
import './ui/theme/panels.css'
import './ui/theme/chrome.css'
import './ui/theme/modals.css'
import './ui/theme/ftMap.css'
import './ui/theme/ftShips.css'
import './ui/theme/ftPlay.css'
import './ui/theme/ftScreens.css'
import './ui/theme/campaign.css'
import './ui/theme/dirtsideTokens.css'
import './ui/theme/dirtside.css'
import './ui/theme/dirtsideSetup.css'
import './ui/theme/dirtsidePlay.css'
import './ui/theme/dirtsideMap.css'
import './ui/theme/print.css'
import { App } from './ui/App'
import { SsdSprite } from './ui/ssd/Glyph'

/**
 * Entry point. The rules engine runs in the browser and there is no server, so
 * this is the whole of the boot sequence: mount the app over the fallback
 * message in index.html.
 */
const container = document.getElementById('root')
if (!container) throw new Error('#root is missing from index.html')

createRoot(container).render(
  <StrictMode>
    {/* The SSD symbol definitions, mounted once for the whole app: every ship
        drawn anywhere refers to these rather than carrying a copy. */}
    <SsdSprite />
    <App />
  </StrictMode>,
)
