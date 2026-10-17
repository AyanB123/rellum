import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  CaptureContext,
  EndpointConfig,
  RewriteStreamEvent,
  RellumSettings,
  WindowPosition
} from '@shared/ipc'

const api = {
  app: {
    version: (): Promise<string> => ipcRenderer.invoke(IPC.app.version)
  },
  popup: {
    rewrite: (action: string, capture: CaptureContext, previous?: string): Promise<void> =>
      ipcRenderer.invoke(IPC.popup.rewrite, action, capture, previous),
    cancel: (): void => {
      ipcRenderer.send(IPC.popup.cancel)
    },
    pasteBack: (text: string): Promise<void> => ipcRenderer.invoke(IPC.popup.pasteBack, text),
    copyText: (text: string): void => {
      ipcRenderer.send(IPC.popup.copyText, text)
    },
    done: (): void => {
      ipcRenderer.send(IPC.popup.done)
    },
    moveBy: (dx: number, dy: number): void => {
      ipcRenderer.send(IPC.popup.moveBy, dx, dy)
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
