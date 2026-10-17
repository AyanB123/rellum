// Minimal OpenAI-compatible mock for smoke tests. Not shipped in the app.
import http from 'node:http'

const REWRITES = {
  improve: 'The quick brown fox leaps over the lazy dog. It was a poor sentence that needed work.',
  proofread: 'The quick brown fox jumps over the lazy dog, it was a very bad sentence that needs fixing.',
  condense: 'The quick brown fox jumps over the lazy dog.'
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ data: [{ id: 'mock-mini' }] }))
    return
  }
  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      let action = 'improve'
      try {
        const parsed = JSON.parse(body)
        const system = parsed.messages?.[0]?.content ?? ''
        if (/proofread/i.test(system)) action = 'proofread'
        if (/condense/i.test(system)) action = 'condense'
      } catch {}
      const text = REWRITES[action]
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })
      const tokens = text.split(' ')
      let i = 0
      const timer = setInterval(() => {
        if (i < tokens.length) {
          const chunk = (i === 0 ? '' : ' ') + tokens[i]
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`)
          i++
        } else {
          res.write('data: [DONE]\n\n')
          res.end()
          clearInterval(timer)
        }
      }, 40)
    })
    return
  }
  res.writeHead(404)
  res.end('not found')
})

server.listen(15317, '127.0.0.1', () => {
  console.log('mock llm on http://127.0.0.1:15317/v1')
})
