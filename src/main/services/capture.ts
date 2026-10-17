import { clipboard } from 'electron'
import * as nut from '@nut-tree-fork/nut-js'
import { getForegroundWindowInfo } from './foreground'

const CAPTURE_POLL_MS = 25
const CAPTURE_TIMEOUT_MS = 400

/** The window that was focused when the selection was captured. */
let capturedWindow: nut.Window | null = null

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

  const modifier = process.platform === 'darwin' ? nut.Key.LeftCmd : nut.Key.LeftControl
  await nut.keyboard.pressKey(modifier, nut.Key.C)
  await nut.keyboard.releaseKey(modifier, nut.Key.C)

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
  try {
    capturedWindow = await nut.getActiveWindow()
  } catch {
    capturedWindow = null
  }
  return {
    text: captured,
    appName: info.appName,
    windowTitle: info.windowTitle,
    unreliable: false
  }
}

/** Refocus the app whose text was captured. Best effort. */
export async function refocusCapturedWindow(): Promise<void> {
  const window = capturedWindow
  capturedWindow = null
  if (!window) return
  try {
    const focused = await window.focus()
    console.log('[rellum] refocus result:', focused)
    await sleep(120)
  } catch (error) {
    console.error('[rellum] refocus failed:', error)
  }
}

/** Paste text back into the previously focused app by restoring focus and injecting Ctrl+V. */
export async function pasteBack(text: string): Promise<void> {
  await refocusCapturedWindow()
  clipboard.writeText(text)
  await sleep(60)
  const modifier = process.platform === 'darwin' ? nut.Key.LeftCmd : nut.Key.LeftControl
  try {
    await nut.keyboard.pressKey(modifier, nut.Key.V)
    await nut.keyboard.releaseKey(modifier, nut.Key.V)
    await sleep(150)
    // Focus handoffs can race the keystroke; retry once if nothing landed.
    if (clipboard.readText() === text) {
      await windowlessRetryPaste(modifier)
    }
  } catch (error) {
    console.error('[rellum] paste keystroke failed:', error)
  }
  await sleep(60)
}

async function windowlessRetryPaste(modifier: nut.Key): Promise<void> {
  try {
    await sleep(120)
    await nut.keyboard.pressKey(modifier, nut.Key.V)
    await nut.keyboard.releaseKey(modifier, nut.Key.V)
  } catch {
    /* best effort */
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
