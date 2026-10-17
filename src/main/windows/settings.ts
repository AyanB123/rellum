import { BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'

const DEV_SERVER = process.env.ELECTRON_RENDERER_URL ?? 'http://localhost:5173'

let settingsWindow: BrowserWindow | null = null

export function createSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show()
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 780,
    height: 640,
    show: false,
    title: 'Rellum Settings',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true
    }
  })

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })

  if (is.dev) {
    void settingsWindow.loadURL(DEV_SERVER + '/src/renderer/src/settings/index.html')
  } else {
    void settingsWindow.loadFile(join(__dirname, '../renderer/src/settings/index.html'))
  }

  settingsWindow.show()
}
