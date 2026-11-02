/** Browser-only synchronization state. It never touches the clipboard or a website. */

function fieldParts(field) {
  if (field === 'main' || field === 'uc') return { key: field }
  const match = /^character:([a-zA-Z0-9_-]+):(prompt|uc|name)$/.exec(field)
  if (!match) throw new Error('无效的稿纸字段')
  return { id: match[1], key: match[2] }
}

export function fieldValue(snapshot, field) {
  const { id, key } = fieldParts(field)
  return id ? snapshot?.characters.find(c => c.id === id)?.[key] : snapshot?.[key]
}

function operationFor(field, value) {
  const { id, key } = fieldParts(field)
  return id ? { type: 'set_character', id, patch: { [key]: value } } : { type: key === 'main' ? 'set_main' : 'set_uc', text: value }
}

function checkedSnapshot(value, sessionId) {
  if (value?.schemaVersion !== 1 || value.sessionId !== sessionId || !Number.isSafeInteger(value.revision) || value.revision < 0 || typeof value.main !== 'string' || typeof value.uc !== 'string' || !Array.isArray(value.characters)) throw new Error('稿纸服务返回了无效或不属于当前会话的内容')
  const ids = new Set()
  for (const c of value.characters) {
    if (!c || typeof c.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(c.id) || ids.has(c.id) || typeof c.prompt !== 'string' || typeof c.uc !== 'string' || typeof c.name !== 'string' || typeof c.enabled !== 'boolean') throw new Error('稿纸服务返回了无效角色栏')
    ids.add(c.id)
  }
  return structuredClone(value)
}

const sleep = (ms, signal) => new Promise(resolve => {
  const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve() }
  const timer = setTimeout(finish, ms)
  signal.addEventListener('abort', finish, { once: true })
  if (signal.aborted) finish()
})

export class DeskClient {
  #sessionId
  #request
  #autoSaveMs
  #allowWatch
  #watchWanted
  #server = null
  #pending = new Map()
  #conflicts = new Map()
  #listeners = new Set()
  #version = 0
  #loading = true
  #saving = false
  #commanding = false
  #error = null
  #closed = false
  #startPromise
  #flushPromise
  #saveTimer
  #watchController
  #controller = new AbortController()
  #state

  constructor({ sessionId, request, autoSaveMs = 180, watch = true }) {
    this.#sessionId = sessionId
    this.#request = request
    this.#autoSaveMs = autoSaveMs
    this.#allowWatch = watch
    this.#watchWanted = watch
    this.#publish()
  }

  getSnapshot = () => this.#state
  subscribe = listener => { this.#listeners.add(listener); return () => this.#listeners.delete(listener) }

  #publish() {
    if (this.#closed) return
    const draft = this.#server ? structuredClone(this.#server) : null
    if (draft) for (const [field, pending] of this.#pending) {
      const { id, key } = fieldParts(field)
      if (!id) draft[key] = pending.value
      else {
        const target = draft.characters.find(c => c.id === id)
        if (target) target[key] = pending.value
      }
    }
    this.#state = {
      phase: this.#loading ? 'loading' : this.#conflicts.size ? 'conflict' : this.#error ? 'error' : this.#saving ? 'saving' : 'ready',
      draft,
      server: this.#server,
      pending: this.#pending.size,
      commandPending: this.#commanding,
      conflicts: [...this.#conflicts.values()],
      error: this.#error,
    }
    for (const listener of this.#listeners) listener()
  }

  #adopt(value) {
    if (this.#closed) return
    const snapshot = checkedSnapshot(value, this.#sessionId)
    if (this.#server && snapshot.revision < this.#server.revision) return
    this.#server = snapshot
    for (const [field, conflict] of this.#conflicts) {
      const remote = fieldValue(snapshot, field)
      if (remote !== conflict.remote) this.#conflicts.set(field, {
        ...conflict, remote, deleted: remote === undefined, revision: snapshot.revision,
        notice: '另一端又更新了这一栏，请确认最新内容。',
      })
    }
  }

  #send(data, signal = this.#controller.signal) {
    return this.#request({ ...data, sessionId: this.#sessionId }, signal)
  }

  start() {
    if (!this.#startPromise) this.#startPromise = this.refresh()
    return this.#startPromise
  }

  async refresh() {
    if (this.#closed) return
    try {
      const value = await this.#send({ action: 'read' })
      if (this.#closed) return
      this.#adopt(value)
      this.#error = null
    } catch (error) {
      if (!this.#closed) this.#error = error.message
    } finally {
      this.#loading = false
      this.#publish()
    }
    if (this.#allowWatch && this.#watchWanted) this.resume()
  }

  edit(field, value, { deferSave = false } = {}) {
    if (this.#closed || !this.#server) throw new Error('稿纸尚未准备好')
    if (typeof value !== 'string') throw new Error('提示词必须是文字')
    const current = fieldValue(this.#server, field)
    if (current === undefined) throw new Error('角色栏已不存在')
    const previous = this.#pending.get(field)
    this.#pending.set(field, { value, base: previous ? previous.base : current, version: ++this.#version })
    if (this.#conflicts.has(field)) this.#conflicts.set(field, { ...this.#conflicts.get(field), local: value })
    this.#error = null
    this.#publish()
    clearTimeout(this.#saveTimer)
    if (!deferSave && this.#autoSaveMs !== null) this.#saveTimer = setTimeout(() => { this.flush().catch(() => {}) }, this.#autoSaveMs)
  }

  flush() {
    clearTimeout(this.#saveTimer)
    if (this.#closed) return Promise.resolve()
    if (this.#flushPromise) return this.#flushPromise
    const promise = this.#drain()
    this.#flushPromise = promise
    promise.finally(() => { if (this.#flushPromise === promise) this.#flushPromise = undefined }).catch(() => {})
    return promise
  }

  async #drain() {
    this.#saving = true
    this.#error = null
    this.#publish()
    try {
      while (!this.#closed) {
        const selected = [...this.#pending].find(([field]) => !this.#conflicts.has(field))
        if (!selected) break
        const [field, pending] = selected
        const remote = fieldValue(this.#server, field)
        if (remote === pending.value) { this.#pending.delete(field); continue }
        if (remote === undefined || remote !== pending.base) {
          this.#conflicts.set(field, { field, local: pending.value, remote, deleted: remote === undefined, revision: this.#server.revision })
          continue
        }
        try {
          const updated = await this.#send({ action: 'mutate', expectedRevision: this.#server.revision, operation: operationFor(field, pending.value) })
          if (this.#closed) return
          this.#adopt(updated)
          const latest = this.#pending.get(field)
          if (latest?.version === pending.version) this.#pending.delete(field)
          else if (latest) latest.base = fieldValue(updated, field)
        } catch (error) {
          if (this.#closed) return
          if (error.code === 'conflict' && error.current) { this.#adopt(error.current); continue }
          this.#error = error.message
          throw error
        }
      }
    } finally { this.#saving = false; this.#publish() }
  }

  async resolveConflict(field, choice, shownRevision) {
    const pending = this.#pending.get(field)
    const conflict = this.#conflicts.get(field)
    if (!pending || !conflict) return
    if (shownRevision !== conflict.revision) {
      this.#conflicts.set(field, { ...conflict, notice: '另一端又更新了这一栏，请确认最新内容。' })
      this.#publish()
      return
    }
    if (choice === 'remote') this.#pending.delete(field)
    else if (choice === 'local') {
      const remote = fieldValue(this.#server, field)
      if (remote === undefined) throw new Error('角色已删除；这段未保存文字仍在冲突框中，可先选字保留')
      pending.base = remote
    } else throw new Error('无效的冲突处理方式')
    this.#conflicts.delete(field)
    this.#publish()
    await this.flush()
  }

  async command(operation) {
    if (this.#commanding) throw new Error('上一项角色操作还未完成')
    this.#commanding = true
    this.#publish()
    try {
      await this.flush()
      if (this.#closed) throw new Error('稿纸已关闭')
      if (this.#conflicts.size || this.#pending.size) throw new Error('先处理未保存的文字，再调整角色栏')
      this.#saving = true
      this.#error = null
      this.#publish()
      const next = await this.#send({ action: 'mutate', expectedRevision: this.#server.revision, operation })
      if (this.#closed) return
      this.#adopt(next)
      return next
    } catch (error) {
      if (error.code === 'conflict' && error.current) this.#adopt(error.current)
      this.#error = error.message
      throw error
    } finally { this.#saving = false; this.#commanding = false; this.#publish() }
  }

  pause() { this.#watchWanted = false; this.#watchController?.abort(); this.#watchController = undefined }

  resume() {
    this.#watchWanted = true
    if (this.#closed || !this.#server || !this.#allowWatch || this.#watchController) return
    const controller = new AbortController()
    this.#watchController = controller
    const run = async () => {
      let delay = 500
      while (!controller.signal.aborted && !this.#closed) {
        try {
          const value = await this.#send({ action: 'watch', revision: this.#server.revision }, controller.signal)
          if (controller.signal.aborted || this.#closed) return
          this.#adopt(value)
          this.#error = null
          this.#publish()
          delay = 500
        } catch (error) {
          if (controller.signal.aborted || this.#closed) return
          this.#error = error.message
          this.#publish()
          await sleep(delay, controller.signal)
          delay = Math.min(delay * 2, 15000)
        }
      }
    }
    run().catch(error => { if (!this.#closed) { this.#error = error.message; this.#publish() } })
  }

  close() {
    if (this.#closed) return
    this.#closed = true
    clearTimeout(this.#saveTimer)
    this.pause()
    this.#controller.abort()
    this.#listeners.clear()
  }
}
