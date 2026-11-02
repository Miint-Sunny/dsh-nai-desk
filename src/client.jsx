import React from 'react'
import { DeskClient } from './client-state.js'
import { requestDraft } from './transport.js'
import { Icon, Panel, TabTitle } from './panel.jsx'
import { PANEL_ID, PANEL_KIND, PRESET_ID } from './protocol.js'
import { DeskTurnCard, deskTurnDefinition } from './turn-card.jsx'
import css from './style.css'

export const inject = ['slots', 'sidebarRightTabs', 'sidebarRight', 'sessions', 'uiSession', 'uiConversation']

// Sessions whose draft already pushed the panel open once in this browser.
const AUTO_OPENED = 'dsh.nai-desk.auto-opened.v1'
function autoOpened() {
  try { const list = JSON.parse(localStorage.getItem(AUTO_OPENED) ?? '[]'); return Array.isArray(list) ? list : [] } catch { return [] }
}
function markAutoOpened(id) {
  try { localStorage.setItem(AUTO_OPENED, JSON.stringify([...autoOpened().filter(item => item !== id), id].slice(-200))) } catch {}
}

export function apply(ctx) {
  const clients = new Map()
  const watchers = new Map()
  const getClient = id => {
    if (!clients.has(id)) { const client = new DeskClient({ sessionId: id, request: requestDraft }); client.pause(); clients.set(id, client) }
    return clients.get(id)
  }
  const acquireClient = id => {
    const client = getClient(id)
    watchers.set(id, (watchers.get(id) ?? 0) + 1)
    client.resume()
    client.start()
    return () => {
      const count = Math.max(0, (watchers.get(id) ?? 1) - 1)
      watchers.set(id, count)
      if (!count) client.pause()
    }
  }

  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = PANEL_ID
    style.textContent = css
    document.head.append(style)
    return () => style.remove()
  }, 'nai-desk: styles')

  ctx.effect(() => {
    const current = ctx.uiSession.adapter.current
    const list = ctx.sessions.list
    let unregister
    const sync = () => {
      const id = current.getSnapshot().key
      const eligible = list.getSnapshot().byId[id]?.projectionValues?.agentPreset === PRESET_ID
      if (eligible && !unregister) unregister = ctx.sidebarRightTabs.register({
        id: PANEL_ID, kind: PANEL_KIND, keepMounted: true, priority: 'extension', title: () => '稿纸',
        guide: [{ id: 'open', order: 45, title: () => '提示词稿纸', description: () => '编辑当前会话的提示词草稿', icon: () => <Icon kind="notebook" /> }],
      })
      else if (!eligible && unregister) { unregister(); unregister = undefined }
    }
    const offCurrent = current.subscribe(sync), offList = list.subscribe(sync)
    sync()
    return () => { offCurrent(); offList(); unregister?.() }
  }, 'nai-desk: NAI5 tab availability')

  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab', key: PANEL_ID,
    inject: sessionId => ({ sessionId, sessionList: ctx.sessions.list, getClient, acquireClient }),
  }, Panel))
  const openDesk = () => { try { ctx.sidebarRight.openTab(PANEL_KIND) } catch {} }

  // The first time the model writes a session's draft, push the panel open the
  // way the host opens a submitted plan; later writes leave the layout alone.
  ctx.effect(() => {
    const current = ctx.uiSession.adapter.current
    const list = ctx.sessions.list
    let watched, release, stop
    const sync = () => {
      const id = current.getSnapshot().key
      const next = list.getSnapshot().byId[id]?.projectionValues?.agentPreset === PRESET_ID ? id : undefined
      if (next === watched) return
      stop?.(); release?.()
      stop = release = undefined
      watched = next
      if (!next) return
      stop = getClient(next).onRemoteChange(draft => {
        if (draft.updatedBy !== 'model' || autoOpened().includes(next) || current.getSnapshot().key !== next) return
        markAutoOpened(next)
        openDesk()
      })
      release = acquireClient(next)
    }
    const offCurrent = current.subscribe(sync), offList = list.subscribe(sync)
    sync()
    return () => { offCurrent(); offList(); stop?.(); release?.() }
  }, 'nai-desk: open on the first model write')

  ctx.uiConversation.events.register(deskTurnDefinition)
  ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
    name: 'conversation.chat.turnTail', id: 'nai-desk', order: 30,
    inject: () => ({ openDesk }),
  }, DeskTurnCard))

  ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab.title', key: PANEL_ID, inject: sessionId => ({ sessionId }),
  }, TabTitle))

  ctx.effect(() => {
    const beforeUnload = event => {
      if ([...clients.values()].some(client => client.getSnapshot().pending > 0)) { event.preventDefault(); event.returnValue = '' }
    }
    if (typeof window.addEventListener === 'function') window.addEventListener('beforeunload', beforeUnload)
    return () => {
      if (typeof window.removeEventListener === 'function') window.removeEventListener('beforeunload', beforeUnload)
      for (const client of clients.values()) client.close()
      clients.clear(); watchers.clear()
    }
  }, 'nai-desk: clients')
}
