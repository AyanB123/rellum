import { screen } from 'electron'
import * as nut from '@nut-tree-fork/nut-js'
import type { AgentAction } from '@shared/ipc'
import { sleep } from '../capture'

export type { AgentAction }

interface PointAction {
  type: 'click' | 'double_click' | 'right_click' | 'move'
  x: number
  y: number
}

const KEY_NAMES: Record<string, nut.Key> = {
  escape: nut.Key.Escape,
  esc: nut.Key.Escape,
  enter: nut.Key.Enter,
  return: nut.Key.Return,
  tab: nut.Key.Tab,
  space: nut.Key.Space,
  backspace: nut.Key.Backspace,
  delete: nut.Key.Delete,
  insert: nut.Key.Insert,
  home: nut.Key.Home,
  end: nut.Key.End,
  pageup: nut.Key.PageUp,
  pagedown: nut.Key.PageDown,
  up: nut.Key.Up,
  down: nut.Key.Down,
  left: nut.Key.Left,
  right: nut.Key.Right,
  shift: nut.Key.LeftShift,
  ctrl: nut.Key.LeftControl,
  control: nut.Key.LeftControl,
  alt: nut.Key.LeftAlt,
  option: nut.Key.LeftAlt,
  meta: nut.Key.LeftMeta,
  command: nut.Key.LeftCmd,
  cmd: nut.Key.LeftCmd,
  win: nut.Key.LeftWin,
  windows: nut.Key.LeftWin,
  f1: nut.Key.F1,
  f2: nut.Key.F2,
  f3: nut.Key.F3,
  f4: nut.Key.F4,
  f5: nut.Key.F5,
  f6: nut.Key.F6,
  f7: nut.Key.F7,
  f8: nut.Key.F8,
  f9: nut.Key.F9,
  f10: nut.Key.F10,
  f11: nut.Key.F11,
  f12: nut.Key.F12
}
for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
  const key = letter.toUpperCase() as keyof typeof nut.Key
  const value = nut.Key[key]
  if (typeof value === 'number') KEY_NAMES[letter] = value
}
for (const digit of '0123456789') {
  const key = `Num${digit}` as keyof typeof nut.Key
  const value = nut.Key[key]
  if (typeof value === 'number') KEY_NAMES[digit] = value
}

/** Extract the first JSON object from a model response and validate its action shape. */
export function parseAction(rawText: string): AgentAction | null {
  const text = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '')
  const start = text.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let quote = false
  let escaped = false
  let end = -1
  for (let i = start; i < text.length; i += 1) {
    const character = text[i]
    if (quote) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') quote = false
      continue
    }
    if (character === '"') quote = true
    else if (character === '{') depth += 1
    else if (character === '}' && --depth === 0) {
      end = i + 1
      break
    }
  }
  if (end < 0) return null
  let candidate: unknown
  try { candidate = JSON.parse(text.slice(start, end)) as unknown } catch { return null }
  return validateAction(candidate)
}

function validateAction(value: unknown): AgentAction | null {
  if (!value || typeof value !== 'object') return null
  const object = value as Record<string, unknown>
  const type = object.type
  if (type === 'done') return typeof object.summary === 'string' ? { type, summary: object.summary } : null
  if (type === 'type') return typeof object.text === 'string' ? { type, text: object.text } : null
  if (type === 'hotkey') {
    return Array.isArray(object.keys) && object.keys.every((key): key is string => typeof key === 'string')
      ? { type, keys: object.keys }
      : null
  }
  if (type === 'wait') return finiteNumber(object.ms) ? { type, ms: Math.max(0, object.ms as number) } : null
  if (type === 'scroll') {
    return finiteNumber(object.dx) && finiteNumber(object.dy)
      ? { type, dx: object.dx as number, dy: object.dy as number }
      : null
  }
  if (type === 'click' || type === 'double_click' || type === 'right_click' || type === 'move') {
    return finiteNumber(object.x) && finiteNumber(object.y)
      ? { type, x: object.x as number, y: object.y as number }
      : null
  }
  return null
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Execute one validated action. Coordinates from the model are logical screen pixels. */
export async function executeAction(action: AgentAction): Promise<void> {
  switch (action.type) {
    case 'click':
      await moveToLogical(action)
      await nut.mouse.leftClick()
      return
    case 'double_click':
      await moveToLogical(action)
      await nut.mouse.doubleClick()
      return
    case 'right_click':
      await moveToLogical(action)
      await nut.mouse.rightClick()
      return
    case 'move':
      await moveToLogical(action)
      return
    case 'type':
      await nut.keyboard.type(action.text)
      return
    case 'hotkey': {
      const keys = action.keys.map(keyForName)
      await nut.keyboard.pressKey(...keys)
      await nut.keyboard.releaseKey(...keys)
      return
    }
    case 'scroll':
      if (action.dy > 0) await nut.mouse.scrollDown(Math.round(action.dy))
      else if (action.dy < 0) await nut.mouse.scrollUp(Math.round(-action.dy))
      if (action.dx > 0) await nut.mouse.scrollRight(Math.round(action.dx))
      else if (action.dx < 0) await nut.mouse.scrollLeft(Math.round(-action.dx))
      return
    case 'wait':
      await sleep(action.ms)
      return
    case 'done':
      return
  }
}

function keyForName(name: string): nut.Key {
  const key = KEY_NAMES[name.trim().toLowerCase()]
  if (key === undefined) throw new Error(`Unsupported hotkey key: ${name}`)
  return key
}

async function moveToLogical(action: PointAction): Promise<void> {
  const displays = screen.getAllDisplays()
  const display = displays.find((candidate) => {
    const { x, y, width, height } = candidate.bounds
    return action.x >= x && action.x < x + width && action.y >= y && action.y < y + height
  }) ?? screen.getPrimaryDisplay()
  const { x, y } = display.bounds
  const scale = display.scaleFactor || 1
  await nut.mouse.setPosition({
    x: Math.round(x + (action.x - x) * scale),
    y: Math.round(y + (action.y - y) * scale)
  })
}
