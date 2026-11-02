import React, { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { PRESET_ID } from './protocol.js'
import { Button, PromptTabs } from './controls.jsx'
import { HostIcon } from './host-icons.jsx'

export function Icon({ kind }) {
  if (['up', 'down', 'check', 'trash', 'expand', 'plus'].includes(kind)) return <HostIcon kind={kind} />
  const paths = {
    minus: <path d="M5 12h14" />,
    restore: <path d="M3 8h5V3M21 8h-5V3M8 21v-5H3M16 21v-5h5" />,
    fold: <path d="m7 3 5 5 5-5M7 21l5-5 5 5M5 12h14" />,
    unfold: <path d="m7 8 5-5 5 5M7 16l5 5 5-5M5 12h14" />,
    notebook: <><path d="M7 3h13v18H7zM3 7h6M3 12h6M3 17h6M12 8h4M12 12h4" /></>,
  }
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>
}

function IconButton({ label, icon, ...props }) {
  return <Button className="nd-icon" title={label} aria-label={label} {...props}><Icon kind={icon} /></Button>
}

const baseOptions = [{ value: 'main', label: 'Base Prompt' }, { value: 'uc', label: 'UC', title: '总负面提示词' }]
const characterOptions = [{ value: 'prompt', label: 'Prompt' }, { value: 'uc', label: 'UC', title: '角色负面提示词' }]

function PromptEditor({ client, field, value, label, rows = 5 }) {
  const composing = useRef(false)
  return <textarea
    aria-label={label} value={value} rows={rows} spellCheck={false} placeholder={field === 'main' ? '例如：outdoors, soft lighting' : field.endsWith(':prompt') ? '例如：girl, blue jacket' : ''}
    onCompositionStart={() => { composing.current = true }}
    onCompositionEnd={event => { composing.current = false; client.edit(field, event.currentTarget.value) }}
    onChange={event => client.edit(field, event.currentTarget.value, { deferSave: composing.current })}
    onBlur={() => { if (!composing.current) client.flush().catch(() => {}) }}
  />
}

const defaultUi = () => ({ baseTab: 'main', collapsed: {}, tabs: {} })
function readUi(sessionId) {
  try {
    const saved = JSON.parse(localStorage.getItem(`dsh.nai-desk.ui.v1.${sessionId}`) ?? 'null')
    if (saved && ['main', 'uc'].includes(saved.baseTab) && saved.collapsed && typeof saved.collapsed === 'object' && saved.tabs && typeof saved.tabs === 'object') return saved
  } catch {}
  return defaultUi()
}

function Character({ character, index, count, client, ui, setUi, busy, onDelete }) {
  const tabsId = useId()
  const id = character.id
  const collapsed = ui.collapsed[id] === true
  const tab = ui.tabs[id] === 'uc' ? 'uc' : 'prompt'
  const run = operation => client.command(operation).catch(() => {})
  const gender = /(?:^|[\s,])(?:1?girl|female)(?:[\s,]|$)/i.test(character.prompt) ? '♀' : /(?:^|[\s,])(?:1?boy|male)(?:[\s,]|$)/i.test(character.prompt) ? '♂' : '○'
  return <section className={`nd-card nd-character${character.enabled ? '' : ' nd-disabled'}`}>
    <div className="nd-character-head">
      <span className="nd-gender" aria-hidden="true">{gender}</span>
      <span className="nd-name-field"><input aria-label={`角色 ${index + 1} 名称`} className="nd-name" value={character.name} maxLength={128}
        onChange={event => client.edit(`character:${id}:name`, event.currentTarget.value)}
        onBlur={() => client.flush().catch(() => {})} /></span>
      <div className="nd-character-actions">
        <IconButton label={`上移角色 ${index + 1}`} icon="up" disabled={busy || index === 0} onClick={() => run({ type: 'move_character', id, index: index - 1 })} />
        <IconButton label={`下移角色 ${index + 1}`} icon="down" disabled={busy || index === count - 1} onClick={() => run({ type: 'move_character', id, index: index + 1 })} />
        <IconButton label={`启用角色 ${index + 1} 的提示词`} title={`${character.enabled ? '停用' : '启用'}角色 ${index + 1} 的提示词`} icon={character.enabled ? 'check' : 'minus'} aria-pressed={character.enabled} disabled={busy} onClick={() => run({ type: 'set_character', id, patch: { enabled: !character.enabled } })} />
        <IconButton label={`删除角色 ${index + 1}`} icon="trash" disabled={busy} onClick={() => onDelete(character, index)} />
        <IconButton label={`${collapsed ? '展开' : '收起'}角色 ${index + 1}`} icon={collapsed ? 'unfold' : 'fold'} aria-expanded={!collapsed} aria-controls={`nd-character-${id}`} onClick={() => setUi(previous => ({ ...previous, collapsed: { ...previous.collapsed, [id]: !collapsed } }))} />
      </div>
    </div>
    <div className="nd-character-body" id={`nd-character-${id}`} hidden={collapsed}>
      <div className="nd-editor-tools">
        <PromptTabs id={tabsId} value={tab} options={characterOptions} label={`角色 ${index + 1} 提示词类型`}
          onChange={value => setUi(previous => ({ ...previous, tabs: { ...previous.tabs, [id]: value } }))} />
      </div>
      {characterOptions.map(option => <div key={option.value} role="tabpanel" id={`${tabsId}-${option.value}-panel`} aria-labelledby={`${tabsId}-${option.value}`} hidden={tab !== option.value}>
        <PromptEditor client={client} field={`character:${id}:${option.value}`} value={character[option.value]} label={`角色 ${index + 1} ${option.value === 'prompt' ? '正向提示词' : 'UC'}`} />
      </div>)}
    </div>
  </section>
}

function Conflict({ conflict, client }) {
  const label = conflict.field === 'main' ? '主提示词' : conflict.field === 'uc' ? '草稿级 UC' : conflict.field.endsWith(':name') ? '角色名称' : conflict.field.endsWith(':uc') ? '角色级 UC' : '角色提示词'
  return <section className="nd-conflict" role="alert">
    <strong>{conflict.deleted ? '草稿中的该角色提示词已删除' : `${label}存在版本冲突`}</strong>
    {conflict.notice && <p>{conflict.notice}</p>}
    <label>未保存的本地内容<textarea readOnly value={conflict.local} rows={3} /></label>
    {!conflict.deleted && <label>当前已保存内容<textarea readOnly value={conflict.remote ?? ''} rows={3} /></label>}
    <div className="nd-conflict-actions">
      {!conflict.deleted && <Button onClick={() => client.resolveConflict(conflict.field, 'local', conflict.revision).catch(() => {})}>保留我的修改</Button>}
      <Button onClick={() => client.resolveConflict(conflict.field, 'remote', conflict.revision).catch(() => {})}>{conflict.deleted ? '放弃这段未保存内容' : '使用已保存版本'}</Button>
    </div>
  </section>
}

export function Panel(props) {
  if (typeof props.sessionId !== 'string') return <div className="nai-desk nd-message">选择一个 NAI5 提示词会话以打开草稿。</div>
  return <SessionPanel key={props.sessionId} {...props} />
}

function SessionPanel({ sessionId, sessionList, getClient, acquireClient, useTabInfo }) {
  const tabsId = useId()
  const presetSnapshot = useCallback(() => sessionList.getSnapshot().byId[sessionId]?.projectionValues?.agentPreset, [sessionList, sessionId])
  const preset = useSyncExternalStore(sessionList.subscribe, presetSnapshot, presetSnapshot)
  const client = useMemo(() => getClient(sessionId), [getClient, sessionId])
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot)
  const tabInfo = useTabInfo?.()
  const visible = tabInfo?.tab?.visible !== false
  const [ui, setUi] = useState(() => readUi(sessionId))
  const [expanded, setExpanded] = useState(false)
  const [removed, setRemoved] = useState(null)

  useEffect(() => {
    if (preset !== PRESET_ID || !visible) return
    return acquireClient(sessionId)
  }, [preset, visible, acquireClient, sessionId])
  useEffect(() => { try { localStorage.setItem(`dsh.nai-desk.ui.v1.${sessionId}`, JSON.stringify(ui)) } catch {} }, [sessionId, ui])

  if (preset !== PRESET_ID) return <div className="nai-desk nd-message">选择使用 NAI5 提示词预设的会话以打开草稿。</div>
  if (!state.draft) return <div className="nai-desk nd-message" role="status">{state.error ?? '正在加载草稿…'}{state.error && <Button onClick={() => client.refresh()}>重新加载</Button>}</div>

  const draft = state.draft
  const busy = state.commandPending
  const saveLabel = state.phase === 'conflict' ? '存在版本冲突' : state.error ? '同步异常' : state.phase === 'saving' ? '正在保存…' : state.pending ? '等待保存…' : '已同步'
  const removeCharacter = async (character, index) => {
    try { await client.command({ type: 'remove_character', id: character.id }); setRemoved({ character: structuredClone(character), index }) } catch {}
  }
  const restoreCharacter = async () => {
    if (!removed) return
    try { await client.command({ type: 'add_character', character: removed.character, index: Math.min(removed.index, client.getSnapshot().draft.characters.length) }); setRemoved(null) } catch {}
  }

  return <div className={`nai-desk${expanded ? ' nd-expanded' : ''}`} onKeyDown={event => { if (event.key === 'Escape' && expanded) { setExpanded(false); event.stopPropagation() } }}>
    <div className="nd-status">{saveLabel}</div>
    {state.error && <div className="nd-error" role="alert"><span>{state.error}</span><Button onClick={() => state.pending ? client.flush().catch(() => {}) : client.refresh()}>重试</Button></div>}
    {state.conflicts.map(conflict => <Conflict key={conflict.field} conflict={conflict} client={client} />)}
    <div className="nd-content">
      <section className="nd-base nd-card" aria-label="主提示词与负面提示词">
        <div className="nd-editor-tools">
          <PromptTabs id={tabsId} value={ui.baseTab} options={baseOptions} label="主提示词类型"
            onChange={value => setUi(previous => ({ ...previous, baseTab: value }))} />
          <IconButton label={expanded ? '还原编辑区' : '展开编辑区'} icon={expanded ? 'restore' : 'expand'} aria-pressed={expanded} onClick={() => setExpanded(value => !value)} />
        </div>
        {baseOptions.map(option => <div className="nd-prompt-panel" key={option.value} role="tabpanel" id={`${tabsId}-${option.value}-panel`} aria-labelledby={`${tabsId}-${option.value}`} hidden={ui.baseTab !== option.value}>
          <PromptEditor client={client} field={option.value} value={draft[option.value]} label={option.value === 'main' ? 'Base Prompt' : '总负面 UC'} rows={6} />
        </div>)}
      </section>
      <section className="nd-characters" aria-label="角色提示词" hidden={expanded}>
        <div className="nd-section-label"><span>角色提示词</span><span>{draft.characters.length} 个角色</span></div>
        <div className="nd-character-list">{draft.characters.map((character, index) => <Character key={character.id} character={character} index={index} count={draft.characters.length} client={client} ui={ui} setUi={setUi} busy={busy} onDelete={removeCharacter} />)}</div>
        <Button variant="outline" size="md" className="nd-add" disabled={busy || draft.characters.length >= 22} onClick={() => client.command({ type: 'add_character', character: {} }).catch(() => {})}><Icon kind="plus" />添加角色栏</Button>
      </section>
    </div>
    {removed && <div className="nd-undo" role="status"><span>已移除 {removed.character.name || '角色栏'}</span><Button disabled={busy} onClick={restoreCharacter}>撤销</Button></div>}
    <div className="nd-footer">草稿按会话保存 · 可手动选择文本</div>
  </div>
}
