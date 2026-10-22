import type { IncomingMessage, ServerResponse } from 'node:http'
import { createLoginNonce, readSession, sameOrigin, settings, signIn, signOut } from '../server/security.ts'

type Request = IncomingMessage & { body?: unknown }
export default async function handler(req: Request, res: ServerResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  try {
    const config = settings()
    if (req.method === 'GET') {
      const user = await readSession(req)
      res.end(JSON.stringify(user ? { user } : { user: null, clientId: config.clientId, nonce: createLoginNonce(res) }))
      return
    }
    if (!sameOrigin(req, config.origin)) { res.statusCode = 403; res.end(JSON.stringify({ error: '요청한 접속 주소를 확인하세요.' })); return }
    if (req.method === 'DELETE') { signOut(res); res.end(JSON.stringify({ ok: true })); return }
    if (req.method !== 'POST') { res.statusCode = 405; res.setHeader('Allow', 'GET, POST, DELETE'); res.end('{}'); return }
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      const user = await signIn(req, res, body?.credential)
      res.end(JSON.stringify({ user }))
    } catch { res.statusCode = 401; res.end(JSON.stringify({ error: '접근이 허용된 직원 계정으로 다시 로그인해 주세요.' })) }
  } catch { res.statusCode = 503; res.end(JSON.stringify({ error: '공유 수주대장 연결 설정이 필요합니다. 관리자에게 문의하세요.' })) }
}
