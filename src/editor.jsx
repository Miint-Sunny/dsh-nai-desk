import React, { useEffect, useRef } from 'react'
import { revealText, tokenRanges } from './mask.js'

const placeholders = {
  main: '例如：outdoors, soft lighting',
  prompt: '例如：girl, blue jacket',
}

/** Text with each placeholder wrapped, so the layer behind the textarea can paint it as a chip. */
function painted(value, ranges) {
  const parts = []
  let at = 0
  for (const range of ranges) {
    parts.push(value.slice(at, range.start), <mark key={range.start} className="nd-token">{range.token}</mark>)
    at = range.end
  }
  // A trailing newline needs one more character to take up its line.
  parts.push(value.slice(at), '​')
  return parts
}

/**
 * Native textarea for prompt text. Placeholders stay plain text for editing and
 * IME; a layer behind paints them, deletion removes a whole placeholder, and
 * copy or cut puts the original words on the clipboard.
 */
export function PromptEditor({ client, field, value, label, secrets, readOnly = false, onCaret }) {
  const area = useRef(null)
  const layer = useRef(null)
  const composing = useRef(false)
  const ranges = tokenRanges(value)
  const report = () => {
    const el = area.current
    if (el && document.activeElement === el) onCaret?.({ field, start: el.selectionStart, end: el.selectionEnd })
  }
  const keepOutOfPlaceholders = () => {
    const el = area.current
    if (el && el.selectionStart === el.selectionEnd) {
      const inside = ranges.find(range => el.selectionStart > range.start && el.selectionStart < range.end)
      if (inside) el.setSelectionRange(inside.end, inside.end)
    }
    report()
  }
  const track = useRef(keepOutOfPlaceholders)
  track.current = keepOutOfPlaceholders
  // React's onSelect misses some selection changes; the document event sees every one while this field has focus.
  useEffect(() => {
    const listener = () => { if (document.activeElement === area.current) track.current() }
    document.addEventListener('selectionchange', listener)
    return () => document.removeEventListener('selectionchange', listener)
  }, [])
  const onKeyDown = event => {
    if (readOnly || composing.current || (event.key !== 'Backspace' && event.key !== 'Delete')) return
    const el = event.currentTarget
    let start = el.selectionStart, end = el.selectionEnd
    if (start === end) {
      const hit = ranges.find(range => event.key === 'Backspace' ? start > range.start && start <= range.end : start >= range.start && start < range.end)
      if (hit) { start = hit.start; end = hit.end }
    } else for (const range of ranges) if (range.start < end && range.end > start) { start = Math.min(start, range.start); end = Math.max(end, range.end) }
    if (start !== el.selectionStart || end !== el.selectionEnd) el.setSelectionRange(start, end)
  }
  const transfer = (event, cut) => {
    const el = event.currentTarget
    const start = el.selectionStart, end = el.selectionEnd
    const picked = el.value.slice(start, end)
    if (!tokenRanges(picked).length) return
    event.preventDefault()
    event.clipboardData.setData('text/plain', revealText(picked, secrets))
    if (cut && !readOnly) {
      client.edit(field, el.value.slice(0, start) + el.value.slice(end))
      requestAnimationFrame(() => area.current?.setSelectionRange(start, start))
    }
  }
  const key = field === 'main' ? 'main' : field.endsWith(':prompt') ? 'prompt' : 'uc'
  return <div className="nd-editor-wrap">
    {ranges.length > 0 && <div ref={layer} className="nd-editor nd-editor-layer" aria-hidden="true">{painted(value, ranges)}</div>}
    <textarea
      ref={area} className="nd-editor" aria-label={label} value={value} spellCheck={false} readOnly={readOnly}
      placeholder={readOnly ? '' : placeholders[key] ?? ''}
      onCompositionStart={() => { composing.current = true }}
      onCompositionEnd={event => { composing.current = false; client.edit(field, event.currentTarget.value) }}
      onChange={event => client.edit(field, event.currentTarget.value, { deferSave: composing.current })}
      onSelect={keepOutOfPlaceholders} onFocus={report} onKeyDown={onKeyDown}
      onScroll={event => { if (layer.current) layer.current.scrollTop = event.currentTarget.scrollTop }}
      onCopy={event => transfer(event, false)} onCut={event => transfer(event, true)}
      onBlur={event => {
        if (!composing.current) client.flush().catch(() => {})
        if (!event.currentTarget.closest('.nd-card')?.contains(event.relatedTarget)) onCaret?.(null)
      }}
    />
  </div>
}

/** What the caret touches in this field: a selection that can be masked, or a placeholder that can be revealed. */
export function caretTarget(caret, field, value) {
  if (!caret || caret.field !== field) return null
  const ranges = tokenRanges(value)
  if (caret.end > caret.start) {
    const covers = ranges.some(range => range.start < caret.end && range.end > caret.start)
    return { kind: 'selection', start: caret.start, end: caret.end, text: value.slice(caret.start, caret.end), blocked: covers }
  }
  const range = ranges.find(item => caret.start >= item.start && caret.start <= item.end)
  return range ? { kind: 'token', ...range } : null
}
