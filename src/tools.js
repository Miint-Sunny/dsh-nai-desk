import { DeskError, LIMITS, sessionKey } from './desk.js'

const string = { type: 'string' }
const positionSchema = { type: 'object', properties: { x: { type: 'number', description: '0–1' }, y: { type: 'number', description: '0–1' } }, required: ['x', 'y'], additionalProperties: false }
export const snapshotSchema = {
  type: 'object',
  properties: {
    schemaVersion: { type: 'integer' }, sessionId: string, revision: { type: 'integer' }, main: string, uc: string,
    characters: {
      type: 'array', items: {
        type: 'object',
        properties: { id: string, name: string, prompt: string, uc: string, enabled: { type: 'boolean' }, position: positionSchema },
        required: ['id', 'name', 'prompt', 'uc', 'enabled'], additionalProperties: false,
      },
    },
  },
  required: ['schemaVersion', 'sessionId', 'revision', 'main', 'uc', 'characters'],
  additionalProperties: false,
}

const revision = { type: 'integer', description: 'desk_read 或上次成功写入返回的非负 revision。发生冲突时重新读，不猜版本。' }
const number = { type: 'integer', description: `从 1 开始，最大 ${LIMITS.characters}` }
const writeHint = '只修改指定字段，其他内容保留。写前读 desk_read；expected_revision 必须使用读到的版本，冲突时重新读取。'

function callingSession(exec) {
  exec?.signal?.throwIfAborted()
  return sessionKey(exec?.agent?.session?.id)
}

function slot(n, maximum) {
  if (!Number.isInteger(n) || n < 1 || n > maximum) throw new DeskError('invalid_input', `角色序号必须在 1 到 ${maximum} 之间，不能跳号`)
  return n - 1
}

/** Raw dsh ToolDefinition objects: JSON Schema in/out, no dependency on the runtime in tests. */
export function createDeskTools(store) {
  const define = (name, description, properties, required, execute) => ({
    name,
    description,
    parameters: { type: 'object', properties, required, additionalProperties: false },
    output: { schema: snapshotSchema, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    isConcurrencySafe: () => name === 'desk_read',
    execute,
  })
  const write = (name, description, properties, required, build) => define(
    name, `${description} ${writeHint}`,
    { expected_revision: revision, ...properties }, ['expected_revision', ...required],
    async (args, exec) => {
      const id = callingSession(exec)
      const state = await store.read(id)
      if (state.revision !== args.expected_revision) {
        if (!Number.isSafeInteger(args.expected_revision) || args.expected_revision < 0) throw new DeskError('invalid_input', 'expected_revision 必须是当前稿纸的 revision')
        throw new DeskError('conflict', '稿纸已更新，请先重新调用 desk_read', state)
      }
      const operation = build(args, state)
      exec?.signal?.throwIfAborted()
      return store.mutate(id, args.expected_revision, operation)
    },
  )
  return [
    define('desk_read', '读取当前会话稿纸的主串 main、总负面 uc、角色栏及 revision。用户在右侧面板的手动编辑也在这里。修改前先读，只改用户要求的部分。', {}, [], async (_args, exec) => store.read(callingSession(exec))),
    write('desk_set_main', '将定稿主串写入当前会话的 Base Prompt（整段覆盖）。不生成图片、不写官网、不改角色和 UC。', { text: string }, ['text'], args => ({ type: 'set_main', text: args.text })),
    write('desk_set_uc', '将总负面提示词写入当前会话的 UC。仅在用户需要时填写，不擅自补个人默认 UC。', { text: string }, ['text'], args => ({ type: 'set_uc', text: args.text })),
    write('desk_set_character', '写第 n 个角色栏（从 1 开始），或在末尾添加。prompt 是正向正文；uc、name、enabled、position 省略时保留。position 为 null 时恢复自动位置。不会读取角色库。', {
      n: number, prompt: string, uc: string, name: string, enabled: { type: 'boolean' }, position: { oneOf: [positionSchema, { type: 'null' }] },
    }, ['n', 'prompt'], (args, state) => {
      const index = slot(args.n, state.characters.length + 1)
      const patch = { prompt: args.prompt }
      for (const key of ['uc', 'name', 'enabled', 'position']) if (args[key] !== undefined) patch[key] = args[key]
      if (index === state.characters.length) {
        if (patch.position === null) delete patch.position
        return { type: 'add_character', character: patch }
      }
      return { type: 'set_character', id: state.characters[index].id, patch }
    }),
    write('desk_remove_character', '删除第 n 个角色栏。角色正文会从稿纸移除；仅在用户要求删除时使用。', { n: number }, ['n'], (args, state) => ({ type: 'remove_character', id: state.characters[slot(args.n, state.characters.length)].id })),
    write('desk_move_character', '把第 n 个角色栏移动到第 to 位（均从 1 开始）。文字、角色身份与启用状态一同移动。', { n: number, to: number }, ['n', 'to'], (args, state) => ({ type: 'move_character', id: state.characters[slot(args.n, state.characters.length)].id, index: slot(args.to, state.characters.length) })),
  ]
}
