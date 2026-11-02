import test from 'node:test'
import assert from 'node:assert/strict'
import { DeskStore } from '../src/desk.js'
import { createDeskTools } from '../src/tools.js'

function setup() {
  const records = new Map()
  const store = new DeskStore({ persistence: { read: id => records.get(id), write: (id, value) => records.set(id, value) } })
  const tools = createDeskTools(store)
  const run = (name, args = {}, sessionId = 'model-session', signal) => tools.find(t => t.name === name).execute(args, { agent: { session: { id: sessionId } }, signal })
  return { store, tools, run }
}

test('tool catalog is limited to desk fields, has strict schemas and no caller-selected session', () => {
  const { tools } = setup()
  assert.deepEqual(tools.map(t => t.name), ['desk_read', 'desk_set_main', 'desk_set_uc', 'desk_set_character', 'desk_remove_character', 'desk_move_character'])
  for (const tool of tools) {
    assert.equal(tool.parameters.additionalProperties, false)
    assert.equal(tool.parameters.properties.sessionId, undefined)
    assert.equal(tool.parameters.properties.session_id, undefined)
    assert.equal(tool.isConcurrencySafe(), tool.name === 'desk_read')
    assert.doesNotMatch(JSON.stringify(tool.output.schema), /"(?:minimum|maximum|anyOf)"/)
    if (tool.name !== 'desk_read') assert.ok(tool.parameters.required.includes('expected_revision'))
  }
})

test('model reads user changes and all writes affect only the invoking session', async () => {
  const { store, run } = setup()
  await store.mutate('model-session', 0, { type: 'set_main', text: 'user edits\nremain' })
  assert.equal((await run('desk_read')).main, 'user edits\nremain')
  const result = await run('desk_set_uc', { expected_revision: 1, text: 'negative' })
  assert.equal(result.uc, 'negative')
  assert.equal((await store.read('other')).uc, '')
  await assert.rejects(run('desk_set_main', { expected_revision: 0, text: 'stale' }), { code: 'conflict' })
})

test('character tool updates supplied fields only, appends in order and supports reorder/removal', async () => {
  const { run } = setup()
  let s = await run('desk_set_character', { expected_revision: 0, n: 1, prompt: 'first', uc: 'hat' })
  const id = s.characters[0].id
  s = await run('desk_set_character', { expected_revision: 1, n: 1, prompt: 'first changed', enabled: false })
  assert.equal(s.characters[0].uc, 'hat')
  assert.equal(s.characters[0].id, id)
  s = await run('desk_set_character', { expected_revision: 2, n: 2, prompt: 'second' })
  s = await run('desk_move_character', { expected_revision: 3, n: 1, to: 2 })
  assert.equal(s.characters[1].id, id)
  s = await run('desk_remove_character', { expected_revision: 4, n: 2 })
  assert.equal(s.characters.length, 1)
  assert.equal(s.characters[0].prompt, 'second')
})

test('missing session, cancelled calls and skipped character slots cannot mutate state', async () => {
  const { store, tools, run } = setup()
  await assert.rejects(tools[0].execute({}, {}), { code: 'invalid_input' })
  await assert.rejects(run('desk_set_character', { expected_revision: 0, n: 2, prompt: 'skip' }), { code: 'invalid_input' })
  const abort = new AbortController()
  abort.abort()
  await assert.rejects(run('desk_set_main', { expected_revision: 0, text: 'cancelled' }, 'model-session', abort.signal), { name: 'AbortError' })
  assert.equal((await store.read('model-session')).revision, 0)
})
