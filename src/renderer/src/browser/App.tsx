import { useEffect, useState } from 'react'
import type { ChromeProfile, BrowserStatus } from '@shared/ipc'

export default function BrowserApp(): JSX.Element {
  const [profiles, setProfiles] = useState<ChromeProfile[]>([])
  const [profile, setProfile] = useState('Default')
  const [port, setPort] = useState(9222)
  const [url, setUrl] = useState('https://')
  const [status, setStatus] = useState<BrowserStatus | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState<string[]>([])

  useEffect(() => {
    void Promise.all([window.rellum.browser.profiles(), window.rellum.settings.get(), window.rellum.browser.status()]).then(([found, settings, current]) => {
      setProfiles(found)
      setProfile(settings.browser.profileDirectory)
      setPort(settings.browser.debugPort)
      setStatus(current)
    }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not load browser settings.'))
  }, [])

  const addLog = (entry: string): void => setLog((current) => [entry, ...current].slice(0, 12))

  const saveBrowserSettings = async (): Promise<void> => {
    const settings = await window.rellum.settings.get()
    await window.rellum.settings.save({ browser: { ...settings.browser, profileDirectory: profile, debugPort: port } })
  }

  const connect = async (kind: 'launch' | 'attach'): Promise<void> => {
    setBusy(true)
    setMessage(kind === 'launch' ? 'Launching Chrome…' : 'Attaching…')
    try {
      await saveBrowserSettings()
      const next = kind === 'launch' ? await window.rellum.browser.launch() : await window.rellum.browser.attach()
      setStatus(next)
      if (next.error) { setMessage(next.error); addLog(next.error) }
      else { setMessage(next.connected ? 'Connected' : 'Not connected'); addLog(next.connected ? `Chrome ${kind}ed on port ${next.port ?? port}.` : `Chrome ${kind} failed.`) }
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : 'Browser connection failed.'
      setMessage(text); addLog(text)
    } finally { setBusy(false) }
  }

  const go = async (): Promise<void> => {
    const target = url.trim()
    if (!target) return
    setBusy(true)
    const result = await window.rellum.browser.navigate(target)
    setMessage(result.message ?? (result.ok ? 'Navigated' : 'Navigation failed'))
    addLog(result.message ?? 'Navigation finished.')
    if (result.ok) setStatus(await window.rellum.browser.status())
    setBusy(false)
  }

  return <main className="min-h-screen bg-ink-950 px-8 py-8 font-sans text-paper"><div className="mx-auto max-w-2xl">
    <div className="flex items-start justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-lime">Browser</p><h1 className="mt-2 font-display text-2xl font-semibold">Chrome automation</h1><p className="mt-1 text-sm text-paper/45">Connect to your real Chrome profile. Rellum never launches headless.</p></div><span className={`rounded-full px-3 py-1 text-xs ${status?.connected ? 'bg-lime/15 text-lime' : 'bg-white/5 text-paper/45'}`}>{status?.connected ? 'Connected' : 'Disconnected'}</span></div>
    <section className="mt-8 rounded-2xl border border-white/10 bg-ink-900/55 p-5"><h2 className="text-sm font-semibold">Chrome profile</h2><p className="mt-1 text-xs text-paper/40">Close your normal Chrome before launching with debugging, or use Attach.</p><div className="mt-5 grid grid-cols-[1fr_120px] gap-3"><label className="label">Profile<select className="field mt-1" value={profile} onChange={(event) => setProfile(event.target.value)}>{profiles.length === 0 && <option value={profile}>{profile}</option>}{profiles.map((item) => <option value={item.directory} key={item.directory}>{item.displayName} · {item.directory}</option>)}</select></label><label className="label">Debug port<input className="field mt-1" type="number" min="1" max="65535" value={port} onChange={(event) => setPort(Number(event.target.value) || 9222)} /></label></div><div className="mt-4 flex items-center gap-2"><button className="primary" type="button" disabled={busy} onClick={() => void connect('launch')}>Launch Chrome</button><button className="secondary" type="button" disabled={busy} onClick={() => void connect('attach')}>Attach</button>{message && <span className="text-xs text-paper/45">{message}</span>}</div></section>
    <section className="mt-5 rounded-2xl border border-white/10 bg-ink-900/55 p-5"><h2 className="text-sm font-semibold">Command bar</h2><div className="mt-4 flex gap-2"><input className="field flex-1" value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void go() }} aria-label="URL" placeholder="https://example.com" /><button className="primary" type="button" disabled={busy || !status?.connected} onClick={() => void go()}>Go</button></div>{status?.tabs && status.tabs.length > 0 && <p className="mt-3 text-xs text-paper/40">{status.tabs.length} tab{status.tabs.length === 1 ? '' : 's'} · {status.url ?? status.tabs[0]?.url}</p>}</section>
    <section className="mt-5 rounded-2xl border border-white/10 bg-ink-900/55 p-5"><h2 className="text-sm font-semibold">Activity</h2><div className="mt-3 min-h-12 space-y-2 text-xs text-paper/45">{log.length === 0 ? <p>No actions yet.</p> : log.map((entry, index) => <p key={`${entry}-${index}`}>{entry}</p>)}</div></section>
  </div></main>
}
