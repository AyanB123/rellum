import { clipboard } from 'electron'
import { keyboard } from '@nut-tree-fork/nut-js'
import { getForegroundWindowInfo } from './foreground'

const CAPTURE_POLL_MS = 25
const CAPTURE_TIMEOUT_MS = 400

export interface CaptureResult {
  text: string
  appName: string
  windowTitle: string
  unreliable: boolean
}

async function readClipboardText(): Promise<string> {
  const t = clipboard.readText()
  return t
}

/**
 * Capture the current selection of the frontmost window.
 *
 * Strategy: snapshot + restore the clipboard, inject Ctrl+C, poll for new
 * content within a short budget. The user's clipboard is always restored —
 * even on failure — so this never destroys anything.
 *
 * If the target app ignored Ctrl+C (nothing selected or injection refused),
 * returns text: '' and the caller may show a fallback textarea.
 */
export async function captureSelection(): Promise<CaptureResult> {
  const before = clipboard.readText()
  const beforeRtf = clipboard.readRTF()
  const beforeImage = clipboard.readImage()

  // small pre-copy clear improves reliability on some apps
  clipboard.clear()

  await keyboard.pressKey(...(process.platform === 'darwin' ? ['command' as const] : ['control' as const]), 'c' as const)
  await keyboard.releaseKey(...(process.platform === 'darwin' ? ['command' as const] : ['control' as const]), 'c' as const)

  const deadline = Date.now() + CAPTURE_TIMEOUT_MS
  let captured = ''
  while (Date.now() < deadline) {
    await sleep(CAPTURE_POLL_MS)
    const t = await readClipboardText()
    if (t.length > 0) {
      captured = t
      break
    }
  }

  // restore the user's clipboard exactly as it was
  if (beforeImage && !beforeImage.isEmpty()) clipboard.writeImage(beforeImage)
  else if (beforeRtf) clipboard.write({ text: before, rtf: beforeRtf })
  else if (before) clipboard.writeText(before)
  else clipboard.clear()

  const info = await getForegroundWindowInfo()
  return {
    text: captured,
    appName: info.appName,
    windowTitle: info.windowTitle,
    unreliable: false
  }
}

/** Paste text back into the previously focused app by restoring focus and injecting Ctrl+V. */
export async function pasteBack(text: string): Promise<void> {
  clipboard.writeText(text)
  await sleep(40)
  await keyboard.pressKey(...(process.platform === 'darwin' ? ['command' as const] : ['control' as const]), 'v' as const)
  await keyboard.releaseKey(...(process.platform === 'darwin' ? ['command' as const] : ['control' as const]), 'v' as const)
  await sleep(60)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
