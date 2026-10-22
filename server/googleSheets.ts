import { createHmac, randomUUID } from 'node:crypto'
import { settings } from './security.ts'
import { validateOrders, validateRevision } from './orderValidation.ts'
import { validateWorkspace } from './workspaceValidation.ts'
import { packWorkspace } from './workspaceCodec.ts'

type SheetsAction = 'read' | 'write' | 'workspace-read' | 'workspace-write'
export function signedEnvelope(action: SheetsAction, data: unknown, secret: string) {
  const payload = JSON.stringify({ action, data, issuedAt: Date.now(), nonce: randomUUID() })
  return { payload, signature: createHmac('sha256', secret).update(payload).digest('hex') }
}

async function request(action: SheetsAction, data?: unknown) {
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
  return body.data
}

export async function sheetsRequest(action: 'read' | 'write', data?: unknown) {
  const body = await request(action,data)
  return body ? { orders: validateOrders(body.orders), revision: validateRevision(body.revision) } : null
}
export async function workspaceSheetsRequest(action: 'workspace-read' | 'workspace-write', data?: unknown) {
  const input = data as { data?: unknown } | undefined
  const outgoing = action === 'workspace-write' && input?.data
    ? { ...input, data: packWorkspace(validateWorkspace(input.data)) }
    : data
  const body=await request(action,outgoing)
  if(!body)return null
  const revision=validateRevision(body.revision)
  if(typeof revision!=='string' || typeof body.initialized!=='boolean')throw new Error('공유 자료 응답을 확인하세요.')
  return {data:validateWorkspace(body.data),revision,initialized:body.initialized}
}
