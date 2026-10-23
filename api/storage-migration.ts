import type { IncomingMessage, ServerResponse } from 'node:http'
import { readSession, sameOrigin, settings } from '../server/security.ts'
import { sheetsRequest, workspaceSheetsRequest } from '../server/googleSheets.ts'
import { applyWorkspaceOps, ensureWorkspaceSchema, readWorkspaceRevision, readWorkspaceRows, replaceOps, workspaceSql } from '../server/workspaceDb.ts'
import { workspaceCollections, workspaceSettings } from '../server/workspaceValidation.ts'

// Temporary admin tool for moving the shared data from Google Sheets to the database.
// GET compares both stores; POST copies Sheets into the database and compares again.
// It only ever reads Google Sheets, so the original stays untouched as a backup.

const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
  : JSON.stringify(value)

async function compare(sql: ReturnType<typeof workspaceSql>) {
  const [sheetOrders, sheetWorkspace] = await Promise.all([sheetsRequest('read'), workspaceSheetsRequest('workspace-read')])
  if (!sheetOrders || !sheetWorkspace) throw new Error('구글 시트를 읽지 못했습니다.')
  const dbRevision = await readWorkspaceRevision(sql).catch(() => null)
  const db = dbRevision === null ? null : await readWorkspaceRows(sql)
  const [dbOrders] = dbRevision === null ? [] : await sql`SELECT orders FROM cjeng_order_workspace WHERE id = 1`
  const parts = [...workspaceCollections, ...workspaceSettings].map(name => {
    const sheet = sheetWorkspace.data[name], stored = db?.data[name]
    return { name, sheets: Array.isArray(sheet) ? sheet.length : Object.keys(sheet).length, database: stored === undefined ? null : Array.isArray(stored) ? stored.length : Object.keys(stored).length, same: stored !== undefined && canonical(sheet) === canonical(stored) }
  })
  const orders = { name: 'orders', sheets: sheetOrders.orders.length, database: Array.isArray(dbOrders?.orders) ? dbOrders.orders.length : null, same: !!dbOrders && canonical(sheetOrders.orders) === canonical(dbOrders.orders) }
  const all = [orders, ...parts]
  return { storage: settings().storage, databaseReady: dbRevision !== null, allSame: all.every(part => part.same), parts: all, sheets: { orders: sheetOrders, workspace: sheetWorkspace } }
}

// The report goes to the browser, so it never includes the data itself.
const withoutData = (report: Awaited<ReturnType<typeof compare>>) => ({ storage: report.storage, databaseReady: report.databaseReady, allSame: report.allSame, parts: report.parts })

export function createMigrationHandler(deps = { readSession, sameOrigin, settings }) {
  return async function handler(req: IncomingMessage, res: ServerResponse) {
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    try {
      const user = await deps.readSession(req)
      const admin = deps.settings().allowed.values().next().value
      if (!user || user.email !== admin) { res.statusCode = 403; res.end(JSON.stringify({ error: '관리자 계정만 사용할 수 있습니다.' })); return }
      const sql = workspaceSql(deps.settings().databaseUrl)
      if (req.method === 'GET') { res.end(JSON.stringify(withoutData(await compare(sql)))); return }
      if (req.method !== 'POST') { res.statusCode = 405; res.end('{}'); return }
      if (!deps.sameOrigin(req, deps.settings().origin)) { res.statusCode = 403; res.end(JSON.stringify({ error: '접속 주소를 확인하세요.' })); return }
      if (deps.settings().storage !== 'sheets') { res.statusCode = 409; res.end(JSON.stringify({ error: '이미 데이터베이스로 전환되어 복사하지 않습니다.' })); return }
      await ensureWorkspaceSchema(sql)
      const { sheets } = await compare(sql)
      await sql`UPDATE cjeng_order_workspace SET orders = ${JSON.stringify(sheets.orders.orders)}::jsonb, revision = revision + 1, updated_at = now(), updated_by = ${user.email} WHERE id = 1`
      const revision = await readWorkspaceRevision(sql)
      if (revision === null || !await applyWorkspaceOps(sql, replaceOps(sheets.workspace.data), revision, user.email, { replace: true })) throw new Error('데이터베이스에 쓰지 못했습니다.')
      res.end(JSON.stringify({ copied: true, ...withoutData(await compare(sql)) }))
    } catch (error) {
      res.statusCode = 500
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : '이전 작업에 실패했습니다.' }))
    }
  }
}
export default createMigrationHandler()
