import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planColumns } from './printLayout.ts'

test('when every column fits on one line nothing wraps and widths scale to the page', () => {
  const plan = planColumns([40, 60, 100], 400)
  assert.deepEqual(plan.nowrap, [true, true, true])
  assert.deepEqual(plan.widths, [80, 120, 200])
})

test('narrow columns keep one line first and the widest share what is left', () => {
  // year, order no., date, client, site, project name, note
  const natural = [40, 50, 80, 120, 160, 420, 380]
  const plan = planColumns(natural, 1000)
  assert.deepEqual(plan.nowrap, [true, true, true, true, true, false, false])
  const left = 1000 - (40 + 50 + 80 + 120 + 160)
  assert.equal(Math.round(plan.widths[5] + plan.widths[6]), left)
  assert.ok(plan.widths[5] > plan.widths[6])
})

test('the planned widths never exceed the page even when little fits', () => {
  const plan = planColumns([300, 300, 300, 300], 500)
  assert.equal(plan.nowrap.filter(Boolean).length, 0)
  assert.ok(Math.round(plan.widths.reduce((a, b) => a + b)) <= 500)
})
