import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { deliveryCsv, deliveryKey, emptyDeliveryFilters, filterDeliveries, normalizeDeliveryDate, prepareDeliveryImport } from './deliveryData.ts'

const seed = JSON.parse(readFileSync(new URL('./deliverySeed.json', import.meta.url), 'utf8'))
const headers = '날짜,발주처,설치회사명,주소,품명,규격,풍량,비고\r\n'
test('source contains all 75 distinct nonempty Excel records and round trips', () => {
  assert.equal(seed.length, 75)
  assert.equal(new Set(seed.map(deliveryKey)).size, 75)
  const imported = prepareDeliveryImport(deliveryCsv(seed), [])
  assert.deepEqual(imported.records.map(deliveryKey), seed.map(deliveryKey))
  assert.equal(imported.errors.length, 0)
  assert.equal(prepareDeliveryImport(deliveryCsv(seed), seed).duplicates, 75)
})
test('quoted commas, escaped quotes, multiline notes, BOM, reordered headers and Korean title', () => {
  const csv = '\ufeff납품실적\r\n비고,풍량,규격,품명,주소,설치회사명,발주처,날짜\r\n"첫 줄\n둘째 줄",,40t,탱크,"서울, 인천",공장,"가""나",2026/10/22'
  const { records, errors } = prepareDeliveryImport(csv, [])
  assert.equal(errors.length, 0)
  assert.equal(records[0].date, '2026-10-22')
  assert.equal(records[0].client, '가"나')
  assert.equal(records[0].address, '서울, 인천')
  assert.equal(records[0].note, '첫 줄\n둘째 줄')
  assert.equal(prepareDeliveryImport(deliveryCsv(records), []).records[0].note, records[0].note)
})
test('invalid dates, missing fields, malformed files and wrong column counts are rejected', () => {
  assert.equal(normalizeDeliveryDate('2025-02-29'), null)
  assert.equal(normalizeDeliveryDate('2024.2.29.'), '2024-02-29')
  assert.equal(normalizeDeliveryDate('2026-13-01'), null)
  assert.equal(prepareDeliveryImport(headers + '2026-02-30,회사,,,,,,', []).errors.length, 1)
  assert.equal(prepareDeliveryImport(headers + '2026-01-01,회사,공장,서울,,40t,,', []).errors.length, 1)
  assert.equal(prepareDeliveryImport(headers + '2026-01-01,회사', []).errors.length, 1)
  assert.throws(() => prepareDeliveryImport('날짜,품명\n2026-01-01,탱크', []), /머리글/)
  assert.throws(() => prepareDeliveryImport(headers + '"닫히지 않음', []), /따옴표/)
  assert.throws(() => prepareDeliveryImport(headers + '"2026-01-01"x,회사,,,,,,', []), /문자/)
})
test('duplicates skipped in file and existing records; distinct notes preserved', () => {
  const a = { ...seed[0], note: '새로운 비고' }
  const result = prepareDeliveryImport(deliveryCsv([seed[0], seed[0], a, a]), seed)
  assert.equal(result.records.length, 1)
  assert.equal(result.duplicates, 3)
  assert.equal(result.records[0].note, '새로운 비고')
})
test('all fields support combined search and inclusive date boundaries', () => {
  const record = seed[0]
  assert.equal(filterDeliveries(seed, { ...emptyDeliveryFilters, query: '유 성 화 학' }).length > 0, true)
  const fields = { ...emptyDeliveryFilters, ...record, from: record.date, to: record.date, year: '2018' }
  assert.deepEqual(filterDeliveries(seed, fields), [record])
  assert.equal(filterDeliveries(seed, { ...fields, airflow: '없는풍량' }).length, 0)
  assert.equal(filterDeliveries(seed, { ...fields, from: '2026-10-22' }).length, 0)
})
test('Excel formula injection is escaped and can be reimported', () => {
  const record = { ...seed[0], note: '=HYPERLINK("https://example.com")' }
  assert.match(deliveryCsv([record]), /\t=HYPERLINK/)
  assert.equal(prepareDeliveryImport(deliveryCsv([record]), []).records[0].note, record.note)
})
