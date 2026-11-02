import test from 'node:test'
import assert from 'node:assert/strict'
import { DeskStore, HISTORY } from '../src/desk.js'
import { createDeskTools } from '../src/tools.js'

function setup() {
  const records = new Map(), histories = new Map()
  let clock = 1_000_000
  const store = new DeskStore({
    persistence: {
      read: id => records.get(id), write: (id, value) => records.set(id, structuredClone(value)),
      readHistory: id => histories.get(id), writeHistory: (id, value) => histories.set(id, structuredClone(value)),
    },
    now: () => clock,
  })
  const tools = createDeskTools(store)
  const run = (name, args = {}) => tools.find(t => t.name === name).execute(args, { agent: { session: { id: 's' } } })
  return { store, run, records, histories, tick(ms) { clock += ms } }
}

test('masked spans reach the model only as placeholders and must survive its rewrites', async () => {
  const { store, run } = setup()
  let s = await store.mutate('s', 0, { type: 'add_character', character: { prompt: 'girl, kuzaki yoruko, blue jacket' } })
  const field = `character:${s.characters[0].id}:prompt`
  s = await store.mutate('s', s.revision, { type: 'mask_span', field, text: 'girl, ⟪屏蔽1⟫, blue jacket', token: '⟪屏蔽1⟫', secret: 'kuzaki yoruko' })
  const view = await run('desk_read')
  assert.equal(view.characters[0].prompt, 'girl, ⟪屏蔽1⟫, blue jacket')
  assert.doesNotMatch(JSON.stringify(view), /kuzaki|secrets/)
  await assert.rejects(run('desk_set_character', { expected_revision: s.revision, n: 1, prompt: 'girl, red coat' }), { code: 'masked', message: /⟪屏蔽1⟫/ })
  await assert.rejects(run('desk_set_character', { expected_revision: s.revision, n: 1, prompt: 'girl, ⟪屏蔽1⟫, ⟪屏蔽9⟫' }), { code: 'masked' })
  await assert.rejects(run('desk_remove_character', { expected_revision: s.revision, n: 1 }), { code: 'masked' })
  const written = await run('desk_set_character', { expected_revision: s.revision, n: 1, prompt: '⟪屏蔽1⟫, girl, red coat' })
  assert.equal(written.characters[0].prompt, '⟪屏蔽1⟫, girl, red coat')
  assert.equal((await store.read('s')).secrets['⟪屏蔽1⟫'], 'kuzaki yoruko')
  s = await store.mutate('s', written.revision, { type: 'unmask', token: '⟪屏蔽1⟫' })
  assert.equal(s.characters[0].prompt, 'kuzaki yoruko, girl, red coat')
  assert.equal(s.secrets, undefined)
})

test('whole fields and characters the user masked can be neither read nor written by the model', async () => {
  const { store, run } = setup()
  let s = await store.mutate('s', 0, { type: 'set_main', text: 'secret scene, 2girls' })
  s = await store.mutate('s', s.revision, { type: 'set_mask', field: 'main', masked: true })
  s = await store.mutate('s', s.revision, { type: 'add_character', character: { name: 'Yoruko', prompt: 'kuzaki yoruko', masked: true } })
  const view = await run('desk_read')
  assert.deepEqual(view.masked, { main: true })
  assert.match(view.main, /^⟪整栏已屏蔽，约 20 字⟫$/)
  assert.equal(view.characters[0].masked, true)
  assert.doesNotMatch(JSON.stringify(view), /secret scene|kuzaki|Yoruko/)
  await assert.rejects(run('desk_set_main', { expected_revision: s.revision, text: 'other' }), { code: 'masked' })
  await assert.rejects(run('desk_set_character', { expected_revision: s.revision, n: 1, prompt: 'x' }), { code: 'masked' })
  const moved = await run('desk_set_character', { expected_revision: s.revision, n: 2, prompt: 'boy' })
  assert.equal(moved.characters.length, 2)
  await assert.rejects(run('desk_set_uc', { expected_revision: 0, text: 'x' }), error => !/secret scene/.test(JSON.stringify(error.current)))
})

test('history records who wrote, merges bursts, keeps an earlier baseline and restores as a new step', async () => {
  const { store, run, tick } = setup()
  let s = await store.mutate('s', 0, { type: 'set_main', text: 'mine' })
  tick(1000)
  s = await store.mutate('s', s.revision, { type: 'set_main', text: 'mine, edited' })
  tick(1000)
  await run('desk_set_main', { expected_revision: s.revision, text: 'model one' })
  tick(1000)
  s = await run('desk_set_character', { expected_revision: s.revision + 1, n: 1, prompt: 'girl' })
  let history = await store.history('s')
  assert.deepEqual(history.steps.map(step => [step.source, step.parts]), [['user', ['主提示词']], ['model', ['主提示词', '添加 Character 1']]])
  assert.equal(history.steps.at(-1).revision, s.revision)
  assert.equal(history.steps[0].state, undefined)
  const old = await store.version('s', history.steps[0].revision)
  assert.equal(old.main, 'mine, edited')
  assert.deepEqual(old.characters, [])
  const restored = await store.mutate('s', s.revision, { type: 'restore', revision: history.steps[0].revision })
  assert.equal(restored.main, 'mine, edited')
  assert.equal(restored.characters.length, 0)
  assert.equal(restored.revision, s.revision + 1)
  history = await store.history('s')
  assert.deepEqual(history.steps.at(-1).parts, ['恢复较早版本'])
  assert.equal(history.steps.length, 3)
})

test('drafts written before history existed get one baseline step; history stays bounded', async () => {
  const { store, records, tick } = setup()
  records.set('s', { schemaVersion: 1, sessionId: 's', revision: 7, main: 'old', uc: '', characters: [] })
  let s = await store.read('s')
  for (let i = 0; i < HISTORY.steps + 5; i++) {
    tick(HISTORY.mergeMs.user + 1)
    s = await store.mutate('s', s.revision, { type: 'set_uc', text: `uc ${i}` })
  }
  const { steps } = await store.history('s')
  assert.equal(steps.length, HISTORY.steps)
  assert.equal(steps.at(-1).revision, s.revision)
  const fresh = setup()
  fresh.records.set('s', { schemaVersion: 1, sessionId: 's', revision: 7, main: 'old', uc: '', characters: [] })
  await fresh.store.mutate('s', 7, { type: 'set_main', text: 'new' })
  const first = (await fresh.store.history('s')).steps[0]
  assert.deepEqual([first.source, first.revision, first.at], ['earlier', 7, null])
  assert.equal((await fresh.store.version('s', 7)).main, 'old')
})

test('the editor cannot use the internal replace operation and restore of an unknown step fails cleanly', async () => {
  const { store } = setup()
  await assert.rejects(store.mutate('s', 0, { type: 'replace', state: { main: 'x', uc: '', characters: [] } }), { code: 'invalid_input' })
  await assert.rejects(store.mutate('s', 0, { type: 'restore', revision: 99 }), { code: 'not_found' })
  await assert.rejects(store.mutate('s', 0, { type: 'mask_span', field: 'main', text: 'no token', token: '⟪屏蔽1⟫', secret: 'x' }), { code: 'invalid_input' })
})
