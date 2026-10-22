import { test } from 'node:test'
import assert from 'node:assert/strict'
import { navigationHash, parseNavigationHash } from './navigation.ts'

test('navigation preserves the chosen project, year, detail tab and calendar month', () => {
  const route = { view:'project', projectId:'shared-2023-23001', year:'2023', projectTab:'expenses', month:'2024-02' }
  assert.deepEqual(parseNavigationHash(navigationHash(route)),route)
  assert.deepEqual(parseNavigationHash(navigationHash({...route,view:'worklogs',year:'기타',projectId:'공통 & 작업'})),{...route,view:'worklogs',year:'기타',projectId:'공통 & 작업'})
})

test('unknown screens are ignored and malformed date or tab parameters use valid defaults', () => {
  assert.equal(parseNavigationHash(''),null)
  assert.equal(parseNavigationHash('#view=unknown'),null)
  const route = parseNavigationHash('#view=orders&year=invalid&month=2024-99&tab=other')
  assert.equal(route.projectTab,'worklogs')
  assert.match(route.year,/^\d{4}$/)
  assert.match(route.month,/^\d{4}-(0[1-9]|1[0-2])$/)
})
