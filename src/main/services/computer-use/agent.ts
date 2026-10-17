import { globalShortcut } from 'electron'
import type { AgentAction, AgentProgressEvent } from '@shared/ipc'
import { captureAllDisplays, askVision } from './vision'
import { executeAction, parseAction } from './act'

export interface AgentRunOptions {
  maxSteps?: number
  onProgress?: (event: AgentProgressEvent) => void
}

let activeAbort: (() => void) | null = null

export function stopAgent(): void {
  activeAbort?.()
}

/** Run the screen-control loop until the model reports done, abort, or maxSteps. */
export async function runAgent(goal: string, options: AgentRunOptions = {}): Promise<void> {
  const trimmedGoal = goal.trim()
  if (!trimmedGoal) throw new Error('Agent goal cannot be empty.')
  if (activeAbort) throw new Error('An agent run is already active.')

  const maxSteps = Math.max(1, Math.floor(options.maxSteps ?? 24))
  let aborted = false
  activeAbort = () => { aborted = true }
  const history: AgentAction[] = []
  let step = 0
  let finished = false
  const emit = (event: AgentProgressEvent): void => options.onProgress?.(event)

  const abortHandler = (): void => { aborted = true }
  globalShortcut.register('Escape', abortHandler)

  try {
    while (!aborted && step < maxSteps) {
      const images = await captureAllDisplays()
      if (aborted) break
      const prompt = buildPrompt(trimmedGoal, history)
      const reply = await askVision(prompt, images)
      if (aborted) break
      const action = parseAction(reply)
      if (!action) throw new Error('Vision model returned no valid action.')
      history.push(action)
      if (history.length > 6) history.shift()
      step += 1
      emit({ type: 'step', step, action: displayAction(action) })
      if (action.type === 'done') {
        finished = true
        emit({ type: 'done', step, summary: action.summary })
        break
      }
      await executeAction(action)
    }
    if (aborted) emit({ type: 'aborted', step, summary: 'Agent stopped.' })
    else if (!finished && step >= maxSteps) emit({ type: 'done', step, summary: 'Agent reached the step limit.' })
  } catch (error) {
    if (aborted) emit({ type: 'aborted', step, summary: 'Agent stopped.' })
    else {
      const message = error instanceof Error ? error.message : 'Agent failed.'
      emit({ type: 'error', step, message })
    }
  } finally {
    globalShortcut.unregister('Escape')
    activeAbort = null
  }
}

function buildPrompt(goal: string, history: AgentAction[]): string {
  const recent = history.map((action, index) => `${index + 1}. ${JSON.stringify(displayAction(action))}`).join('\n') || '(none)'
  return [
    'You control a computer through screenshots. Choose exactly one next action to achieve the goal.',
    'Reply with ONLY one JSON object. Allowed actions:',
    '{"type":"click","x":0,"y":0}, {"type":"double_click","x":0,"y":0}, {"type":"right_click","x":0,"y":0},',
    '{"type":"move","x":0,"y":0}, {"type":"type","text":"..."}, {"type":"hotkey","keys":["ctrl","l"]},',
    '{"type":"scroll","dx":0,"dy":3}, {"type":"wait","ms":500}, {"type":"done","summary":"..."}.',
    'Coordinates are logical desktop pixels. Use the latest screenshot and do not repeat a completed action.',
    `Goal: ${goal}`,
    `Recent actions:
${recent}`
  ].join('\n')
}

/** Do not expose typed text in UI progress events or logs. */
function displayAction(action: AgentAction): AgentAction {
  if (action.type === 'type') return { type: 'type', text: '[text omitted]' }
  if (action.type === 'hotkey') return { type: 'hotkey', keys: [...action.keys] }
  return action
}
