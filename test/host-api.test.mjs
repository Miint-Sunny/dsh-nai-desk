import test from 'node:test'
import assert from 'node:assert/strict'
import { DeskStore } from '../src/desk.js'
import { createDeskHandler, API_PATH } from '../src/host-api.js'

function setup() {
  const records = new Map()
  const store = new DeskStore({ persistence: { read: id => records.get(id), write: (id, value) => records.set(id, value) } })
  const handler = createDeskHandler({ store, isNaiSession: async id => id === 'nai-session' })
  const request = body => handler(new Request(`http://example.test${API_PATH}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }))
  return { records, store, handler, request }
}

test('versioned API reads and writes the shared durable draft', async () => {
  const { request, store } = setup()
  assert.equal(API_PATH, '/api/nai-desk/v1')
  const read = await request({ action: 'read', sessionId: 'nai-session' })
  assert.equal(read.status, 200)
  assert.equal(read.headers.get('cache-control'), 'no-store')
  assert.equal((await read.json()).revision, 0)
  const write = await request({ action: 'mutate', sessionId: 'nai-session', expectedRevision: 0, operation: { type: 'set_main', text: 'exact\ntext' } })
  assert.equal(write.status, 200)
  assert.equal((await store.read('nai-session')).main, 'exact\ntext')
})

test('stale API writes return 409 and the current snapshot without mutation', async () => {
  const { request, store } = setup()
  await store.mutate('nai-session', 0, { type: 'set_main', text: 'current' })
  const response = await request({ action: 'mutate', sessionId: 'nai-session', expectedRevision: 0, operation: { type: 'set_main', text: 'old' } })
  assert.equal(response.status, 409)
  const body = await response.json()
  assert.equal(body.error.code, 'conflict')
  assert.equal(body.error.current.main, 'current')
  assert.equal((await store.read('nai-session')).main, 'current')
})

test('other presets are forbidden and leave no persisted record', async () => {
  const { request, records } = setup()
  const response = await request({ action: 'mutate', sessionId: 'standard-session', expectedRevision: 0, operation: { type: 'set_main', text: 'wrong' } })
  assert.equal(response.status, 403)
  assert.equal((await response.json()).error.code, 'wrong_preset')
  assert.equal(records.size, 0)
})

test('reject malformed and oversized input at the boundary', async () => {
  const { handler, request } = setup()
  assert.equal((await handler(new Request(`http://example.test${API_PATH}`))).status, 405)
  assert.equal((await handler(new Request(`http://example.test${API_PATH}`, { method: 'POST', body: '{}' }))).status, 415)
  assert.equal((await handler(new Request(`http://example.test${API_PATH}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' }))).status, 400)
  assert.equal((await request({ action: 'read', sessionId: '../outside' })).status, 400)
  assert.equal((await request({ action: 'read', sessionId: 'nai-session', extra: true })).status, 400)
  assert.equal((await request({ action: 'missing', sessionId: 'nai-session' })).status, 400)
  assert.equal((await request({ action: 'toString', sessionId: 'nai-session' })).status, 400)
  assert.equal((await request({ action: 'read', sessionId: 'nai-session', padding: 'x'.repeat(1024 * 1024) })).status, 413)
})

test('internal persistence errors do not reveal local paths', async () => {
  const store = new DeskStore({ persistence: { read() { throw new Error('/private/secret/path') }, write() {} } })
  const handler = createDeskHandler({ store, isNaiSession: async () => true })
  const response = await handler(new Request(`http://example.test${API_PATH}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'read', sessionId: 'nai-session' }) }))
  assert.equal(response.status, 500)
  assert.doesNotMatch(await response.text(), /private|secret/)
})

test('watch cancellation terminates without writing', async () => {
  const { handler, records } = setup()
  const abort = new AbortController()
  const response = handler(new Request(`http://example.test${API_PATH}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'watch', sessionId: 'nai-session', revision: 0 }), signal: abort.signal }))
  abort.abort()
  assert.equal((await response).status, 499)
  assert.equal(records.size, 0)
})
