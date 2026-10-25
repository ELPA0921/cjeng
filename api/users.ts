import type { IncomingMessage, ServerResponse } from 'node:http'
import { readSession, sameOrigin, settings, userDirectory } from '../server/security.ts'

// Staff account management for admins: list, add or change a role, remove.
export function createUsersHandler(deps = { readSession, sameOrigin, settings, userDirectory }) {
  return async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    try {
      const user = await deps.readSession(req)
      if (!user) { res.statusCode = 401; res.end(JSON.stringify({ error: '직원 계정으로 로그인해 주세요.' })); return }
      if (user.role !== 'admin') { res.statusCode = 403; res.end(JSON.stringify({ error: '관리자만 직원 계정을 관리할 수 있습니다.' })); return }
      const directory = deps.userDirectory()
      if (req.method === 'GET') { res.end(JSON.stringify({ members: await directory.members() })); return }
      if (!['POST', 'DELETE'].includes(req.method ?? '')) { res.statusCode = 405; res.setHeader('Allow', 'GET, POST, DELETE'); res.end('{}'); return }
      if (!deps.sameOrigin(req, deps.settings().origin)) { res.statusCode = 403; res.end(JSON.stringify({ error: '접속 주소를 확인해 주세요.' })); return }
      let body: { email?: unknown; role?: unknown }
      try {
        if (Number(req.headers['content-length']) > 2000) throw new Error()
        body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {}
      } catch { res.statusCode = 400; res.end(JSON.stringify({ error: '입력값을 확인해 주세요.' })); return }
      try {
        const members = req.method === 'POST' ? await directory.put(user.email, body.email, body.role) : await directory.remove(user.email, body.email)
        res.end(JSON.stringify({ members }))
      } catch (error) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : '저장하지 못했습니다.' }))
      }
    } catch {
      res.statusCode = 503
      res.end(JSON.stringify({ error: '계정 목록에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.' }))
    }
  }
}
export default createUsersHandler()
