import { createServer } from 'node:http'
import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'

const directory = resolve(process.argv[2])
await mkdir(directory, { recursive: true })
let serial = 0

function messageText(message) {
  return typeof message?.content === 'string' ? message.content : Array.isArray(message?.content) ? message.content.map(part => part.text ?? '').join('') : ''
}

function answer(body) {
  const names = new Set((body.tools ?? []).map(tool => tool.function?.name))
  const messages = body.messages ?? []
  const userIndex = messages.findLastIndex(message => message.role === 'user')
  const prompt = messageText(messages[userIndex])
  if (!names.has('desk_read')) return { content: '普通模式：没有稿纸工具。' }
  const toolResults = messages.slice(userIndex + 1).filter(message => message.role === 'tool')
  let current
  try { current = JSON.parse(messageText(toolResults.at(-1))) } catch {}
  const call = (name, args) => ({ content: null, tool_calls: [{ id: `fixture-${++serial}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }] })
  if (!toolResults.length) return call('desk_read', {})
  if (prompt.includes('NAI_DESK_READ')) return { content: `模型读到：${current?.main ?? messageText(toolResults.at(-1))}` }
  if (!Number.isSafeInteger(current?.revision)) return { content: `测试工具返回了错误：${messageText(toolResults.at(-1))}` }
  if (toolResults.length === 1) return call('desk_set_main', { text: 'integration main: café\nsecond line', expected_revision: current.revision })
  if (toolResults.length === 2) return call('desk_set_character', { n: 1, prompt: 'girl, blue jacket, holding a cup', expected_revision: current.revision })
  if (toolResults.length === 3) return call('desk_set_uc', { text: 'lowres', expected_revision: current.revision })
  return { content: '稿纸的主串、角色 1 和 UC 已更新。' }
}

const server = createServer(async (req, res) => {
  if (req.url === '/v1/models') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ object: 'list', data: [{ id: 'nai-desk-fixture', object: 'model', owned_by: 'local-test' }] }))
    return
  }
  if (req.url !== '/v1/chat/completions' || req.method !== 'POST') { res.writeHead(404); res.end(); return }
  try {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = JSON.parse(Buffer.concat(chunks).toString())
    await appendFile(join(directory, 'requests.jsonl'), `${JSON.stringify(body)}\n`)
    const message = answer(body)
    const finish = message.tool_calls ? 'tool_calls' : 'stop'
    const id = `chatcmpl-local-${++serial}`
    if (!body.stream) {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ id, object: 'chat.completion', created: 1, model: 'nai-desk-fixture', choices: [{ index: 0, message: { role: 'assistant', ...message }, finish_reason: finish }], usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } }))
      return
    }
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' })
    const delta = { role: 'assistant', ...message }
    if (delta.tool_calls) delta.tool_calls = delta.tool_calls.map((call, index) => ({ index, ...call }))
    res.write(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created: 1, model: 'nai-desk-fixture', choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`)
    res.write(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created: 1, model: 'nai-desk-fixture', choices: [{ index: 0, delta: {}, finish_reason: finish }], usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } })}\n\n`)
    res.end('data: [DONE]\n\n')
  } catch (error) {
    res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { message: error.message } }))
  }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const address = server.address()
await writeFile(join(directory, 'server.json'), JSON.stringify({ pid: process.pid, baseURL: `http://127.0.0.1:${address.port}/v1` }))
console.log(`Local synthetic model listening on 127.0.0.1:${address.port}; no upstream requests.`)
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)))
