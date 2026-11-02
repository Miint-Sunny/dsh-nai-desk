import React, { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { PRESET_ID } from './protocol.js'
import { Button, PromptTabs, Switch, ToolButton } from './controls.jsx'
import { HostIcon } from './host-icons.jsx'

// Local glyphs drawn on the host's 16px grid with its 1px stroke.
const glyphs = {
  up: <path d="M8 13.5V2.5M3.5 7 8 2.5 12.5 7" stroke="currentColor" />,
  down: <path d="M8 2.5v11M3.5 9 8 13.5 12.5 9" stroke="currentColor" />,
  notebook: <><path d="M4 1.5h8a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z" stroke="currentColor" /><path d="M5.5 5h5M5.5 8h5M5.5 11h3" stroke="currentColor" /></>,
  female: <><circle cx="8" cy="5.5" r="3.5" stroke="currentColor" /><path d="M8 9v6M5 12.5h6" stroke="currentColor" /></>,
  male: <><circle cx="6.5" cy="9.5" r="3.5" stroke="currentColor" /><path d="M9 7l5-5M10 2h4v4" stroke="currentColor" /></>,
  person: <><circle cx="8" cy="5.5" r="2.75" stroke="currentColor" /><path d="M2.75 14c0-2.9 2.35-4.75 5.25-4.75s5.25 1.85 5.25 4.75" stroke="currentColor" /></>,
}

export function Icon({ kind }) {
  if (!glyphs[kind]) return <HostIcon kind={kind} />
  return <svg viewBox="0 0 16 16" width="16" height="16" fill="none" strokeWidth="1" aria-hidden="true">{glyphs[kind]}</svg>
}

/** Live chip title for the sidebar tab: glyph plus a short name, like the host's Files tab. */
export function TabTitle() {
  return <><span className="nd-tab-title-icon"><Icon kind="notebook" /></span>稿纸</>
}

const baseOptions = [{ value: 'main', label: 'Base Prompt' }, { value: 'uc', label: 'UC', title: '总负面提示词' }]
const characterOptions = [{ value: 'prompt', label: 'Prompt' }, { value: 'uc', label: 'UC', title: '角色负面提示词' }]

function PromptEditor({ client, field, value, label }) {
  const composing = useRef(false)
  return <textarea
    className="nd-editor" aria-label={label} value={value} spellCheck={false}
    placeholder={field === 'main' ? '例如：outdoors, soft lighting' : field.endsWith(':prompt') ? '例如：girl, blue jacket' : ''}
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

function genderOf(prompt) {
  if (/(?:^|[\s,])(?:1?girl|female)(?:[\s,]|$)/i.test(prompt)) return 'female'
  if (/(?:^|[\s,])(?:1?boy|male)(?:[\s,]|$)/i.test(prompt)) return 'male'
  return 'person'
}

function Character({ character, index, count, client, ui, setUi, busy, onDelete }) {
  const tabsId = useId()
  const id = character.id
  const collapsed = ui.collapsed[id] === true
  const tab = ui.tabs[id] === 'uc' ? 'uc' : 'prompt'
  const run = operation => client.command(operation).catch(() => {})
  const n = index + 1
  return <section className={`nd-card nd-character${character.enabled ? '' : ' nd-disabled'}`}>
    <div className="nd-card-head">
      <span className="nd-gender"><Icon kind={genderOf(character.prompt)} /></span>
      <input aria-label={`角色 ${n} 名称`} className="nd-name" value={character.name} maxLength={128} placeholder={`角色 ${n}`}
        onChange={event => client.edit(`character:${id}:name`, event.currentTarget.value)}
        onBlur={() => client.flush().catch(() => {})} />
      <div className="nd-actions">
        <Switch checked={character.enabled} label={`启用角色 ${n}`} title={character.enabled ? `停用角色 ${n}` : `启用角色 ${n}`} disabled={busy}
          onChange={enabled => run({ type: 'set_character', id, patch: { enabled } })} />
        <ToolButton label={`上移角色 ${n}`} disabled={busy || index === 0} onClick={() => run({ type: 'move_character', id, index: index - 1 })}><Icon kind="up" /></ToolButton>
        <ToolButton label={`下移角色 ${n}`} disabled={busy || index === count - 1} onClick={() => run({ type: 'move_character', id, index: index + 1 })}><Icon kind="down" /></ToolButton>
        <ToolButton label={`删除角色 ${n}`} className="nd-tool-danger" disabled={busy} onClick={() => onDelete(character, index)}><Icon kind="trash" /></ToolButton>
        <ToolButton label={`${collapsed ? '展开' : '收起'}角色 ${n}`} aria-expanded={!collapsed} aria-controls={`nd-character-${id}`}
          onClick={() => setUi(previous => ({ ...previous, collapsed: { ...previous.collapsed, [id]: !collapsed } }))}><Icon kind={collapsed ? 'chevronDown' : 'chevronUp'} /></ToolButton>
      </div>
    </div>
    <div className="nd-card-body" id={`nd-character-${id}`} hidden={collapsed}>
      <PromptTabs id={tabsId} value={tab} options={characterOptions} label={`角色 ${n} 提示词类型`}
        onChange={value => setUi(previous => ({ ...previous, tabs: { ...previous.tabs, [id]: value } }))} />
      {characterOptions.map(option => <div key={option.value} className="nd-prompt-panel" role="tabpanel" id={`${tabsId}-${option.value}-panel`} aria-labelledby={`${tabsId}-${option.value}`} hidden={tab !== option.value}>
        <PromptEditor client={client} field={`character:${id}:${option.value}`} value={character[option.value]} label={`角色 ${n} ${option.value === 'prompt' ? '正向提示词' : 'UC'}`} />
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
      {!conflict.deleted && <Button variant="outline" onClick={() => client.resolveConflict(conflict.field, 'local', conflict.revision).catch(() => {})}>保留我的修改</Button>}
      <Button variant="outline" onClick={() => client.resolveConflict(conflict.field, 'remote', conflict.revision).catch(() => {})}>{conflict.deleted ? '放弃这段未保存内容' : '使用已保存版本'}</Button>
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
  if (!state.draft) return <div className="nai-desk nd-message" role="status">{state.error ?? '正在加载草稿…'}{state.error && <Button variant="outline" onClick={() => client.refresh()}>重新加载</Button>}</div>

  const draft = state.draft
  const busy = state.commandPending
  const [saveLabel, tone] = state.phase === 'conflict' ? ['存在版本冲突', 'warn'] : state.error ? ['同步异常', 'error'] : state.phase === 'saving' ? ['正在保存…', ''] : state.pending ? ['等待保存…', ''] : ['已同步', '']
  const removeCharacter = async (character, index) => {
    try { await client.command({ type: 'remove_character', id: character.id }); setRemoved({ character: structuredClone(character), index }) } catch {}
  }
  const restoreCharacter = async () => {
    if (!removed) return
    try { await client.command({ type: 'add_character', character: removed.character, index: Math.min(removed.index, client.getSnapshot().draft.characters.length) }); setRemoved(null) } catch {}
  }

  return <div className={`nai-desk${expanded ? ' nd-expanded' : ''}`} onKeyDown={event => { if (event.key === 'Escape' && expanded) { setExpanded(false); event.stopPropagation() } }}>
    <header className="nd-header">
      <span className="nd-status" data-tone={tone || undefined} role="status">{saveLabel}</span>
      <ToolButton label={expanded ? '还原编辑区' : '展开编辑区'} aria-pressed={expanded} onClick={() => setExpanded(value => !value)}><Icon kind="expand" /></ToolButton>
    </header>
    <div className="nd-body">
      {state.error && <div className="nd-error" role="alert"><span>{state.error}</span><Button onClick={() => state.pending ? client.flush().catch(() => {}) : client.refresh()}>重试</Button></div>}
      {state.conflicts.map(conflict => <Conflict key={conflict.field} conflict={conflict} client={client} />)}
      <section className="nd-card nd-base" aria-label="主提示词与负面提示词">
        <PromptTabs id={tabsId} value={ui.baseTab} options={baseOptions} label="主提示词类型"
          onChange={value => setUi(previous => ({ ...previous, baseTab: value }))} />
        {baseOptions.map(option => <div className="nd-prompt-panel" key={option.value} role="tabpanel" id={`${tabsId}-${option.value}-panel`} aria-labelledby={`${tabsId}-${option.value}`} hidden={ui.baseTab !== option.value}>
          <PromptEditor client={client} field={option.value} value={draft[option.value]} label={option.value === 'main' ? 'Base Prompt' : '总负面 UC'} />
        </div>)}
      </section>
      <section className="nd-characters" aria-label="角色提示词" hidden={expanded}>
        <h2 className="nd-section-label"><span>角色</span><span>{draft.characters.length}</span></h2>
        {draft.characters.map((character, index) => <Character key={character.id} character={character} index={index} count={draft.characters.length} client={client} ui={ui} setUi={setUi} busy={busy} onDelete={removeCharacter} />)}
        {removed && <div className="nd-notice" role="status"><span>已移除{removed.character.name ? `「${removed.character.name}」` : '角色栏'}</span><Button disabled={busy} onClick={restoreCharacter}>撤销</Button></div>}
        <button type="button" className="nd-creator" disabled={busy || draft.characters.length >= 22} onClick={() => client.command({ type: 'add_character', character: {} }).catch(() => {})}><Icon kind="plus" />添加角色栏</button>
      </section>
    </div>
  </div>
}
