import { DeskError, LIMITS, sessionKey, tokensIn } from './desk.js'

const string = { type: 'string' }
const positionSchema = { type: 'object', properties: { x: { type: 'number', description: '归一化水平位置，范围 0–1，从左到右。' }, y: { type: 'number', description: '归一化垂直位置，范围 0–1，从上到下。' } }, required: ['x', 'y'], additionalProperties: false }
export const snapshotSchema = {
  type: 'object',
  properties: {
    schemaVersion: { type: 'integer' }, sessionId: string, revision: { type: 'integer' }, main: string, uc: string,
    masked: { type: 'object', properties: { main: { type: 'boolean' }, uc: { type: 'boolean' } }, additionalProperties: false, description: '被用户整栏屏蔽的字段，对应文本只是占位，不能读写。' },
    characters: {
      type: 'array', items: {
        type: 'object',
        properties: { id: string, name: string, prompt: string, uc: string, enabled: { type: 'boolean' }, position: positionSchema, masked: { type: 'boolean', description: '为 true 时用户已向你屏蔽这个角色：name、prompt、uc 只是占位，不能读写。' } },
        required: ['id', 'name', 'prompt', 'uc', 'enabled'], additionalProperties: false,
      },
    },
  },
  required: ['schemaVersion', 'sessionId', 'revision', 'main', 'uc', 'characters'],
  additionalProperties: false,
}

const WHOLE = count => `⟪整栏已屏蔽，约 ${count} 字⟫`
const maskRule = '文本中的 ⟪屏蔽N⟫ 是用户向你隐藏的内容：你看不到原文，改写所在字段时必须原样保留每个占位（位置可以按语义调整），也不要自己编造占位。'

/** What the model may see: masked text stays behind placeholders and the stored secrets never leave the host. */
export function modelView(state) {
  const view = { schemaVersion: state.schemaVersion, sessionId: state.sessionId, revision: state.revision, main: state.main, uc: state.uc }
  if (state.mask) {
    view.masked = {}
    for (const key of ['main', 'uc']) if (state.mask[key]) { view[key] = WHOLE(state[key].length); view.masked[key] = true }
  }
  view.characters = state.characters.map(c => {
    const shown = { id: c.id, name: c.name, prompt: c.prompt, uc: c.uc, enabled: c.enabled, ...(c.position ? { position: c.position } : {}) }
    return c.masked ? { ...shown, name: '⟪已屏蔽⟫', prompt: WHOLE(c.prompt.length), uc: WHOLE(c.uc.length), masked: true } : shown
  })
  return view
}

function keepsPlaceholders(state, before, after, label) {
  const missing = [...new Set(tokensIn(before))].filter(token => !after.includes(token))
  if (missing.length) throw new DeskError('masked', `${label}里漏掉了屏蔽占位 ${missing.join('、')}。这些占位代表用户不让你看到的内容，请原样保留后重新提交。`)
  const unknown = [...new Set(tokensIn(after))].filter(token => state.secrets?.[token] === undefined)
  if (unknown.length) throw new DeskError('masked', `${unknown.join('、')} 不是这份稿纸里的屏蔽占位，不要自己编造占位。`)
}

const blocked = label => new DeskError('masked', `${label}已被用户向你屏蔽，不能读取或修改。保留原样即可；需要改动时请用户自己处理。`)

/** Model writes may not read through or overwrite anything the user masked. */
export function checkModelWrite(state, operation) {
  switch (operation.type) {
    case 'set_main':
    case 'set_uc': {
      const key = operation.type === 'set_main' ? 'main' : 'uc'
      const label = key === 'main' ? '主提示词' : '负面提示词'
      if (state.mask?.[key]) throw blocked(label)
      keepsPlaceholders(state, state[key], operation.text, label)
      break
    }
    case 'add_character':
      for (const key of ['prompt', 'uc']) keepsPlaceholders(state, '', operation.character[key] ?? '', '新角色')
      break
    case 'set_character': {
      const target = state.characters.find(c => c.id === operation.id)
      const index = state.characters.indexOf(target) + 1
      if (target.masked) throw blocked(`角色 ${index}`)
      for (const key of ['prompt', 'uc']) if (operation.patch[key] !== undefined) keepsPlaceholders(state, target[key], operation.patch[key], `角色 ${index} 的${key === 'uc' ? ' UC ' : '提示词'}`)
      break
    }
    case 'remove_character': {
      const target = state.characters.find(c => c.id === operation.id)
      const index = state.characters.indexOf(target) + 1
      if (target.masked) throw blocked(`角色 ${index}`)
      if (tokensIn(target.prompt + target.uc).length) throw new DeskError('masked', `角色 ${index} 含有用户屏蔽的内容，不能由你删除。需要删除时请用户自己处理。`)
      break
    }
  }
  return operation
}

const revision = { type: 'integer', description: '使用最近一次读取或成功写入返回的 revision。版本冲突后须重新读取草稿。' }
const number = { type: 'integer', description: `角色序号从 1 开始，实际范围取决于当前草稿，最多 ${LIMITS.characters} 条。` }
const writeHint = 'expected_revision 用于版本检查。发生冲突时先读取当前草稿，再决定需要提交的修改。改写含 ⟪屏蔽N⟫ 的字段时原样保留占位；用户整栏屏蔽的字段和角色不能写入。'

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
        throw new DeskError('conflict', '草稿版本已变化，请重新调用 desk_read 后提交。', modelView(state))
      }
      const operation = checkModelWrite(state, build(args, state))
      exec?.signal?.throwIfAborted()
      try {
        return modelView(await store.mutate(id, args.expected_revision, operation, { source: 'model' }))
      } catch (error) {
        if (error instanceof DeskError && error.current) throw new DeskError(error.code, error.message, modelView(error.current))
        throw error
      }
    },
  )
  return [
    define('desk_read', `返回当前会话提示词草稿的已提交快照，包括 main、uc、characters 和 revision。快照包含编辑器已成功保存的修改。${maskRule}masked 标出用户整栏屏蔽的字段和角色，它们只是占位。`, {}, [], async (_args, exec) => modelView(await store.read(callingSession(exec)))),
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
