import { FormEvent, useEffect, useState } from 'react'
import type { AgentAction, AgentProgressEvent } from '@shared/ipc'

function actionLabel(action: AgentAction): string {
  switch (action.type) {
    case 'click': return `Click (${action.x}, ${action.y})`
    case 'double_click': return `Double-click (${action.x}, ${action.y})`
    case 'right_click': return `Right-click (${action.x}, ${action.y})`
    case 'move': return `Move to (${action.x}, ${action.y})`
    case 'type': return 'Type [text omitted]'
    case 'hotkey': return `Hotkey ${action.keys.join(' + ')}`
    case 'scroll': return `Scroll (${action.dx}, ${action.dy})`
    case 'wait': return `Wait ${action.ms}ms`
    case 'done': return `Done: ${action.summary}`
  }
}

export function AgentOverlay(): JSX.Element {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(true)
  useEffect(() => window.rellum.onAgent((event) => {
    if (event.type === 'step') setStep(event.step)
    if (event.type === 'done' || event.type === 'error' || event.type === 'aborted') setVisible(false)
  }), [])
  if (!visible) return <></>
  return <main className="p-2 text-paper">
    <section className="rellum-card px-4 py-3">
      <p className="text-sm font-semibold">Rellum agent running</p>
      <p className="mt-1 text-xs text-paper/55">ESC to stop · Step {step}</p>
    </section>
  </main>
}

export default function AgentApp(): JSX.Element {
  const [goal, setGoal] = useState('')
  const [running, setRunning] = useState(false)
  const [events, setEvents] = useState<AgentProgressEvent[]>([])
  const [summary, setSummary] = useState('')
  const [error, setError] = useState('')

  useEffect(() => window.rellum.onAgent((event) => {
    setEvents((current) => [...current, event])
    if (event.type === 'step') setRunning(true)
    if (event.type === 'done' || event.type === 'aborted') {
      setRunning(false)
      setSummary(event.summary ?? '')
    }
    if (event.type === 'error') {
      setRunning(false)
      setError(event.message ?? 'Agent failed.')
    }
  }), [])

  const start = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!goal.trim() || running) return
    setEvents([])
    setSummary('')
    setError('')
    setRunning(true)
    try { await window.rellum.agent.start(goal) }
    catch (reason) {
      setRunning(false)
      setError(reason instanceof Error ? reason.message : 'Could not start agent.')
    }
  }

  return <main className="min-h-screen bg-ink-950 p-5 text-paper">
    <section className="rellum-card mx-auto max-w-2xl overflow-hidden">
      <header className="border-b border-white/10 px-5 py-4">
        <h1 className="text-lg font-semibold">Computer-use agent</h1>
        <p className="mt-1 text-xs text-paper/50">Rellum can see your screen and control input. Press Esc to stop.</p>
      </header>
      <form onSubmit={start} className="space-y-3 p-5">
        <label className="label" htmlFor="goal">Goal</label>
        <textarea id="goal" className="field min-h-24 resize-y" value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Describe what Rellum should do…" disabled={running} />
        <div className="flex gap-2">
          <button className="primary" type="submit" disabled={running || !goal.trim()}>Start agent</button>
          <button className="secondary" type="button" onClick={() => window.rellum.agent.stop()} disabled={!running}>Stop</button>
        </div>
      </form>
      <div className="border-t border-white/10 px-5 py-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-paper/45">Activity</h2>
        <ol className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm text-paper/70">
          {events.map((event, index) => <li key={`${event.step}-${index}`} className="rounded-lg bg-white/5 px-3 py-2">
            <span className="mr-2 text-xs text-lime">{event.step}</span>
            {event.action ? actionLabel(event.action) : event.type === 'error' ? event.message : event.summary}
          </li>)}
        </ol>
        {summary && <p className="mt-4 rounded-lg border border-lime/20 bg-lime/5 px-3 py-2 text-sm text-lime">{summary}</p>}
        {error && <p className="mt-4 rounded-lg border border-red-300/20 bg-red-300/5 px-3 py-2 text-sm text-red-200">{error}</p>}
      </div>
    </section>
  </main>
}
