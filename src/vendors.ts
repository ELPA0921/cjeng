export type FrequentVendor = { name: string; count: number }

/** A vendor needs this many expenses before it is offered for autocomplete. */
export const frequentVendorMinimum = 5

/** "(주)승우레이져", "승우 레이져" and "승우레이져" all fold to the same search text. */
export const foldVendor = (text: string) => text.replace(/\(주\)|㈜|주식회사|\s/g, '').toLowerCase()

/** One expense's vendor; official when it came from a 법인카드 or 전자세금계산서 posting. */
export type VendorUse = { vendor: string; official: boolean }

/**
 * Vendors used at least frequentVendorMinimum times, most used first. Spellings that differ only
 * by spaces or (주) count as one vendor, named as the card company or tax invoice names it, so
 * hand-typed 승우레이져 adds to (주)승우레이져. Without an official spelling the most used one wins.
 */
export function frequentVendors(uses: VendorUse[]): FrequentVendor[] {
  const groups = new Map<string, { count: number; spellings: Map<string, { count: number; official: number }> }>()
  for (const use of uses) {
    const name = use.vendor.trim()
    const key = foldVendor(name)
    if (!key) continue
    const group = groups.get(key) ?? { count: 0, spellings: new Map() }
    const spelling = group.spellings.get(name) ?? { count: 0, official: 0 }
    spelling.count += 1
    if (use.official) spelling.official += 1
    group.spellings.set(name, spelling)
    group.count += 1
    groups.set(key, group)
  }
  return [...groups.values()].filter(group => group.count >= frequentVendorMinimum)
    .map(group => {
      const [name] = [...group.spellings].sort(([, a], [, b]) => b.official - a.official || b.count - a.count)[0]
      return { name, count: group.count }
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko-KR'))
}

/** Frequent vendors matching what was typed: names starting with it first, then by use. */
export function matchVendors(vendors: FrequentVendor[], typed: string, limit = 8) {
  const query = foldVendor(typed)
  if (!query) return []
  const starts = (vendor: FrequentVendor) => foldVendor(vendor.name).startsWith(query) ? 0 : 1
  return vendors.filter(vendor => foldVendor(vendor.name).includes(query) && vendor.name !== typed.trim())
    .sort((a, b) => starts(a) - starts(b))
    .slice(0, limit)
}
