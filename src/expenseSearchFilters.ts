/** Conditions of the 지출 검색 window; kept by App so they survive closing and reopening it. */
export type ExpenseSearchFilters = { keyword: string; project: string; from: string; to: string; kind: string; minAmount: string; maxAmount: string }
export const emptyExpenseSearch: ExpenseSearchFilters = { keyword: '', project: '', from: '', to: '', kind: '', minAmount: '', maxAmount: '' }
