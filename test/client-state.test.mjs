import test from 'node:test'
import assert from 'node:assert/strict'
import { DeskStore } from '../src/desk.js'
import { DeskClient } from '../src/client-state.js'

function fixture(t, sessionId = 'one', wrap = request => request) {
  const records = new Map()
  const store = new DeskStore({ persistence: { read: id => records.get(id), write: (id, value) => records.set(id, value) } })
  const request = async (data, signal) => {
    signal?.throwIfAborted()
    if (data.action === 'read') return store.read(data.sessionId)
    if (data.action === 'watch') return store.watch(data.sessionId, data.revision, { signal })
    return store.mutate(data.sessionId, data.expectedRevision, data.operation)
  }
  const client = new DeskClient({ sessionId, request: wrap(request), autoSaveMs: null, watch: false })
  t.after(() => client.close())
  return { store, client, request }
}

test('local edits render immediately then reach the shared store without formatting', async t => {
  const { store, client } = fixture(t)
  await client.start()
  client.edit('main', '  local\n1.2::blue::  ')
  assert.equal(client.getSnapshot().draft.main, '  local\n1.2::blue::  ')
  assert.equal(client.getSnapshot().pending, 1)
  await client.flush()
  assert.equal((await store.read('one')).main, '  local\n1.2::blue::  ')
  assert.equal(client.getSnapshot().pending, 0)
})

test('unrelated remote changes rebase safely while same-field changes keep a conflict', async t => {
  const { store, client } = fixture(t)
  await client.start()
  client.edit('main', 'local')
  await store.mutate('one', 0, { type: 'set_uc', text: 'remote uc' })
  await client.flush()
  assert.equal((await store.read('one')).main, 'local')
  assert.equal(client.getSnapshot().draft.uc, 'remote uc')
  client.edit('main', 'mine next')
  await store.mutate('one', 2, { type: 'set_main', text: 'theirs next' })
  await client.flush()
  assert.equal(client.getSnapshot().phase, 'conflict')
  assert.equal(client.getSnapshot().draft.main, 'mine next')
  assert.equal(client.getSnapshot().conflicts[0].remote, 'theirs next')
  assert.equal((await store.read('one')).main, 'theirs next')
  await client.resolveConflict('main', 'local', client.getSnapshot().conflicts[0].revision)
  assert.equal((await store.read('one')).main, 'mine next')
})

test('choosing the remote conflict value discards only that local field', async t => {
  const { store, client } = fixture(t)
  await client.start()
  client.edit('main', 'local')
  await store.mutate('one', 0, { type: 'set_main', text: 'remote' })
  await client.flush()
  await client.resolveConflict('main', 'remote', client.getSnapshot().conflicts[0].revision)
  assert.equal(client.getSnapshot().draft.main, 'remote')
  assert.equal(client.getSnapshot().pending, 0)
})

test('typing during an in-flight save keeps the newer input and saves it next', async t => {
  let release, entered
  const gate = new Promise(resolve => { release = resolve })
  const started = new Promise(resolve => { entered = resolve })
  let held = false
  const { store, client } = fixture(t, 'one', request => async (data, signal) => {
    if (data.action === 'mutate' && !held) { held = true; entered(); await gate }
    return request(data, signal)
  })
  await client.start()
  client.edit('main', 'first input')
  const saving = client.flush()
  await started
  client.edit('main', 'newer input')
  release()
  await saving
  assert.equal((await store.read('one')).main, 'newer input')
  assert.equal(client.getSnapshot().draft.main, 'newer input')
})

test('a late response after close cannot publish and cannot reach another session', async t => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  const { client, request } = fixture(t, 'one', request => async (data, signal) => {
    await gate
    return request(data)
  })
  let notifications = 0
  client.subscribe(() => { notifications++ })
  const starting = client.start()
  client.close()
  const atClose = notifications
  const other = new DeskClient({ sessionId: 'two', request, autoSaveMs: null, watch: false })
  t.after(() => other.close())
  await other.start()
  release()
  await starting
  assert.equal(notifications, atClose)
  assert.equal(other.getSnapshot().draft.sessionId, 'two')
  assert.equal(other.getSnapshot().draft.main, '')
})

test('remote removal keeps unsaved character text in an explicit conflict', async t => {
  const { store, client } = fixture(t)
  let s = await store.mutate('one', 0, { type: 'add_character', character: { prompt: 'original' } })
  const id = s.characters[0].id
  await client.start()
  client.edit(`character:${id}:prompt`, 'unsaved character text')
  await store.mutate('one', 1, { type: 'remove_character', id })
  await client.flush()
  const conflict = client.getSnapshot().conflicts[0]
  assert.equal(conflict.local, 'unsaved character text')
  assert.equal(conflict.deleted, true)
  assert.equal((await store.read('one')).characters.length, 0)
})

test('structural commands first flush text; storage failures retain drafts for explicit retry', async t => {
  let fail = true
  const { store, client } = fixture(t, 'one', request => (data, signal) => {
    if (data.action === 'mutate' && fail) return Promise.reject(new Error('offline'))
    return request(data, signal)
  })
  await client.start()
  client.edit('main', 'not lost')
  await assert.rejects(client.command({ type: 'add_character', character: {} }), /offline/)
  assert.equal(client.getSnapshot().draft.main, 'not lost')
  assert.equal(client.getSnapshot().pending, 1)
  fail = false
  await client.command({ type: 'add_character', character: {} })
  const saved = await store.read('one')
  assert.equal(saved.main, 'not lost')
  assert.equal(saved.characters.length, 1)
})

test('pausing before the initial read resolves prevents a hidden panel from starting watch', async t => {
  let release
  let watched = 0
  const gate = new Promise(resolve => { release = resolve })
  const client = new DeskClient({ sessionId: 'one', autoSaveMs: null, request: async (data, signal) => {
    if (data.action === 'read') { await gate; return { schemaVersion: 1, sessionId: 'one', revision: 0, main: '', uc: '', characters: [] } }
    watched++
    return new Promise((resolve,reject) => signal.addEventListener('abort', () => reject(signal.reason), { once:true }))
  } })
  t.after(() => client.close())
  const starting = client.start()
  client.pause()
  release()
  await starting
  assert.equal(watched, 0)
})

test('a second remote edit refreshes the conflict and an old decision cannot overwrite it', async t => {
  const { store, client } = fixture(t)
  await client.start()
  client.edit('main', 'local')
  await store.mutate('one', 0, { type: 'set_main', text: 'remote A' })
  await client.flush()
  const shownRevision = client.getSnapshot().conflicts[0].revision
  await store.mutate('one', 1, { type: 'set_main', text: 'remote B' })
  await client.refresh()
  assert.equal(client.getSnapshot().conflicts[0].remote, 'remote B')
  await client.resolveConflict('main', 'local', shownRevision)
  assert.equal((await store.read('one')).main, 'remote B')
  assert.equal(client.getSnapshot().pending, 1)
  await client.resolveConflict('main', 'local', client.getSnapshot().conflicts[0].revision)
  assert.equal((await store.read('one')).main, 'local')
})

test('text autosave does not disable structural controls before their click event', async t => {
  let release, entered
  const gate = new Promise(resolve => { release = resolve })
  const started = new Promise(resolve => { entered = resolve })
  let held = false
  const { client } = fixture(t, 'one', request => async (data, signal) => {
    if (data.action === 'mutate' && !held) { held = true; entered(); await gate }
    return request(data, signal)
  })
  await client.start()
  client.edit('main', 'typed before clicking')
  const saving = client.flush()
  await started
  assert.equal(client.getSnapshot().phase, 'saving')
  assert.equal(client.getSnapshot().commandPending, false)
  const action = client.command({ type: 'add_character', character: {} })
  assert.equal(client.getSnapshot().commandPending, true)
  release()
  await saving
  await action
  assert.equal(client.getSnapshot().commandPending, false)
})
