import { describe, expect, it } from 'vitest'
import { parseSseChunk } from './llm'

describe('parseSseChunk', () => {
  it('extracts token deltas from a data line', () => {
    const out = parseSseChunk('data: {"choices":[{"delta":{"content":"hi"}}]}')
    expect(out.token).toBe('hi')
  })

  it('returns done sentinel for [DONE]', () => {
    const out = parseSseChunk('data: [DONE]')
    expect(out.done).toBe(true)
  })

  it('tolerates junk lines', () => {
    const out = parseSseChunk('event: ping')
    expect(out.token).toBeUndefined()
    expect(out.done).toBeUndefined()
  })
})
