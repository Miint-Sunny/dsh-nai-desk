import React from 'react'
import { TURN_DATA_KEY } from './turn-writes.js'

export { deskTurnDefinition } from './turn-writes.js'

const Glyph = () => <svg viewBox="0 0 16 16" width="20" height="20" fill="none" strokeWidth="1" aria-hidden="true">
  <path d="M4 1.5h8a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z" stroke="currentColor" />
  <path d="M5.5 5h5M5.5 8h5M5.5 11h3" stroke="currentColor" />
</svg>

/** One card per Turn that wrote the draft, in the file-delivery card treatment the plan cards use. */
export function DeskTurnCard({ turn, seq, openDesk }) {
  const writes = turn?.data?.get?.(TURN_DATA_KEY)?.writes?.filter(write => write.seq <= (turn.end?.seq ?? seq))
  if (!writes?.length) return null
  const parts = [...new Set(writes.map(write => write.label))]
  return <div className="nd-turn-cards">
    <button type="button" className="nd-turn-card" aria-label="在侧边栏打开稿纸" onClick={openDesk}>
      <span className="nd-turn-card-icon"><Glyph /></span>
      <span className="nd-turn-card-details">
        <span className="nd-turn-card-title">稿纸</span>
        <span className="nd-turn-card-description">已修改：{parts.join('、')}</span>
      </span>
      <span className="nd-turn-card-open">打开</span>
    </button>
  </div>
}
