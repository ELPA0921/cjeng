import type { OrderStatus } from './orderStatus'

export type Order = {
  id: string
  year?: string
  orderNo: string
  orderDate: string
  expectedCompletionDate: string
  manager: string
  client1: string
  client2: string
  region: string
  projectName: string
  note?: string
  status?: OrderStatus
}

export type SharedOrderStore = {
  orders: Order[]
  revision: number
  save: (orders: Order[], revision: number) => Promise<boolean>
}
