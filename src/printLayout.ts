/**
 * Plans printed column widths from each column's measured one-line width.
 * Everything stays on one line when it fits; otherwise the narrowest columns keep
 * one line first, as long as each fits its fair share of the space still left, and
 * the rest wrap, splitting what remains in proportion to their length.
 * Self-contained so it can also run inside the print window via toString().
 */
export function planColumns(natural: number[], available: number) {
  const total = natural.reduce((sum, width) => sum + width, 0)
  if (total <= available) return { widths: natural.map(width => width * available / total), nowrap: natural.map(() => true) }
  const nowrap = natural.map(() => false)
  let used = 0, kept = 0
  for (const index of natural.map((_, i) => i).sort((a, b) => natural[a] - natural[b])) {
    if (natural[index] > (available - used) / (natural.length - kept)) break
    nowrap[index] = true; used += natural[index]; kept++
  }
  const wrapTotal = natural.reduce((sum, width, i) => nowrap[i] ? sum : sum + width, 0)
  const space = Math.max(0, available - used)
  return { widths: natural.map((width, i) => nowrap[i] ? width : space * width / wrapTotal), nowrap }
}
