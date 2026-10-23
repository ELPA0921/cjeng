import type { Order } from './orderTypes.ts'

// Order numbers ending in 000 (23000, 24000, ...) are each year's 일반관리비, not a 공사.
// Their expenses live under a fixed per-year id instead of an order in 수주대장.
const adminPrefix = 'admin-'

export function adminYearOfOrderNo(orderNo: string) {
  const value = orderNo.trim()
  return /^\d{2}000$/.test(value) ? `20${value.slice(0, 2)}` : null
}
export const adminProjectId = (year: string) => `${adminPrefix}${year}`
export const isAdminProject = (projectId: string) => projectId.startsWith(adminPrefix)
export const adminYearOfProject = (projectId: string) => isAdminProject(projectId) ? projectId.slice(adminPrefix.length) : null

/** A stand-in order so 관리비 can be picked, validated and printed like a 공사. */
export function adminOrder(year: string): Order {
  return {
    id: adminProjectId(year), year, orderNo: `${year.slice(2)}000`,
    orderDate: `${year}-01-01`, expectedCompletionDate: `${year}-12-31`,
    manager: '', client1: '', client2: '', region: '', projectName: `${year}년 일반관리비`, note: '',
  }
}

// Order numbers are either YYNNN (26001) or YYYY-NNN (2026-001).
function orderYear(order: Order) {
  if (/^\d{4}$/.test(order.year ?? '')) return order.year
  const orderNo = order.orderNo.trim()
  return /^(\d{4})-/.exec(orderNo)?.[1] ?? (/^\d{5}$/.test(orderNo) ? `20${orderNo.slice(0, 2)}` : null)
}

/** One 관리비 entry per year that has orders, plus the current year, newest first. */
export function adminOrders(orders: Order[], currentYear = String(new Date().getFullYear())) {
  const years = new Set([currentYear, ...orders.map(orderYear).filter((year): year is string => !!year)])
  return [...years].sort().reverse().map(adminOrder)
}
