import { activeWindow } from '@nut-tree-fork/nut-js'

export interface ForegroundInfo {
  appName: string
  windowTitle: string
}

/** Best-effort frontmost window info. Never throws. */
export async function getForegroundWindowInfo(): Promise<ForegroundInfo> {
  try {
    const w = await activeWindow()
    return {
      appName: (w.owner?.name ?? w.title ?? '').split('.')[0] || 'app',
      windowTitle: w.title ?? ''
    }
  } catch {
    return { appName: 'app', windowTitle: '' }
  }
}
