import { desktopCapturer, screen } from 'electron'
import { getSettings } from '../settings'

export interface DisplayCapture {
  id: string
  imageBase64: string
  width: number
  height: number
  scaleFactor: number
}

interface VisionResponse {
  choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>
}

/** Capture each connected display without writing screenshots to disk. */
export async function captureAllDisplays(): Promise<DisplayCapture[]> {
  const displays = screen.getAllDisplays()
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 7680, height: 4320 },
    fetchWindowIcons: false
  })

  return displays.flatMap((display) => {
    const source = sources.find((candidate) => candidate.display_id === String(display.id))
    if (!source || source.thumbnail.isEmpty()) return []
    const size = source.thumbnail.getSize()
    return [{
      id: String(display.id),
      imageBase64: source.thumbnail.toPNG().toString('base64'),
      width: size.width,
      height: size.height,
      scaleFactor: display.scaleFactor
    }]
  })
}

/** Ask the configured OpenAI-compatible multimodal endpoint about the displays. */
export async function askVision(prompt: string, images: DisplayCapture[]): Promise<string> {
  const settings = getSettings()
  const endpoint = settings.endpoint
  const model = settings.computerUse.model.trim() || endpoint.model
  if (!model) throw new Error('No computer-use model is configured.')

  const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
    { type: 'text', text: prompt },
    ...images.map((image) => ({
      type: 'image_url' as const,
      image_url: { url: `data:image/png;base64,${image.imageBase64}` }
    }))
  ]
  const url = endpoint.baseUrl.replace(/\/$/, '') + '/chat/completions'
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(endpoint.apiKey ? { Authorization: `Bearer ${endpoint.apiKey}` } : {})
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      stream: false,
      temperature: 0,
      max_tokens: 2048
    })
  })
  if (!response.ok) {
    // Do not include response bodies: compatible servers can echo prompts/user text.
    throw new Error(`Vision endpoint returned HTTP ${response.status}.`)
  }
  const payload: unknown = await response.json()
  if (!isVisionResponse(payload)) throw new Error('Vision endpoint returned an invalid response.')
  const contentValue = payload.choices?.[0]?.message?.content
  if (typeof contentValue === 'string') return contentValue
  if (Array.isArray(contentValue)) return contentValue.map((part) => part.text ?? '').join('')
  throw new Error('Vision endpoint returned no text.')
}

function isVisionResponse(value: unknown): value is VisionResponse {
  if (!value || typeof value !== 'object') return false
  const choices = (value as { choices?: unknown }).choices
  return Array.isArray(choices)
}
