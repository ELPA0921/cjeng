import type { Expense } from './workspaceTypes'

/**
 * Order of expenses that share a date, used by the 지출내역 table and its printout alike.
 * Rows someone has arranged (with a sequence) come first in that order; the rest follow in
 * the order they are stored, so a row added later to an arranged date lands at its end.
 */
export function sameDateOrder(expenses: Expense[]) {
  const stored = new Map(expenses.map((expense, index) => [expense.id, index]))
  return (a: Expense, b: Expense) => {
    const arranged = Number(b.sequence !== undefined) - Number(a.sequence !== undefined)
    if (arranged) return arranged
    if (a.sequence !== undefined && b.sequence !== undefined && a.sequence !== b.sequence) return a.sequence - b.sequence
    return (stored.get(a.id) ?? 0) - (stored.get(b.id) ?? 0)
  }
}

/**
 * Moves one row up (-1) or down (1) among the shown rows that share its date. Returns the new
 * sequence of every row on that date, or null when the neighbour in that direction is another
 * date (or there is none).
 */
export function moveWithinDate(shown: Expense[], id: string, direction: -1 | 1) {
  const index = shown.findIndex(expense => expense.id === id)
  const neighbour = shown[index + direction]
  if (index < 0 || !neighbour || neighbour.date !== shown[index].date) return null
  const group = shown.filter(expense => expense.date === shown[index].date).map(expense => expense.id)
  const at = group.indexOf(id)
  ;[group[at], group[at + direction]] = [group[at + direction], group[at]]
  return new Map(group.map((rowId, position) => [rowId, position]))
}
