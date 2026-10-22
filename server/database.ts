import { neon } from '@neondatabase/serverless'
import { settings } from './security.ts'

export function database() { return neon(settings().databaseUrl) }

export async function readOrders() {
  const sql = database()
  const [row] = await sql`SELECT orders, revision, updated_at FROM cjeng_order_workspace WHERE id = 1`
  if (!row) throw new Error('공유 수주대장 초기 설정이 필요합니다.')
  return { orders: row.orders, revision: Number(row.revision), updatedAt: row.updated_at }
}

export async function writeOrders(orders: Record<string, string>[], revision: number, email: string) {
  const sql = database()
  const [row] = await sql`UPDATE cjeng_order_workspace SET orders = ${JSON.stringify(orders)}::jsonb, revision = revision + 1, updated_at = now(), updated_by = ${email} WHERE id = 1 AND revision = ${revision} RETURNING orders, revision, updated_at`
  return row ? { orders: row.orders, revision: Number(row.revision), updatedAt: row.updated_at } : null
}
