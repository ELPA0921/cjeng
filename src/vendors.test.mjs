import { test } from 'node:test'
import assert from 'node:assert/strict'
import { frequentVendors, matchVendors } from './vendors.ts'

const uses = (vendor, n, official = false) => Array(n).fill({ vendor, official })

test('only vendors used five times or more are offered, most used first', () => {
  const vendors = frequentVendors([...uses('승우레이져', 7), ...uses('대화볼트', 5), ...uses('한번업체', 4), ...uses(' 대화볼트 ', 1), ...uses('', 3)])
  assert.deepEqual(vendors, [{ name: '승우레이져', count: 7 }, { name: '대화볼트', count: 6 }])
})

test('hand-typed spellings count toward the name the card or tax invoice uses', () => {
  const vendors = frequentVendors([...uses('승우레이져', 3), ...uses('승우 레이져', 1), ...uses('(주)승우레이져', 1, true)])
  assert.deepEqual(vendors, [{ name: '(주)승우레이져', count: 5 }])
})

test('matching ignores spaces and (주), puts prefix matches first and hides an exact entry', () => {
  const vendors = [{ name: '대화볼트', count: 9 }, { name: '(주)승우레이져', count: 6 }, { name: '볼트나라', count: 5 }]
  assert.deepEqual(matchVendors(vendors, '승우 레이').map(v => v.name), ['(주)승우레이져'])
  assert.deepEqual(matchVendors(vendors, '승우레이져').map(v => v.name), ['(주)승우레이져'])
  assert.deepEqual(matchVendors(vendors, '볼트').map(v => v.name), ['볼트나라', '대화볼트'])
  assert.deepEqual(matchVendors(vendors, '대화볼트'), [])
  assert.deepEqual(matchVendors(vendors, '  '), [])
})
