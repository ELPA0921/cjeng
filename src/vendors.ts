export type FrequentVendor = { name: string; count: number }

/** Where an expense's vendor name came from: a 법인카드 or 전자세금계산서 posting, or typed by hand (''). */
export type VendorSource = '' | '법인카드' | '전자세금계산서'

/** One expense's vendor. */
export type VendorUse = { vendor: string; source: VendorSource }

/** A vendor name as the tax invoice or card company writes it, whether or not any expense uses it yet. */
export type OfficialVendor = { name: string; source: Exclude<VendorSource, ''> }

/** A spelling of a vendor and how many expenses use it; source is the most official one seen. */
export type VendorSpelling = { name: string; count: number; source: VendorSource }

/**
 * Spellings that belong to one vendor. target is the spelling to keep: the tax invoice's, else
 * the card company's, else the most used. similar marks groups joined only by a near spelling
 * (one letter apart), which need a person to confirm.
 */
export type VendorGroup = { key: string; spellings: VendorSpelling[]; target: string; total: number; similar: boolean }

/** A vendor needs this many expenses before it is offered for autocomplete or 거래처명 정리. */
export const frequentVendorMinimum = 5

/** "(주)승우레이져", "승우 레이져" and "승우레이져" all fold to the same search text. */
export const foldVendor = (text: string) => text
  .replace(/주식회사|유한회사|\(주\)|\(유\)|㈜|㈲/g, '')
  .replace(/[\s.,·\-_()（）[\]]/g, '')
  .toLowerCase()

const sourceRank: Record<VendorSource, number> = { '': 0, 법인카드: 1, 전자세금계산서: 2 }
const bySourceThenUse = (a: VendorSpelling, b: VendorSpelling) => sourceRank[b.source] - sourceRank[a.source] || b.count - a.count || a.name.localeCompare(b.name, 'ko-KR')

function tallySpellings(uses: VendorUse[], official: OfficialVendor[] = []): VendorSpelling[] {
  const spellings = new Map<string, VendorSpelling>()
  for (const { name: raw, source } of official) {
    const name = raw.trim()
    if (!foldVendor(name)) continue
    const spelling = spellings.get(name) ?? { name, count: 0, source }
    if (sourceRank[source] > sourceRank[spelling.source]) spelling.source = source
    spellings.set(name, spelling)
  }
  for (const use of uses) {
    const name = use.vendor.trim()
    if (!foldVendor(name)) continue
    const spelling = spellings.get(name) ?? { name, count: 0, source: '' }
    spelling.count += 1
    if (sourceRank[use.source] > sourceRank[spelling.source]) spelling.source = use.source
    spellings.set(name, spelling)
  }
  return [...spellings.values()]
}

/** Spellings grouped by their folded text, so differences in spaces and (주) disappear. */
function foldedGroups(uses: VendorUse[], official: OfficialVendor[] = []) {
  const groups = new Map<string, VendorSpelling[]>()
  for (const spelling of tallySpellings(uses, official)) {
    const key = foldVendor(spelling.name)
    groups.set(key, [...groups.get(key) ?? [], spelling])
  }
  return groups
}

/**
 * Vendors used at least frequentVendorMinimum times, most used first. Spellings that differ only
 * by spaces or (주) count as one vendor, named as the tax invoice or card company names it, so
 * hand-typed 승우레이져 adds to (주)승우레이져. Without an official spelling the most used one wins.
 */
export function frequentVendors(uses: VendorUse[]): FrequentVendor[] {
  return [...foldedGroups(uses).values()]
    .map(spellings => ({ name: [...spellings].sort(bySourceThenUse)[0].name, count: spellings.reduce((sum, spelling) => sum + spelling.count, 0) }))
    .filter(vendor => vendor.count >= frequentVendorMinimum)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko-KR'))
}

/** True when one letter added, removed or changed turns a into b (승우레이저 / 승우레이져). */
function oneEditApart(a: string, b: string) {
  if (a.length > b.length) [a, b] = [b, a]
  if (b.length - a.length > 1) return false
  let i = 0
  while (i < a.length && a[i] === b[i]) i += 1
  return a.length === b.length ? a.slice(i + 1) === b.slice(i + 1) : a.slice(i) === b.slice(i + 1)
}

/**
 * Vendors with frequentVendorMinimum or more expenses that are not all written the official way,
 * most used first. Spellings that
 * fold to the same text are grouped for sure; names of four or more letters that are one letter
 * apart are grouped as similar. Official names from the tax invoice and card lists take part even
 * when no expense uses them yet, so a vendor typed only as 승우레이져 still becomes (주)승우레이져.
 */
export function vendorGroups(uses: VendorUse[], official: OfficialVendor[] = []): VendorGroup[] {
  const folded = foldedGroups(uses, official)
  const keys = [...folded.keys()]
  // Only names some expense uses matter; the thousands of other card stores join only as their match.
  const used = keys.filter(key => folded.get(key)!.some(spelling => spelling.count > 0))
  const parent = new Map(keys.map(key => [key, key]))
  const root = (key: string): string => { const up = parent.get(key)!; return up === key ? key : root(up) }
  const nearKeys = new Set<string>()
  for (const a of used) {
    for (const b of keys) {
      if (a === b || Math.min(a.length, b.length) < 4 || !oneEditApart(a, b)) continue
      parent.set(root(a), root(b))
      nearKeys.add(a); nearKeys.add(b)
    }
  }
  const joined = new Map<string, string[]>()
  for (const key of keys) joined.set(root(key), [...joined.get(root(key)) ?? [], key])
  return [...joined.values()]
    .map(groupKeys => {
      const ranked = groupKeys.flatMap(key => folded.get(key)!).sort(bySourceThenUse)
      // An official spelling no expense uses is shown only when it is the name to change to.
      const spellings = ranked.filter((spelling, index) => index === 0 || spelling.count > 0)
      return { key: groupKeys.join('|'), spellings, target: spellings[0].name, total: spellings.reduce((sum, spelling) => sum + spelling.count, 0), similar: groupKeys.some(key => nearKeys.has(key)) }
    })
    .filter(group => group.total >= frequentVendorMinimum && group.spellings.some(spelling => spelling.count > 0 && spelling.name !== group.target))
    .sort((a, b) => Number(a.similar) - Number(b.similar) || b.total - a.total)
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
