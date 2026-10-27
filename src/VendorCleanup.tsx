import { useEffect, useState } from 'react'
import ModalClose from './ModalClose'
import type { CardApprovalPage } from './cardTypes'
import type { PurchaseTaxInvoicePage } from './taxInvoiceTypes'
import { vendorGroups, type OfficialVendor, type VendorGroup, type VendorUse } from './vendors'

const sourceLabel = { '': '', 법인카드: '카드', 전자세금계산서: '세금계산서' } as const

const addDays = (day: string, days: number) => new Date(Date.parse(day) + days * 86400000).toISOString().slice(0, 10)

/** The tax invoice and card screens query at most 200 days at a time. */
function periods(since: string, until: string) {
  const list: [string, string][] = []
  for (let start = since; start <= until; start = addDays(start, 200)) list.push([start, addDays(start, 199) < until ? addDays(start, 199) : until])
  return list
}

async function barobill<T>(input: Record<string, unknown>, signal: AbortSignal): Promise<T> {
  const response = await fetch('/api/barobill-cards', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal })
  if (!response.ok) throw new Error('내역을 불러오지 못했습니다.')
  return await response.json() as T
}

type Loaded = { official: OfficialVendor[]; failed: number; total: number }

/**
 * 거래처명 정리. Reads every 전자세금계산서 and 법인카드 record from since to until, so the names
 * they use become the names to keep, then lists the vendors to tidy up.
 */
export default function VendorCleanup({ uses, since, until, onApply, onClose }: {
  uses: VendorUse[]
  since: string
  until: string
  /** Gets each old spelling mapped to its new one; resolves false when saving failed. */
  onApply: (renames: Record<string, string>) => Promise<boolean>
  onClose: () => void
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [progress, setProgress] = useState(0)
  const total = periods(since, until).length * 2
  useEffect(() => {
    const controller = new AbortController()
    const official: OfficialVendor[] = []
    let failed = 0
    // Tax invoices and cards load side by side, each one period after another.
    const read = async (load: (startDate: string, endDate: string) => Promise<OfficialVendor[]>) => {
      for (const [startDate, endDate] of periods(since, until)) {
        try { official.push(...await load(startDate, endDate)) } catch { if (controller.signal.aborted) return; failed += 1 }
        setProgress(count => count + 1)
      }
    }
    void Promise.all([
      read(async (startDate, endDate) => (await barobill<PurchaseTaxInvoicePage>({ action: 'purchaseTaxInvoices', startDate, endDate, page: 'all' }, controller.signal))
        .records.map(row => ({ name: row.vendor, source: '전자세금계산서' as const }))),
      read(async (startDate, endDate) => (await barobill<CardApprovalPage>({ action: 'approvals', cardId: 'all', startDate, endDate, page: 'all' }, controller.signal))
        .records.map(row => ({ name: row.store, source: '법인카드' as const }))),
    ]).then(() => { if (!controller.signal.aborted) setLoaded({ official, failed, total: periods(since, until).length * 2 }) })
    return () => controller.abort()
  }, [since, until])

  if (!loaded) return <div className="modal-backdrop" role="presentation">
    <section className="modal-panel vendor-cleanup" role="dialog" aria-modal="true" aria-labelledby="vendor-cleanup-title">
      <div className="modal-heading">
        <div><h3 id="vendor-cleanup-title">거래처명 정리</h3><span>{since} ~ {until} 전자세금계산서·법인카드 내역을 불러오는 중입니다… ({progress}/{total})</span></div>
        <ModalClose onClose={onClose} />
      </div>
    </section>
  </div>
  const note = loaded.failed === loaded.total ? '전자세금계산서·법인카드 내역을 불러오지 못해 지출내역에 적힌 이름만으로 정리합니다.'
    : loaded.failed ? `내역 일부(${loaded.failed}/${loaded.total}구간)를 불러오지 못했습니다. 해당 기간의 이름은 지출내역 기준입니다.` : ''
  return <CleanupList groups={vendorGroups(uses, loaded.official)} note={note} onApply={onApply} onClose={onClose} />
}

/**
 * Lists vendors written more than one way across every project's 지출내역 and renames the chosen
 * ones to a single spelling. Every group starts ticked; untick any that are different companies.
 */
function CleanupList({ groups, note, onApply, onClose }: {
  groups: VendorGroup[]
  note: string
  onApply: (renames: Record<string, string>) => Promise<boolean>
  onClose: () => void
}) {
  const [targets, setTargets] = useState<Record<string, string>>(() => Object.fromEntries(groups.map(group => [group.key, group.target])))
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(groups.map(group => group.key)))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const chosen = groups.filter(group => ticked.has(group.key))
  const renamed = (group: VendorGroup) => group.spellings.filter(spelling => spelling.count > 0 && spelling.name !== targets[group.key])
  const changes = chosen.reduce((sum, group) => sum + renamed(group).reduce((count, spelling) => count + spelling.count, 0), 0)

  function toggle(key: string) { setTicked(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next }) }
  async function apply() {
    if (!window.confirm(`거래처 ${chosen.length}곳, 지출 ${changes}건의 거래처명을 바꿀까요?`)) return
    const renames = Object.fromEntries(chosen.flatMap(group => renamed(group).map(spelling => [spelling.name, targets[group.key]])))
    setSaving(true); setError('')
    if (!await onApply(renames)) { setSaving(false); setError('저장하지 못했습니다. 다른 사람이 먼저 고쳤을 수 있으니 창을 다시 열어 확인해 주세요.') }
  }
  const section = (title: string, hint: string, list: VendorGroup[]) => list.length > 0 && <>
    <h4 className="vendor-cleanup-section">{title} <small>{hint}</small></h4>
    <ul className="vendor-cleanup-list">{list.map(group => <li key={group.key}>
      <input type="checkbox" aria-label={`${group.target} 정리`} checked={ticked.has(group.key)} disabled={saving} onChange={() => toggle(group.key)} />
      <div className="vendor-cleanup-spellings">{group.spellings.map(spelling => <span key={spelling.name} className={spelling.name === targets[group.key] ? 'keep' : undefined}>
        {spelling.name} <small>{[spelling.count ? `${spelling.count}건` : '', spelling.source ? `${sourceLabel[spelling.source]} 이름` : ''].filter(Boolean).join(' · ')}</small>
      </span>)}</div>
      <label>→ <select aria-label={`${group.target} 바꿀 이름`} value={targets[group.key]} disabled={saving} onChange={event => setTargets(current => ({ ...current, [group.key]: event.target.value }))}>
        {group.spellings.map(spelling => <option key={spelling.name} value={spelling.name}>{spelling.name}</option>)}
      </select></label>
    </li>)}</ul>
  </>

  return <div className="modal-backdrop" role="presentation">
    <section className="modal-panel vendor-cleanup" role="dialog" aria-modal="true" aria-labelledby="vendor-cleanup-title">
      <div className="modal-heading">
        <div><h3 id="vendor-cleanup-title">거래처명 정리</h3><span>모든 공사의 지출내역에서 5건 이상 거래한 업체 중 다른 이름으로 적힌 곳을 찾아 한 이름으로 맞춥니다. 바꿀 이름은 전자세금계산서 내역에 나온 이름, 없으면 법인카드 내역에 나온 이름이 기본입니다.</span></div>
        <ModalClose onClose={onClose} disabled={saving} />
      </div>
      {note && <p className="card-query-error" role="status">{note}</p>}
      <div className="vendor-cleanup-body">
        {groups.length === 0 && <p>정리할 거래처가 없습니다. 5건 이상 거래한 업체는 모두 전자세금계산서·법인카드 내역과 같은 이름으로 적혀 있습니다.</p>}
        {section('표기만 다른 거래처', '띄어쓰기·(주) 차이', groups.filter(group => !group.similar))}
        {section('철자만 다른 거래처', '레이져/레이저, 쎈타/센타처럼 헷갈리기 쉬운 글자 차이', groups.filter(group => group.similar))}
      </div>
      {error && <p className="card-query-error" role="alert">{error}</p>}
      <div className="modal-actions">
        <button className="ghost-button" type="button" disabled={saving} onClick={onClose}>취소</button>
        <button className="primary-button" type="button" disabled={saving || changes === 0} onClick={() => void apply()}>{saving ? '저장 중…' : `선택한 ${chosen.length}곳 정리 (${changes}건)`}</button>
      </div>
    </section>
  </div>
}
