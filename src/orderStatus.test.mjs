import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultOrderStatus, getOrderStatus, importedOrderStatus, orderStatuses } from './orderStatus.ts'

const today = '2026-10-22'
test('new orders default to scheduled or in progress, including the order date boundary', () => {
  assert.equal(defaultOrderStatus('2026-10-23', today), '예정')
  assert.equal(defaultOrderStatus(today, today), '진행중')
  assert.equal(defaultOrderStatus('2018-01-01', today), '진행중')
})
test('all five saved statuses override dates and completion is never inferred from a past deadline', () => {
  for (const status of orderStatuses) {
    assert.equal(getOrderStatus({ status, orderDate: '2030-01-01' }, today), status)
    assert.equal(getOrderStatus({ status, orderDate: '2018-01-01' }, today), status)
  }
  assert.equal(getOrderStatus({ orderDate: '2018-01-01', expectedCompletionDate: '2018-02-01' }, today), '진행중')
})
test('CSV status is optional for new records and blank/missing values preserve an existing status', () => {
  assert.equal(importedOrderStatus(undefined, '2030-01-01', today), '예정')
  assert.equal(importedOrderStatus('', '2018-01-01', today), '진행중')
  for (const status of orderStatuses) {
    for (const blank of [undefined, '', '  ']) {
      assert.equal(importedOrderStatus(blank, '2030-01-01', today, { status, orderDate: '2018-01-01' }), status)
    }
  }
})
test('explicit CSV values update status and invalid values are rejected', () => {
  assert.equal(importedOrderStatus(' 준공 ', '2030-01-01', today, { status: '보류', orderDate: today }), '준공')
  assert.throws(() => importedOrderStatus('완료', today, today), /상태/)
})
