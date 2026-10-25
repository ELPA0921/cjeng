import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyCardAccounting, cardExpenseId, cardPostingSource, findOrder, invalidOrderRows, missingOrderMessage } from './cardAccounting.ts'

const orders = [{ id: 'o-1', orderNo: '26006', projectName: '공사' }, { id: 'o-2', orderNo: '26007', projectName: '다른 공사' }]
const approval = { id: 'approval-1', dateTime: '2026-10-05 09:10:44', approvalType: '승인', approvalNumber: '1', store: '주유소', storeNumber: '', amount: 88000, currency: 'KRW', supplyAmount: 0, vatAmount: 8000, serviceCharge: 0, memo: '', cardNumber: '3888' }
const row = cardPostingSource(approval)
const empty = { cardAccounting: [], expenses: [], orders }

test('order numbers must match the order ledger exactly after trimming', () => {
  assert.equal(findOrder(orders, ' 26006 ')?.id, 'o-1')
  assert.equal(findOrder(orders, ''), undefined)
  assert.equal(findOrder(orders, '2600'), undefined)
  const inputs = [{ row, status: '회계반영', orderNo: '99999', memo: '' }, { row: { ...row, id: 'b' }, status: '강제회계반영', orderNo: '', memo: '' }]
  assert.deepEqual(invalidOrderRows(inputs, orders), ['approval-1'])
  assert.throws(() => applyCardAccounting(inputs, empty), { message: missingOrderMessage })
})

test('posting creates one card expense on the order and re-posting updates it in place', () => {
  const first = applyCardAccounting([{ row, status: '회계반영', orderNo: '26006', memo: ' 유류비 ' }], empty, 'T1')
  assert.deepEqual(first.cardAccounting, [{ id: 'approval-1', status: '회계반영', orderNo: '26006', memo: '유류비', updatedAt: 'T1', expenseId: cardExpenseId('approval-1') }])
  assert.deepEqual(first.expenses, [{ id: cardExpenseId('approval-1'), projectId: 'o-1', date: '2026-10-05', kind: '법인카드', vendor: '주유소', memo: '유류비', cardNumber: '3888', supplyAmount: 80000, vatAmount: 8000, amount: 88000 }])
  const withCategory = { ...first, expenses: [{ ...first.expenses[0], category: '유류' }], orders }
  const moved = applyCardAccounting([{ row, status: '회계반영', orderNo: '26007', memo: '수정' }], withCategory, 'T2')
  assert.equal(moved.expenses.length, 1)
  assert.equal(moved.expenses[0].projectId, 'o-2')
  assert.equal(moved.expenses[0].memo, '수정')
  assert.equal(moved.expenses[0].category, '유류')
})

test('forced posting and reverting remove the linked expense but keep other expenses', () => {
  const other = { id: 'manual', projectId: 'o-1', date: '2026-10-01', kind: '현금', vendor: 'x', memo: '', amount: 1 }
  const posted = applyCardAccounting([{ row, status: '회계반영', orderNo: '26006', memo: '' }], { ...empty, expenses: [other] }, 'T1')
  const forced = applyCardAccounting([{ row, status: '강제회계반영', orderNo: '', memo: '' }], { ...posted, orders }, 'T2')
  assert.deepEqual(forced.expenses, [other])
  assert.deepEqual(forced.cardAccounting, [{ id: 'approval-1', status: '강제회계반영', orderNo: '', memo: '', updatedAt: 'T2' }])
  const reverted = applyCardAccounting([{ row, status: '미반영', orderNo: '', memo: '' }], { ...posted, orders })
  assert.deepEqual(reverted, { cardAccounting: [], expenses: [other] })
})

test('tax invoices post as 전자세금계산서 expenses without a card number', () => {
  const invoice = { id: 'inv-1', date: '2026-10-07', vendor: '연일종합철강(주)', supplyAmount: 1000000, vatAmount: 100000, amount: 1100000, kind: '전자세금계산서', cardNumber: '' }
  const posted = applyCardAccounting([{ row: invoice, status: '회계반영', orderNo: '26006', memo: '철판' }], empty, 'T1')
  assert.deepEqual(posted.expenses, [{ id: 'tax-inv-1', projectId: 'o-1', date: '2026-10-07', kind: '전자세금계산서', vendor: '연일종합철강(주)', memo: '철판', supplyAmount: 1000000, vatAmount: 100000, amount: 1100000 }])
  assert.equal(posted.cardAccounting[0].expenseId, 'tax-inv-1')
})

test('YY000 order numbers post to that year\'s 관리비 without a 수주대장 entry', () => {
  assert.equal(findOrder(orders, '26000')?.id, 'admin-2026')
  assert.equal(findOrder(orders, '23000')?.projectName, '2023년 관리비 지출내역')
  assert.equal(findOrder(orders, '26001'), undefined)
  assert.deepEqual(invalidOrderRows([{ row, status: '회계반영', orderNo: '25000', memo: '' }], orders), [])
  const posted = applyCardAccounting([{ row, status: '회계반영', orderNo: '26000', memo: '사무용품' }], empty, 'T1')
  assert.equal(posted.expenses[0].projectId, 'admin-2026')
  assert.equal(posted.cardAccounting[0].orderNo, '26000')
})

test('deleting a posted expense returns its row to 미반영 and editing keeps the posting in step', async () => {
  const { unlinkDeletedExpenses, syncEditedExpense } = await import('./cardAccounting.ts')
  const posted = applyCardAccounting([{ row, status: '회계반영', orderNo: '26000', memo: '사무용품' }], empty, 'T1')
  const forced = { id: 'f', status: '강제회계반영', orderNo: '', memo: '', updatedAt: 'T1' }
  const all = [...posted.cardAccounting, forced]
  assert.deepEqual(unlinkDeletedExpenses(all, new Set([posted.expenses[0].id])), [forced])
  assert.deepEqual(unlinkDeletedExpenses(all, new Set(['other'])), all)
  const edited = syncEditedExpense(all, { id: posted.expenses[0].id, memo: ' 문구류 ' }, '26006', 'T2')
  assert.deepEqual(edited[0], { ...posted.cardAccounting[0], orderNo: '26006', memo: '문구류', updatedAt: 'T2' })
  assert.deepEqual(edited[1], forced)
})
