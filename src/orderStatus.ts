export const orderStatuses = ['예정', '진행중', '보류', '준공', '취소'] as const
export type OrderStatus = typeof orderStatuses[number]

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && orderStatuses.some(status => status === value)
}

export function defaultOrderStatus(orderDate: string, today: string): OrderStatus {
  return orderDate > today ? '예정' : '진행중'
}

export function getOrderStatus(order: { status?: string; orderDate: string }, today: string): OrderStatus {
  return isOrderStatus(order.status) ? order.status : defaultOrderStatus(order.orderDate, today)
}

export function importedOrderStatus(
  value: string | undefined,
  orderDate: string,
  today: string,
  existing?: { status?: string; orderDate: string },
): OrderStatus {
  const status = value?.trim()
  if (status) {
    if (!isOrderStatus(status)) throw new Error('상태는 예정, 진행중, 보류, 준공, 취소 중 하나여야 합니다.')
    return status
  }
  return existing ? getOrderStatus(existing, today) : defaultOrderStatus(orderDate, today)
}
