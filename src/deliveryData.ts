export const deliveryColumns = [
  ['date', '날짜'], ['client', '발주처'], ['company', '설치회사명'],
  ['address', '주소'], ['item', '품명'], ['specification', '규격'],
  ['airflow', '풍량'], ['note', '비고'],
] as const

export type DeliveryField = typeof deliveryColumns[number][0]
export type Delivery = Record<DeliveryField, string> & { id: string }
export type DeliveryFilters = Record<DeliveryField, string> & {
  query: string; year: string; from: string; to: string
}
export const emptyDeliveryFilters: DeliveryFilters = {
  query: '', year: '', from: '', to: '', date: '', client: '', company: '',
  address: '', item: '', specification: '', airflow: '', note: '',
}
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ko').replace(/\s+/g, '')
export const deliveryKey = (record: Delivery) => JSON.stringify(deliveryColumns.map(([key]) => normalize(record[key])))

export function filterDeliveries(records: Delivery[], filters: DeliveryFilters) {
  const query = normalize(filters.query)
  return records.filter(record =>
    (!filters.year || record.date.startsWith(filters.year)) &&
    (!filters.from || record.date >= filters.from) &&
    (!filters.to || record.date <= filters.to) &&
    (!query || deliveryColumns.some(([key]) => normalize(record[key]).includes(query))) &&
    deliveryColumns.every(([key]) => !filters[key] || normalize(record[key]).includes(normalize(filters[key]))),
  )
}

export function normalizeDeliveryDate(value: string) {
  const match = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})\.?$/.exec(value.trim())
  if (!match) return null
  const [, year, month, day] = match
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() + 1 !== Number(month) || date.getUTCDate() !== Number(day)) return null
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

// Preserve quoted commas/newlines and reject malformed CSV rather than shifting columns.
export function parseDeliveryCsv(text: string): { cells: string[]; line: number }[] {
  const rows: { cells: string[]; line: number }[] = []
  let cells: string[] = [], cell = '', quoted = false, closed = false, line = 1, startLine = 1
  const pushCell = () => { cells.push(cell.trim()); cell = ''; closed = false }
  const pushRow = () => { pushCell(); if (cells.some(Boolean)) rows.push({ cells, line: startLine }); cells = [] }
  text = text.replace(/^\ufeff/, '')
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (char === '"') { quoted = false; closed = true }
      else { cell += char; if (char === '\n') line++ }
    } else if (char === '"') {
      if (cell.trim() || closed) throw new Error(`${line}행: 따옴표 형식을 확인해 주세요.`)
      cell = ''; quoted = true
    } else if (char === ',') pushCell()
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      pushRow(); line++; startLine = line
    } else if (closed && char.trim()) throw new Error(`${line}행: 닫는 따옴표 뒤에 잘못된 문자가 있습니다.`)
    else cell += char
  }
  if (quoted) throw new Error(`${startLine}행: 닫히지 않은 따옴표가 있습니다.`)
  pushRow()
  return rows
}

export type DeliveryImport = { records: Delivery[]; duplicates: number; errors: string[]; total: number }
export function prepareDeliveryImport(text: string, existing: Delivery[]): DeliveryImport {
  const rows = parseDeliveryCsv(text)
  if (rows[0]?.cells.length === 1 && rows[0].cells[0] === '납품실적') rows.shift()
  const headers = rows.shift()?.cells ?? []
  const missing = deliveryColumns.filter(([, label]) => !headers.includes(label))
  if (missing.length) throw new Error(`CSV 머리글이 필요합니다: ${missing.map(([, label]) => label).join(', ')}`)
  if (new Set(headers).size !== headers.length) throw new Error('CSV에 중복된 머리글이 있습니다.')
  const seen = new Set(existing.map(deliveryKey))
  const result: DeliveryImport = { records: [], duplicates: 0, errors: [], total: rows.length }
  for (const { cells, line } of rows) {
    if (cells.length !== headers.length) { result.errors.push(`${line}행: 머리글과 열 개수가 다릅니다.`); continue }
    const record = Object.fromEntries(deliveryColumns.map(([key, label]) => [key, cells[headers.indexOf(label)]])) as Delivery
    const date = normalizeDeliveryDate(record.date)
    if (!date || !record.item) { result.errors.push(`${line}행: 날짜(YYYY-MM-DD)와 품명을 확인해 주세요.`); continue }
    record.date = date
    const key = deliveryKey(record)
    if (seen.has(key)) { result.duplicates++; continue }
    seen.add(key)
    result.records.push(record)
  }
  return result
}

export function deliveryCsv(records: Delivery[]) {
  const escape = (value: string) => {
    // Excel must treat user supplied formulas as text; trim restores the value on import.
    const safe = /^[=+@-]/.test(value.trimStart()) ? `\t${value}` : value
    return `"${safe.replaceAll('"', '""')}"`
  }
  return '\ufeff' + [deliveryColumns.map(([, label]) => label), ...records.map(record => deliveryColumns.map(([key]) => record[key]))]
    .map(row => row.map(escape).join(',')).join('\r\n')
}

export function isDelivery(value: unknown): value is Delivery {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string' && deliveryColumns.every(([key]) => typeof record[key] === 'string') &&
    normalizeDeliveryDate(String(record.date)) === record.date && Boolean(record.item)
}
