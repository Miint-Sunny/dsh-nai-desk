import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DeskStore, validateRecord } from '../src/desk.js'
import { createDeskHandler, API_PATH } from '../src/host-api.js'

test('API documentation examples parse and execute against the current contract', async () => {
  const markdown = readFileSync(new URL('../docs/api.md', import.meta.url), 'utf8')
  const examples = [...markdown.matchAll(/```json\n([\s\S]*?)\n```/g)].map(match => JSON.parse(match[1]))
  assert.ok(examples.length >= 5)
  const records = new Map(), histories = new Map()
  const store = new DeskStore({ persistence: { read: id => records.get(id), write: (id, value) => records.set(id, value), readHistory: id => histories.get(id), writeHistory: (id, value) => histories.set(id, value) } })
  const handler = createDeskHandler({ store, isNaiSession: async id => id === 'session-id' })
  await store.mutate('session-id', 0, { type: 'set_main', text: 'outdoors, soft lighting' })
  try {
    for (const value of examples) {
      if (value.schemaVersion) validateRecord(value, value.sessionId)
      if (value.error?.current) validateRecord(value.error.current, value.error.current.sessionId)
      if (!value.action) continue
      // Earlier examples merge into one history step, so read a step that exists now.
      if (value.action === 'version') value.revision = (await store.history('session-id')).steps.at(-1).revision
      const response = handler(new Request(`http://example.test${API_PATH}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) }))
      if (value.action === 'watch') await store.mutate('session-id', (await store.read('session-id')).revision, { type: 'set_uc', text: 'example' })
      const result = await response
      assert.equal(result.status, 200)
      const body = await result.json()
      if (value.action === 'history') assert.ok(Array.isArray(body.steps) && body.steps.length > 0 && body.steps.every(step => step.state === undefined))
      else if (value.action === 'version') validateRecord({ schemaVersion: 1, ...body }, 'session-id')
      else validateRecord(body, 'session-id')
    }
  } finally { await store.close() }
})
