import { randomUUID } from 'node:crypto'
import { MASK_TOKEN, TOKEN_PATTERN as tokenPattern, maskToken, tokensIn } from './mask.js'

export { MASK_TOKEN, maskToken, tokensIn }

export const LIMITS = Object.freeze({ characters: 22, fieldCharacters: 32768, nameCharacters: 128, recordBytes: 1024 * 1024, secrets: 200 })
export const HISTORY = Object.freeze({ steps: 60, bytes: 4 * 1024 * 1024, mergeMs: Object.freeze({ model: 45000, user: 90000 }) })
const sources = ['user', 'model']

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
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) invalid('标识格式无效：使用 1–128 位 ASCII 字母、数字、下划线或连字符。')
  return value
}

function text(value, label, max = LIMITS.fieldCharacters) {
  if (typeof value !== 'string') invalid(`${label} 必须是字符串。`)
  if (value.length > max) throw new DeskError('limit_exceeded', `${label} 超过长度上限 ${max}，请缩短后提交。`)
  return value
}

function integer(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max) invalid(`${label} 必须是 ${min} 到 ${max} 之间的安全整数。`)
  return value
}

function position(value) {
  object(value, ['x', 'y'], 'position')
  for (const key of ['x', 'y']) if (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || value[key] < 0 || value[key] > 1) invalid('position.x 和 position.y 必须是 0 到 1 之间的有限数值。')
  return { x: value.x, y: value.y }
}

const characterFields = ['id', 'name', 'prompt', 'uc', 'enabled', 'position', 'masked']

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
  if (value.masked !== undefined && typeof value.masked !== 'boolean') invalid('masked 必须是布尔值')
  if (value.masked) result.masked = true
  return result
}

function mask(value) {
  object(value, ['main', 'uc'], 'mask')
  for (const key of Object.keys(value)) if (value[key] !== true) invalid('mask 只记录值为 true 的字段')
  return value
}

function secrets(value) {
  if (!isObject(value)) invalid('secrets 必须是对象')
  const entries = Object.entries(value)
  if (entries.length > LIMITS.secrets) throw new DeskError('limit_exceeded', `屏蔽内容最多 ${LIMITS.secrets} 段。`)
  for (const [token, secret] of entries) {
    if (!tokenPattern.test(token)) invalid('屏蔽占位格式无效')
    if (!text(secret, '屏蔽内容').trim()) invalid('屏蔽内容不能为空')
  }
  return value
}

/** Field ids shared with the editor: main, uc, character:<id>:prompt and character:<id>:uc. */
function textField(state, field) {
  if (field === 'main' || field === 'uc') return { owner: state, key: field }
  const match = typeof field === 'string' ? /^character:([a-zA-Z0-9_-]{1,128}):(prompt|uc)$/.exec(field) : null
  if (!match) invalid('field 必须是 main、uc 或 character:<id>:prompt|uc')
  const owner = state.characters.find(c => c.id === match[1])
  if (!owner) throw new DeskError('not_found', '该角色不存在，请重新读取稿纸后操作。')
  return { owner, key: match[2] }
}

function withinSize(state) {
  if (Buffer.byteLength(JSON.stringify(state)) > LIMITS.recordBytes) throw new DeskError('limit_exceeded', '稿纸序列化大小超过 1 MiB，请减少内容后提交。')
  return state
}

/** Validate stored data without repairing, truncating or replacing the user's text. */
export function validateRecord(value, id) {
  try {
    object(value, ['schemaVersion', 'sessionId', 'revision', 'main', 'uc', 'characters', 'mask', 'secrets', 'updatedBy'], 'record')
    if (value.schemaVersion !== 1 || value.sessionId !== id) invalid('稿纸格式版本或会话标识不匹配。')
    integer(value.revision, 0, Number.MAX_SAFE_INTEGER, 'revision')
    text(value.main, '主提示词')
    text(value.uc, '总 UC')
    if (!Array.isArray(value.characters) || value.characters.length > LIMITS.characters) invalid('角色列表无效')
    if (value.mask !== undefined) mask(value.mask)
    if (value.secrets !== undefined) secrets(value.secrets)
    if (value.updatedBy !== undefined && !sources.includes(value.updatedBy)) invalid('updatedBy 无效')
    const ids = new Set()
    for (const c of value.characters) {
      for (const key of ['id', 'name', 'prompt', 'uc', 'enabled']) if (c?.[key] === undefined) invalid(`角色缺少 ${key}`)
      character(c, 1, () => { throw new Error('stored id is missing') })
      if (ids.has(c.id)) invalid('角色 id 重复')
      ids.add(c.id)
    }
    return structuredClone(withinSize(value))
  } catch (error) {
    throw new DeskError('invalid_record', `稿纸数据不符合当前格式，无法读取：${error.message}`)
  }
}

const emptyRecord = id => ({ schemaVersion: 1, sessionId: id, revision: 0, main: '', uc: '', characters: [] })

function applyOperation(state, operation, idFactory, internal = false) {
  if (!isObject(operation)) invalid('operation 必须是对象')
  const next = structuredClone(state)
  const find = id => {
    sessionKey(id)
    const index = next.characters.findIndex(c => c.id === id)
    if (index < 0) throw new DeskError('not_found', '该角色不存在，请重新读取稿纸后操作。')
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
      if (next.characters.length >= LIMITS.characters) throw new DeskError('limit_exceeded', `稿纸最多包含 ${LIMITS.characters} 个角色。`)
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
        } else if (key === 'masked') {
          if (typeof value !== 'boolean') invalid('masked 必须是布尔值')
          if (value) target.masked = true
          else delete target.masked
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
    case 'set_mask': {
      object(operation, ['type', 'field', 'masked'], 'operation')
      if (!['main', 'uc'].includes(operation.field)) invalid('field 只能是 main 或 uc')
      if (typeof operation.masked !== 'boolean') invalid('masked 必须是布尔值')
      const flags = { ...next.mask }
      if (operation.masked) flags[operation.field] = true
      else delete flags[operation.field]
      if (Object.keys(flags).length) next.mask = flags
      else delete next.mask
      break
    }
    case 'mask_span': {
      object(operation, ['type', 'field', 'text', 'token', 'secret'], 'operation')
      if (typeof operation.token !== 'string' || !tokenPattern.test(operation.token)) invalid('token 格式无效')
      if (next.secrets?.[operation.token] !== undefined) invalid('该屏蔽占位已被使用，请重新读取稿纸。')
      if (!text(operation.secret, '屏蔽内容').trim()) invalid('屏蔽内容不能为空')
      const value = text(operation.text, '提示词')
      if (!value.includes(operation.token)) invalid('text 中缺少新的屏蔽占位')
      const { owner, key } = textField(next, operation.field)
      owner[key] = value
      next.secrets = secrets({ ...next.secrets, [operation.token]: operation.secret })
      break
    }
    case 'unmask': {
      object(operation, ['type', 'token'], 'operation')
      const secret = next.secrets?.[operation.token]
      if (secret === undefined) throw new DeskError('not_found', '该屏蔽内容不存在，请重新读取稿纸。')
      const reveal = (value, label) => text(value.split(operation.token).join(secret), label)
      next.main = reveal(next.main, '主提示词')
      next.uc = reveal(next.uc, '总 UC')
      for (const c of next.characters) { c.prompt = reveal(c.prompt, '角色正向'); c.uc = reveal(c.uc, '角色 UC') }
      delete next.secrets[operation.token]
      if (!Object.keys(next.secrets).length) delete next.secrets
      break
    }
    case 'replace': {
      if (!internal) invalid('不支持该稿纸操作。')
      for (const key of ['main', 'uc', 'characters', 'mask', 'secrets']) {
        if (operation.state[key] === undefined) delete next[key]
        else next[key] = structuredClone(operation.state[key])
      }
      break
    }
    default: invalid('不支持该稿纸操作。')
  }
  next.revision = integer(state.revision + 1, 1, Number.MAX_SAFE_INTEGER, 'revision')
  return withinSize(next)
}

const contentOf = state => structuredClone(Object.fromEntries(['main', 'uc', 'characters', 'mask', 'secrets'].filter(key => state[key] !== undefined).map(key => [key, state[key]])))

/** Short labels for what changed between two drafts, used as the history step title. */
export function describeChange(before, after) {
  const parts = []
  if (before.main !== after.main) parts.push('主提示词')
  if (before.uc !== after.uc) parts.push('UC')
  const label = (c, i) => c.name || `角色 ${i + 1}`
  const old = new Map(before.characters.map((c, i) => [c.id, c]))
  after.characters.forEach((c, i) => {
    const previous = old.get(c.id)
    if (!previous) parts.push(`添加 ${label(c, i)}`)
    else if (JSON.stringify(previous) !== JSON.stringify(c)) parts.push(label(c, i))
  })
  const kept = new Set(after.characters.map(c => c.id))
  before.characters.forEach((c, i) => { if (!kept.has(c.id)) parts.push(`删除 ${label(c, i)}`) })
  const order = list => list.filter(c => old.has(c.id) && kept.has(c.id)).map(c => c.id).join()
  if (order(before.characters) !== order(after.characters)) parts.push('角色顺序')
  if (JSON.stringify(before.mask ?? {}) !== JSON.stringify(after.mask ?? {}) || JSON.stringify(Object.keys(before.secrets ?? {})) !== JSON.stringify(Object.keys(after.secrets ?? {}))) parts.push('屏蔽设置')
  return [...new Set(parts)]
}

function validHistory(value, id) {
  if (!isObject(value) || value.sessionId !== id || !Array.isArray(value.steps)) return { sessionId: id, steps: [] }
  return structuredClone(value)
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
  #history = new Map()
  #now
  #closed = false

  constructor({ persistence, idFactory = randomUUID, now = Date.now }) {
    this.#persistence = persistence
    this.#idFactory = idFactory
    this.#now = now
  }

  #assertOpen() {
    if (this.#closed) throw new DeskError('closed', '稿纸服务已关闭，请重新连接后重试。')
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

  #loadHistory(id) {
    if (!this.#history.has(id)) {
      const loading = Promise.resolve().then(() => this.#persistence.readHistory?.(id)).then(value => validHistory(value, id))
      this.#history.set(id, loading)
      loading.catch(() => { if (this.#history.get(id) === loading) this.#history.delete(id) })
    }
    return this.#history.get(id)
  }

  /** Step list without draft bodies; the last step is the current draft. */
  async history(id) {
    this.#assertOpen()
    sessionKey(id)
    await this.#tails.get(id)?.catch(() => {})
    const { steps } = await this.#loadHistory(id)
    return { sessionId: id, revision: (await this.#load(id)).revision, steps: steps.map(({ state, ...meta }) => structuredClone(meta)) }
  }

  async version(id, revision) {
    this.#assertOpen()
    sessionKey(id)
    integer(revision, 0, Number.MAX_SAFE_INTEGER, 'revision')
    const step = (await this.#loadHistory(id)).steps.find(item => item.revision === revision)
    if (!step) throw new DeskError('not_found', '该版本已不在版本历史中，请刷新后重试。')
    return { sessionId: id, revision, ...structuredClone(step.state) }
  }

  /** Best effort: a history failure never undoes or blocks the draft write that already landed. */
  async #record(id, before, after, source, restored) {
    if (!this.#persistence.writeHistory) return
    try {
      const history = structuredClone(await this.#loadHistory(id))
      const { steps } = history
      const at = this.#now()
      if (!steps.length && before.revision > 0) steps.push({ revision: before.revision, at: null, source: 'earlier', parts: [], state: contentOf(before) })
      const parts = restored ? ['恢复较早版本'] : describeChange(before, after)
      const last = steps.at(-1)
      if (!restored && last?.source === source && !last.restored && last.at !== null && at - last.at < HISTORY.mergeMs[source]) {
        Object.assign(last, { revision: after.revision, at, parts: [...new Set([...last.parts, ...parts])].slice(0, 12), state: contentOf(after) })
      } else steps.push({ revision: after.revision, at, source, parts, ...(restored ? { restored: true } : {}), state: contentOf(after) })
      while (steps.length > 1 && (steps.length > HISTORY.steps || Buffer.byteLength(JSON.stringify(history)) > HISTORY.bytes)) steps.shift()
      await this.#persistence.writeHistory(id, history)
      this.#history.set(id, Promise.resolve(history))
    } catch {
      this.#history.delete(id)
    }
  }

  async mutate(id, expectedRevision, operation, { source = 'user' } = {}) {
    this.#assertOpen()
    sessionKey(id)
    integer(expectedRevision, 0, Number.MAX_SAFE_INTEGER, 'expectedRevision')
    if (!sources.includes(source)) invalid('source 只能是 user 或 model')
    let op
    try { op = structuredClone(operation) } catch { invalid('operation 必须是可序列化数据') }
    const previous = this.#tails.get(id) ?? Promise.resolve()
    const current = previous.catch(() => {}).then(async () => {
      this.#assertOpen()
      const before = await this.#load(id)
      if (before.revision !== expectedRevision) throw new DeskError('conflict', '稿纸已被修改，请重新读取后提交。', before)
      const restored = isObject(op) && op.type === 'restore'
      let next
      if (restored) {
        object(op, ['type', 'revision'], 'operation')
        const { revision, sessionId, ...state } = await this.version(id, op.revision)
        next = validateRecord({ ...applyOperation(before, { type: 'replace', state }, this.#idFactory, true), updatedBy: source }, id)
      } else next = { ...applyOperation(before, op, this.#idFactory), updatedBy: source }
      await this.#persistence.write(id, structuredClone(next))
      this.#loaded.set(id, Promise.resolve(next))
      for (const listener of [...(this.#listeners.get(id) ?? [])]) listener(null, next)
      await this.#record(id, before, next, source, restored)
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
    for (const listeners of this.#listeners.values()) for (const listener of [...listeners]) listener(new DeskError('closed', '稿纸服务已关闭，请重新连接后重试。'))
    this.#listeners.clear()
    await Promise.allSettled([...this.#tails.values()])
    this.#loaded.clear()
    this.#history.clear()
  }
}
