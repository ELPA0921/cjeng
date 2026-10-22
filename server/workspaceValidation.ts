import type { WorkspaceData } from '../src/workspaceTypes.ts'
import { packWorkspace, unpackWorkLog } from './workspaceCodec.ts'

const vendorFields = ['company','contact','mobile','tel','fax','email','address','item']
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('자료 형식을 확인하세요.')
  return value as Record<string, unknown>
}
function text(value: unknown, required = false) {
  if (typeof value !== 'string' || value.length > 10000 || (required && !value.trim())) throw new Error('문자 항목을 확인하세요.')
  return value
}
function day(value: unknown) {
  const result = text(value, true)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result)) || new Date(result).toISOString().slice(0,10) !== result) throw new Error('날짜 형식을 확인하세요.')
}
function rows(value: unknown) {
  if (!Array.isArray(value) || value.length > 10000) throw new Error('자료 건수를 확인하세요.')
  const ids = new Set<string>()
  return value.map(item => {
    const row = object(item), id = text(row.id, true)
    if (ids.has(id)) throw new Error('중복된 내부 ID가 있습니다.')
    ids.add(id)
    return row
  })
}
function records(value: unknown, strings: string[], numbers: string[], required: string[], dates: string[]) {
  return rows(value).map(row => {
    const next: Record<string, string | number> = {id:text(row.id,true)}
    for (const field of strings) {
      if (row[field] !== undefined) next[field] = text(row[field], required.includes(field) && ['projectId','date','orderDate','kind','vendor','worker','workerType','task','item','status'].includes(field))
      else if (required.includes(field)) throw new Error('필수 항목을 확인하세요.')
    }
    for (const field of numbers) {
      const cell = row[field]
      if (cell !== undefined && (typeof cell !== 'number' || !Number.isFinite(cell) || Math.abs(cell) > 1e15)) throw new Error('숫자 항목을 확인하세요.')
      if (cell !== undefined) next[field] = cell as number
      else if (required.includes(field)) throw new Error('필수 금액·시간을 확인하세요.')
    }
    for (const field of dates) day(next[field])
    return next
  })
}
function vendor(value: unknown) {
  const row=object(value)
  return Object.fromEntries(vendorFields.map(field=>[field,text(row[field],field==='company')]))
}
function vendorList(value: unknown) {
  if (!Array.isArray(value) || value.length>10000) throw new Error('거래처 목록을 확인하세요.')
  return value.map(vendor)
}
function keys(value: unknown) {
  if (!Array.isArray(value) || value.length>20000) throw new Error('거래처 상태를 확인하세요.')
  return [...new Set(value.map(item=>text(item,true)))]
}
export function validateWorkspace(value: unknown): WorkspaceData {
  const input=object(value)
  const edits=object(input.vendorEdits), custom=object(input.customVendorContacts)
  if (Object.keys(edits).length>20000) throw new Error('거래처 수정 자료가 너무 많습니다.')
  const expenses=records(input.expenses,['projectId','date','kind','vendor','category','memo','cardNumber'],['supplyAmount','vatAmount','amount'],['projectId','date','kind','vendor','memo','amount'],['date'])
  for (const expense of expenses) if (expense.kind === '세금계산서') expense.kind = '전자세금계산서'
  const workLogRows = Array.isArray(input.workLogs) ? input.workLogs.map(unpackWorkLog) : input.workLogs
  const workLogs=records(workLogRows,['projectId','date','worker','workerType','startTime','endTime','location','task','note'],['overtimeHours','hours'],['projectId','date','worker','workerType','startTime','endTime','location','task','note','overtimeHours','hours'],['date'])
  for (const row of workLogs) {
    if (!['직원','인력'].includes(String(row.workerType)) || !/^\d{2}:\d{2}$/.test(String(row.startTime)) || !/^\d{2}:\d{2}$/.test(String(row.endTime)) || Number(row.hours)<0 || Number(row.overtimeHours)<0) throw new Error('작업일보 항목을 확인하세요.')
  }
  const purchases=records(input.purchases,['projectId','orderDate','vendor','item','quantity','status'],['amount'],['projectId','orderDate','vendor','item','quantity','status','amount'],['orderDate'])
  for (const row of purchases) if (!['요청','발주완료','입고완료'].includes(String(row.status))) throw new Error('발주 상태를 확인하세요.')
  const deliveries=records(input.deliveries,['date','client','company','address','item','specification','airflow','note'],[],['date','item'],['date'])
  for (const row of deliveries) for (const field of ['client','company','address','specification','airflow','note']) row[field] ??= ''
  const result = {expenses,workLogs,purchases,deliveries,inactiveVendorKeys:keys(input.inactiveVendorKeys),deletedVendorKeys:keys(input.deletedVendorKeys),vendorEdits:Object.fromEntries(Object.entries(edits).map(([key,row])=>[text(key,true),vendor(row)])),customVendorContacts:{purchase:vendorList(custom.purchase),order:vendorList(custom.order)}} as WorkspaceData
  if (JSON.stringify(packWorkspace(result)).length > 1500000) throw new Error('공유 자료가 너무 큽니다.')
  return result
}
