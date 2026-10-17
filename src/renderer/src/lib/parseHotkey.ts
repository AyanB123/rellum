const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta'])

/** Convert a keydown event to an Electron accelerator string. */
export function parseHotkey(event: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(event.key)) return null

  const modifiers: string[] = []
  if (event.ctrlKey) modifiers.push('Ctrl')
  if (event.altKey) modifiers.push('Alt')
  if (event.shiftKey) modifiers.push('Shift')
  if (event.metaKey) modifiers.push('Meta')

  const key = electronKey(event.key)
  if (!key) return null
  return [...modifiers, key].join('+')
}

function electronKey(key: string): string | null {
  const named: Record<string, string> = {
    ' ': 'Space',
    Spacebar: 'Space',
    Enter: 'Enter',
    Escape: 'Esc',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Insert: 'Insert',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    PrintScreen: 'PrintScreen'
  }
  if (named[key]) return named[key]
  if (/^F(?:[1-9]|1[0-2])$/.test(key)) return key
  if (key.length === 1 && /[a-zA-Z0-9]/.test(key)) return key.toUpperCase()
  const punctuation: Record<string, string> = {
    '`': '`',
    '-': '-',
    '=': '=',
    '[': '[',
    ']': ']',
    '\\': '\\',
    ';': ';',
    "'": "'",
    ',': ',',
    '.': '.',
    '/': '/'
  }
  return punctuation[key] ?? null
}
