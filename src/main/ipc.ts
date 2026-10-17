import { clipboard, ipcMain, app } from 'electron'
import { IPC, type CaptureContext, type RewriteAction } from '@shared/ipc'
import { getSettings, saveSettings } from './services/settings'
import { streamRewrite, listModels, detectEndpoints } from './services/llm'
import { pasteBack } from './services/capture'
import { getPopupWindow, showPopupForCapture, popupEscapeBounds } from './windows/popup'
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
}
