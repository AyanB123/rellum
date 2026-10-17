import React from 'react'
import { createRoot } from 'react-dom/client'
import SettingsApp from './src/settings/App'
import AgentApp, { AgentOverlay } from './src/agent/App'
import './src/assets/tailwind.css'

const App = window.location.hash === '#/agent-overlay' ? AgentOverlay : window.location.hash === '#/agent' ? AgentApp : SettingsApp

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode><App /></React.StrictMode>
)
