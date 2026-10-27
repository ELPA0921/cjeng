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
 * the card company's, else the most used. similar marks groups whose names differ in a commonly
 * confused letter (레이져 / 레이저), not just in spaces or (주).
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
 * Vendors used at least frequentVendorMinimum times, most used first. Each spelling is counted and
 * offered on its own, so (주)승우레이져 and 승우레이져 both appear; 거래처명 정리 merges them.
 */
export function frequentVendors(uses: VendorUse[]): FrequentVendor[] {
  return tallySpellings(uses)
    .filter(spelling => spelling.count >= frequentVendorMinimum)
    .map(({ name, count }) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko-KR'))
}

// Letters people mix up when typing a company name. Only these count as the same name, so
// 대상레이져 / 대상레이저 match while 대상레이져 / 대형레이져 and 동일크레인 / 제일크레인 do not.
// Initials: ㄲㄸㅃㅆㅉ → ㄱㄷㅂㅅㅈ (쎈타 / 센타).
const plainInitial: Record<number, number> = { 1: 0, 4: 3, 8: 7, 10: 9, 13: 12 }
// Vowels: ㅐㅒㅖ → ㅔ (테크 / 태크), ㅙㅚ → ㅞ (웨 / 외 / 왜).
const plainVowel: Record<number, number> = { 1: 5, 3: 5, 7: 5, 10: 15, 11: 15 }
const jieut = new Set([12, 13, 14]) // ㅈ ㅉ ㅊ

/** foldVendor, with commonly confused letters made the same: 져 → 저, 쳐 → 처, ㅐ → ㅔ, ㅆ → ㅅ. */
function soundVendor(text: string) {
  return [...foldVendor(text)].map(char => {
    const code = char.charCodeAt(0) - 0xac00
    if (code < 0 || code > 11171) return char
    const initial = Math.floor(code / 588), final = code % 28
    let vowel = Math.floor(code % 588 / 28)
    // After ㅈ and ㅊ, ㅕ sounds like ㅓ: 레이져 / 레이저.
    if (vowel === 6 && jieut.has(initial)) vowel = 4
    vowel = plainVowel[vowel] ?? vowel
    return String.fromCharCode(0xac00 + (plainInitial[initial] ?? initial) * 588 + vowel * 28 + final)
  }).join('')
}

/**
 * Vendors with frequentVendorMinimum or more expenses that are not all written the official way,
 * most used first. Spellings that differ only in spaces or (주) are grouped, and so are those that
 * differ only in commonly confused letters (similar). Official names from the tax invoice and card
 * lists take part even when no expense uses them yet, so a vendor typed only as 승우레이져 still
 * becomes (주)승우레이져.
 */
export function vendorGroups(uses: VendorUse[], official: OfficialVendor[] = []): VendorGroup[] {
  const folded = foldedGroups(uses, official)
  const sounds = new Map<string, string[]>()
  for (const key of folded.keys()) sounds.set(soundVendor(key), [...sounds.get(soundVendor(key)) ?? [], key])
  return [...sounds.entries()]
    .map(([sound, keys]) => {
      const ranked = keys.flatMap(key => folded.get(key)!).sort(bySourceThenUse)
      // An official spelling no expense uses is shown only when it is the name to change to.
      const spellings = ranked.filter((spelling, index) => index === 0 || spelling.count > 0)
      const shown = new Set(spellings.map(spelling => foldVendor(spelling.name)))
      return { key: sound, spellings, target: spellings[0].name, total: spellings.reduce((sum, spelling) => sum + spelling.count, 0), similar: shown.size > 1 }
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
