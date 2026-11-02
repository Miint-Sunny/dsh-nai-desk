import test from 'node:test'
import assert from 'node:assert/strict'
import { Config, apply, SHADOW_PROVIDER } from '../src/entry.js'

test('the root entry retains legacy isolation defaults and accepts the global desk mode', () => {
  assert.deepEqual(new Config({}), { hideGlobalTools: true, keepGlobalTools: [], hideGlobalSkills: true, keepGlobalSkills: [] })
  assert.deepEqual(new Config({ mode: 'desk' }), { mode: 'desk' })
  assert.equal(typeof SHADOW_PROVIDER, 'string')
})

test('a legacy root entry with isolation disabled does not start another draft domain', () => {
  let opened = false
  const ctx = { storageDomain: { open() { opened = true } } }
  apply(ctx, { hideGlobalTools: false, keepGlobalTools: [], hideGlobalSkills: false, keepGlobalSkills: [] })
  assert.equal(opened, false)
})
