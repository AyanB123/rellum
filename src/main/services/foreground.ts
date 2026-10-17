import * as nut from '@nut-tree-fork/nut-js'

export interface ForegroundInfo {
  appName: string
  windowTitle: string
}

/** Best-effort frontmost window info. Never throws. */
export async function getForegroundWindowInfo(): Promise<ForegroundInfo> {
  try {
    const window = await nut.getActiveWindow()
    return {
      appName: (window.owner?.name ?? window.title ?? '').split('.')[0] || 'app',
      windowTitle: window.title ?? ''
    }
  } catch {
    return { appName: 'app', windowTitle: '' }
  }
}
