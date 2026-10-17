import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CaptureContext, RewriteAction, RewriteStreamEvent, WindowPosition } from '@shared/ipc'
import { diffWords } from '../lib/diff'

type View = 'menu' | 'streaming' | 'result' | 'error'

const ACTIONS: Array<{ id: RewriteAction; label: string; hint: string; icon: string }> = [
  { id: 'improve', label: 'Improve writing', hint: 'Clearer and more compelling', icon: '✦' },
  { id: 'proofread', label: 'Proofread', hint: 'Fix grammar and spelling', icon: 'Aa' },
  { id: 'condense', label: 'Condense', hint: 'Keep the meaning, use fewer words', icon: '↘' }
]

export default function PopupApp(): JSX.Element {
  const [view, setView] = useState<View>('menu')
  const [capture, setCapture] = useState<CaptureContext>({ text: '', appName: 'your app', windowTarget: '', capturedAt: 0, unreliable: true })
  const [selected, setSelected] = useState(0)
  const [text, setText] = useState('')
  const [resultText, setResultText] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const streamRef = useRef<HTMLDivElement>(null)
  const lastAction = useRef<RewriteAction | null>(null)
  const fallbackRef = useRef('')

  const resize = useCallback((height: number) => {
    window.rellum.popup.resizeHeight(Math.min(420, Math.max(200, height)))
  }, [])

  useEffect(() => {
    const offCapture = window.rellum.onCapture((next: CaptureContext | null, _pos: WindowPosition) => {
      const incoming = next ?? { text: '', appName: 'your app', windowTarget: '', capturedAt: Date.now(), unreliable: true }
      setCapture(incoming)
      setText(incoming.text)
      fallbackRef.current = incoming.text
      setResultText('')
      setError('')
      setCopied(false)
      setSelected(0)
      setView('menu')
    })
    const offStream = window.rellum.onStream((event: RewriteStreamEvent) => {
      if (event.type === 'token') {
        setText((current) => current + (event.text ?? ''))
      } else if (event.type === 'done') {
        if (event.text) {
          setResultText(event.text)
          setText(event.text)
          setView('result')
        }
      } else if (event.type === 'error') {
        setError(event.message ?? 'The rewrite could not be completed.')
        setView('error')
      }
    })
    return () => {
      offCapture()
      offStream()
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (view === 'menu') window.rellum.popup.done()
        else {
          window.rellum.popup.cancel()
          setView('menu')
          setText(capture.text)
          setError('')
        }
        return
      }
      if (view !== 'menu') return
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        setSelected((current) => (current + (event.key === 'ArrowDown' ? 1 : -1) + ACTIONS.length) % ACTIONS.length)
      } else if (event.key === 'Enter') {
        event.preventDefault()
        void runAction(ACTIONS[selected].id)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  useEffect(() => {
    const height = view === 'menu' ? (!capture.text ? 340 : 270) : view === 'result' ? 380 : 290
    resize(height)
  }, [capture.text, capture.unreliable, resize, view, resultText])

  useEffect(() => {
    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight
  }, [text, resultText])

  const sourcePreview = useMemo(() => {
    const source = capture.text || 'Nothing selected'
    return source.replace(/\s+/g, ' ').trim()
  }, [capture.text])

  const runAction = async (action: RewriteAction, previous?: string): Promise<void> => {
    const input = !capture.text ? fallbackRef.current : capture.text
    const actualCapture = { ...capture, text: input }
    setCapture(actualCapture)
    if (!input.trim()) {
      setError('Add some text first, then choose an action.')
      setView('error')
      return
    }
    lastAction.current = action
    setCopied(false)
    setError('')
    setText('')
    setResultText('')
    setView('streaming')
    await window.rellum.popup.rewrite(action, actualCapture, previous)
  }

  const onFallbackChange = (value: string): void => {
    fallbackRef.current = value
    setText(value)
  }

  const goBack = (): void => {
    window.rellum.popup.cancel()
    setView('menu')
    setText(capture.text || fallbackRef.current)
    setResultText('')
  }

  return (
    <main className="p-2 text-paper">
      <section className="rellum-card overflow-hidden">
        <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0 flex-1 truncate text-sm text-paper/60">{sourcePreview}</div>
          <div className="rellum-badge shrink-0 px-2.5 py-1 text-[11px] tracking-wide">RELLUM</div>
        </header>
        {view === 'menu' && (
          <div className="p-2">
            {!capture.text && (
              <textarea
                aria-label="Text to rewrite"
                value={text}
                onChange={(event) => onFallbackChange(event.target.value)}
                placeholder="Nothing was selected — paste or type text here"
                className="mb-2 h-20 w-full resize-none rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2 text-sm leading-5 text-paper outline-none transition placeholder:text-paper/35 focus:border-lime/60"
              />
            )}
            <nav aria-label="Rewrite actions">
              {ACTIONS.map((action, index) => (
                <button
                  type="button"
                  key={action.id}
                  className="rellum-menu-row w-full text-left"
                  data-selected={index === selected}
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => void runAction(action.id)}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime/10 text-sm font-bold text-lime">{action.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block">{action.label}</span>
                    <span className="mt-0.5 block text-xs font-normal text-paper/40">{action.hint}</span>
                  </span>
                  {index === selected && <span className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-paper/45">Enter ↵</span>}
                </button>
              ))}
            </nav>
          </div>
        )}
        {view === 'streaming' && (
          <div className="p-5">
            <div ref={streamRef} className="max-h-52 overflow-y-auto whitespace-pre-wrap text-[15px] leading-6 text-paper/90">{text || <span className="text-paper/45">Working on it…</span>}</div>
            <div className="mt-5 flex items-center gap-2 text-xs text-paper/40"><span className="rellum-spinner" /> Rewriting…</div>
          </div>
        )}
        {view === 'result' && (
          <div className="p-5">
            <div ref={streamRef} className="max-h-52 overflow-y-auto whitespace-pre-wrap text-[15px] leading-6 text-paper/90">
              {diffWords(capture.text, resultText).map((part, index) => part.changed ? <strong className="font-semibold text-lime" key={`${index}-${part.text}`}>{part.text}</strong> : <span key={`${index}-${part.text}`}>{part.text}</span>)}
            </div>
            <div className="mt-5 flex flex-wrap gap-1 border-t border-white/10 pt-3">
              <button type="button" className="rellum-action-btn bg-lime/10 text-lime hover:bg-lime/20" onClick={() => void window.rellum.popup.pasteBack(resultText)}>Paste in {capture.appName || 'app'}</button>
              <button type="button" className="rellum-action-btn" onClick={() => { window.rellum.popup.copyText(resultText); setCopied(true); setTimeout(() => setCopied(false), 1600) }}>{copied ? 'Copied!' : 'Copy'}</button>
              <button type="button" className="rellum-action-btn" onClick={() => lastAction.current && void runAction(lastAction.current, resultText)}>Retry differently</button>
            </div>
          </div>
        )}
        {view === 'error' && (
          <div className="p-6">
            <div className="text-sm font-medium text-paper">{error || 'Something went wrong.'}</div>
            <p className="mt-2 text-xs leading-5 text-paper/45">Check that your model server is running and the endpoint is correct.</p>
            <button type="button" className="mt-4 text-xs text-lime hover:underline" onClick={goBack}>Back to actions</button>
          </div>
        )}
        {view !== 'menu' && <footer className="border-t border-white/10 px-5 py-2 text-[11px] text-paper/35">esc to go back</footer>}
        {view === 'menu' && <footer className="px-4 pb-3 pt-1 text-[11px] text-paper/30">↑↓ navigate · Enter choose · esc close</footer>}
      </section>
    </main>
  )
}
