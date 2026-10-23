import type { CardApproval } from './cardTypes.ts'
import type { Order } from './orderTypes.ts'
import type { CardAccounting, CardAccountingStatus, Expense } from './workspaceTypes.ts'
import { cardSupplyAmount } from './cardAmounts.ts'

export type CardAccountingChoice = CardAccountingStatus | '미반영'
export type CardAccountingInput = { row: CardApproval; status: CardAccountingChoice; orderNo: string; memo: string }

export const missingOrderMessage = '존재하지 않는 수주번호입니다.'

export function findOrder(orders: Order[], orderNo: string) {
  const value = orderNo.trim()
  return value ? orders.find(order => order.orderNo.trim() === value) : undefined
}

// One expense per approval, so posting the same card row twice can never duplicate it.
export const cardExpenseId = (approvalId: string) => `card-${approvalId.slice(0, 32)}`

/** Returns the ids of rows whose order number blocks saving. */
export function invalidOrderRows(inputs: CardAccountingInput[], orders: Order[]) {
  return inputs.filter(input => input.status === '회계반영' && !findOrder(orders, input.orderNo)).map(input => input.row.id)
}

/**
 * Applies the chosen status to each card row. 회계반영 creates or updates the linked
 * 법인카드 expense on the order; 강제회계반영 and 미반영 remove it.
 */
export function applyCardAccounting(
  inputs: CardAccountingInput[],
  state: { cardAccounting: CardAccounting[]; expenses: Expense[]; orders: Order[] },
  cardLast4: string,
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
      const expenseId = previous?.expenseId ?? cardExpenseId(row.id)
      const supply = cardSupplyAmount(row).value
      expenses.set(expenseId, {
        ...expenses.get(expenseId),
        id: expenseId,
        projectId: order.id,
        date: row.dateTime.slice(0, 10),
        kind: '법인카드',
        vendor: row.store.trim() || '법인카드',
        memo: entry.memo,
        cardNumber: cardLast4,
        ...(supply === null ? {} : { supplyAmount: supply }),
        ...(row.vatAmount === null ? {} : { vatAmount: row.vatAmount }),
        amount: row.amount,
      })
      entry.expenseId = expenseId
    }
    entries.set(row.id, entry)
  }
  return { cardAccounting: [...entries.values()], expenses: [...expenses.values()] }
}
