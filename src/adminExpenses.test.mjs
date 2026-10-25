import { test } from 'node:test'
import assert from 'node:assert/strict'
import { adminOrders, adminYearOfOrderNo, adminYearOfProject, isAdminProject } from './adminExpenses.ts'

test('only YY000 numbers are 관리비 codes', () => {
  assert.equal(adminYearOfOrderNo(' 26000 '), '2026')
  assert.equal(adminYearOfOrderNo('26001'), null)
  assert.equal(adminYearOfOrderNo('260000'), null)
  assert.equal(isAdminProject('admin-2025'), true)
  assert.equal(isAdminProject('shared-2026-26001'), false)
  assert.equal(adminYearOfProject('admin-2024'), '2024')
})

test('there is a 관리비 entry for every order year and the current year, newest first', () => {
  const orders = [{ id: 'a', year: '2023', orderNo: '23001' }, { id: 'b', year: '2025', orderNo: '25003' }, { id: 'c', orderNo: '24002' }, { id: 'd', orderNo: '2026-001' }, { id: 'e', orderNo: 'x' }]
  assert.deepEqual(adminOrders(orders, '2026').map(order => `${order.orderNo}:${order.projectName}`), ['26000:2026년 관리비 지출내역', '25000:2025년 관리비 지출내역', '24000:2024년 관리비 지출내역', '23000:2023년 관리비 지출내역'])
})
