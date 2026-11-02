import React from 'react'
import { DeskClient } from './client-state.js'
import { requestDraft } from './transport.js'
import { Icon, Panel } from './panel.jsx'
import { PANEL_ID, PANEL_KIND, PRESET_ID } from './protocol.js'
import css from './style.css'

export const inject = ['slots', 'sidebarRightTabs', 'sessions', 'uiSession']

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
        id: PANEL_ID, kind: PANEL_KIND, keepMounted: true, priority: 'extension', title: () => '提示词稿纸',
        guide: [{ id: 'open', order: 45, title: () => '提示词稿纸', description: () => '查看、编辑这个会话的 NAI5 提示词', icon: () => <Icon kind="notebook" /> }],
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
