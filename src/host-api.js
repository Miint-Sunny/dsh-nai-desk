import { DeskError, LIMITS, sessionKey } from './desk.js'
import { API_PATH } from './protocol.js'

export { API_PATH }
const statusCodes = { invalid_input: 400, wrong_preset: 403, masked: 403, not_found: 404, conflict: 409, limit_exceeded: 413, invalid_record: 500, closed: 503 }
const reply = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })
const errorReply = (code, message, status, current) => reply({ error: { code, message, ...(current ? { current } : {}) } }, status)

async function readJson(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) return { response: errorReply('unsupported_media_type', '请求须使用 Content-Type: application/json。', 415) }
  const declared = request.headers.get('content-length')
  if (declared && Number(declared) > LIMITS.recordBytes) throw new DeskError('limit_exceeded', '请求体超过 1 MiB，请减少请求内容。')
  const reader = request.body?.getReader()
  if (!reader) throw new DeskError('invalid_input', '请求体不能为空。')
  const chunks = []
  let size = 0
  try {
    while (true) {
      request.signal.throwIfAborted()
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > LIMITS.recordBytes) {
        await reader.cancel()
        throw new DeskError('limit_exceeded', '请求体超过 1 MiB，请减少请求内容。')
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new Error('not object')
    return { data }
  } catch { throw new DeskError('invalid_input', '请求体必须是有效的 JSON 对象。') }
}

/**
 * Register this handler only on ctx.connection.fetch, never webServer.
 * Connection owns authentication, Host/Origin checks and owner admission.
 */
export function createDeskHandler({ store, isNaiSession }) {
  return async request => {
    try {
      request.signal.throwIfAborted()
      if (request.method !== 'POST') return errorReply('method_not_allowed', '该操作只接受 POST 请求。', 405)
      const parsed = await readJson(request)
      if (parsed.response) return parsed.response
      const data = parsed.data
      const requestKeys = {
        read: ['action', 'sessionId'],
        mutate: ['action', 'sessionId', 'expectedRevision', 'operation'],
        watch: ['action', 'sessionId', 'revision'],
        history: ['action', 'sessionId'],
        version: ['action', 'sessionId', 'revision'],
      }
      const keys = Object.hasOwn(requestKeys, data.action) ? requestKeys[data.action] : undefined
      if (!keys || Object.keys(data).some(key => !keys.includes(key))) throw new DeskError('invalid_input', 'action 或请求字段不符合接口约定，请检查请求结构。')
      const id = sessionKey(data.sessionId)
      if (!await isNaiSession(id, request.signal)) throw new DeskError('wrong_preset', '目标会话不存在，或未使用 NAI5 提示词预设。')
      request.signal.throwIfAborted()
      switch (data.action) {
        case 'read': return reply(await store.read(id))
        case 'mutate': return reply(await store.mutate(id, data.expectedRevision, data.operation))
        case 'watch': return reply(await store.watch(id, data.revision, { signal: request.signal }))
        case 'history': return reply(await store.history(id))
        case 'version': return reply(await store.version(id, data.revision))
      }
    } catch (error) {
      if (request.signal.aborted || error?.name === 'AbortError') return errorReply('cancelled', '请求已取消', 499)
      if (error instanceof DeskError) return errorReply(error.code, error.message, statusCodes[error.code] ?? 500, error.current)
      return errorReply('storage_error', '草稿读写失败，请保留未保存内容后重试。', 500)
    }
  }
}
