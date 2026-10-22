import type { Order } from './orderTypes'
import type { WorkspaceData } from './workspaceTypes'
import { emptyWorkspace } from './workspaceTypes.ts'
import { defaultExpenses, defaultWorkLogs } from './sampleData.ts'
import deliverySeed from './deliverySeed.json' with {type:'json'}
import { remapProjectReferences, sharedProjectIdMap } from './orderMigration.ts'
import { isDelivery, deliveryKey } from './deliveryData.ts'

function stored<T>(key: string, fallback: T): T {
  const raw=localStorage.getItem(key)
  if(raw===null)return fallback
  try{return JSON.parse(raw) as T}catch{throw new Error('브라우저의 기존 자료를 읽지 못했습니다. 원본을 보호하기 위해 공용 자료 연결을 중단했습니다.')}
}
function withoutExamples<T extends {id:string}>(rows: T[], examples: T[]) {
  if(!Array.isArray(rows))throw new Error('브라우저 자료의 목록 형식을 확인하세요.')
  return rows.filter(row=>!examples.some(example=>JSON.stringify(example)===JSON.stringify(row)))
}
export function browserWorkspace(orders: Order[]): WorkspaceData {
  const data=emptyWorkspace()
  const local=stored<Order[]>('cost-app-orders',[])
  const ids=sharedProjectIdMap(local,orders)
  data.expenses=remapProjectReferences(withoutExamples(stored('cost-app-expenses',[]),defaultExpenses),ids)
  data.workLogs=remapProjectReferences(withoutExamples(stored('cost-app-worklogs-v2',[]),defaultWorkLogs),ids)
  data.purchases=stored('cost-app-purchases',[])
  data.inactiveVendorKeys=stored('cost-app-inactive-vendors',[])
  data.deletedVendorKeys=stored('cost-app-deleted-vendors',[])
  data.vendorEdits=stored('cost-app-vendor-edits',{})
  data.customVendorContacts=stored('cost-app-custom-vendors',{purchase:[],order:[]})
  const deliveries=stored('cost-app-deliveries-v1',{version:1,records:deliverySeed})
  if(deliveries.version!==1 || !Array.isArray(deliveries.records) || !deliveries.records.every(isDelivery))throw new Error('브라우저의 납품실적 형식을 확인하세요.')
  data.deliveries=deliveries.records
  return data
}

// Adds records from another previously used browser without replacing shared edits.
export function mergeBrowserWorkspace(shared: WorkspaceData, local: WorkspaceData) {
  let added=0, conflicts=0
  const merge=<T,>(current:T[],incoming:T[],identity:(row:T)=>string,checkChanges=true)=>{
    const result=[...current], seen=new Map(current.map(row=>[identity(row),row]))
    for(const row of incoming){const existing=seen.get(identity(row));if(existing){if(checkChanges && JSON.stringify(existing)!==JSON.stringify(row))conflicts++;continue}result.push(row);seen.set(identity(row),row);added++}
    return result
  }
  const data:WorkspaceData={...shared,
    expenses:merge(shared.expenses,local.expenses,row=>row.id),workLogs:merge(shared.workLogs,local.workLogs,row=>row.id),purchases:merge(shared.purchases,local.purchases,row=>row.id),
    deliveries:merge(shared.deliveries,local.deliveries,deliveryKey,false),
    customVendorContacts:{purchase:merge(shared.customVendorContacts.purchase,local.customVendorContacts.purchase,row=>JSON.stringify(row)),order:merge(shared.customVendorContacts.order,local.customVendorContacts.order,row=>JSON.stringify(row))},
  }
  for(const [key,value] of Object.entries(local.vendorEdits)){
    if(Object.hasOwn(shared.vendorEdits,key)){if(JSON.stringify(shared.vendorEdits[key])!==JSON.stringify(value))conflicts++;continue}
    if(data.vendorEdits===shared.vendorEdits)data.vendorEdits={...shared.vendorEdits}
    data.vendorEdits[key]=value;added++
  }
  // A stale browser's hidden/deleted state must not undo the current shared state.
  return {data,added,conflicts}
}
