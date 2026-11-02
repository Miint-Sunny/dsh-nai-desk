// Adapted from DeepSeek Harness dsh-v0.2.1-rc.5 ui-primitives (Button, Switch, SegmentedControl, Menu)
// and the Workspace files panel header tools.
// Source: https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.2.1-rc.5/packages/client/ui-primitives/src
// MIT, Copyright (c) 2026 DeepSeek. See NOTICE.
// Third-party plugins own their controls; do not require internal Client modules.
import React, { forwardRef, useEffect, useId, useRef, useState } from 'react'

export const Button = forwardRef(function Button({ variant = 'ghost', size = 'sm', className = '', children, ...props }, ref) {
  return <button ref={ref} type="button" className={`nd-button nd-button-${variant} nd-button-${size} ${className}`} {...props}>{children}</button>
})

/** 28px square icon action, matching the host panel header tools. */
export function ToolButton({ label, title, children, className = '', ...props }) {
  return <button type="button" className={`nd-tool ${className}`} aria-label={label} title={title ?? label} {...props}>{children}</button>
}

/** Two-state toggle, 36×20; the state lives in aria-checked only. Read-only stays focusable so its state can still be read. */
export function Switch({ checked, onChange, label, title, disabled = false, readOnly = false }) {
  return <button type="button" role="switch" className="nd-switch" aria-checked={checked} aria-label={label} title={title}
    disabled={disabled} aria-disabled={readOnly || undefined} onClick={readOnly ? undefined : () => onChange(!checked)}><span className="nd-switch-thumb" /></button>
}

/**
 * Action menu on a 28px tool anchor, after the host Menu: the card opens below
 * the anchor (above when the scroll area has no room), ↑/↓/Home/End walk the
 * rows, Escape or Shift+Tab return to the anchor, Tab settles, and choosing a
 * row closes the menu before the action runs. Opening by keyboard focuses the
 * first row; opening by pointer leaves focus on the anchor.
 */
export function ActionMenu({ label, icon, items, disabled = false }) {
  const [open, setOpen] = useState(false)
  const [above, setAbove] = useState(false)
  const root = useRef(null), anchor = useRef(null), list = useRef(null), focusFirst = useRef(false)
  const id = useId()
  const rows = () => [...(list.current?.querySelectorAll('[role="menuitem"]:not(:disabled)') ?? [])]
  const close = returnFocus => { setOpen(false); if (returnFocus) anchor.current?.focus() }
  const show = byKeyboard => {
    const scroller = root.current?.closest('.nd-body')?.getBoundingClientRect(), box = anchor.current.getBoundingClientRect()
    setAbove(Boolean(scroller) && scroller.bottom - box.bottom < 140 && box.top - scroller.top > scroller.bottom - box.bottom)
    focusFirst.current = byKeyboard
    setOpen(true)
  }
  useEffect(() => {
    if (!open) return
    if (focusFirst.current) rows()[0]?.focus()
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  }, [open])
  useEffect(() => { if (disabled) setOpen(false) }, [disabled])
  const onAnchorKeyDown = event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (open) rows()[event.key === 'ArrowDown' ? 0 : rows().length - 1]?.focus(); else show(true)
    } else if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(true) }
  }
  const onListKeyDown = event => {
    const all = rows(), at = all.indexOf(document.activeElement)
    if (event.key === 'Escape' || (event.key === 'Tab' && event.shiftKey)) { event.preventDefault(); event.stopPropagation(); close(true) }
    else if (event.key === 'Tab') setOpen(false)
    else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? all.length - 1 : (at + (event.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length
      all[next]?.focus()
    }
  }
  return <div ref={root} className="nd-menu">
    <button ref={anchor} type="button" className="nd-tool" aria-label={label} title={label} disabled={disabled}
      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={event => { if (open) close(false); else show(event.detail === 0) }} onKeyDown={onAnchorKeyDown}>{icon}</button>
    {open && <div ref={list} id={id} role="menu" aria-label={label} className={`nd-menu-list${above ? ' nd-menu-above' : ''}`} onKeyDown={onListKeyDown}>
      {items.map(item => <React.Fragment key={item.id}>
        {item.separatorBefore && <div role="separator" className="nd-menu-separator" />}
        <button type="button" role="menuitem" tabIndex={-1} className={`nd-menu-item${item.danger ? ' nd-menu-danger' : ''}`} disabled={item.disabled}
          onClick={() => { close(true); item.onSelect() }}>
          <span className="nd-menu-icon">{item.icon}</span><span className="nd-menu-label">{item.label}</span>
        </button>
      </React.Fragment>)}
    </div>}
  </div>
}

export function PromptTabs({ id, value, options, onChange, label }) {
  const list = useRef(null)
  const selected = options.findIndex(option => option.value === value)
  useEffect(() => {
    if (list.current?.contains(document.activeElement)) list.current.querySelector('[role="tab"][aria-selected="true"]')?.focus()
  }, [value])
  const onKeyDown = event => {
    const key = event.key
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) return
    event.preventDefault()
    const index = key === 'Home' ? 0 : key === 'End' ? options.length - 1
      : (selected + (key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
    if (index !== selected) onChange(options[index].value)
  }
  return <div ref={list} className="nd-tabs" role="tablist" aria-label={label}
    style={{ '--nd-segment-count': options.length, '--nd-segment-index': selected }}>
    <span className="nd-tab-indicator" aria-hidden="true" />
    {options.map(option => <button key={option.value} type="button" role="tab" className="nd-tab"
      id={`${id}-${option.value}`} aria-controls={`${id}-${option.value}-panel`} aria-selected={option.value === value}
      tabIndex={option.value === value ? 0 : -1} title={option.title}
      onClick={() => { if (option.value !== value) onChange(option.value) }} onKeyDown={onKeyDown}>{option.label}</button>)}
  </div>
}
