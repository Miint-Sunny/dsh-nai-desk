import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
function observable(initial) {
  let value = initial
  const listeners = new Set()
  return { getSnapshot: () => value, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) }, set(next) { value = next; for (const fn of [...listeners]) fn() }, count: () => listeners.size }
}

test('built client offers the right tab only for the selected NAI5 session and releases it cleanly', () => {
  let plugin, styleRemoved = false
  const document = { createElement: () => ({ dataset: {}, remove() { styleRemoved = true } }), head: { append() {} } }
  const context = { window: { __ModuleLoader__: { load({ id, factory }) { assert.equal(id, require('../package.json').name); plugin = factory(require) } } }, document, console, AbortController, structuredClone, setTimeout, clearTimeout }
  vm.runInNewContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), context)
  const current = observable({ key: 'one' })
  const list = observable({ byId: { one: { projectionValues: { agentPreset: 'standard' } } } })
  const tabs = new Map(), cleanups = [], slots = []
  const ctx = {
    uiSession: { adapter: { current } }, sessions: { list },
    sidebarRightTabs: { register(def) { tabs.set(def.kind, def); return () => tabs.delete(def.kind) } },
    slots: { inject(_name, callback) { cleanups.push(callback()) }, register(meta, component) { slots.push({ meta, component }); return () => {} } },
    effect(factory) { const cleanup = factory(); cleanups.push(cleanup); return cleanup },
  }
  plugin.apply(ctx)
  assert.equal(tabs.size, 0)
  list.set({ byId: { one: { projectionValues: { agentPreset: 'nai5-prompting' } } } })
  assert.equal(tabs.get('nai-desk').keepMounted, true)
  assert.equal(tabs.get('nai-desk').guide.length, 1)
  const body = slots.find(s => s.meta.name === 'sidebar.right.pane.tab')
  assert.equal(body.meta.inject('one').sessionId, 'one')
  const title = slots.find(s => s.meta.name === 'sidebar.right.pane.tab.title')
  assert.equal(title.meta.key, body.meta.key)
  assert.equal(title.meta.inject('one').sessionId, 'one')
  current.set({ key: 'other' })
  assert.equal(tabs.size, 0)
  for (const cleanup of cleanups.reverse()) cleanup?.()
  assert.equal(current.count(), 0)
  assert.equal(list.count(), 0)
  assert.equal(styleRemoved, true)
})
