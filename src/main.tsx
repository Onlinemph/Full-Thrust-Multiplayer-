import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './ui/theme/tokens.css'
import './ui/theme/plot.css'
import './ui/theme/panels.css'
import './ui/theme/chrome.css'
import './ui/theme/modals.css'
import { App } from './ui/App'

/**
 * Entry point. The rules engine runs in the browser and there is no server, so
 * this is the whole of the boot sequence: mount the app over the fallback
 * message in index.html.
 */
const container = document.getElementById('root')
if (!container) throw new Error('#root is missing from index.html')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
