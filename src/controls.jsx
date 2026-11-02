// Adapted from DeepSeek Harness dsh-v0.2.1-rc.5 ui-primitives.
// Source: https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.2.1-rc.5/packages/client/ui-primitives/src
// MIT, Copyright (c) 2026 DeepSeek. See NOTICE.
// Third-party plugins own their controls; do not require internal Client modules.
import React, { forwardRef, useEffect, useRef } from 'react'

export const Button = forwardRef(function Button({ variant = 'ghost', size = 'sm', className = '', children, ...props }, ref) {
  return <button ref={ref} type="button" className={`nd-button nd-button-${variant} nd-button-${size} ${className}`} {...props}>{children}</button>
})

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
