import { createHmac, randomUUID } from 'node:crypto'
import { settings } from './security.ts'
import { validateOrders, validateRevision } from './orderValidation.ts'

export function signedEnvelope(action: 'read' | 'write', data: unknown, secret: string) {
  const payload = JSON.stringify({ action, data, issuedAt: Date.now(), nonce: randomUUID() })
  return { payload, signature: createHmac('sha256', secret).update(payload).digest('hex') }
}

export async function sheetsRequest(action: 'read' | 'write', data?: unknown) {
  const config = settings()
  if (!config.sheetsEndpoint || !config.sheetsSecret) throw new Error('구글 시트 연결 설정이 필요합니다.')
  const response = await fetch(config.sheetsEndpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signedEnvelope(action, data ?? null, config.sheetsSecret)),
    redirect: 'follow', signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw new Error('구글 시트 연결에 실패했습니다.')
  const body = await response.json()
  if (body.conflict === true) return null
  if (body.ok !== true || !body.data) throw new Error('구글 시트 요청에 실패했습니다.')
  return { orders: validateOrders(body.data.orders), revision: validateRevision(body.data.revision) }
}
