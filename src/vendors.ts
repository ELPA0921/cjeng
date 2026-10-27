export type FrequentVendor = { name: string; count: number }

/** A vendor needs this many expenses before it is offered for autocomplete. */
export const frequentVendorMinimum = 5

/** "(주)승우레이져", "승우 레이져" and "승우레이져" all fold to the same search text. */
export const foldVendor = (text: string) => text.replace(/\(주\)|㈜|주식회사|\s/g, '').toLowerCase()

/** Vendors used at least frequentVendorMinimum times, most used first. */
export function frequentVendors(names: string[]): FrequentVendor[] {
  const counts = new Map<string, number>()
  for (const name of names) { const trimmed = name.trim(); if (trimmed) counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1) }
  return [...counts].filter(([, count]) => count >= frequentVendorMinimum)
    .map(([name, count]) => ({ name, count }))
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
