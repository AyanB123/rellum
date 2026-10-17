import { clipboard, ipcMain, app } from 'electron'
import { IPC, POPUP_MIN_HEIGHT, POPUP_MAX_HEIGHT, type CaptureContext, type RewriteAction } from '@shared/ipc'
import { getSettings, saveSettings } from './services/settings'
import { streamRewrite, listModels, detectEndpoints } from './services/llm'
import { pasteBack } from './services/capture'
import { attach, chromeUserDataDir, findChrome, isLaunched, launchWithDebugging, listChromeProfiles } from './services/browser/launcher'
import { connectOverCDP, currentPage, currentPort, isConnected, listTabs, navigate, screenshotPage } from './services/browser/automation'
import type { BrowserStatus } from '@shared/ipc'
import { getPopupWindow, popupEscapeBounds } from './windows/popup'
import { runAgent, stopAgent } from './services/computer-use/agent'
import { createAgentWindow, sendAgentProgress, showAgentOverlay } from './windows/agent'
import type { StreamHandlers } from './services/llm'

let activeStream: AbortController | null = null

function forwardToPopup(channel: string, payload: unknown): void {
  const win = getPopupWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload)
  }
}

export function streamRewriteWithHandlers(
  action: RewriteAction,
  capture: CaptureContext,
  previous: string[],
  handlers: StreamHandlers
): AbortController {
  const { endpoint } = getSettings()
  const controller = new AbortController()
  activeStream = controller
  void streamRewrite(endpoint, action, capture.text, previous, {
    ...handlers,
    onDone: (full) => {
      if (activeStream === controller) activeStream = null
      handlers.onDone(full)
    },
    onError: (message) => {
      if (activeStream === controller) activeStream = null
      handlers.onError(message)
    }
  }).then((c) => {
    if (activeStream === controller) activeStream = c
  })
  return controller
}

export function cancelActiveStream(): void {
  activeStream?.abort()
  activeStream = null
}

async function connectBrowserWithRetry(port: number): Promise<void> {
  let lastError: unknown
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { await connectOverCDP(port); return }
    catch (error) { lastError = error; await new Promise((resolve) => setTimeout(resolve, 150)) }
  }
  throw lastError instanceof Error ? lastError : new Error('Chrome debugging endpoint did not become ready.')
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.app.version, () => app.getVersion())

  ipcMain.handle(IPC.settings.get, () => getSettings())

  ipcMain.handle(IPC.settings.save, (_e, patch) => saveSettings(patch))

  ipcMain.handle(IPC.settings.testEndpoint, async (_e, endpoint) => {
    try {
      const models = await listModels(endpoint)
      return { ok: true, models }
    } catch (err) {
      return { ok: false, message: (err as Error).message }
    }
  })

  ipcMain.handle(IPC.settings.detectEndpoints, () => detectEndpoints())

  ipcMain.handle(IPC.agent.start, async (_event, goal: string) => {
    const settings = getSettings()
    if (!settings.computerUse.enabled) throw new Error('Computer-use agent is disabled in Settings.')
    createAgentWindow()
    showAgentOverlay()
    await runAgent(goal, { onProgress: sendAgentProgress })
  })

  ipcMain.on(IPC.agent.stop, () => stopAgent())

  const browserStatus = async (): Promise<BrowserStatus> => {
    const connected = isConnected()
    const tabs = connected ? await listTabs() : []
    const page = connected ? await currentPage().catch(() => null) : null
    return { connected, port: connected ? currentPort() : null, launched: isLaunched(), tabs, url: page?.url() }
  }

  ipcMain.handle(IPC.browser.profiles, () => listChromeProfiles(chromeUserDataDir()))
  ipcMain.handle(IPC.browser.status, async () => {
    const connected = isConnected()
    const tabs = connected ? await listTabs() : []
    const page = connected ? await currentPage().catch(() => null) : null
    return { connected, port: connected ? currentPort() : null, launched: isLaunched(), tabs, url: page?.url() } satisfies BrowserStatus
  })
  ipcMain.handle(IPC.browser.launch, async () => {
    try {
      const settings = getSettings().browser
      const chromePath = settings.chromePath.trim() ? settings.chromePath : findChrome()
      await launchWithDebugging(chromePath, settings.profileDirectory, settings.debugPort)
      await connectBrowserWithRetry(settings.debugPort)
      return await browserStatus()
    } catch (error) {
      return { connected: false, port: null, launched: isLaunched(), tabs: [], url: undefined, error: (error as Error).message }
    }
  })
  ipcMain.handle(IPC.browser.attach, async () => {
    try {
      const port = getSettings().browser.debugPort
      await attach(port)
      await connectOverCDP(port)
      return await browserStatus()
    } catch (error) {
      return { connected: false, port: null, launched: isLaunched(), tabs: [], url: undefined, error: (error as Error).message }
    }
  })
  ipcMain.handle(IPC.browser.navigate, async (_event, url: string) => navigate(url))
  ipcMain.handle(IPC.browser.screenshot, async () => {
    try { return await screenshotPage(await currentPage()) }
    catch (error) { return { ok: false, message: (error as Error).message } }
  })

  ipcMain.on(IPC.popup.rewrite, (_e, action: RewriteAction, capture: CaptureContext, previous?: string) => {
    cancelActiveStream()
    const previousList = previous ? [previous] : []
    streamRewriteWithHandlers(action, capture, previousList, {
      onToken: (token) => forwardToPopup(IPC.push.stream, { type: 'token', text: token }),
      onDone: (full) => forwardToPopup(IPC.push.stream, { type: 'done', text: full }),
      onError: (message) => forwardToPopup(IPC.push.stream, { type: 'error', message })
    })
  })

  ipcMain.on(IPC.popup.cancel, () => cancelActiveStream())

  ipcMain.on(IPC.popup.pasteBack, async (_e, text: string) => {
    const win = getPopupWindow()
    win?.hide()
    await pasteBack(text)
    forwardToPopup(IPC.push.stream, { type: 'done', text: '' })
  })

  ipcMain.on(IPC.popup.copyText, (_e, text: string) => {
    clipboard.writeText(text)
  })

  ipcMain.on(IPC.popup.done, () => {
    getPopupWindow()?.hide()
  })

  ipcMain.on(IPC.popup.moveBy, (_e, dx: number, dy: number) => {
    popupEscapeBounds(dx, dy)
  })

  ipcMain.on(IPC.popup.resizeHeight, (_e, height: number) => {
    const win = getPopupWindow()
    if (!win || win.isDestroyed()) return
    const clamped = Math.min(Math.max(Math.round(height), POPUP_MIN_HEIGHT), POPUP_MAX_HEIGHT)
    const [width] = win.getContentSize()
    win.setContentSize(width, clamped)
  })
}
