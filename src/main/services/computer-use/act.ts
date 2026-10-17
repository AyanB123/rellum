import { screen } from 'electron'
import nut from '@nut-tree-fork/nut-js'
const { Key, keyboard, mouse } = nut
import type { AgentAction } from '@shared/ipc'
import { sleep } from '../capture'

export type { AgentAction }

interface PointAction {
  type: 'click' | 'double_click' | 'right_click' | 'move'
  x: number
  y: number
}

const KEY_NAMES: Record<string, Key> = {
  escape: Key.Escape,
  esc: Key.Escape,
  enter: Key.Enter,
  return: Key.Return,
  tab: Key.Tab,
  space: Key.Space,
  backspace: Key.Backspace,
  delete: Key.Delete,
  insert: Key.Insert,
  home: Key.Home,
  end: Key.End,
  pageup: Key.PageUp,
  pagedown: Key.PageDown,
  up: Key.Up,
  down: Key.Down,
  left: Key.Left,
  right: Key.Right,
  shift: Key.LeftShift,
  ctrl: Key.LeftControl,
  control: Key.LeftControl,
  alt: Key.LeftAlt,
  option: Key.LeftAlt,
  meta: Key.LeftMeta,
  command: Key.LeftCmd,
  cmd: Key.LeftCmd,
  win: Key.LeftWin,
  windows: Key.LeftWin,
  f1: Key.F1,
  f2: Key.F2,
  f3: Key.F3,
  f4: Key.F4,
  f5: Key.F5,
  f6: Key.F6,
  f7: Key.F7,
  f8: Key.F8,
  f9: Key.F9,
  f10: Key.F10,
  f11: Key.F11,
  f12: Key.F12
}
for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
  const key = letter.toUpperCase() as keyof typeof Key
  const value = Key[key]
  if (typeof value === 'number') KEY_NAMES[letter] = value
}
for (const digit of '0123456789') {
  const key = `Num${digit}` as keyof typeof Key
  const value = Key[key]
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
      await mouse.leftClick()
      return
    case 'double_click':
      await moveToLogical(action)
      await mouse.doubleClick()
      return
    case 'right_click':
      await moveToLogical(action)
      await mouse.rightClick()
      return
    case 'move':
      await moveToLogical(action)
      return
    case 'type':
      await keyboard.type(action.text)
      return
    case 'hotkey': {
      const keys = action.keys.map(keyForName)
      await keyboard.pressKey(...keys)
      await keyboard.releaseKey(...keys)
      return
    }
    case 'scroll':
      if (action.dy > 0) await mouse.scrollDown(Math.round(action.dy))
      else if (action.dy < 0) await mouse.scrollUp(Math.round(-action.dy))
      if (action.dx > 0) await mouse.scrollRight(Math.round(action.dx))
      else if (action.dx < 0) await mouse.scrollLeft(Math.round(-action.dx))
      return
    case 'wait':
      await sleep(action.ms)
      return
    case 'done':
      return
  }
}

function keyForName(name: string): Key {
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
  await mouse.setPosition({
    x: Math.round(x + (action.x - x) * scale),
    y: Math.round(y + (action.y - y) * scale)
  })
}
