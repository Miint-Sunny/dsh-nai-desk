import React, { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { PRESET_ID } from './protocol.js'
import { fieldValue } from './client-state.js'
import { ActionMenu, Button, PromptTabs, Switch, ToolButton } from './controls.jsx'
import { HostIcon } from './host-icons.jsx'
import { PromptEditor, caretTarget } from './editor.jsx'
import { nextToken } from './mask.js'

// Eye artwork from the host's credential reveal control (ui-secret-mask SecretText), and the
// ellipsis, user and exit-fullscreen artwork from ui-primitives and ui-sidebar-right,
// dsh-v0.2.1-rc.5, MIT, see NOTICE. All drawn on the 16px grid with the host's 1px Regular stroke.
const EYE_CONTOUR = 'M1.5 8C2.9 5.25 5.25 3.5 8 3.5C10.75 3.5 13.1 5.25 14.5 8C13.1 10.75 10.75 12.5 8 12.5C5.25 12.5 2.9 10.75 1.5 8Z'
const glyphs = {
  up: <path d="M8 13.5V2.5M3.5 7 8 2.5 12.5 7" stroke="currentColor" />,
  down: <path d="M8 2.5v11M3.5 9 8 13.5 12.5 9" stroke="currentColor" />,
  back: <path d="M10 4 6.70711 7.29289c-.39053.39053-.39053 1.02369 0 1.41422L10 12" stroke="currentColor" />,
  forward: <path d="M6 4l3.29289 3.29289c.39053.39053.39053 1.02369 0 1.41422L6 12" stroke="currentColor" />,
  eye: <path d={`${EYE_CONTOUR}M10 8C10 9.1 9.1 10 8 10C6.9 10 6 9.1 6 8C6 6.9 6.9 6 8 6C9.1 6 10 6.9 10 8Z`} stroke="currentColor" strokeLinecap="round" />,
  eyeOff: <path d={`${EYE_CONTOUR}M2.5 2.5L13.5 13.5`} stroke="currentColor" strokeLinecap="round" />,
  // The exit-fullscreen corners plus the diagonals of the expand artwork, pointing inward.
  shrink: <><path d="M9 2.5V6C9 6.26522 9.10536 6.51957 9.29289 6.70711C9.48043 6.89464 9.73478 7 10 7H13.5" stroke="currentColor" /><path d="M7 13.5V10C7 9.73478 6.89464 9.48043 6.70711 9.29289C6.51957 9.10536 6.26522 9 6 9H2.5" stroke="currentColor" /><path d="M9.5 6.5 13.914 2.08594M6.5 9.5 2.08594 13.914" stroke="currentColor" /></>,
  ellipsis: <><path d="M3 9C3.55228 9 4 8.55228 4 8C4 7.44772 3.55228 7 3 7C2.44772 7 2 7.44772 2 8C2 8.55228 2.44772 9 3 9Z" fill="currentColor" /><path d="M8 9C8.55228 9 9 8.55228 9 8C9 7.44772 8.55228 7 8 7C7.44772 7 7 7.44772 7 8C7 8.55228 7.44772 9 8 9Z" fill="currentColor" /><path d="M13 9C13.5523 9 14 8.55228 14 8C14 7.44772 13.5523 7 13 7C12.4477 7 12 7.44772 12 8C12 8.55228 12.4477 9 13 9Z" fill="currentColor" /></>,
  notebook: <><path d="M4 1.5h8a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z" stroke="currentColor" /><path d="M5.5 5h5M5.5 8h5M5.5 11h3" stroke="currentColor" /></>,
  female: <><circle cx="8" cy="5.5" r="3.5" stroke="currentColor" /><path d="M8 9v6M5 12.5h6" stroke="currentColor" /></>,
  male: <><circle cx="6.5" cy="9.5" r="3.5" stroke="currentColor" /><path d="M9 7l5-5M10 2h4v4" stroke="currentColor" /></>,
  person: <><path d="M8 8.25C9.51878 8.25 10.75 7.01878 10.75 5.5C10.75 3.98122 9.51878 2.75 8 2.75C6.48122 2.75 5.25 3.98122 5.25 5.5C5.25 7.01878 6.48122 8.25 8 8.25Z" stroke="currentColor" /><path d="M2.5 14.5C2.5 11.5 5.25 10.25 8 10.25C10.75 10.25 13.5 11.5 13.5 14.5" stroke="currentColor" /></>,
}

export function Icon({ kind }) {
  if (!glyphs[kind]) return <HostIcon kind={kind} />
  return <svg viewBox="0 0 16 16" width="16" height="16" fill="none" strokeWidth="1" aria-hidden="true">{glyphs[kind]}</svg>
}

/** Live chip title for the sidebar tab: glyph plus a short name, like the host's Files tab. */
export function TabTitle() {
  return <><span className="nd-tab-title-icon"><Icon kind="notebook" /></span>稿纸</>
}

/** A field the model cannot read keeps an eye-off mark on its tab, so the state shows even while the other tab is open. */
const tabLabel = (text, masked) => <>{text}{masked && <span className="nd-tab-mark" role="img" aria-label="（模型不可见）"><Icon kind="eyeOff" /></span>}</>

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

const minutesAgo = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' })
const clock = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const dayAndClock = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
function when(at) {
  if (at === null) return ''
  const age = Date.now() - at
  if (age < 60_000) return '刚刚'
  if (age < 3_600_000) return minutesAgo.format(-Math.floor(age / 60_000), 'minute')
  return new Date(at).toDateString() === new Date().toDateString() ? clock.format(at) : dayAndClock.format(at)
}
const who = step => step.restored ? '恢复较早版本' : step.source === 'model' ? '模型修改' : step.source === 'user' ? '手动修改' : '较早的内容'
const describe = step => [who(step), when(step.at), step.restored ? '' : step.parts.join('、')].filter(Boolean).join(' · ')

/** Under the editor: mask the selected text, or show and reveal the placeholder at the caret. */
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
    return <div className="nd-hint">
      <span className="nd-hint-text">{target.blocked ? '所选内容已包含屏蔽部分' : `已选 ${target.text.length} 个字符`}</span>
      <Button variant="outline" onMouseDown={keepFocus} disabled={busy || target.blocked || !target.text.trim()} onClick={mask}><Icon kind="eyeOff" />向模型屏蔽</Button>
    </div>
  }
  const secret = client.getSnapshot().draft?.secrets?.[target.token]
  return <div className="nd-hint">
    <span className="nd-hint-text"><mark className="nd-token">{target.token}</mark>{secret === undefined ? '无法读取原文。删除此占位后重新输入。' : <span className="nd-hint-secret">{secret}</span>}</span>
    {secret !== undefined && <Button variant="outline" onMouseDown={keepFocus} disabled={busy} onClick={() => run({ type: 'unmask', token: target.token })}>取消屏蔽</Button>}
  </div>
}

/**
 * Whole-field or whole-character masking. The glyph shows the state (eye-off while
 * the model cannot read it), the accessible name stays fixed with aria-pressed, and
 * the tooltip names what a click does. In history versions it only reports the state.
 */
function MaskToggle({ name, masked, readOnly, busy, onToggle }) {
  return <ToolButton label={`向模型屏蔽${name}`} aria-pressed={masked}
    title={readOnly ? (masked ? '模型不可见' : '模型可见') : (masked ? '取消屏蔽' : '向模型屏蔽')}
    disabled={busy && !readOnly} aria-disabled={readOnly || undefined} onClick={readOnly ? undefined : onToggle}>
    <Icon kind={masked ? 'eyeOff' : 'eye'} />
  </ToolButton>
}

function BaseCard({ draft, client, ui, setUi, readOnly, caret, setCaret, busy }) {
  const tabsId = useId()
  const tab = ui.baseTab
  const options = [
    { value: 'main', label: tabLabel('主提示词', draft.mask?.main === true) },
    { value: 'uc', label: tabLabel('UC', draft.mask?.uc === true), title: '负面提示词' },
  ]
  const masked = draft.mask?.[tab] === true
  return <section className="nd-card nd-base" aria-label="主提示词与 UC">
    <div className="nd-card-head">
      <PromptTabs id={tabsId} value={tab} options={options} label="主提示词与 UC" onChange={value => setUi(previous => ({ ...previous, baseTab: value }))} />
      <span className="nd-head-fill" />
      <MaskToggle name={tab === 'main' ? '主提示词' : ' UC'} masked={masked} readOnly={readOnly} busy={busy}
        onToggle={() => client.command({ type: 'set_mask', field: tab, masked: !masked }).catch(() => {})} />
    </div>
    {options.map(option => <div className="nd-prompt-panel" key={option.value} role="tabpanel" id={`${tabsId}-${option.value}-panel`} aria-labelledby={`${tabsId}-${option.value}`} hidden={tab !== option.value}>
      <PromptEditor client={client} field={option.value} value={draft[option.value]} label={option.value === 'main' ? '主提示词' : 'UC'} secrets={draft.secrets} readOnly={readOnly} onCaret={setCaret} />
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
  const options = [{ value: 'prompt', label: '提示词' }, { value: 'uc', label: 'UC', title: '角色的负面提示词' }]
  return <section className={`nd-card nd-character${character.enabled ? '' : ' nd-disabled'}`}>
    <div className="nd-card-head">
      <span className="nd-gender"><Icon kind={genderOf(character.prompt)} /></span>
      <input aria-label={`角色 ${n} 名称`} className="nd-name" value={character.name} maxLength={128} placeholder={`角色 ${n}`} readOnly={readOnly}
        onChange={event => client.edit(`character:${id}:name`, event.currentTarget.value)}
        onBlur={() => { if (!readOnly) client.flush().catch(() => {}) }} />
      <div className="nd-actions">
        <MaskToggle name={`角色 ${n}`} masked={character.masked === true} readOnly={readOnly} busy={busy}
          onToggle={() => run({ type: 'set_character', id, patch: { masked: !character.masked } })} />
        <Switch checked={character.enabled} label={`启用角色 ${n}`} disabled={busy && !readOnly} readOnly={readOnly}
          title={readOnly ? (character.enabled ? '已启用' : '已停用') : character.enabled ? `停用角色 ${n}` : `启用角色 ${n}`}
          onChange={enabled => run({ type: 'set_character', id, patch: { enabled } })} />
        {!readOnly && <ActionMenu label={`角色 ${n} 的更多操作`} icon={<Icon kind="ellipsis" />} disabled={busy} items={[
          { id: 'up', label: '上移', icon: <Icon kind="up" />, disabled: index === 0, onSelect: () => run({ type: 'move_character', id, index: index - 1 }) },
          { id: 'down', label: '下移', icon: <Icon kind="down" />, disabled: index === count - 1, onSelect: () => run({ type: 'move_character', id, index: index + 1 }) },
          { id: 'delete', label: '删除', icon: <Icon kind="trash" />, danger: true, separatorBefore: true, onSelect: () => onDelete(character, index) },
        ]} />}
        <ToolButton label={`${collapsed ? '展开' : '收起'}角色 ${n}`} aria-expanded={!collapsed} aria-controls={`nd-character-${id}`}
          onClick={() => setUi(previous => ({ ...previous, collapsed: { ...previous.collapsed, [id]: !collapsed } }))}><Icon kind={collapsed ? 'chevronDown' : 'chevronUp'} /></ToolButton>
      </div>
    </div>
    <div className="nd-card-body" id={`nd-character-${id}`} hidden={collapsed}>
      <PromptTabs id={tabsId} value={tab} options={options} label={`角色 ${n} 的提示词与 UC`}
        onChange={value => setUi(previous => ({ ...previous, tabs: { ...previous.tabs, [id]: value } }))} />
      {options.map(option => <div key={option.value} className="nd-prompt-panel" role="tabpanel" id={`${tabsId}-${option.value}-panel`} aria-labelledby={`${tabsId}-${option.value}`} hidden={tab !== option.value}>
        <PromptEditor client={client} field={`character:${id}:${option.value}`} value={character[option.value]} label={`角色 ${n} ${option.value === 'prompt' ? '提示词' : 'UC'}`} secrets={draft.secrets} readOnly={readOnly} onCaret={setCaret} />
      </div>)}
      {!readOnly && <MaskHint target={caretTarget(caret, field, character[tab])} field={field} client={client} busy={busy} setCaret={setCaret} />}
    </div>
  </section>
}

function Conflict({ conflict, client }) {
  const label = conflict.field === 'main' ? '主提示词' : conflict.field === 'uc' ? 'UC' : conflict.field.endsWith(':name') ? '角色名称' : conflict.field.endsWith(':uc') ? '角色 UC' : '角色提示词'
  return <section className="nd-conflict" role="alert">
    <strong>{conflict.deleted ? '该角色已被删除，未保存的修改无法写入' : `${label}的修改与已保存的版本冲突`}</strong>
    {conflict.notice && <p>{conflict.notice}</p>}
    <label>你的修改（未保存）<textarea readOnly value={conflict.local} rows={3} /></label>
    {!conflict.deleted && <label>已保存的版本<textarea readOnly value={conflict.remote ?? ''} rows={3} /></label>}
    <div className="nd-conflict-actions">
      {!conflict.deleted && <Button variant="outline" onClick={() => client.resolveConflict(conflict.field, 'local', conflict.revision).catch(() => {})}>保留你的修改</Button>}
      <Button variant="outline" onClick={() => client.resolveConflict(conflict.field, 'remote', conflict.revision).catch(() => {})}>{conflict.deleted ? '放弃未保存的修改' : '使用已保存的版本'}</Button>
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
  if (typeof props.sessionId !== 'string') return <div className="nai-desk nd-message">请先选择会话</div>
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
  const undoRef = useRef(null)
  const history = useHistory(client, state.draft?.revision, visible)

  useEffect(() => {
    if (preset !== PRESET_ID || !visible) return
    return acquireClient(sessionId)
  }, [preset, visible, acquireClient, sessionId])
  useEffect(() => { try { localStorage.setItem(`dsh.nai-desk.ui.v1.${sessionId}`, JSON.stringify(ui)) } catch {} }, [sessionId, ui])
  // The deleted card took its menu with it; Undo, in the same place, takes the focus.
  useEffect(() => { if (removed) undoRef.current?.focus() }, [removed])

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

  if (preset !== PRESET_ID) return <div className="nai-desk nd-message">稿纸只用于「NAI5 提示词」预设的会话。</div>
  if (!state.draft) return <div className="nai-desk nd-message" role="status">{state.error ?? '正在读取稿纸…'}{state.error && <Button variant="outline" onClick={() => client.refresh()}>重试</Button>}</div>

  const busy = state.commandPending
  const reading = viewing !== null
  const loaded = reading ? history.version(viewing) : state.draft
  if (loaded) shownRef.current = loaded
  const shown = loaded ?? shownRef.current ?? state.draft
  const loading = reading && !loaded
  const go = index => { setCaret(null); if (index >= liveIndex) setViewing(null); else if (index >= 0) setViewing(steps[index].revision) }
  const step = steps[viewIndex]
  const [saveLabel, tone] = state.phase === 'conflict' ? ['保存冲突', 'warn'] : state.error ? ['无法同步', 'error'] : state.phase === 'saving' || state.pending ? ['保存中…', ''] : ['已保存', '']
  const atLimit = shown.characters.length >= 22
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
      {liveIndex > 0 && <div className="nd-steps" role="group" aria-label="版本历史">
        <ToolButton label="上一个版本" disabled={viewIndex <= 0} onClick={() => go(viewIndex - 1)}><Icon kind="back" /></ToolButton>
        <span className="nd-step-count" title={step ? describe(step) : '当前版本'}>{viewIndex + 1} / {liveIndex + 1}</span>
        <ToolButton label="下一个版本" disabled={!reading} onClick={() => go(viewIndex + 1)}><Icon kind="forward" /></ToolButton>
      </div>}
      <ToolButton label={expanded ? '退出全栏编辑' : '全栏编辑'} onClick={() => setExpanded(value => !value)}><Icon kind={expanded ? 'shrink' : 'expand'} /></ToolButton>
    </header>
    <div className="nd-visually-hidden" role="status">{reading ? `正在查看第 ${viewIndex + 1} 个版本，共 ${liveIndex + 1} 个` : ''}</div>
    <div className="nd-body" data-reading={reading || undefined} aria-busy={loading || undefined}>
      {reading && step && <div className="nd-history-bar">
        <span className="nd-history-meta"><strong>{who(step)}</strong>{step.at !== null && <span>{when(step.at)}</span>}{!step.restored && step.parts.length > 0 && <span>{step.parts.join('、')}</span>}</span>
        <span className="nd-history-actions">
          <Button variant="outline" onClick={() => go(liveIndex)}>返回当前版本</Button>
          <Button variant="primary" disabled={busy || loading} onClick={() => client.command({ type: 'restore', revision: viewing }).then(() => setViewing(null), () => {})}>恢复此版本</Button>
        </span>
      </div>}
      {!reading && state.error && <div className="nd-error" role="alert"><span>{state.error}</span><Button onClick={() => state.pending ? client.flush().catch(() => {}) : client.refresh()}>重试</Button></div>}
      {!reading && state.conflicts.map(conflict => <Conflict key={conflict.field} conflict={conflict} client={client} />)}
      <BaseCard {...shared} />
      <section className="nd-characters" aria-label="角色" hidden={expanded}>
        {shown.characters.map((character, index) => <Character key={character.id} {...shared} character={character} index={index} count={shown.characters.length} onDelete={removeCharacter} />)}
        <div className="nd-notice-region" role="status">
          {!reading && removed && <div className="nd-notice"><span>{removed.character.name ? `已删除「${removed.character.name}」` : `已删除角色 ${removed.index + 1}`}</span><Button ref={undoRef} disabled={busy} onClick={restoreCharacter}>撤销</Button></div>}
        </div>
        {!reading && <button type="button" className="nd-creator" disabled={busy || atLimit} onClick={() => client.command({ type: 'add_character', character: {} }).catch(() => {})}>
          {atLimit ? '已达到 22 个角色的上限' : <><Icon kind="plus" />添加角色</>}
        </button>}
      </section>
    </div>
  </div>
}
