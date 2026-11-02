import { randomUUID } from 'node:crypto'

export const LIMITS = Object.freeze({ characters: 22, fieldCharacters: 32768, nameCharacters: 128, recordBytes: 1024 * 1024 })

export class DeskError extends Error {
  constructor(code, message, current) {
    super(message)
    this.name = 'DeskError'
    this.code = code
    if (current) this.current = structuredClone(current)
  }
}

const invalid = message => { throw new DeskError('invalid_input', message) }
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value))

function object(value, allowed, label) {
  if (!isObject(value)) invalid(`${label} 必须是对象`)
  for (const key of Object.keys(value)) if (!allowed.includes(key)) invalid(`${label} 不接受字段 ${key}`)
  return value
}

export function sessionKey(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) invalid('sessionId 无效')
  return value
}

function text(value, label, max = LIMITS.fieldCharacters) {
  if (typeof value !== 'string') invalid(`${label} 必须是文字`)
  if (value.length > max) throw new DeskError('limit_exceeded', `${label} 超过 ${max} 字符的上限`)
  return value
}

function integer(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max) invalid(`${label} 超出范围`)
  return value
}

function position(value) {
  object(value, ['x', 'y'], 'position')
  for (const key of ['x', 'y']) if (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || value[key] < 0 || value[key] > 1) invalid('角色位置必须在 0 到 1 之间')
  return { x: value.x, y: value.y }
}

const characterFields = ['id', 'name', 'prompt', 'uc', 'enabled', 'position']

function character(value, number, idFactory) {
  object(value, characterFields, 'character')
  const result = {
    id: sessionKey(value.id === undefined ? idFactory() : value.id),
    name: text(value.name ?? `Character ${number}`, '角色名称', LIMITS.nameCharacters),
    prompt: text(value.prompt ?? '', '角色正向'),
    uc: text(value.uc ?? '', '角色 UC'),
    enabled: value.enabled === undefined ? true : value.enabled,
  }
  if (typeof result.enabled !== 'boolean') invalid('enabled 必须是布尔值')
  if (value.position !== undefined) result.position = position(value.position)
  return result
}

function withinSize(state) {
  if (Buffer.byteLength(JSON.stringify(state)) > LIMITS.recordBytes) throw new DeskError('limit_exceeded', '稿纸总大小超过 1 MiB 上限')
  return state
}

/** Validate stored data without repairing, truncating or replacing the user's text. */
export function validateRecord(value, id) {
  try {
    object(value, ['schemaVersion', 'sessionId', 'revision', 'main', 'uc', 'characters'], 'record')
    if (value.schemaVersion !== 1 || value.sessionId !== id) invalid('稿纸版本或会话不匹配')
    integer(value.revision, 0, Number.MAX_SAFE_INTEGER, 'revision')
    text(value.main, '主串')
    text(value.uc, '总 UC')
    if (!Array.isArray(value.characters) || value.characters.length > LIMITS.characters) invalid('角色列表无效')
    const ids = new Set()
    for (const c of value.characters) {
      for (const key of ['id', 'name', 'prompt', 'uc', 'enabled']) if (c?.[key] === undefined) invalid(`角色缺少 ${key}`)
      character(c, 1, () => { throw new Error('stored id is missing') })
      if (ids.has(c.id)) invalid('角色 id 重复')
      ids.add(c.id)
    }
    return structuredClone(withinSize(value))
  } catch (error) {
    throw new DeskError('invalid_record', `已保存稿纸无效，原数据已保留：${error.message}`)
  }
}

const emptyRecord = id => ({ schemaVersion: 1, sessionId: id, revision: 0, main: '', uc: '', characters: [] })

function applyOperation(state, operation, idFactory) {
  if (!isObject(operation)) invalid('operation 必须是对象')
  const next = structuredClone(state)
  const find = id => {
    sessionKey(id)
    const index = next.characters.findIndex(c => c.id === id)
    if (index < 0) throw new DeskError('not_found', '这个角色栏已不存在，请重新读取稿纸')
    return index
  }
  switch (operation.type) {
    case 'set_main':
    case 'set_uc': {
      object(operation, ['type', 'text'], 'operation')
      next[operation.type === 'set_main' ? 'main' : 'uc'] = text(operation.text, '提示词')
      break
    }
    case 'add_character': {
      object(operation, ['type', 'character', 'index'], 'operation')
      if (next.characters.length >= LIMITS.characters) throw new DeskError('limit_exceeded', `最多 ${LIMITS.characters} 个角色栏`)
      const index = operation.index === undefined ? next.characters.length : integer(operation.index, 0, next.characters.length, 'index')
      const added = character(operation.character ?? {}, index + 1, idFactory)
      if (next.characters.some(c => c.id === added.id)) invalid('角色 id 已存在')
      next.characters.splice(index, 0, added)
      break
    }
    case 'set_character': {
      object(operation, ['type', 'id', 'patch'], 'operation')
      const target = next.characters[find(operation.id)]
      const patch = object(operation.patch, characterFields.filter(key => key !== 'id'), 'patch')
      if (!Object.keys(patch).length) invalid('patch 不能为空')
      for (const [key, value] of Object.entries(patch)) {
        if (key === 'enabled') {
          if (typeof value !== 'boolean') invalid('enabled 必须是布尔值')
          target.enabled = value
        } else if (key === 'position') {
          if (value === null) delete target.position
          else target.position = position(value)
        } else target[key] = text(value, key, key === 'name' ? LIMITS.nameCharacters : LIMITS.fieldCharacters)
      }
      break
    }
    case 'remove_character':
      object(operation, ['type', 'id'], 'operation')
      next.characters.splice(find(operation.id), 1)
      break
    case 'move_character': {
      object(operation, ['type', 'id', 'index'], 'operation')
      const from = find(operation.id)
      const to = integer(operation.index, 0, next.characters.length - 1, 'index')
      const [moving] = next.characters.splice(from, 1)
      next.characters.splice(to, 0, moving)
      break
    }
    default: invalid('不支持的稿纸操作')
  }
  next.revision = integer(state.revision + 1, 1, Number.MAX_SAFE_INTEGER, 'revision')
  return withinSize(next)
}

/**
 * Session-local, durable state. persistence owns storage; this class owns
 * validation, write ordering, compare-and-swap and change notifications.
 */
export class DeskStore {
  #persistence
  #idFactory
  #loaded = new Map()
  #tails = new Map()
  #listeners = new Map()
  #closed = false

  constructor({ persistence, idFactory = randomUUID }) {
    this.#persistence = persistence
    this.#idFactory = idFactory
  }

  #assertOpen() {
    if (this.#closed) throw new DeskError('closed', '稿纸服务已关闭')
  }

  async #load(id) {
    this.#assertOpen()
    sessionKey(id)
    if (!this.#loaded.has(id)) {
      const loading = Promise.resolve().then(() => this.#persistence.read(id)).then(value => value === undefined ? emptyRecord(id) : validateRecord(value, id))
      this.#loaded.set(id, loading)
      loading.catch(() => { if (this.#loaded.get(id) === loading) this.#loaded.delete(id) })
    }
    return this.#loaded.get(id)
  }

  async read(id) { return structuredClone(await this.#load(id)) }

  async mutate(id, expectedRevision, operation) {
    this.#assertOpen()
    sessionKey(id)
    integer(expectedRevision, 0, Number.MAX_SAFE_INTEGER, 'expectedRevision')
    let op
    try { op = structuredClone(operation) } catch { invalid('operation 必须是可序列化数据') }
    const previous = this.#tails.get(id) ?? Promise.resolve()
    const current = previous.catch(() => {}).then(async () => {
      this.#assertOpen()
      const before = await this.#load(id)
      if (before.revision !== expectedRevision) throw new DeskError('conflict', '稿纸已被另一端修改，请读取最新版本再写入', before)
      const next = applyOperation(before, op, this.#idFactory)
      await this.#persistence.write(id, structuredClone(next))
      this.#loaded.set(id, Promise.resolve(next))
      for (const listener of [...(this.#listeners.get(id) ?? [])]) listener(null, next)
      return structuredClone(next)
    })
    this.#tails.set(id, current)
    current.finally(() => { if (this.#tails.get(id) === current) this.#tails.delete(id) }).catch(() => {})
    return current
  }

  async watch(id, revision, { signal, timeoutMs = 20000 } = {}) {
    integer(revision, 0, Number.MAX_SAFE_INTEGER, 'revision')
    integer(timeoutMs, 1, 30000, 'timeoutMs')
    signal?.throwIfAborted()
    const initial = await this.read(id)
    signal?.throwIfAborted()
    if (initial.revision !== revision) return initial
    return new Promise((resolve, reject) => {
      let finished = false
      const listeners = this.#listeners.get(id) ?? new Set()
      this.#listeners.set(id, listeners)
      const finish = (error, value) => {
        if (finished) return
        finished = true
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        listeners.delete(onChange)
        if (!listeners.size) this.#listeners.delete(id)
        if (error) reject(error)
        else resolve(structuredClone(value))
      }
      const onAbort = () => finish(signal.reason ?? new DOMException('Aborted', 'AbortError'))
      const onChange = (error, value) => { if (error || value.revision !== revision) finish(error, value) }
      const timer = setTimeout(() => this.read(id).then(value => finish(null, value), finish), timeoutMs)
      listeners.add(onChange)
      signal?.addEventListener('abort', onAbort, { once: true })
      if (signal?.aborted) onAbort()
      // Recheck after subscribing so a write between the first read and
      // listener registration cannot leave a client waiting on a missed event.
      this.read(id).then(value => onChange(null, value), finish)
    })
  }

  async close() {
    this.#closed = true
    for (const listeners of this.#listeners.values()) for (const listener of [...listeners]) listener(new DeskError('closed', '稿纸服务已关闭'))
    this.#listeners.clear()
    await Promise.allSettled([...this.#tails.values()])
    this.#loaded.clear()
  }
}
