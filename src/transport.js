import { API_PATH } from './protocol.js'

/** Use the authenticated desktop carrier when supplied, otherwise same-origin HTTP. */
export async function requestDraft(data, signal) {
  const transport = globalThis.__DSH_TRANSPORT__
  const response = await (transport?.fetch ? transport.fetch(API_PATH, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data), signal,
  }) : globalThis.fetch(API_PATH, {
    method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data), signal,
  }))
  let body
  try { body = await response.json() } catch { throw new Error(`暂时无法读取稿纸（HTTP ${response.status}），请重新连接 dsh`) }
  if (!response.ok) {
    const error = new Error(typeof body.error?.message === 'string' ? body.error.message : '稿纸请求失败')
    error.code = body.error?.code
    if (body.error?.current) error.current = body.error.current
    throw error
  }
  return body
}
