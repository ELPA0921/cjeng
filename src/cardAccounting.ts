import type { CardApproval } from './cardTypes.ts'
import type { Order } from './orderTypes.ts'
import type { CardAccounting, CardAccountingStatus, Expense } from './workspaceTypes.ts'
import { cardSupplyAmount } from './cardAmounts.ts'
import { adminOrder, adminYearOfOrderNo } from './adminExpenses.ts'

// A Barobill row (card approval or purchase tax invoice) as the posting flow sees it.
export type PostingSource = {
  id: string
  date: string
  vendor: string
  supplyAmount: number | null
  vatAmount: number | null
  amount: number
  kind: '법인카드' | '전자세금계산서'
  cardNumber: string
  defaultMemo?: string
}
export type CardAccountingChoice = CardAccountingStatus | '미반영'
export type CardAccountingInput = { row: PostingSource; status: CardAccountingChoice; orderNo: string; memo: string }

export const missingOrderMessage = '존재하지 않는 수주번호입니다.'

export function cardPostingSource(row: CardApproval): PostingSource {
  return { id: row.id, date: row.dateTime.slice(0, 10), vendor: row.store, supplyAmount: cardSupplyAmount(row).value, vatAmount: row.vatAmount, amount: row.amount, kind: '법인카드', cardNumber: row.cardNumber }
}

export function findOrder(orders: Order[], orderNo: string) {
  const value = orderNo.trim()
  if (!value) return undefined
  const adminYear = adminYearOfOrderNo(value)
  return adminYear ? adminOrder(adminYear) : orders.find(order => order.orderNo.trim() === value)
}

// One expense per source row, so posting the same row twice can never duplicate it.
export const cardExpenseId = (approvalId: string) => `card-${approvalId.slice(0, 32)}`
export const postingExpenseId = (row: PostingSource) => row.kind === '법인카드' ? cardExpenseId(row.id) : `tax-${row.id.slice(0, 32)}`

/** Returns the ids of rows whose order number blocks saving. */
export function invalidOrderRows(inputs: CardAccountingInput[], orders: Order[]) {
  return inputs.filter(input => input.status === '회계반영' && !findOrder(orders, input.orderNo)).map(input => input.row.id)
}

/**
 * Applies the chosen status to each row. 회계반영 creates or updates the linked
 * expense on the order; 강제회계반영 and 미반영 remove it.
 */
export function applyCardAccounting(
  inputs: CardAccountingInput[],
  state: { cardAccounting: CardAccounting[]; expenses: Expense[]; orders: Order[] },
  now = new Date().toISOString(),
) {
  const entries = new Map(state.cardAccounting.map(entry => [entry.id, entry]))
  const expenses = new Map(state.expenses.map(expense => [expense.id, expense]))
  for (const { row, status, orderNo, memo } of inputs) {
    const previous = entries.get(row.id)
    if (previous?.expenseId && status !== '회계반영') expenses.delete(previous.expenseId)
    if (status === '미반영') { entries.delete(row.id); continue }
    const entry: CardAccounting = { id: row.id, status, orderNo: orderNo.trim(), memo: memo.trim(), updatedAt: now }
    if (status === '회계반영') {
      const order = findOrder(state.orders, orderNo)
      if (!order) throw new Error(missingOrderMessage)
      const expenseId = previous?.expenseId ?? postingExpenseId(row)
      expenses.set(expenseId, {
        ...expenses.get(expenseId),
        id: expenseId,
        projectId: order.id,
        date: row.date,
        kind: row.kind,
        vendor: row.vendor.trim() || row.kind,
        memo: entry.memo,
        ...(row.cardNumber ? { cardNumber: row.cardNumber } : {}),
        ...(row.supplyAmount === null ? {} : { supplyAmount: row.supplyAmount }),
        ...(row.vatAmount === null ? {} : { vatAmount: row.vatAmount }),
        amount: row.amount,
      })
      entry.expenseId = expenseId
    }
    entries.set(row.id, entry)
  }
  return { cardAccounting: [...entries.values()], expenses: [...expenses.values()] }
}

/** Deleting a posted expense sends its source row back to 미반영. */
export function unlinkDeletedExpenses(cardAccounting: CardAccounting[], deletedExpenseIds: Set<string>) {
  return cardAccounting.filter(entry => !entry.expenseId || !deletedExpenseIds.has(entry.expenseId))
}

/** Editing a posted expense keeps its source row's 수주번호 and 내용 in step. */
export function syncEditedExpense(cardAccounting: CardAccounting[], expense: Pick<Expense, 'id' | 'memo'>, orderNo: string, now = new Date().toISOString()) {
  return cardAccounting.map(entry => entry.expenseId === expense.id ? { ...entry, orderNo, memo: expense.memo.trim(), updatedAt: now } : entry)
}
