import test from 'node:test'
import assert from 'node:assert/strict'
import { DeskStore, DeskError, LIMITS } from '../src/desk.js'

function setup() {
  const records = new Map()
  let failure = false
  const persistence = {
    async read(id) { return structuredClone(records.get(id)) },
    async write(id, value) {
      if (failure) throw new Error('disk unavailable')
      records.set(id, structuredClone(value))
    },
  }
  return { records, persistence, store: new DeskStore({ persistence }), fail() { failure = true } }
}

test('empty session and exact text preservation; returned values are detached', async () => {
  const { store } = setup()
  const empty = await store.read('one')
  assert.deepEqual(empty, { schemaVersion: 1, sessionId: 'one', revision: 0, main: '', uc: '', characters: [] })
  const text = '  1.2::blue sky::,\n\nwhite background,  '
  const state = await store.mutate('one', 0, { type: 'set_main', text })
  assert.equal(state.main, text)
  state.main = 'outside change'
  assert.equal((await store.read('one')).main, text)
  assert.equal((await store.read('two')).main, '')
})

test('characters retain identity, negative text and position across patch/reorder/disable', async () => {
  const { store } = setup()
  let s = await store.mutate('one', 0, { type: 'add_character', character: { name: 'First', prompt: 'girl', uc: 'hat', position: { x: 0, y: 1 } } })
  const first = s.characters[0].id
  s = await store.mutate('one', s.revision, { type: 'add_character', character: { name: 'Second', prompt: 'boy' } })
  const second = s.characters[1].id
  s = await store.mutate('one', s.revision, { type: 'set_character', id: first, patch: { prompt: 'girl, coat', enabled: false } })
  assert.equal(s.characters[0].uc, 'hat')
  assert.deepEqual(s.characters[0].position, { x: 0, y: 1 })
  s = await store.mutate('one', s.revision, { type: 'move_character', id: first, index: 1 })
  assert.deepEqual(s.characters.map(c => c.id), [second, first])
  assert.equal(s.characters[1].enabled, false)
  assert.equal(s.characters[1].prompt, 'girl, coat')
  s = await store.mutate('one', s.revision, { type: 'set_character', id: first, patch: { position: null } })
  assert.equal(s.characters[1].position, undefined)
})

test('concurrent mutations have exactly one winner; conflict includes current snapshot', async () => {
  const { store } = setup()
  const results = await Promise.allSettled([
    store.mutate('one', 0, { type: 'set_main', text: 'first' }),
    store.mutate('one', 0, { type: 'set_main', text: 'second' }),
  ])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  const rejected = results.find(r => r.status === 'rejected').reason
  assert.equal(rejected.code, 'conflict')
  assert.equal(rejected.current.revision, 1)
  assert.equal((await store.read('one')).main, 'first')
})

test('removed id cannot redirect a late edit to a different character; restore preserves id', async () => {
  const { store } = setup()
  let s = await store.mutate('one', 0, { type: 'add_character', character: { prompt: 'first' } })
  const removed = structuredClone(s.characters[0])
  s = await store.mutate('one', 1, { type: 'add_character', character: { prompt: 'second' } })
  s = await store.mutate('one', 2, { type: 'remove_character', id: removed.id })
  await assert.rejects(store.mutate('one', 3, { type: 'set_character', id: removed.id, patch: { prompt: 'late' } }), { code: 'not_found' })
  assert.equal((await store.read('one')).characters[0].prompt, 'second')
  s = await store.mutate('one', 3, { type: 'add_character', character: removed, index: 0 })
  assert.equal(s.characters[0].id, removed.id)
  assert.equal(s.characters[0].prompt, 'first')
})

test('successful writes survive new store; failed persistence does not publish new revision', async () => {
  const env = setup()
  await env.store.mutate('one', 0, { type: 'set_main', text: 'saved' })
  assert.equal((await new DeskStore({ persistence: env.persistence }).read('one')).main, 'saved')
  env.fail()
  await assert.rejects(env.store.mutate('one', 1, { type: 'set_main', text: 'lost' }), /disk unavailable/)
  assert.equal((await env.store.read('one')).main, 'saved')
  assert.equal((await env.store.read('one')).revision, 1)
})

test('watch resolves after durable change, immediate catch-up, cancellation and timeout', async () => {
  const { store } = setup()
  const controller = new AbortController()
  const waiting = store.watch('one', 0, { signal: controller.signal, timeoutMs: 1000 })
  await store.mutate('one', 0, { type: 'set_uc', text: 'example' })
  assert.equal((await waiting).uc, 'example')
  assert.equal((await store.watch('one', 0, { timeoutMs: 100 })).revision, 1)
  const abort = new AbortController()
  const cancel = store.watch('one', 1, { signal: abort.signal, timeoutMs: 1000 })
  abort.abort()
  await assert.rejects(cancel, { name: 'AbortError' })
  assert.equal((await store.watch('one', 1, { timeoutMs: 5 })).revision, 1)
})

test('invalid input, wrong sessions and oversized fields fail without changing state', async () => {
  const { store } = setup()
  for (const id of ['../private', '', 'a/b', '\u0000']) await assert.rejects(store.read(id), { code: 'invalid_input' })
  for (const operation of [
    { type: 'set_main', text: 1 },
    { type: 'set_main', text: 'a'.repeat(LIMITS.fieldCharacters + 1) },
    { type: 'add_character', character: { prompt: 'x', enabled: 'yes' } },
    { type: 'add_character', character: { prompt: 'x', position: { x: 2, y: 0 } } },
    { type: 'unknown' },
    { type: 'set_main', text: 'x', extra: true },
  ]) await assert.rejects(store.mutate('one', 0, operation), DeskError)
  await assert.rejects(store.mutate('one', undefined, { type: 'set_main', text: 'x' }), { code: 'invalid_input' })
  assert.equal((await store.read('one')).revision, 0)
})

test('character limit and duplicate id are rejected atomically', async () => {
  const { store } = setup()
  let s = await store.read('one')
  for (let i = 0; i < LIMITS.characters; i++) s = await store.mutate('one', s.revision, { type: 'add_character', character: { prompt: String(i) } })
  await assert.rejects(store.mutate('one', s.revision, { type: 'add_character', character: { prompt: 'extra' } }), { code: 'limit_exceeded' })
  assert.equal((await store.read('one')).characters.length, LIMITS.characters)
  const other = await store.mutate('two', 0, { type: 'add_character', character: { prompt: 'x', id: 'same-id' } })
  await assert.rejects(store.mutate('two', other.revision, { type: 'add_character', character: { prompt: 'y', id: 'same-id' } }), { code: 'invalid_input' })
})

test('incompatible persisted records are rejected without writing a replacement', async () => {
  const { store, records } = setup()
  records.set('one', { schemaVersion: 99, main: 'unrecognized saved work' })
  await assert.rejects(store.read('one'), { code: 'invalid_record' })
  assert.equal(records.get('one').main, 'unrecognized saved work')
})
