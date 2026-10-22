import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getWorkCategory, workProjectLabel } from './workLogCategories.ts'

test('only the internal factory is factory work, customer factories remain sites', () => {
  assert.equal(getWorkCategory({location:' 공장 ',workerType:'직원'}),'공장 직원')
  assert.equal(getWorkCategory({location:'공장',workerType:'인력'}),'공장 인력')
  assert.equal(getWorkCategory({location:'인천공장',workerType:'직원'}),'현장 직원')
  assert.equal(getWorkCategory({location:'부안공장',workerType:'인력'}),'현장 인력')
})

test('common and unassigned records stay distinct from construction orders', () => {
  assert.equal(workProjectLabel('work-common',[]),'공통업무')
  assert.equal(workProjectLabel('work-unassigned',[]),'공사 미지정')
  assert.equal(workProjectLabel('p1',[{id:'p1',orderNo:'23001'}]),'23001')
})
