/**
 * Rellum — shared IPC contract (single source of truth).
 * Every channel used by the renderer must be declared here.
 */

export type RewriteAction = 'improve' | 'proofread' | 'condense'

export type PopupState = 'idle' | 'streaming' | 'done' | 'error'

export interface EndpointConfig {
  /** Base URL, e.g. http://127.0.0.1:11434/v1 */
  baseUrl: string
  /** Optional bearer token */
  apiKey?: string
  /** Model id as exposed by the endpoint's /v1/models */
  model: string
}

export interface RellumSettings {
  hotkey: string
  endpoint: EndpointConfig
  /** For 'paste back' we re-select by typing over the previous selection. */
  pasteBack: boolean
  autoDetectEndpoint: boolean
  computerUse: {
    enabled: boolean
    model: string
  }
  browser: {
    enabled: boolean
    chromePath: string
    profileDirectory: string
    debugPort: number
  }
}

export const DEFAULT_SETTINGS: RellumSettings = {
  hotkey: 'Ctrl+Shift+Space',
  endpoint: {
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: ''
  },
  pasteBack: true,
  autoDetectEndpoint: true,
  computerUse: { enabled: false, model: '' },
  browser: {
    enabled: false,
    chromePath: '',
    profileDirectory: 'Default',
    debugPort: 9222
  }
}

/** Capture context delivered to the popup with the selection. */
export interface CaptureContext {
  text: string
  appName: string
  windowTarget: string
  capturedAt: number
  /** true if the text may have been captured without a real selection (fallback) */
  unreliable?: boolean
}

/** One streaming chunk for the rewrite. */
export interface RewriteStreamEvent {
  type: 'token' | 'done' | 'error'
  text?: string
  message?: string
}

export interface WindowPosition {
  x: number
  y: number
  width: number
  height: number
}

export interface RellumApi {
  /** Popup window -> main */
  popup: {
    rewrite(action: RewriteAction, capture: CaptureContext, previous?: string): Promise<void>
    cancel(): void
    pasteBack(text: string): Promise<void>
    copyText(text: string): Promise<void>
    done(): void
    moveBy(dx: number, dy: number): void
  }
  /** Settings window -> main */
  settings: {
    get(): Promise<RellumSettings>
    save(patch: Partial<RellumSettings>): Promise<RellumSettings>
    testEndpoint(endpoint: EndpointConfig): Promise<{ ok: boolean; models?: string[]; message?: string }>
    detectEndpoints(): Promise<EndpointConfig[]>
  }
  /** Main -> popup renderer pushes */
  onCapture: (cb: (capture: CaptureContext | null, pos: WindowPosition) => void) => () => void
  onStream: (cb: (event: RewriteStreamEvent) => void) => () => void
  /** Main -> any: hotkey re-registered (settings changed) */
  onHotkeyChanged: (cb: (accelerator: string) => void) => () => void
}

export const IPC = {
  popup: {
    rewrite: 'popup:rewrite',
    cancel: 'popup:cancel',
    pasteBack: 'popup:paste-back',
    copyText: 'popup:copy-text',
    done: 'popup:done',
    moveBy: 'popup:move-by'
  },
  settings: {
    get: 'settings:get',
    save: 'settings:save',
    testEndpoint: 'settings:test-endpoint',
    detectEndpoints: 'settings:detect-endpoints'
  },
  push: {
    capture: 'push:capture',
    stream: 'push:stream',
    hotkeyChanged: 'push:hotkey-changed'
  }
} as const

export const POPUP_WIDTH = 520
export const POPUP_MIN_HEIGHT = 200
export const POPUP_MAX_HEIGHT = 420
