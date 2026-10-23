import type { IncomingMessage, ServerResponse } from 'node:http'
import { readSession, sameOrigin, settings } from '../server/security.ts'
import { barobillConfig, createBarobillClient, BarobillError, CardInputError } from '../server/barobill.ts'

const client = () => createBarobillClient(barobillConfig())
export function createCardHandler(deps = { readSession, sameOrigin, settings, client }) {
  return async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    try {
      if (!await deps.readSession(req)) { res.statusCode = 401; res.end(JSON.stringify({ error: '직원 계정으로 로그인해 주세요.' })); return }
      if (req.method !== 'POST') { res.statusCode = 405; res.setHeader('Allow', 'POST'); res.end('{}'); return }
      if (!deps.sameOrigin(req, deps.settings().origin)) { res.statusCode = 403; res.end(JSON.stringify({ error: '접속 주소를 확인해 주세요.' })); return }
      let input: Record<string, unknown>
      try {
        if (Number(req.headers['content-length']) > 2000 || JSON.stringify(req.body ?? '').length > 2000) throw new Error()
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error()
        input = body as Record<string, unknown>
      } catch { throw new CardInputError('조회 조건을 확인해 주세요.') }
      if (input.action === 'cards') {
        const provider = deps.client()
        res.end(JSON.stringify({ cards: await provider.cards(), environment: provider.environment }))
      }
      else if (input.action === 'approvals') res.end(JSON.stringify(await deps.client().approvals(input)))
      else if (input.action === 'purchaseTaxInvoices') {
        const provider = deps.client()
        res.end(JSON.stringify({ ...await provider.purchaseTaxInvoices(input), environment: provider.environment }))
      }
      else throw new CardInputError('조회 종류를 확인해 주세요.')
    } catch (error) {
      res.statusCode = error instanceof CardInputError ? 400 : 503
      res.end(JSON.stringify({ error: error instanceof BarobillError || error instanceof CardInputError ? error.message : '법인카드 내역을 불러올 수 없습니다. 잠시 후 다시 조회해 주세요.' }))
    }
  }
}
export default createCardHandler()
