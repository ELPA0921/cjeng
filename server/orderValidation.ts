const fields = ['id', 'year', 'orderNo', 'orderDate', 'expectedCompletionDate', 'manager', 'client1', 'client2', 'region', 'projectName', 'note', 'status'] as const
const statuses = new Set(['예정', '진행중', '보류', '준공', '취소'])

export function validateOrders(value: unknown): Record<string, string>[] {
  if (!Array.isArray(value) || value.length > 10000) throw new Error('수주 목록 형식을 확인하세요.')
  const keys = new Set<string>()
  const ids = new Set<string>()
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`${index + 1}번째 수주 형식을 확인하세요.`)
    const row: Record<string, string> = {}
    for (const field of fields) {
      const cell = item[field]
      if (cell !== undefined && (typeof cell !== 'string' || cell.length > (field === 'note' ? 10000 : 2000))) {
        throw new Error(`${index + 1}번째 수주의 ${field} 값을 확인하세요.`)
      }
      if (cell !== undefined) row[field] = cell
    }
    for (const field of ['id', 'orderNo', 'projectName']) {
      if (!row[field]?.trim()) throw new Error(`${index + 1}번째 수주의 필수 항목이 비어 있습니다.`)
    }
    const year = row.year || row.orderDate?.slice(0, 4) || row.orderNo.slice(0, 4)
    if (!/^\d{4}$/.test(year)) throw new Error(`${row.orderNo}: 년도를 확인하세요.`)
    row.year = year
    for (const field of ['orderDate', 'expectedCompletionDate']) {
      const day = row[field] ?? ''
      if (day && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day)) {
        throw new Error(`${row.orderNo}: 날짜 형식을 확인하세요.`)
      }
      row[field] = day
    }
    if (row.status && !statuses.has(row.status)) throw new Error(`${row.orderNo}: 상태를 확인하세요.`)
    const key = `${year}/${row.orderNo.trim()}`
    if (keys.has(key) || ids.has(row.id)) throw new Error(`${row.orderNo}: 중복된 수주입니다.`)
    keys.add(key)
    ids.add(row.id)
    for (const field of ['manager', 'client1', 'client2', 'region']) row[field] ??= ''
    return row
  })
}

export function validateRevision(value: unknown): number | string {
  if (typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)) return value
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('수주 목록을 다시 불러온 후 저장하세요.')
  return value
}
