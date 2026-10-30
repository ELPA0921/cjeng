import { adminOrder, adminYearOfProject, isAdminProject } from './adminExpenses.ts'
import type { Order } from './orderTypes.ts'

// 2019~2022 공사 came from the old 법인카드 명세서 workbooks. They have their own
// "22년 이전 지출내역" menu and stay out of 공사별·관리비 지출내역 and their 지출 검색.
export const legacyLastYear = '2022'
export const isLegacyYear = (year: string | undefined) => !!year && /^\d{4}$/.test(year) && year <= legacyLastYear

export type LegacyProject = { order: Order; year: string; label: string }

/** Every 공사 up to 2022 plus each of those years' 관리비, oldest year first, 관리비 leading its year. */
export function legacyProjects(orders: Order[], yearOf: (order: Order) => string): LegacyProject[] {
  const projects = orders.filter(order => isLegacyYear(yearOf(order))).map(order => ({ order, year: yearOf(order), label: `${yearOf(order)} · ${order.projectName}` }))
  const admins = [...new Set(projects.map(project => project.year))].map(year => ({ order: adminOrder(year), year, label: `${year} · 관리비` }))
  return [...admins, ...projects].sort((a, b) => a.year.localeCompare(b.year)
    || Number(isAdminProject(b.order.id)) - Number(isAdminProject(a.order.id))
    || a.order.projectName.localeCompare(b.order.projectName, 'ko-KR'))
}

/** Whether an expense's 공사 (or 관리비 year) belongs to the 22년 이전 menu. */
export function isLegacyProjectId(projectId: string, legacyOrderIds: ReadonlySet<string>) {
  return legacyOrderIds.has(projectId) || isLegacyYear(adminYearOfProject(projectId) ?? undefined)
}
