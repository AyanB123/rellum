import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  CaptureContext,
  EndpointConfig,
  RewriteStreamEvent,
  RellumSettings,
  WindowPosition,
  BrowserActionResult,
  BrowserScreenshotResult,
  BrowserStatus,
  ChromeProfile
} from '@shared/ipc'

const api = {
  app: {
    version: (): Promise<string> => ipcRenderer.invoke(IPC.app.version)
  },
  popup: {
    rewrite: (action: string, capture: CaptureContext, previous?: string): Promise<void> => {
      ipcRenderer.send(IPC.popup.rewrite, action, capture, previous)
      return Promise.resolve()
    },
    cancel: (): void => {
      ipcRenderer.send(IPC.popup.cancel)
    },
    pasteBack: (text: string): Promise<void> => {
      ipcRenderer.send(IPC.popup.pasteBack, text)
      return Promise.resolve()
    },
    copyText: (text: string): Promise<void> => {
      ipcRenderer.send(IPC.popup.copyText, text)
      return Promise.resolve()
    },
    done: (): void => {
      ipcRenderer.send(IPC.popup.done)
    },
    moveBy: (dx: number, dy: number): void => {
      ipcRenderer.send(IPC.popup.moveBy, dx, dy)
    },
    resizeHeight: (height: number): void => {
      ipcRenderer.send(IPC.popup.resizeHeight, height)
    }
  },
  settings: {
    get: (): Promise<RellumSettings> => ipcRenderer.invoke(IPC.settings.get),
    save: (patch: Partial<RellumSettings>): Promise<RellumSettings> =>
      ipcRenderer.invoke(IPC.settings.save, patch),
    testEndpoint: (
      endpoint: EndpointConfig
    ): Promise<{ ok: boolean; models?: string[]; message?: string }> =>
      ipcRenderer.invoke(IPC.settings.testEndpoint, endpoint),
    detectEndpoints: (): Promise<EndpointConfig[]> => ipcRenderer.invoke(IPC.settings.detectEndpoints)
  },
  browser: {
    profiles: (): Promise<ChromeProfile[]> => ipcRenderer.invoke(IPC.browser.profiles),
    launch: (): Promise<BrowserStatus> => ipcRenderer.invoke(IPC.browser.launch),
    attach: (): Promise<BrowserStatus> => ipcRenderer.invoke(IPC.browser.attach),
    status: (): Promise<BrowserStatus> => ipcRenderer.invoke(IPC.browser.status),
    navigate: (url: string): Promise<BrowserActionResult> => ipcRenderer.invoke(IPC.browser.navigate, url),
    screenshot: (): Promise<BrowserScreenshotResult> => ipcRenderer.invoke(IPC.browser.screenshot)
  },
  onCapture: (cb: (capture: CaptureContext | null, pos: WindowPosition) => void): (() => void) => {
    const listener = (
      _e: Electron.IpcRendererEvent,
      capture: CaptureContext | null,
      pos: WindowPosition
    ): void => cb(capture, pos)
    ipcRenderer.on(IPC.push.capture, listener)
    return () => ipcRenderer.removeListener(IPC.push.capture, listener)
  },
  onStream: (cb: (event: RewriteStreamEvent) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, event: RewriteStreamEvent): void => cb(event)
    ipcRenderer.on(IPC.push.stream, listener)
    return () => ipcRenderer.removeListener(IPC.push.stream, listener)
  },
  onHotkeyChanged: (cb: (accelerator: string) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, accelerator: string): void => cb(accelerator)
    ipcRenderer.on(IPC.push.hotkeyChanged, listener)
    return () => ipcRenderer.removeListener(IPC.push.hotkeyChanged, listener)
  }
}

export type RellumApi = typeof api

contextBridge.exposeInMainWorld('rellum', api)
