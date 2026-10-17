import { useEffect, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import type { EndpointConfig, RellumSettings } from '@shared/ipc'
import { parseHotkey } from '../lib/parseHotkey'
import { lazy, Suspense } from 'react'

const BrowserApp = lazy(() => import('../browser/App'))


export default function SettingsApp(): JSX.Element {
  const [hash, setHash] = useState(window.location.hash)
  const [settings, setSettings] = useState<RellumSettings | null>(null)
  const [models, setModels] = useState<string[]>([])
  const [detected, setDetected] = useState<EndpointConfig[]>([])
  const [status, setStatus] = useState('')
  const [version, setVersion] = useState('')
  const [recording, setRecording] = useState(false)

  useEffect(() => {
    void Promise.all([window.rellum.settings.get(), window.rellum.app.version()]).then(([next, appVersion]) => {
      setSettings(next)
      setVersion(appVersion)
    })
  }, [])

  useEffect(() => {
    const onHash = (): void => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (hash === '#/browser') {
    return (
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-ink-950 text-paper/50">Loading…</div>}>
        <BrowserApp />
      </Suspense>
    )
  }

  if (!settings) return <div className="flex min-h-screen items-center justify-center bg-ink-950 text-paper/50">Loading settings…</div>

  const update = (patch: Partial<RellumSettings>): void => {
    setSettings((current) => current ? { ...current, ...patch } : current)
    void window.rellum.settings.save(patch).then(setSettings)
  }

  const updateEndpoint = (patch: Partial<EndpointConfig>): void => {
    const endpoint = { ...settings.endpoint, ...patch }
    setSettings({ ...settings, endpoint })
  }

  const saveEndpoint = (): void => {
    void window.rellum.settings.save({ endpoint: settings.endpoint }).then(setSettings)
  }

  const testEndpoint = async (): Promise<void> => {
    setStatus('Testing endpoint…')
    const response = await window.rellum.settings.testEndpoint(settings.endpoint)
    if (response.ok) {
      setModels(response.models ?? [])
      setStatus(`Connected${response.models?.length ? ` · ${response.models.length} models found` : ''}`)
    } else setStatus(response.message ?? 'Could not connect')
  }

  const detectEndpoints = async (): Promise<void> => {
    setStatus('Looking for local servers…')
    const found = await window.rellum.settings.detectEndpoints()
    setDetected(found)
    setStatus(found.length ? `${found.length} endpoint${found.length === 1 ? '' : 's'} found` : 'No local endpoints found')
  }

  const onHotkeyKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    event.preventDefault()
    const hotkey = parseHotkey(event.nativeEvent)
    if (hotkey) {
      update({ hotkey })
      setRecording(false)
    }
  }

  return (
    <main className="flex min-h-screen bg-ink-950 font-sans text-paper">
      <aside className="w-56 shrink-0 border-r border-white/10 bg-ink-900/70 px-5 py-6">
        <div className="mb-10 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-lime text-sm font-black text-ink-950">R</span><span className="font-display text-lg font-semibold">Rellum</span></div>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.18em] text-paper/35">Settings</p>
        <nav className="space-y-1 text-sm text-paper/55"><a className="block rounded-lg bg-white/5 px-3 py-2 text-paper" href="#hotkey">Hotkey</a><a className="block rounded-lg px-3 py-2 hover:bg-white/5 hover:text-paper" href="#model">Model</a><a className="block rounded-lg px-3 py-2 hover:bg-white/5 hover:text-paper" href="#integrations">Integrations</a><a className="block rounded-lg px-3 py-2 hover:bg-white/5 hover:text-paper" href="#about">About</a><a className="block rounded-lg px-3 py-2 hover:bg-white/5 hover:text-paper" href="#/browser">Browser</a></nav>
      </aside>
      <section className="min-w-0 flex-1 overflow-y-auto px-8 py-8"><div className="mx-auto max-w-2xl"><h1 className="font-display text-2xl font-semibold">Preferences</h1><p className="mt-1 text-sm text-paper/45">Tune Rellum to your workflow.</p>
        <div className="mt-8 space-y-8">
          <SettingsSection id="hotkey" title="Hotkey" description="Open Rellum from any app.">
            <div className="flex items-center gap-3"><input readOnly value={recording ? 'Press a shortcut…' : settings.hotkey} onFocus={() => setRecording(true)} onKeyDown={onHotkeyKeyDown} onBlur={() => setRecording(false)} className="field flex-1" aria-label="Global hotkey" /><button type="button" className="secondary" onClick={() => setRecording(true)}>{recording ? 'Listening…' : 'Record shortcut'}</button></div>
          </SettingsSection>
          <SettingsSection id="model" title="Model endpoint" description="Use any OpenAI-compatible local or remote server.">
            <label className="label">Base URL<input className="field mt-1" value={settings.endpoint.baseUrl} onChange={(event) => updateEndpoint({ baseUrl: event.target.value })} onBlur={saveEndpoint} placeholder="http://127.0.0.1:11434/v1" /></label>
            <label className="label mt-4">API key <span className="font-normal text-paper/30">(optional)</span><input type="password" className="field mt-1" value={settings.endpoint.apiKey ?? ''} onChange={(event) => updateEndpoint({ apiKey: event.target.value })} onBlur={saveEndpoint} placeholder="sk-…" /></label>
            <label className="label mt-4">Model<select className="field mt-1" value={settings.endpoint.model} onChange={(event) => { updateEndpoint({ model: event.target.value }); void window.rellum.settings.save({ endpoint: { ...settings.endpoint, model: event.target.value } }).then(setSettings) }}><option value="">Select a model</option>{models.map((model) => <option value={model} key={model}>{model}</option>)}{settings.endpoint.model && !models.includes(settings.endpoint.model) && <option value={settings.endpoint.model}>{settings.endpoint.model}</option>}</select></label>
            <div className="mt-4 flex items-center gap-2"><button type="button" className="primary" onClick={() => void testEndpoint()}>Test endpoint</button><button type="button" className="secondary" onClick={() => void detectEndpoints()}>Detect endpoints</button>{status && <span className="text-xs text-paper/45">{status}</span>}</div>
            {detected.length > 0 && <div className="mt-3 space-y-1">{detected.map((endpoint) => <button type="button" key={endpoint.baseUrl} className="block w-full rounded-lg border border-white/10 px-3 py-2 text-left text-xs text-paper/65 hover:border-lime/40" onClick={() => { updateEndpoint(endpoint); void window.rellum.settings.save({ endpoint }).then(setSettings) }}>{endpoint.baseUrl}</button>)}</div>}
          </SettingsSection>
          <SettingsSection id="integrations" title="Paste back" description="Replace the selected text after a rewrite."><Toggle checked={settings.pasteBack} onChange={(checked) => update({ pasteBack: checked })} label="Enable paste-back" /></SettingsSection>
          <SettingsSection title="Computer use" description="Optional automation model for future workflows."><Toggle checked={settings.computerUse.enabled} onChange={(enabled) => update({ computerUse: { ...settings.computerUse, enabled } })} label="Enable computer use" /><label className="label mt-4">Model<input className="field mt-1" value={settings.computerUse.model} onChange={(event) => update({ computerUse: { ...settings.computerUse, model: event.target.value } })} /></label></SettingsSection>
          <SettingsSection title="Browser" description="Connect to a Chrome debugging session."><Toggle checked={settings.browser.enabled} onChange={(enabled) => update({ browser: { ...settings.browser, enabled } })} label="Enable browser integration" /><div className="mt-4 grid grid-cols-2 gap-3"><label className="label">Chrome path<input className="field mt-1" value={settings.browser.chromePath} onChange={(event) => update({ browser: { ...settings.browser, chromePath: event.target.value } })} /></label><label className="label">Profile directory<input className="field mt-1" value={settings.browser.profileDirectory} onChange={(event) => update({ browser: { ...settings.browser, profileDirectory: event.target.value } })} /></label></div><label className="label mt-4">Debug port<input type="number" className="field mt-1" value={settings.browser.debugPort} onChange={(event) => update({ browser: { ...settings.browser, debugPort: Number(event.target.value) || 9222 } })} /></label></SettingsSection>
          <SettingsSection id="about" title="About" description="Your words, lit from within."><p className="text-sm text-paper/55">Rellum <span className="text-paper/35">v{version || '0.1.0'}</span></p><p className="mt-2 text-xs text-paper/35">Local-first writing assistance. No telemetry.</p></SettingsSection>
        </div>
      </div></section>
    </main>
  )
}

function SettingsSection({ id, title, description, children }: { id?: string; title: string; description: string; children: ReactNode }): JSX.Element {
  return <section id={id} className="rounded-2xl border border-white/10 bg-ink-900/55 p-5"><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-xs text-paper/40">{description}</p><div className="mt-5">{children}</div></section>
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }): JSX.Element {
  return <label className="flex cursor-pointer items-center gap-3 text-sm text-paper/75"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="sr-only" /><span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${checked ? 'bg-lime' : 'bg-ink-600'}`}><span className={`h-4 w-4 rounded-full bg-white transition ${checked ? 'translate-x-4' : ''}`} /></span>{label}</label>
}
