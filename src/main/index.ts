import { app, globalShortcut, Tray, Menu, nativeImage, screen } from 'electron'
import { join } from 'path'
import { createPopupWindow, getPopupWindow, showPopupForCapture } from './windows/popup'
import { createSettingsWindow } from './windows/settings'
import { registerIpcHandlers } from './ipc'
import { getSettings } from './services/settings'
import { captureSelection } from './services/capture'
import { getForegroundWindowInfo } from './services/foreground'
import type { CaptureContext } from '@shared/ipc'
import { killLaunched } from './services/browser/launcher'
import { disconnect } from './services/browser/automation'

// Single instance lock
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = getPopupWindow()
    if (win) win.show()
  })

  app.whenReady().then(() => {
    registerIpcHandlers()
    createPopupWindow()

    let tray: Tray | null = null

    function makeTray(): void {
      const icon = nativeImage.createFromPath(join(__dirname, '../../build/tray.png'))
      tray = new Tray(icon)
      const menu = Menu.buildFromTemplate([
        { label: 'Open Settings', click: () => createSettingsWindow() },
        { label: 'Quit Rellum', click: () => app.quit() }
      ])
      tray.setToolTip('Rellum')
      tray.setContextMenu(menu)
    }

    function registerHotkey(): void {
      const settings = getSettings()
      globalShortcut.unregisterAll()
      const ok = globalShortcut.register(settings.hotkey, async () => {
        const info = await getForegroundWindowInfo()
        const capture = await captureSelection()
        const context: CaptureContext = {
          text: capture.text,
          appName: info.appName,
          windowTarget: info.windowTitle,
          capturedAt: Date.now(),
          unreliable: capture.unreliable
        }
        showPopupForCapture(context, screen.getCursorScreenPoint())
      })
      if (!ok) console.error('[rellum] failed to register hotkey', settings.hotkey)
    }

    makeTray()
    registerHotkey()

    app.on('activate', () => {
      if (process.platform === 'darwin') createPopupWindow()
    })
  })

  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    void disconnect()
    killLaunched()
  })
}
