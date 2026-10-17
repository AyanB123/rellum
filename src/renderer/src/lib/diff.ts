export interface DiffPart {
  text: string
  changed: boolean
}

/** Return the rewritten text split into words that changed from the source. */
export function diffWords(source: string, result: string): DiffPart[] {
  const sourceTokens = tokenize(source)
  const resultTokens = tokenize(result)
  const rows = sourceTokens.length + 1
  const cols = resultTokens.length + 1
  const table: number[][] = Array.from({ length: rows }, () => Array<number>(cols).fill(0))

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      table[i][j] = sourceTokens[i - 1] === resultTokens[j - 1]
        ? table[i - 1][j - 1] + 1
        : Math.max(table[i - 1][j], table[i][j - 1])
    }
  }

  const matched = new Set<number>()
  let i = sourceTokens.length
  let j = resultTokens.length
  while (i > 0 && j > 0) {
    if (sourceTokens[i - 1] === resultTokens[j - 1]) {
      matched.add(j - 1)
      i -= 1
      j -= 1
    } else if (table[i - 1][j] >= table[i][j - 1]) {
      i -= 1
    } else {
      j -= 1
    }
  }

  const parts: DiffPart[] = []
  resultTokens.forEach((text, index) => {
    const changed = !/^\s+$/.test(text) && !matched.has(index)
    const previous = parts[parts.length - 1]
    if (previous && previous.changed === changed) previous.text += text
    else parts.push({ text, changed })
  })
  return parts
}

function tokenize(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? []
}
