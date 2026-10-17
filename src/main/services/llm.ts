import type { EndpointConfig, RewriteAction } from '@shared/ipc'

export interface StreamHandlers {
  onToken(token: string): void
  onDone(full: string): void
  onError(message: string): void
}

const SYSTEM_PROMPTS: Record<RewriteAction, string> = {
  improve:
    'You are a precise writing editor. Rewrite the user text so it is clearer, ' +
    'more compelling and better structured. Preserve meaning, facts, names, ' +
    'numbers and the original language. Keep the same register unless it is ' +
    'unprofessional. Return ONLY the rewritten text with no preamble, quotes, ' +
    'or commentary.',
  proofread:
    'You are a meticulous proofreader. Fix grammar, spelling, and punctuation ' +
    'errors and nothing else. Do not rephrase or restructure. Keep formatting. ' +
    'Return ONLY the corrected text with no preamble, quotes, or commentary.',
  condense:
    'You are an expert at trimming text. Condense the user text while keeping ' +
    'all essential information. Prefer short sentences. Never add new ' +
    'information. Return ONLY the condensed text with no preamble, quotes, ' +
    'or commentary.'
}

export async function streamRewrite(
  endpoint: EndpointConfig,
  action: RewriteAction,
  text: string,
  previousRewrites: string[],
  handlers: StreamHandlers
): Promise<AbortController> {
  const controller = new AbortController()
  const url = endpoint.baseUrl.replace(/\\/$/, '') + '/chat/completions'

  const messages = [
    { role: 'system', content: SYSTEM_PROMPTS[action] },
    ...(previousRewrites.length
      ? [
          {
            role: 'user' as const,
            content: text
          },
          ...previousRewrites.map(
            (r, i) =>
              ({
                role: i === previousRewrites.length - 1 ? ('assistant' as const) : ('user' as const),
                content: r
              }) as { role: 'user' | 'assistant'; content: string }
          )
        ]
      : []),
    ...(previousRewrites.length ? [] : [{ role: 'user' as const, content: text }])
  ]

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(endpoint.apiKey ? { Authorization: `Bearer ${endpoint.apiKey}` } : {})
      },
      body: JSON.stringify({
        model: endpoint.model,
        messages,
        stream: true,
        temperature: action === 'proofread' ? 0.1 : 0.7
      }),
      signal: controller.signal
    })

    if (!res.ok || !res.body) {
      const errBody = await res.text().catch(() => '')
      handlers.onError(`Endpoint returned ${res.status}: ${errBody.slice(0, 300)}`)
      return controller
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let full = ''

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let idx: number
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim()
        buffer = buffer.slice(idx + 1)
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') {
          handlers.onDone(full)
          return controller
        }
        try {
          const json = JSON.parse(data)
          const token = json.choices?.[0]?.delta?.content
          if (typeof token === 'string' && token) {
            full += token
            handlers.onToken(token)
          }
        } catch {
          // partial json across chunk boundary is handled by buffer accumulation
        }
      }
    }
    handlers.onDone(full)
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      handlers.onDone('') // user cancelled; renderer treats empty as cancelled
    } else {
      handlers.onError(`Request failed: ${(err as Error).message}`)
    }
  }
  return controller
}

export async function listModels(endpoint: EndpointConfig): Promise<string[]> {
  const url = endpoint.baseUrl.replace(/\\/$/, '') + '/models'
  const res = await fetch(url, {
    headers: endpoint.apiKey ? { Authorization: `Bearer ${endpoint.apiKey}` } : {}
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as { data?: Array<{ id: string }> }
  return (json.data ?? []).map((m) => m.id)
}

/** Try common local server ports and return reachable candidates. */
export async function detectEndpoints(): Promise<EndpointConfig[]> {
  const candidates: Array<{ url: string; label: string }> = [
    { url: 'http://127.0.0.1:11434/v1', label: 'Ollama' },
    { url: 'http://127.0.0.1:1234/v1', label: 'LM Studio' },
    { url: 'http://127.0.0.1:8080/v1', label: 'llama.cpp server' },
    { url: 'http://127.0.0.1:8000/v1', label: 'vLLM' },
    { url: 'http://127.0.0.1:20128/v1', label: 'Local proxy' }
  ]
  const found: EndpointConfig[] = []
  await Promise.all(
    candidates.map(async (c) => {
      try {
        const res = await fetch(c.url + '/models', { signal: AbortSignal.timeout(1500) })
        if (res.ok) {
          found.push({ baseUrl: c.url, model: '' })
        }
      } catch {
        /* not running */
      }
    })
  )
  return found
}

/** Parse one SSE data line into { token?, done? }. Pure and unit-testable. */
export function parseSseChunk(line: string): { token?: string; done?: boolean } {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data:')) return {}
  const data = trimmed.slice(5).trim()
  if (data === '[DONE]') return { done: true }
  try {
    const json = JSON.parse(data)
    const token = json?.choices?.[0]?.delta?.content
    if (typeof token === 'string' && token) return { token }
    return {}
  } catch {
    return {}
  }
}
