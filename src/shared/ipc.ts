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

export type AgentAction =
  | { type: 'click'; x: number; y: number }
  | { type: 'double_click'; x: number; y: number }
  | { type: 'right_click'; x: number; y: number }
  | { type: 'move'; x: number; y: number }
  | { type: 'type'; text: string }
  | { type: 'hotkey'; keys: string[] }
  | { type: 'scroll'; dx: number; dy: number }
  | { type: 'wait'; ms: number }
  | { type: 'done'; summary: string }

export interface AgentProgressEvent {
  type: 'step' | 'done' | 'error' | 'aborted'
  step: number
  action?: AgentAction
  summary?: string
  message?: string
}

export interface WindowPosition {
  x: number
  y: number
  width: number
  height: number
}

export interface ChromeProfile {
  directory: string
  displayName: string
}

export interface BrowserTab {
  index: number
  title: string
  url: string
}

export interface BrowserStatus {
  connected: boolean
  port: number | null
  launched: boolean
  tabs: BrowserTab[]
  url?: string
  error?: string
}

export interface BrowserActionResult {
  ok: boolean
  message?: string
  url?: string
  text?: string
}

export interface BrowserScreenshotResult {
  ok: boolean
  data?: string
  message?: string
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
    resizeHeight(height: number): void
  }
  /** App metadata */
  app: {
    version(): Promise<string>
  }
  /** Settings window -> main */
  settings: {
    get(): Promise<RellumSettings>
    save(patch: Partial<RellumSettings>): Promise<RellumSettings>
    testEndpoint(endpoint: EndpointConfig): Promise<{ ok: boolean; models?: string[]; message?: string }>
    detectEndpoints(): Promise<EndpointConfig[]>
  }
  /** Agent console -> main */
  agent: {
    start(goal: string): Promise<void>
    stop(): void
  }
  /** Settings window -> main browser automation. */
  browser: {
    profiles(): Promise<ChromeProfile[]>
    launch(): Promise<BrowserStatus>
    attach(): Promise<BrowserStatus>
    status(): Promise<BrowserStatus>
    navigate(url: string): Promise<BrowserActionResult>
    screenshot(): Promise<BrowserScreenshotResult>
  }
  /** Main -> popup renderer pushes */
  onCapture: (cb: (capture: CaptureContext | null, pos: WindowPosition) => void) => () => void
  onStream: (cb: (event: RewriteStreamEvent) => void) => () => void
  /** Main -> any: hotkey re-registered (settings changed) */
  onHotkeyChanged: (cb: (accelerator: string) => void) => () => void
  onAgent: (cb: (event: AgentProgressEvent) => void) => () => void
}

export const IPC = {
  popup: {
    rewrite: 'popup:rewrite',
    cancel: 'popup:cancel',
    pasteBack: 'popup:paste-back',
    copyText: 'popup:copy-text',
    done: 'popup:done',
    moveBy: 'popup:move-by',
    resizeHeight: 'popup:resize-height'
  },
  app: {
    version: 'app:version'
  },
  settings: {
    get: 'settings:get',
    save: 'settings:save',
    testEndpoint: 'settings:test-endpoint',
    detectEndpoints: 'settings:detect-endpoints'
  },
  agent: {
    start: 'agent:start',
    stop: 'agent:stop'
  },
  browser: {
    profiles: 'browser.profiles',
    launch: 'browser.launch',
    attach: 'browser.attach',
    status: 'browser.status',
    navigate: 'browser.navigate',
    screenshot: 'browser.screenshot'
  },
  push: {
    capture: 'push:capture',
    stream: 'push:stream',
    hotkeyChanged: 'push:hotkey-changed',
    agent: 'push:agent'
  }
} as const

export const POPUP_WIDTH = 520
export const POPUP_MIN_HEIGHT = 200
export const POPUP_MAX_HEIGHT = 420
