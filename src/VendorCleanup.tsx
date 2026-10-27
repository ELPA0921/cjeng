import { useState } from 'react'
import ModalClose from './ModalClose'
import type { VendorGroup } from './vendors'

const sourceLabel = { '': '', 법인카드: '카드', 전자세금계산서: '세금계산서' } as const

/**
 * Lists vendors written more than one way across every project's 지출내역 and renames the chosen
 * ones to a single spelling. Same-name groups start ticked; groups that are only one letter apart
 * start unticked, since they may be different companies.
 */
export default function VendorCleanup({ groups, onApply, onClose }: {
  groups: VendorGroup[]
  /** Gets each old spelling mapped to its new one; resolves false when saving failed. */
  onApply: (renames: Record<string, string>) => Promise<boolean>
  onClose: () => void
}) {
  const [targets, setTargets] = useState<Record<string, string>>(() => Object.fromEntries(groups.map(group => [group.key, group.target])))
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(groups.filter(group => !group.similar).map(group => group.key)))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const chosen = groups.filter(group => ticked.has(group.key))
  const changes = chosen.reduce((sum, group) => sum + group.spellings.filter(spelling => spelling.name !== targets[group.key]).reduce((count, spelling) => count + spelling.count, 0), 0)

  function toggle(key: string) { setTicked(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next }) }
  async function apply() {
    if (!window.confirm(`거래처 ${chosen.length}곳, 지출 ${changes}건의 거래처명을 바꿀까요?`)) return
    const renames = Object.fromEntries(chosen.flatMap(group => group.spellings.filter(spelling => spelling.name !== targets[group.key]).map(spelling => [spelling.name, targets[group.key]])))
    setSaving(true); setError('')
    if (!await onApply(renames)) { setSaving(false); setError('저장하지 못했습니다. 다른 사람이 먼저 고쳤을 수 있으니 창을 다시 열어 확인해 주세요.') }
  }
  const section = (title: string, hint: string, list: VendorGroup[]) => list.length > 0 && <>
    <h4 className="vendor-cleanup-section">{title} <small>{hint}</small></h4>
    <ul className="vendor-cleanup-list">{list.map(group => <li key={group.key}>
      <input type="checkbox" aria-label={`${group.target} 정리`} checked={ticked.has(group.key)} disabled={saving} onChange={() => toggle(group.key)} />
      <div className="vendor-cleanup-spellings">{group.spellings.map(spelling => <span key={spelling.name} className={spelling.name === targets[group.key] ? 'keep' : undefined}>
        {spelling.name} <small>{spelling.count}건{spelling.source && ` · ${sourceLabel[spelling.source]}`}</small>
      </span>)}</div>
      <label>→ <select aria-label={`${group.target} 바꿀 이름`} value={targets[group.key]} disabled={saving} onChange={event => setTargets(current => ({ ...current, [group.key]: event.target.value }))}>
        {group.spellings.map(spelling => <option key={spelling.name} value={spelling.name}>{spelling.name}</option>)}
      </select></label>
    </li>)}</ul>
  </>

  return <div className="modal-backdrop" role="presentation">
    <section className="modal-panel vendor-cleanup" role="dialog" aria-modal="true" aria-labelledby="vendor-cleanup-title">
      <div className="modal-heading">
        <div><h3 id="vendor-cleanup-title">거래처명 정리</h3><span>모든 공사의 지출내역에서 같은 업체가 여러 이름으로 적힌 곳을 찾아 한 이름으로 맞춥니다. 전자세금계산서에 나온 이름, 다음으로 법인카드에 나온 이름이 기본입니다.</span></div>
        <ModalClose onClose={onClose} disabled={saving} />
      </div>
      <div className="vendor-cleanup-body">
        {groups.length === 0 && <p>여러 이름으로 적힌 거래처가 없습니다.</p>}
        {section('표기만 다른 거래처', '띄어쓰기·(주) 차이', groups.filter(group => !group.similar))}
        {section('비슷한 이름 — 확인 필요', '한 글자 차이라 다른 업체일 수 있어 체크하지 않았습니다', groups.filter(group => group.similar))}
      </div>
      {error && <p className="card-query-error" role="alert">{error}</p>}
      <div className="modal-actions">
        <button className="ghost-button" type="button" disabled={saving} onClick={onClose}>취소</button>
        <button className="primary-button" type="button" disabled={saving || changes === 0} onClick={() => void apply()}>{saving ? '저장 중…' : `선택한 ${chosen.length}곳 정리 (${changes}건)`}</button>
      </div>
    </section>
  </div>
}
