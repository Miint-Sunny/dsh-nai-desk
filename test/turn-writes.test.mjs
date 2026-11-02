import test from 'node:test'
import assert from 'node:assert/strict'
import { deskTurnDefinition as definition, TURN_DATA_KEY } from '../src/turn-writes.js'

const call = (callId, name, args, turn = 3) => ({ type: 'tool/call', seq: 10, data: { turn, callId, name, arguments: JSON.stringify(args) } })
const result = (callId, seq, isError = false, turn = 3) => ({ type: 'tool/result', seq, surfaceOp: 'append', data: { turn, message: { source: { callId }, isError, content: [] } } })

function replay(events) {
  let state
  for (const event of events) {
    const match = definition.match(event)
    if (!match) continue
    state = match.role === 'start' ? definition.start({}, { event }) : definition.update({ state }, { event })
  }
  return state
}

test('a turn publishes only its successful draft writes, labelled by field', () => {
  const state = replay([
    { type: 'turn/start', seq: 1, data: { turn: 3 } },
    call('a', 'desk_read', {}),
    call('b', 'desk_set_main', { text: 'x' }), result('b', 11),
    call('c', 'desk_set_character', { n: 2, prompt: 'girl' }), result('c', 12),
    call('d', 'desk_set_uc', { text: 'y' }), result('d', 13, true),
    result('a', 14),
  ])
  assert.deepEqual(state.writes, [{ seq: 11, label: '主提示词' }, { seq: 12, label: '角色 2' }])
  const data = definition.buildLocationData({ state }, 'turn')
  assert.deepEqual(data, { kind: 'turn', turn: 3, key: TURN_DATA_KEY, value: { writes: state.writes } })
  assert.equal(definition.buildLocationData({ state }, 'turn', data), data)
  assert.equal(definition.buildLocationData({ state }, 'step'), null)
})

test('a turn without draft writes publishes nothing and other tools are ignored', () => {
  const state = replay([{ type: 'turn/start', seq: 1, data: { turn: 4 } }, call('a', 'bash', {}, 4), result('a', 5, false, 4)])
  assert.equal(definition.match(call('a', 'bash', {})), null)
  assert.deepEqual(state.writes, [])
  assert.equal(definition.buildLocationData({ state }, 'turn'), null)
})
