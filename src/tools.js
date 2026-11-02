import { DeskError, LIMITS, sessionKey } from './desk.js'

const string = { type: 'string' }
const positionSchema = { type: 'object', properties: { x: { type: 'number', description: '归一化水平位置，范围 0–1，从左到右。' }, y: { type: 'number', description: '归一化垂直位置，范围 0–1，从上到下。' } }, required: ['x', 'y'], additionalProperties: false }
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

const revision = { type: 'integer', description: '使用最近一次读取或成功写入返回的 revision。版本冲突后须重新读取草稿。' }
const number = { type: 'integer', description: `角色序号从 1 开始，实际范围取决于当前草稿，最多 ${LIMITS.characters} 条。` }
const writeHint = 'expected_revision 用于版本检查。发生冲突时先读取当前草稿，再决定需要提交的修改。'

function callingSession(exec) {
  exec?.signal?.throwIfAborted()
  return sessionKey(exec?.agent?.session?.id)
}

function slot(n, maximum) {
  if (maximum === 0) throw new DeskError('invalid_input', '当前草稿没有可操作的角色提示词条目。')
  if (!Number.isInteger(n) || n < 1 || n > maximum) throw new DeskError('invalid_input', `角色序号须为 1 到 ${maximum} 之间的整数。请重新读取草稿确认序号。`)
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
        if (!Number.isSafeInteger(args.expected_revision) || args.expected_revision < 0) throw new DeskError('invalid_input', 'expected_revision 须使用读取结果中的非负整数版本。')
        throw new DeskError('conflict', '草稿版本已变化，请重新调用 desk_read 后提交。', state)
      }
      const operation = build(args, state)
      exec?.signal?.throwIfAborted()
      return store.mutate(id, args.expected_revision, operation)
    },
  )
  return [
    define('desk_read', '返回当前会话提示词草稿的已提交快照，包括 main、uc、characters 和 revision。快照包含编辑器已成功保存的修改。', {}, [], async (_args, exec) => store.read(callingSession(exec))),
    write('desk_set_main', '替换当前会话草稿的主提示词全文，保留负面提示词与角色条目。text 不做格式化或去重。', { text: string }, ['text'], args => ({ type: 'set_main', text: args.text })),
    write('desk_set_uc', '替换当前会话草稿的草稿级负面提示词全文，保留其它字段。', { text: string }, ['text'], args => ({ type: 'set_uc', text: args.text })),
    write('desk_set_character', '更新当前快照中第 n 个角色提示词条目；n 等于条目数加 1 时追加新条目。prompt 必填；更新时省略的 uc、name、enabled、position 保留原值。position 为 null 时清除自定义位置。', {
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
    write('desk_remove_character', '删除当前草稿中第 n 个角色提示词条目，包括其正向文本、UC 和元数据。后续条目的序号相应变化。', { n: number }, ['n'], (args, state) => ({ type: 'remove_character', id: state.characters[slot(args.n, state.characters.length)].id })),
    write('desk_move_character', '将第 n 个角色提示词条目移至第 to 位；两个序号均从 1 开始。条目的稳定 id 和全部字段保持不变。', { n: number, to: number }, ['n', 'to'], (args, state) => ({ type: 'move_character', id: state.characters[slot(args.n, state.characters.length)].id, index: slot(args.to, state.characters.length) })),
  ]
}
