import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cardSupplyAmount } from './cardAmounts.ts'

test('missing or zero supply uses the actual tax and service charge, including refunds', () => {
  const row = { amount:9900, supplyAmount:0, vatAmount:900, serviceCharge:0, currency:'KRW' }
  assert.deepEqual(cardSupplyAmount(row), {value:9000,calculated:true})
  assert.deepEqual(cardSupplyAmount({...row,supplyAmount:null}), {value:9000,calculated:true})
  assert.equal(cardSupplyAmount({...row,amount:12000,vatAmount:1000,serviceCharge:1000}).value,10000)
  assert.equal(cardSupplyAmount({...row,amount:-9900,vatAmount:-900}).value,-9000)
  assert.deepEqual(cardSupplyAmount({...row,supplyAmount:8999}), {value:8999,calculated:false})
})

test('foreign or incomplete tax data is never mixed with an inferred supply amount', () => {
  const row = { amount:10, supplyAmount:null, vatAmount:900, serviceCharge:0, currency:'USD' }
  assert.deepEqual(cardSupplyAmount(row), {value:null,calculated:false})
  assert.deepEqual(cardSupplyAmount({...row,currency:'KRW',vatAmount:null}), {value:null,calculated:false})
})
