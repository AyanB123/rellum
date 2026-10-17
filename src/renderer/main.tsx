import React from 'react'
import { createRoot } from 'react-dom/client'
import SettingsApp from './src/settings/App'
import AgentApp, { AgentOverlay } from './src/agent/App'
import PopupApp from './src/popup/App'
import './src/assets/tailwind.css'

function route(): JSX.Element {
  const hash = window.location.hash
  if (hash === '#/popup') return <PopupApp />
  if (hash === '#/agent-overlay') return <AgentOverlay />
  if (hash === '#/agent') return <AgentApp />
  return <SettingsApp />
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>{route()}</React.StrictMode>
)
