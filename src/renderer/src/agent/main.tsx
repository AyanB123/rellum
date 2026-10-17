import React from 'react'
import { createRoot } from 'react-dom/client'
import AgentApp, { AgentOverlay } from './App'
import '../assets/tailwind.css'

const Root = window.location.hash === '#/agent-overlay' ? AgentOverlay : AgentApp

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
