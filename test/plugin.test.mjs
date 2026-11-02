import test from 'node:test'
import assert from 'node:assert/strict'
import { apply, inject, draftDomain } from '../src/host.js'
import * as toolPlugin from '../src/tools-plugin.js'

function context() {
  const records = new Map(), history = new Map(), routes = [], cleanups = [], definitions = []
  let closed = 0, leases = 0
  const ctx = {
    storageDomain: { async open(spec) {
      assert.ok(['nai_desk', 'nai_desk_history'].includes(spec.name))
      const store = spec.name === 'nai_desk' ? records : history
      return { table: () => ({ get: id => store.get(id), put: async (id, value) => store.set(id, value) }), close: async () => { closed++ } }
    } },
    sessionQuery: { async observeSession(id) { return { projections: { values: { agentPreset: id === 'nai' ? 'nai5-prompting' : 'standard' } }, [Symbol.dispose]() { leases++ } } } },
    connection: { fetch: { register(route) { routes.push(route); return () => { routes.splice(routes.indexOf(route), 1) } } } },
    reflect: { provide(name, value) { ctx[name] = value; return () => { delete ctx[name] } } },
    inject(names, callback) {
      const owned = []
      if (names.every(name => ctx[name])) callback({ ...ctx, effect(factory) { const release = factory(); owned.push(release); return release } })
      let disposed = false
      return { async dispose() { if (disposed) return; disposed = true; for (const release of owned.reverse()) await release?.() } }
    },
    tools: { register(def) { definitions.push(def); return () => { definitions.splice(definitions.indexOf(def), 1) } } },
    effect(factory) { const cleanup = factory(); cleanups.push(cleanup); return cleanup },
  }
  return { ctx, routes, definitions, records, async dispose() { for (const cleanup of cleanups.reverse()) await cleanup?.() }, counts: () => ({ closed, leases }) }
}

test('host uses storageDomain and authenticated Connection, publishes one shared service', async () => {
  const env = context()
  assert.ok(!inject.includes('connection'))
  assert.ok(inject.includes('storageDomain'))
  assert.ok(!inject.includes('webServer'))
  await apply(env.ctx)
  assert.equal(env.routes.length, 1)
  assert.equal(env.routes[0].path, '/api/nai-desk/v1')
  assert.deepEqual(env.routes[0].methods, ['POST'])
  const req = id => new Request('http://example.test/api/nai-desk/v1', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'read', sessionId: id }) })
  assert.equal((await env.routes[0].fetch(req('nai'))).status, 200)
  assert.equal((await env.routes[0].fetch(req('standard'))).status, 403)
  assert.equal(env.counts().leases, 2)
  await env.dispose()
  assert.equal(env.ctx.naiDesk, undefined)
  assert.equal(env.routes.length, 0)
  assert.equal(env.counts().closed, 2)
})

test('preset child registers tools only in its supplied context and cleans them up', async () => {
  const env = context()
  await apply(env.ctx)
  assert.equal(env.definitions.length, 0)
  toolPlugin.apply(env.ctx)
  assert.equal(env.definitions.length, 6)
  await env.dispose()
  assert.equal(env.definitions.length, 0)
})

test('persisted record schema rejects bad versions and preserves raw text', () => {
  const schema = draftDomain.tables.drafts.valueSchema
  const good = { schemaVersion: 1, sessionId: 's', revision: 0, main: '\nexact  ', uc: '', characters: [] }
  assert.equal(schema.parse(good).main, good.main)
  assert.equal(schema.safeParse({ ...good, schemaVersion: 2 }).success, false)
  assert.equal(schema.safeParse({ ...good, characters: [{ id: 'x', name: 'x', prompt: '', uc: '', enabled: 'bad' }] }).success, false)
})

test('the draft service still starts when a non-web profile has no Connection', async () => {
  const env = context()
  delete env.ctx.connection
  await apply(env.ctx)
  assert.equal((await env.ctx.naiDesk.read('terminal')).revision, 0)
  assert.equal(env.routes.length, 0)
  await env.dispose()
  assert.equal(env.counts().closed, 2)
})
