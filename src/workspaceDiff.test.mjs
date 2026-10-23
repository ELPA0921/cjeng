import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hasOps, workspaceOps } from './workspaceDiff.ts'
import { emptyWorkspace } from './workspaceTypes.ts'

const expense = (id, amount) => ({ id, projectId: 'o-1', date: '2026-10-01', kind: '현금', vendor: 'v', memo: '', amount })

test('only added, changed and removed rows are sent', () => {
  const before = { ...emptyWorkspace(), expenses: [expense('a', 1), expense('b', 2), expense('c', 3)] }
  const ops = workspaceOps(before, { expenses: [expense('a', 1), expense('b', 20), expense('d', 4)] })
  assert.deepEqual(ops.upsert, { expenses: [expense('b', 20), expense('d', 4)] })
  assert.deepEqual(ops.delete, { expenses: ['c'] })
  assert.deepEqual(ops.settings, {})
})

test('settings are sent whole and only when they change', () => {
  const before = { ...emptyWorkspace(), inactiveVendorKeys: ['x'] }
  assert.equal(hasOps(workspaceOps(before, { inactiveVendorKeys: ['x'] })), false)
  assert.deepEqual(workspaceOps(before, { inactiveVendorKeys: ['x', 'y'] }).settings, { inactiveVendorKeys: ['x', 'y'] })
})

test('a save touching several collections at once stays one change set', () => {
  const before = { ...emptyWorkspace(), expenses: [expense('a', 1)], cardAccounting: [{ id: 'k', status: '회계반영', orderNo: '1', memo: '', updatedAt: 't', expenseId: 'a' }] }
  const ops = workspaceOps(before, { expenses: [], cardAccounting: [] })
  assert.deepEqual(ops.delete, { expenses: ['a'], cardAccounting: ['k'] })
})
