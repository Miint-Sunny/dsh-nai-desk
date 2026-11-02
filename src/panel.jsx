import React, { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { PRESET_ID } from './protocol.js'
import { fieldValue } from './client-state.js'
import { Button, PromptTabs, Switch, ToolButton } from './controls.jsx'
import { HostIcon } from './host-icons.jsx'
import { PromptEditor, caretTarget } from './editor.jsx'
import { nextToken } from './mask.js'

// Local glyphs drawn on the host's 16px grid with its 1px stroke.
const glyphs = {
  up: <path d="M8 13.5V2.5M3.5 7 8 2.5 12.5 7" stroke="currentColor" />,
  down: <path d="M8 2.5v11M3.5 9 8 13.5 12.5 9" stroke="currentColor" />,
  back: <path d="M10 4 6.70711 7.29289c-.39053.39053-.39053 1.02369 0 1.41422L10 12" stroke="currentColor" />,
  forward: <path d="M6 4l3.29289 3.29289c.39053.39053.39053 1.02369 0 1.41422L6 12" stroke="currentColor" />,
  eyeOff: <><path d="M2.5 8S4.5 4.5 8 4.5 13.5 8 13.5 8 11.5 11.5 8 11.5 2.5 8 2.5 8Z" stroke="currentColor" /><circle cx="8" cy="8" r="1.75" stroke="currentColor" /><path d="M3 13 13 3" stroke="currentColor" /></>,
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

function when(at) {
  if (at === null) return '较早'
  const age = Date.now() - at
  if (age < 60_000) return '刚刚'
  if (age < 3_600_000) return `${Math.floor(age / 60_000)} 分钟前`
  const date = new Date(at)
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return date.toDateString() === new Date().toDateString() ? time : `${date.getMonth() + 1}-${date.getDate()} ${time}`
}
const who = step => step.restored ? '恢复较早版本' : step.source === 'model' ? '模型写入' : step.source === 'user' ? '手动修改' : '更早的稿纸'
const describe = step => [who(step), when(step.at), ...(step.restored ? [] : step.parts.slice(0, 4))].join(' · ')

/** Under the editor: mask the selected words, or show and reveal the placeholder under the caret. */
function MaskHint({ target, field, client, busy, setCaret }) {
  if (!target) return null
  const keepFocus = event => event.preventDefault()
  const run = operation => client.command(operation).then(() => setCaret(null)).catch(() => {})
  if (target.kind === 'selection') {
    const mask = () => {
      const draft = client.getSnapshot().draft
      const value = fieldValue(draft, field)
      const token = nextToken(draft)
      run({ type: 'mask_span', field, text: value.slice(0, target.start) + token + value.slice(target.end), token, secret: target.text })
    }
    return <div className="nd-hint" role="status">
      <span className="nd-hint-text">{target.blocked ? '选中的内容里已有屏蔽占位' : `已选 ${target.text.length} 字`}</span>
      <Button variant="outline" onMouseDown={keepFocus} disabled={busy || target.blocked || !target.text.trim()} onClick={mask}><Icon kind="eyeOff" />向模型屏蔽</Button>
    </div>
  }
  const secret = client.getSnapshot().draft?.secrets?.[target.token]
  return <div className="nd-hint" role="status">
    <span className="nd-hint-text"><mark className="nd-token">{target.token}</mark>{secret === undefined ? '找不到原文' : <span className="nd-hint-secret" title={secret}>{secret}</span>}</span>
    {secret !== undefined && <Button variant="outline" onMouseDown={keepFocus} disabled={busy} onClick={() => run({ type: 'unmask', token: target.token })}>取消屏蔽</Button>}
  </div>
}

function BaseCard({ draft, client, ui, setUi, readOnly, caret, setCaret, busy }) {
  const tabsId = useId()
  const tab = ui.baseTab
  const masked = draft.mask?.[tab] === true
  const name = tab === 'main' ? '主提示词' : 'UC'
  return <section className="nd-card nd-base" aria-label="主提示词与负面提示词">
    <div className="nd-card-head">
      <PromptTabs id={tabsId} value={tab} options={baseOptions} label="主提示词类型" onChange={value => setUi(previous => ({ ...previous, baseTab: value }))} />
      <span className="nd-head-fill" />
      {masked && <span className="nd-tag">模型看不到</span>}
      {!readOnly && <ToolButton label={masked ? `让模型看到${name}` : `向模型屏蔽整栏${name}`} aria-pressed={masked} disabled={busy}
        onClick={() => client.command({ type: 'set_mask', field: tab, masked: !masked }).catch(() => {})}><Icon kind="eyeOff" /></ToolButton>}
    </div>
    {baseOptions.map(option => <div className="nd-prompt-panel" key={option.value} role="tabpanel" id={`${tabsId}-${option.value}-panel`} aria-labelledby={`${tabsId}-${option.value}`} hidden={tab !== option.value}>
      <PromptEditor client={client} field={option.value} value={draft[option.value]} label={option.value === 'main' ? 'Base Prompt' : '总负面 UC'} secrets={draft.secrets} readOnly={readOnly} onCaret={setCaret} />
    </div>)}
    {!readOnly && <MaskHint target={caretTarget(caret, tab, draft[tab])} field={tab} client={client} busy={busy} setCaret={setCaret} />}
  </section>
}

function Character({ draft, character, index, count, client, ui, setUi, busy, readOnly, caret, setCaret, onDelete }) {
  const tabsId = useId()
  const id = character.id
  const collapsed = ui.collapsed[id] === true
  const tab = ui.tabs[id] === 'uc' ? 'uc' : 'prompt'
  const field = `character:${id}:${tab}`
  const run = operation => client.command(operation).catch(() => {})
  const n = index + 1
  return <section className={`nd-card nd-character${character.enabled ? '' : ' nd-disabled'}`}>
    <div className="nd-card-head">
      <span className="nd-gender"><Icon kind={genderOf(character.prompt)} /></span>
      <input aria-label={`角色 ${n} 名称`} className="nd-name" value={character.name} maxLength={128} placeholder={`角色 ${n}`} readOnly={readOnly}
        onChange={event => client.edit(`character:${id}:name`, event.currentTarget.value)}
        onBlur={() => { if (!readOnly) client.flush().catch(() => {}) }} />
      {character.masked && <span className="nd-tag">模型看不到</span>}
      {readOnly && !character.enabled && <span className="nd-tag">已停用</span>}
      <div className="nd-actions">
        {!readOnly && <>
          <ToolButton label={character.masked ? `让模型看到角色 ${n}` : `向模型屏蔽角色 ${n}`} aria-pressed={character.masked === true} disabled={busy}
            onClick={() => run({ type: 'set_character', id, patch: { masked: !character.masked } })}><Icon kind="eyeOff" /></ToolButton>
          <Switch checked={character.enabled} label={`启用角色 ${n}`} title={character.enabled ? `停用角色 ${n}` : `启用角色 ${n}`} disabled={busy}
            onChange={enabled => run({ type: 'set_character', id, patch: { enabled } })} />
          <ToolButton label={`上移角色 ${n}`} disabled={busy || index === 0} onClick={() => run({ type: 'move_character', id, index: index - 1 })}><Icon kind="up" /></ToolButton>
          <ToolButton label={`下移角色 ${n}`} disabled={busy || index === count - 1} onClick={() => run({ type: 'move_character', id, index: index + 1 })}><Icon kind="down" /></ToolButton>
          <ToolButton label={`删除角色 ${n}`} className="nd-tool-danger" disabled={busy} onClick={() => onDelete(character, index)}><Icon kind="trash" /></ToolButton>
        </>}
        <ToolButton label={`${collapsed ? '展开' : '收起'}角色 ${n}`} aria-expanded={!collapsed} aria-controls={`nd-character-${id}`}
          onClick={() => setUi(previous => ({ ...previous, collapsed: { ...previous.collapsed, [id]: !collapsed } }))}><Icon kind={collapsed ? 'chevronDown' : 'chevronUp'} /></ToolButton>
      </div>
    </div>
    <div className="nd-card-body" id={`nd-character-${id}`} hidden={collapsed}>
      <PromptTabs id={tabsId} value={tab} options={characterOptions} label={`角色 ${n} 提示词类型`}
        onChange={value => setUi(previous => ({ ...previous, tabs: { ...previous.tabs, [id]: value } }))} />
      {characterOptions.map(option => <div key={option.value} className="nd-prompt-panel" role="tabpanel" id={`${tabsId}-${option.value}-panel`} aria-labelledby={`${tabsId}-${option.value}`} hidden={tab !== option.value}>
        <PromptEditor client={client} field={`character:${id}:${option.value}`} value={character[option.value]} label={`角色 ${n} ${option.value === 'prompt' ? '正向提示词' : 'UC'}`} secrets={draft.secrets} readOnly={readOnly} onCaret={setCaret} />
      </div>)}
      {!readOnly && <MaskHint target={caretTarget(caret, field, character[tab])} field={field} client={client} busy={busy} setCaret={setCaret} />}
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

/** History steps for the header: refreshed after each revision, bodies fetched only for the step on screen and its neighbours. */
function useHistory(client, revision, visible) {
  const [steps, setSteps] = useState([])
  const versions = useRef(new Map())
  const [, changed] = useReducer(count => count + 1, 0)
  useEffect(() => {
    if (revision === undefined || !visible) return
    let cancelled = false
    const timer = setTimeout(() => client.history().then(value => { if (!cancelled) setSteps(value.steps) }, () => {}), 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [client, revision, visible])
  const load = useCallback(stepRevision => {
    if (stepRevision === undefined || versions.current.has(stepRevision)) return
    versions.current.set(stepRevision, null)
    client.version(stepRevision).then(value => { versions.current.set(stepRevision, value); changed() }, () => { versions.current.delete(stepRevision); changed() })
  }, [client])
  return { steps, load, version: stepRevision => versions.current.get(stepRevision) }
}

export function Panel(props) {
  if (typeof props.sessionId !== 'string') return <div className="nai-desk nd-message">选择一个 NAI5 提示词会话以打开草稿。</div>
  return <SessionPanel key={props.sessionId} {...props} />
}

function SessionPanel({ sessionId, sessionList, getClient, acquireClient, useTabInfo }) {
  const presetSnapshot = useCallback(() => sessionList.getSnapshot().byId[sessionId]?.projectionValues?.agentPreset, [sessionList, sessionId])
  const preset = useSyncExternalStore(sessionList.subscribe, presetSnapshot, presetSnapshot)
  const client = useMemo(() => getClient(sessionId), [getClient, sessionId])
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot)
  const tabInfo = useTabInfo?.()
  const visible = tabInfo?.tab?.visible !== false
  const [ui, setUi] = useState(() => readUi(sessionId))
  const [expanded, setExpanded] = useState(false)
  const [removed, setRemoved] = useState(null)
  const [caret, setCaret] = useState(null)
  const [viewing, setViewing] = useState(null)
  const shownRef = useRef(null)
  const history = useHistory(client, state.draft?.revision, visible)

  useEffect(() => {
    if (preset !== PRESET_ID || !visible) return
    return acquireClient(sessionId)
  }, [preset, visible, acquireClient, sessionId])
  useEffect(() => { try { localStorage.setItem(`dsh.nai-desk.ui.v1.${sessionId}`, JSON.stringify(ui)) } catch {} }, [sessionId, ui])

  const { steps } = history
  const revision = state.draft?.revision
  const liveIndex = steps.length && steps.at(-1).revision === revision ? steps.length - 1 : steps.length
  const viewIndex = viewing === null ? liveIndex : steps.findIndex(step => step.revision === viewing)
  useEffect(() => { if (viewing !== null && viewIndex < 0) setViewing(null) }, [viewing, viewIndex])
  useEffect(() => {
    if (viewing === null || viewIndex < 0) return
    history.load(viewing)
    history.load(steps[viewIndex - 1]?.revision)
    if (viewIndex + 1 < liveIndex) history.load(steps[viewIndex + 1]?.revision)
  }, [viewing, viewIndex, liveIndex, steps, history.load])

  if (preset !== PRESET_ID) return <div className="nai-desk nd-message">选择使用 NAI5 提示词预设的会话以打开草稿。</div>
  if (!state.draft) return <div className="nai-desk nd-message" role="status">{state.error ?? '正在加载草稿…'}{state.error && <Button variant="outline" onClick={() => client.refresh()}>重新加载</Button>}</div>

  const busy = state.commandPending
  const reading = viewing !== null
  const loaded = reading ? history.version(viewing) : state.draft
  if (loaded) shownRef.current = loaded
  const shown = loaded ?? shownRef.current ?? state.draft
  const loading = reading && !loaded
  const go = index => { setCaret(null); if (index >= liveIndex) setViewing(null); else if (index >= 0) setViewing(steps[index].revision) }
  const step = steps[viewIndex]
  const [saveLabel, tone] = state.phase === 'conflict' ? ['存在版本冲突', 'warn'] : state.error ? ['同步异常', 'error'] : state.phase === 'saving' ? ['正在保存…', ''] : state.pending ? ['等待保存…', ''] : ['已同步', '']
  const removeCharacter = async (character, index) => {
    try { await client.command({ type: 'remove_character', id: character.id }); setRemoved({ character: structuredClone(character), index }) } catch {}
  }
  const restoreCharacter = async () => {
    if (!removed) return
    try { await client.command({ type: 'add_character', character: removed.character, index: Math.min(removed.index, client.getSnapshot().draft.characters.length) }); setRemoved(null) } catch {}
  }
  const shared = { draft: shown, client, ui, setUi, busy, readOnly: reading, caret, setCaret }

  return <div className={`nai-desk${expanded ? ' nd-expanded' : ''}`} onKeyDown={event => {
    if (event.key !== 'Escape') return
    if (reading) { go(liveIndex); event.stopPropagation() } else if (expanded) { setExpanded(false); event.stopPropagation() }
  }}>
    <header className="nd-header">
      <span className="nd-status" data-tone={tone || undefined} role="status">{saveLabel}</span>
      {liveIndex > 0 && <div className="nd-steps" role="group" aria-label="稿纸历史">
        <ToolButton label="上一步" disabled={viewIndex <= 0} onClick={() => go(viewIndex - 1)}><Icon kind="back" /></ToolButton>
        <span className="nd-step-count" title={step ? describe(step) : '当前稿纸'}>{viewIndex + 1} / {liveIndex + 1}</span>
        <ToolButton label="下一步" disabled={!reading} onClick={() => go(viewIndex + 1)}><Icon kind="forward" /></ToolButton>
      </div>}
      <ToolButton label={expanded ? '还原编辑区' : '展开编辑区'} aria-pressed={expanded} onClick={() => setExpanded(value => !value)}><Icon kind="expand" /></ToolButton>
    </header>
    <div className="nd-body" data-reading={reading || undefined} aria-busy={loading || undefined}>
      {reading && step && <div className="nd-history-bar" role="status">
        <span className="nd-history-meta"><strong>第 {viewIndex + 1} 步</strong>{describe(step)}</span>
        <span className="nd-history-actions">
          <Button variant="outline" onClick={() => go(liveIndex)}>回到最新</Button>
          <Button variant="primary" disabled={busy || loading} onClick={() => client.command({ type: 'restore', revision: viewing }).then(() => setViewing(null), () => {})}>用这一版</Button>
        </span>
      </div>}
      {!reading && state.error && <div className="nd-error" role="alert"><span>{state.error}</span><Button onClick={() => state.pending ? client.flush().catch(() => {}) : client.refresh()}>重试</Button></div>}
      {!reading && state.conflicts.map(conflict => <Conflict key={conflict.field} conflict={conflict} client={client} />)}
      <BaseCard {...shared} />
      <section className="nd-characters" aria-label="角色提示词" hidden={expanded}>
        <h2 className="nd-section-label"><span>角色</span><span>{shown.characters.length}</span></h2>
        {shown.characters.map((character, index) => <Character key={character.id} {...shared} character={character} index={index} count={shown.characters.length} onDelete={removeCharacter} />)}
        {!reading && removed && <div className="nd-notice" role="status"><span>已移除{removed.character.name ? `「${removed.character.name}」` : '角色栏'}</span><Button disabled={busy} onClick={restoreCharacter}>撤销</Button></div>}
        {!reading && <button type="button" className="nd-creator" disabled={busy || shown.characters.length >= 22} onClick={() => client.command({ type: 'add_character', character: {} }).catch(() => {})}><Icon kind="plus" />添加角色栏</button>}
      </section>
    </div>
  </div>
}
