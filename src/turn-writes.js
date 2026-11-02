export const TURN_DATA_KEY = 'nai-desk-writes'
const WRITE_TOOLS = new Set(['desk_set_main', 'desk_set_uc', 'desk_set_character', 'desk_remove_character', 'desk_move_character'])

function label(name, argsRaw) {
  let args = {}
  try { args = JSON.parse(argsRaw) ?? {} } catch {}
  const n = Number.isInteger(args.n) ? args.n : '?'
  switch (name) {
    case 'desk_set_main': return '主提示词'
    case 'desk_set_uc': return 'UC'
    case 'desk_set_character': return `角色 ${n}`
    case 'desk_remove_character': return `角色 ${n}（已删除）`
    default: return '角色顺序'
  }
}

/**
 * Turn-local record of successful draft writes, published against the Turn so
 * the card can render below the reply, outside the folded tool group. Same
 * shape as the host's schedule card Definition; replay from the Session log
 * rebuilds it without any Host state.
 */
export const deskTurnDefinition = {
  kind: TURN_DATA_KEY,
  match: event => {
    if (event.type === 'turn/start') return { id: String(event.data.turn), role: 'start' }
    if (event.type === 'tool/call' && WRITE_TOOLS.has(event.data?.name)) return { id: String(event.data.turn), role: 'update' }
    if (event.type === 'tool/result' && event.surfaceOp === 'append') return { id: String(event.data.turn), role: 'update' }
    return null
  },
  start: (_context, match) => ({ turn: match.event.data.turn, calls: new Map(), writes: [] }),
  update: (context, match) => {
    const { event } = match
    if (event.type === 'tool/call') {
      const calls = new Map(context.state.calls)
      calls.set(String(event.data.callId), { name: event.data.name, argsRaw: event.data.arguments ?? '' })
      return { ...context.state, calls }
    }
    const message = event.data?.message
    const call = context.state.calls.get(String(message?.source?.callId))
    if (!call || message.isError === true) return context.state
    return { ...context.state, writes: [...context.state.writes, { seq: event.seq, label: label(call.name, call.argsRaw) }] }
  },
  buildLocationData: (context, scope, previous) => {
    if (scope !== 'turn' || context.state === undefined || !context.state.writes.length) return null
    if (previous?.kind === 'turn' && previous.turn === context.state.turn && previous.key === TURN_DATA_KEY && previous.value.writes === context.state.writes) return previous
    return { kind: 'turn', turn: context.state.turn, key: TURN_DATA_KEY, value: { writes: context.state.writes } }
  },
}
