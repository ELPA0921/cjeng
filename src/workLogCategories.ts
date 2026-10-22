import type { WorkLog } from './workspaceTypes.ts'

export const workCategories = ['공장 직원', '공장 인력', '현장 직원', '현장 인력'] as const
export type WorkCategory = typeof workCategories[number]

export function getWorkCategory(log: Pick<WorkLog, 'location' | 'workerType'>): WorkCategory {
  return `${log.location.trim() === '공장' ? '공장' : '현장'} ${log.workerType}`
}

export function workProjectLabel(projectId: string, orders: { id: string; orderNo: string }[]) {
  if (projectId === 'work-common') return '공통업무'
  return orders.find(order => order.id === projectId)?.orderNo ?? '공사 미지정'
}
