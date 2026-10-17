import { BrowserWindow, screen } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'
import { IPC, type AgentProgressEvent } from '@shared/ipc'

const DEV_SERVER = process.env.ELECTRON_RENDERER_URL ?? 'http://localhost:5173'

let agentWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null

function loadAgentPage(win: BrowserWindow, hash = '#/agent'): void {
  if (is.dev) void win.loadURL(DEV_SERVER + '/src/renderer/src/agent/index.html' + hash)
  else void win.loadFile(join(__dirname, '../renderer/src/agent/index.html'), { hash })
}

/** Open the full agent console. The compact status overlay is created on demand by showAgentOverlay. */
export function createAgentWindow(): BrowserWindow {
  if (agentWindow && !agentWindow.isDestroyed()) {
    agentWindow.show()
    agentWindow.focus()
    return agentWindow
  }
  agentWindow = new BrowserWindow({
    width: 760,
    height: 620,
    show: false,
    title: 'Rellum Agent',
    autoHideMenuBar: true,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: true }
  })
  agentWindow.on('closed', () => { agentWindow = null })
  agentWindow.once('ready-to-show', () => agentWindow?.show())
  loadAgentPage(agentWindow)
  return agentWindow
}

export function showAgentOverlay(): BrowserWindow {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.showInactive()
    return overlayWindow
  }
  const { workArea } = screen.getPrimaryDisplay()
  overlayWindow = new BrowserWindow({
    width: 280,
    height: 120,
    x: workArea.x + workArea.width - 296,
    y: workArea.y + 16,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    hasShadow: true,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: true }
  })
  overlayWindow.on('closed', () => { overlayWindow = null })
  overlayWindow.once('ready-to-show', () => overlayWindow?.showInactive())
  loadAgentPage(overlayWindow, '#/agent-overlay')
  return overlayWindow
}

export function sendAgentProgress(event: AgentProgressEvent): void {
  for (const win of [agentWindow, overlayWindow]) {
    if (win && !win.isDestroyed()) win.webContents.send(IPC.push.agent, event)
  }
  if (event.type === 'done' || event.type === 'error' || event.type === 'aborted') {
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide()
  }
}

export function hideAgentOverlay(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide()
}
