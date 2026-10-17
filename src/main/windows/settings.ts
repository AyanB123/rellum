import { BrowserWindow } from 'electron'
import { join } from 'path'

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

  if (process.env.RELLUM_DEV_URL) {
    settingsWindow.loadURL(process.env.RELLUM_DEV_URL + '#/settings')
  } else {
    settingsWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: '#/settings' })
  }

  settingsWindow.show()
}
