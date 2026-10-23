import { neon } from '@neondatabase/serverless'
import { settings } from './security.ts'
import { sheetsRequest } from './googleSheets.ts'

export function database() {
  const url = settings().databaseUrl
  if (!url) throw new Error('데이터베이스 연결 설정이 필요합니다.')
  return neon(url)
}

export async function readOrders() {
  if (settings().storage === 'sheets') {
    const snapshot = await sheetsRequest('read')
    if (!snapshot) throw new Error('구글 시트를 읽지 못했습니다.')
    return snapshot
  }
  const sql = database()
  const [row] = await sql`SELECT orders, revision, updated_at FROM cjeng_order_workspace WHERE id = 1`
  if (!row) throw new Error('공유 수주대장 초기 설정이 필요합니다.')
  return { orders: row.orders, revision: Number(row.revision), updatedAt: row.updated_at }
}

export async function writeOrders(orders: Record<string, string>[], revision: number | string, email: string) {
  if (settings().storage === 'sheets') return sheetsRequest('write', { orders, revision, email })
  if (typeof revision !== 'number') throw new Error('자료를 다시 불러오세요.')
  const sql = database()
  const [row] = await sql`UPDATE cjeng_order_workspace SET orders = ${JSON.stringify(orders)}::jsonb, revision = revision + 1, updated_at = now(), updated_by = ${email} WHERE id = 1 AND revision = ${revision} RETURNING orders, revision, updated_at`
  return row ? { orders: row.orders, revision: Number(row.revision), updatedAt: row.updated_at } : null
}

/** The stored order revision, or null when the store cannot answer cheaply (Google Sheets). */
export async function readOrdersRevision() {
  if (settings().storage === 'sheets') return null
  const [row] = await database()`SELECT revision FROM cjeng_order_workspace WHERE id = 1`
  return row ? String(row.revision) : null
}
