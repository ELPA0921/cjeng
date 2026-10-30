import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isLegacyProjectId, isLegacyYear, legacyProjects } from './legacyExpenses.ts'

const yearOf = order => order.year

test('years up to 2022 are the 22년 이전 menu', () => {
  assert.equal(isLegacyYear('2019'), true)
  assert.equal(isLegacyYear('2022'), true)
  assert.equal(isLegacyYear('2023'), false)
  assert.equal(isLegacyYear('기타'), false)
  assert.equal(isLegacyYear(undefined), false)
})

test('old 공사 are listed by year with that year\'s 관리비 first', () => {
  const orders = [
    { id: 'b', year: '2020', orderNo: '화미', projectName: '화미' },
    { id: 'a', year: '2020', orderNo: '경인양행', projectName: '경인양행' },
    { id: 'c', year: '2019', orderNo: '대마', projectName: '대마' },
    { id: 'n', year: '2023', orderNo: '23001', projectName: '새 공사' },
  ]
  assert.deepEqual(legacyProjects(orders, yearOf).map(project => project.label), ['2019 · 관리비', '2019 · 대마', '2020 · 관리비', '2020 · 경인양행', '2020 · 화미'])
  assert.deepEqual(legacyProjects(orders, yearOf).map(project => project.order.id).slice(0, 2), ['admin-2019', 'c'])
})

test('old 관리비 years and old 공사 are the legacy expenses', () => {
  const ids = new Set(['legacy-y1920-01'])
  assert.equal(isLegacyProjectId('legacy-y1920-01', ids), true)
  assert.equal(isLegacyProjectId('admin-2021', ids), true)
  assert.equal(isLegacyProjectId('admin-2023', ids), false)
  assert.equal(isLegacyProjectId('shared-2026-26001', ids), false)
})
