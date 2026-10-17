import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { POPUP_WIDTH, type CaptureContext } from '@shared/ipc'

let popup: BrowserWindow | null = null

export function getPopupWindow(): BrowserWindow | null {
  return popup
}

export function createPopupWindow(): BrowserWindow {
  if (popup && !popup.isDestroyed()) return popup

  popup = new BrowserWindow({
    width: POPUP_WIDTH,
    height: 260,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
    focusable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true
    }
  })

  popup.on('blur', () => {
    // User clicked elsewhere: dismiss politely.
    if (popup && popup.isVisible()) popup.hide()
  })

  popup.webContents.once('did-finish-load', () => {
    popup?.showInactive()
  })

  if (process.env.RELLUM_DEV_URL) {
    popup.loadURL(process.env.RELLUM_DEV_URL)
  } else {
    popup.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return popup
}

export function showPopupForCapture(capture: CaptureContext, anchor: { x: number; y: number }): void {
  const win = createPopupWindow()
  const { workArea } = screen.getDisplayNearestPoint(anchor)

  const width = POPUP_WIDTH
  const height = 260
  let x = Math.round(anchor.x - width / 2)
  let y = Math.round(anchor.y + 24)
  x = Math.min(Math.max(x, workArea.x + 8), workArea.x + workArea.width - width - 8)
  if (y + height > workArea.y + workArea.height - 8) {
    y = Math.round(anchor.y - height - 24)
  }

  win.setBounds({ x, y, width, height })
  win.webContents.send(IPC.push.capture, capture, { x, y, width, height })
  win.show()
  win.focus()
}

export function popupEscapeBounds(dx: number, dy: number): void {
  if (!popup || popup.isDestroyed()) return
  const [x, y] = popup.getPosition()
  const [w, h] = popup.getSize()
  const area = screen.getDisplayNearestPoint({ x: x + Math.floor(w / 2), y: y + Math.floor(h / 2) }).workArea
  const nx = Math.min(Math.max(x + dx, area.x), area.x + area.width - w)
  const ny = Math.min(Math.max(y + dy, area.y), area.y + area.height - h)
  popup.setPosition(nx, ny)
}
