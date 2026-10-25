import type { NeonQueryFunction } from '@neondatabase/serverless'

// Who may sign in, and who may manage that list. The first address in
// WORKSPACE_ALLOWED_EMAILS is the owner: always an admin, never removable, so the
// site can never lock everyone out. Everyone else lives in cjeng_users.
type Sql = NeonQueryFunction<false, false>
export type Role = 'admin' | 'staff'
export type Member = { email: string; name: string; role: Role; addedBy: string; addedAt: string; owner: boolean }

const roles: readonly Role[] = ['admin', 'staff']
export const isRole = (value: unknown): value is Role => roles.includes(value as Role)
export function normalizeEmail(value: unknown) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (email.length > 254 || !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email)) throw new Error('이메일 주소를 확인해 주세요.')
  return email
}
/** A free-form note such as "홍길동 부장", only to tell accounts apart. */
export function normalizeName(value: unknown) {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value == null ? '' : null
  if (name === null || name.length > 40) throw new Error('이름은 40자 이내로 적어 주세요.')
  return name
}

export async function ensureUsersTable(sql: Sql, envEmails: string[]) {
  const [owner, ...others] = envEmails
  // Seed from the environment list only once, while the table is still empty.
  const seed = JSON.stringify([...(owner ? [{ email: owner, role: 'admin' }] : []), ...others.map(email => ({ email, role: 'staff' }))])
  await sql.transaction([
    sql`CREATE TABLE IF NOT EXISTS cjeng_users (email text PRIMARY KEY, role text NOT NULL CHECK (role IN ('admin', 'staff')), added_by text NOT NULL DEFAULT '', added_at timestamptz NOT NULL DEFAULT now())`,
    sql`ALTER TABLE cjeng_users ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT ''`,
    sql`INSERT INTO cjeng_users (email, role, added_by) SELECT x.email, x.role, '기존 허용 목록' FROM jsonb_to_recordset(${seed}::jsonb) AS x(email text, role text)
      WHERE NOT EXISTS (SELECT 1 FROM cjeng_users) ON CONFLICT (email) DO NOTHING`,
  ])
}

export function createUserDirectory(options: { sql: () => Sql | null; envEmails: () => string[]; ttlMs?: number; now?: () => number }) {
  const ttl = options.ttlMs ?? 15000
  const now = options.now ?? Date.now
  let ready: Promise<void> | null = null
  let cache: { at: number; members: Member[] } | null = null
  const owner = () => options.envEmails()[0] ?? ''

  async function members(): Promise<Member[]> {
    const sql = options.sql()
    // Without the database (Google Sheets storage) the environment list is all there is.
    if (!sql) return options.envEmails().map((email, i) => ({ email, name: '', role: i === 0 ? 'admin' : 'staff', addedBy: '', addedAt: '', owner: i === 0 }))
    if (cache && now() - cache.at < ttl) return cache.members
    ready ??= ensureUsersTable(sql, options.envEmails()).catch(error => { ready = null; throw error })
    await ready
    const rows = await sql`SELECT email, name, role, added_by, added_at::text AS added_at FROM cjeng_users ORDER BY added_at, email`
    const list: Member[] = rows.map(row => ({ email: String(row.email), name: String(row.name ?? ''), role: isRole(row.role) ? row.role : 'staff', addedBy: String(row.added_by ?? ''), addedAt: String(row.added_at ?? ''), owner: row.email === owner() }))
    if (owner() && !list.some(member => member.owner)) list.unshift({ email: owner(), name: '', role: 'admin', addedBy: '', addedAt: '', owner: true })
    list.sort((a, b) => Number(b.owner) - Number(a.owner))
    cache = { at: now(), members: list.map(member => member.owner ? { ...member, role: 'admin' } : member) }
    return cache.members
  }

  return {
    members,
    async roleOf(email: string): Promise<Role | null> {
      return (await members()).find(member => member.email === email.toLowerCase())?.role ?? null
    },
    /** Adds an account or changes its role. The owner and the acting admin's own role stay as they are. */
    async put(actor: string, emailInput: unknown, role: unknown, nameInput?: unknown) {
      const email = normalizeEmail(emailInput)
      const name = normalizeName(nameInput)
      if (!isRole(role)) throw new Error('권한을 확인해 주세요.')
      if (email === owner()) throw new Error('소유자 계정은 바꿀 수 없습니다.')
      if (email === actor.toLowerCase()) throw new Error('자신의 권한은 바꿀 수 없습니다.')
      const sql = options.sql()
      if (!sql) throw new Error('데이터베이스 연결이 필요합니다.')
      await members()
      await sql`INSERT INTO cjeng_users (email, role, added_by, name) VALUES (${email}, ${role}, ${actor}, ${name}) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role`
      cache = null
      return members()
    },
    /** Sets the name note. Any account may be named, including the owner and the acting admin. */
    async rename(emailInput: unknown, nameInput: unknown) {
      const email = normalizeEmail(emailInput)
      const name = normalizeName(nameInput)
      const sql = options.sql()
      if (!sql) throw new Error('데이터베이스 연결이 필요합니다.')
      await members()
      const rows = email === owner()
        ? await sql`INSERT INTO cjeng_users (email, role, name) VALUES (${email}, 'admin', ${name}) ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING email`
        : await sql`UPDATE cjeng_users SET name = ${name} WHERE email = ${email} RETURNING email`
      if (!rows.length) throw new Error('등록되지 않은 계정입니다.')
      cache = null
      return members()
    },
    async remove(actor: string, emailInput: unknown) {
      const email = normalizeEmail(emailInput)
      if (email === owner()) throw new Error('소유자 계정은 삭제할 수 없습니다.')
      if (email === actor.toLowerCase()) throw new Error('자신의 계정은 삭제할 수 없습니다.')
      const sql = options.sql()
      if (!sql) throw new Error('데이터베이스 연결이 필요합니다.')
      await sql`DELETE FROM cjeng_users WHERE email = ${email}`
      cache = null
      return members()
    },
  }
}
