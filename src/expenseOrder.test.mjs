import { test } from 'node:test'
import assert from 'node:assert/strict'
import { moveWithinDate, sameDateOrder } from './expenseOrder.ts'

const row = (id, date, sequence) => ({ id, projectId: 'p', date, kind: '법인카드', vendor: id, memo: '', amount: 1, ...(sequence === undefined ? {} : { sequence }) })

test('arranged rows keep their sequence, unarranged ones follow in stored order', () => {
  const expenses = [row('new', '2026-10-26'), row('b', '2026-10-26', 1), row('a', '2026-10-26', 0), row('old', '2026-10-26')]
  assert.deepEqual([...expenses].sort(sameDateOrder(expenses)).map(e => e.id), ['a', 'b', 'new', 'old'])
})

test('a row moves only among rows of the same date', () => {
  const shown = [row('x', '2026-10-27'), row('a', '2026-10-26'), row('b', '2026-10-26'), row('c', '2026-10-26'), row('y', '2026-10-25')]
  assert.deepEqual([...moveWithinDate(shown, 'c', -1)], [['a', 0], ['c', 1], ['b', 2]])
  assert.deepEqual([...moveWithinDate(shown, 'a', 1)], [['b', 0], ['a', 1], ['c', 2]])
  assert.equal(moveWithinDate(shown, 'a', -1), null)
  assert.equal(moveWithinDate(shown, 'c', 1), null)
  assert.equal(moveWithinDate(shown, 'missing', 1), null)
})
