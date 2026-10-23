import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyCardAccounting, cardExpenseId, findOrder, invalidOrderRows, missingOrderMessage } from './cardAccounting.ts'

const orders = [{ id: 'o-1', orderNo: '26006', projectName: '공사' }, { id: 'o-2', orderNo: '26007', projectName: '다른 공사' }]
const row = { id: 'approval-1', dateTime: '2026-10-05 09:10:44', approvalType: '승인', approvalNumber: '1', store: '주유소', storeNumber: '', amount: 88000, currency: 'KRW', supplyAmount: 0, vatAmount: 8000, serviceCharge: 0, memo: '' }
const empty = { cardAccounting: [], expenses: [], orders }

test('order numbers must match the order ledger exactly after trimming', () => {
  assert.equal(findOrder(orders, ' 26006 ')?.id, 'o-1')
  assert.equal(findOrder(orders, ''), undefined)
  assert.equal(findOrder(orders, '2600'), undefined)
  const inputs = [{ row, status: '회계반영', orderNo: '99999', memo: '' }, { row: { ...row, id: 'b' }, status: '강제회계반영', orderNo: '', memo: '' }]
  assert.deepEqual(invalidOrderRows(inputs, orders), ['approval-1'])
  assert.throws(() => applyCardAccounting(inputs, empty, '3888'), { message: missingOrderMessage })
})

test('posting creates one card expense on the order and re-posting updates it in place', () => {
  const first = applyCardAccounting([{ row, status: '회계반영', orderNo: '26006', memo: ' 유류비 ' }], empty, '3888', 'T1')
  assert.deepEqual(first.cardAccounting, [{ id: 'approval-1', status: '회계반영', orderNo: '26006', memo: '유류비', updatedAt: 'T1', expenseId: cardExpenseId('approval-1') }])
  assert.deepEqual(first.expenses, [{ id: cardExpenseId('approval-1'), projectId: 'o-1', date: '2026-10-05', kind: '법인카드', vendor: '주유소', memo: '유류비', cardNumber: '3888', supplyAmount: 80000, vatAmount: 8000, amount: 88000 }])
  const withCategory = { ...first, expenses: [{ ...first.expenses[0], category: '유류' }], orders }
  const moved = applyCardAccounting([{ row, status: '회계반영', orderNo: '26007', memo: '수정' }], withCategory, '3888', 'T2')
  assert.equal(moved.expenses.length, 1)
  assert.equal(moved.expenses[0].projectId, 'o-2')
  assert.equal(moved.expenses[0].memo, '수정')
  assert.equal(moved.expenses[0].category, '유류')
})

test('forced posting and reverting remove the linked expense but keep other expenses', () => {
  const other = { id: 'manual', projectId: 'o-1', date: '2026-10-01', kind: '현금', vendor: 'x', memo: '', amount: 1 }
  const posted = applyCardAccounting([{ row, status: '회계반영', orderNo: '26006', memo: '' }], { ...empty, expenses: [other] }, '3888', 'T1')
  const forced = applyCardAccounting([{ row, status: '강제회계반영', orderNo: '', memo: '' }], { ...posted, orders }, '3888', 'T2')
  assert.deepEqual(forced.expenses, [other])
  assert.deepEqual(forced.cardAccounting, [{ id: 'approval-1', status: '강제회계반영', orderNo: '', memo: '', updatedAt: 'T2' }])
  const reverted = applyCardAccounting([{ row, status: '미반영', orderNo: '', memo: '' }], { ...posted, orders }, '3888')
  assert.deepEqual(reverted, { cardAccounting: [], expenses: [other] })
})
