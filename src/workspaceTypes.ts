import type { VendorContact } from './vendorData.ts'
import type { Delivery } from './deliveryData.ts'

export type Expense = {
  id: string
  projectId: string
  date: string
  kind: string
  vendor: string
  category?: string
  memo: string
  cardNumber?: string
  supplyAmount?: number
  vatAmount?: number
  amount: number
}

export type WorkLog = {
  id: string
  projectId: string
  date: string
  worker: string
  workerType: '직원' | '인력'
  startTime: string
  endTime: string
  overtimeHours: number
  location: string
  task: string
  note: string
  hours: number
}

export type PurchaseOrder = {
  id: string
  projectId: string
  orderDate: string
  vendor: string
  item: string
  quantity: string
  amount: number
  status: '요청' | '발주완료' | '입고완료'
}

export type WorkspaceData = {
  expenses: Expense[]
  workLogs: WorkLog[]
  purchases: PurchaseOrder[]
  inactiveVendorKeys: string[]
  deletedVendorKeys: string[]
  vendorEdits: Record<string, VendorContact>
  customVendorContacts: Record<'purchase' | 'order', VendorContact[]>
  deliveries: Delivery[]
}
export type WorkspaceSnapshot = { data: WorkspaceData; revision: string; initialized: boolean }
export type SharedWorkspaceStore = WorkspaceSnapshot & {
  save: (patch: Partial<WorkspaceData>, revision: string) => Promise<boolean>
}
export const emptyWorkspace = (): WorkspaceData => ({expenses:[],workLogs:[],purchases:[],inactiveVendorKeys:[],deletedVendorKeys:[],vendorEdits:{},customVendorContacts:{purchase:[],order:[]},deliveries:[]})
