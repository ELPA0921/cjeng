import type { IncomingMessage, ServerResponse } from 'node:http'
import { readOrders, writeOrders } from '../server/database.ts'
import { readSession, sameOrigin, settings } from '../server/security.ts'
import { validateOrders, validateRevision } from '../server/orderValidation.ts'

type Request = IncomingMessage & { body?: unknown }
export function createOrdersHandler(deps = { readSession, sameOrigin, settings, readOrders, writeOrders }) {
return async function handler(req: Request, res: ServerResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  try {
    const user = await deps.readSession(req)
    if (!user) { res.statusCode = 401; res.end(JSON.stringify({ error: '직원 계정으로 로그인해 주세요.' })); return }
    if (req.method === 'GET') { res.end(JSON.stringify(await deps.readOrders())); return }
    if (req.method !== 'PUT') { res.statusCode = 405; res.setHeader('Allow', 'GET, PUT'); res.end('{}'); return }
    if (!deps.sameOrigin(req, deps.settings().origin)) { res.statusCode = 403; res.end(JSON.stringify({ error: '요청한 접속 주소를 확인하세요.' })); return }
    let orders: Record<string, string>[], revision: number | string
    try {
      if (Number(req.headers['content-length']) > 2000000) throw new Error('수주 파일이 너무 큽니다.')
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      orders = validateOrders(body?.orders)
      revision = validateRevision(body?.revision)
    } catch (error) { res.statusCode = 400; res.end(JSON.stringify({ error: error instanceof Error ? error.message : '입력값을 확인하세요.' })); return }
    const saved = await deps.writeOrders(orders, revision, user.email)
    if (!saved) { res.statusCode = 409; res.end(JSON.stringify({ error: '다른 직원이 먼저 수주대장을 수정했습니다. 입력 내용을 복사해 두고 수정 창을 닫은 후 다시 열어주세요.' })); return }
    res.end(JSON.stringify(saved))
  } catch { res.statusCode = 503; res.end(JSON.stringify({ error: '공유 수주대장에 연결할 수 없습니다. 저장되지 않았습니다.' })) }
}
}

export default createOrdersHandler()
