import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { applyWorkspaceOps, ensureWorkspaceSchema, readWorkspaceRevision, readWorkspaceRows, replaceOps, validateOps } from './workspaceDb.ts'
import { emptyWorkspace } from '../src/workspaceTypes.ts'

// Runs the real SQL against an in-process Postgres through a stand-in for the Neon driver:
// tagged templates become parameterized queries and transaction() runs them atomically.
function neonLike(db) {
  const sql = (strings, ...values) => {
    const text = strings.reduce((out, part, i) => out + part + (i < values.length ? `$${i + 1}` : ''), '')
    return { text, values, then: (resolve, reject) => db.query(text, values).then(result => result.rows).then(resolve, reject) }
  }
  sql.transaction = async queries => db.transaction(async tx => {
    const results = []
    for (const query of queries) results.push((await tx.query(query.text, query.values)).rows)
    return results
  })
  return sql
}

const expense = (id, amount, extra = {}) => ({ id, projectId: 'o-1', date: '2026-10-01', kind: '법인카드', vendor: '거래처', memo: '', amount, ...extra })
const log = id => ({ id, projectId: 'work-common', date: '2026-10-02', worker: '직원', workerType: '직원', startTime: '07:30', endTime: '16:30', overtimeHours: 0, location: '', task: '작업', note: '', hours: 8 })

async function freshStore() {
  const sql = neonLike(new PGlite())
  await ensureWorkspaceSchema(sql)
  await ensureWorkspaceSchema(sql)
  return sql
}

test('a full copy reads back identical, in the original order, and marks the store initialized', async () => {
  const sql = await freshStore()
  assert.equal(await readWorkspaceRevision(sql), '0')
  const data = { ...emptyWorkspace(), expenses: [expense('b', 2), expense('a', 1, { cardNumber: '3888', supplyAmount: 0.5 })], workLogs: [log('w1')], inactiveVendorKeys: ['k'], vendorEdits: { x: { company: 'c', contact: '', mobile: '', tel: '', fax: '', email: '', address: '', item: '' } } }
  const revision = await applyWorkspaceOps(sql, replaceOps(data), '0', 'admin@x', { replace: true })
  assert.equal(revision, '1')
  const read = await readWorkspaceRows(sql)
  assert.deepEqual(read, { data, revision: '1', initialized: true })
})

test('row saves upsert, delete and update settings atomically, and a stale revision writes nothing', async () => {
  const sql = await freshStore()
  await applyWorkspaceOps(sql, replaceOps({ ...emptyWorkspace(), expenses: [expense('a', 1), expense('b', 2)] }), '0', 'u', { replace: true })
  const ops = validateOps({ upsert: { expenses: [expense('b', 20), expense('c', 3)] }, delete: { expenses: ['a'] }, settings: { deletedVendorKeys: ['gone'] } })
  assert.equal(await applyWorkspaceOps(sql, ops, '1', 'u'), '2')
  let read = await readWorkspaceRows(sql)
  assert.deepEqual(read.data.expenses, [expense('b', 20), expense('c', 3)])
  assert.deepEqual(read.data.deletedVendorKeys, ['gone'])
  // Someone saving with the old revision must not change anything.
  assert.equal(await applyWorkspaceOps(sql, validateOps({ upsert: { expenses: [expense('z', 9)] }, delete: { expenses: ['b'] } }), '1', 'late'), null)
  read = await readWorkspaceRows(sql)
  assert.equal(read.revision, '2')
  assert.deepEqual(read.data.expenses.map(row => row.id), ['b', 'c'])
})

test('save requests are validated before reaching the database', () => {
  assert.throws(() => validateOps({ upsert: { expenses: [{ id: 'x' }] } }))
  assert.throws(() => validateOps({ upsert: { unknown: [] } }), /자료 종류/)
  assert.throws(() => validateOps({ delete: { expenses: [5] } }), /삭제/)
  assert.throws(() => validateOps({ settings: { orders: [] } }), /설정/)
  assert.deepEqual(validateOps({ upsert: { expenses: [['e', 'o', '2026-10-01', '현금', 'v', '', 5]] } }).upsert.expenses, [{ id: 'e', projectId: 'o', date: '2026-10-01', kind: '현금', vendor: 'v', memo: '', amount: 5 }])
})

test('a large copy is split across statements and still keeps every row in order', async () => {
  const sql = await freshStore()
  const expenses = Array.from({ length: 2500 }, (_, i) => expense(`e${String(i).padStart(4, '0')}`, i))
  await applyWorkspaceOps(sql, replaceOps({ ...emptyWorkspace(), expenses }), '0', 'u', { replace: true })
  const read = await readWorkspaceRows(sql)
  assert.equal(read.data.expenses.length, 2500)
  assert.deepEqual(read.data.expenses.map(row => row.id), expenses.map(row => row.id))
})

test('the workspace API accepts the database revision and saves only the sent rows', async () => {
  const { createWorkspaceHandler } = await import('../api/workspace.ts')
  const sql = await freshStore()
  await applyWorkspaceOps(sql, replaceOps({ ...emptyWorkspace(), expenses: [expense('a', 1)] }), '0', 'u', { replace: true })
  const handler = createWorkspaceHandler({
    readSession: async () => ({ email: 'staff@x', name: 'S', sub: '1' }),
    sameOrigin: () => true,
    settings: () => ({ storage: 'postgres', origin: 'https://x', allowed: new Set(['admin@x']) }),
    workspaceSheetsRequest: async () => { throw new Error('sheets must not be used') },
    rowStore: { sql: () => sql, readWorkspaceRevision, readWorkspaceRows, applyWorkspaceOps },
  })
  const call = async (method, url, body) => {
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v }, end(text) { this.body = JSON.parse(text) } }
    await handler({ method, url, headers: {}, body }, res)
    return res
  }
  const saved = await call('PUT', '/api/workspace', { ops: { upsert: { expenses: [expense('b', 2)] } }, revision: '1' })
  assert.deepEqual([saved.statusCode, saved.body], [200, { revision: '2', mode: 'rows' }])
  assert.equal((await call('PUT', '/api/workspace', { ops: { delete: { expenses: ['a'] } }, revision: '1' })).statusCode, 409)
  assert.deepEqual((await call('GET', '/api/workspace?revision=2')).body, { unchanged: true, revision: '2' })
  const full = await call('GET', '/api/workspace')
  assert.deepEqual(full.body.data.expenses.map(row => row.id), ['a', 'b'])
  assert.equal(full.body.mode, 'rows')
})
