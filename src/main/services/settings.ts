import { app } from 'electron'
import Store from 'electron-store'
import { DEFAULT_SETTINGS, type RellumSettings } from '@shared/ipc'

const store = new Store<RellumSettings>({
  name: 'rellum-settings',
  defaults: DEFAULT_SETTINGS
})

export function getSettings(): RellumSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...store.store,
    endpoint: { ...DEFAULT_SETTINGS.endpoint, ...store.get('endpoint') },
    computerUse: { ...DEFAULT_SETTINGS.computerUse, ...store.get('computerUse') },
    browser: { ...DEFAULT_SETTINGS.browser, ...store.get('browser') }
  }
}

export function saveSettings(patch: Partial<RellumSettings>): RellumSettings {
  for (const key of Object.keys(patch) as (keyof RellumSettings)[]) {
    const value = patch[key]
    if (value !== undefined) {
      const current = store.get(key)
      if (typeof value === 'object' && !Array.isArray(value)) {
        store.set(key, { ...(current as object), ...(value as object) })
      } else {
        store.set(key, value as never)
      }
    }
  }
  return getSettings()
}

export function settingsFilePath(): string {
  return store.path
}

export function appDataDir(): string {
  return app.getPath('userData')
}
