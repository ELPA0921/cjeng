import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ConnectedCard, CardApprovalPage } from './cardTypes'
import { cardSupplyAmount } from './cardAmounts'
import './CorporateCards.css'

async function request<T>(input: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const response = await fetch('/api/barobill-cards', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || '법인카드 내역을 불러올 수 없습니다.')
  return body as T
}
const money = (value: number | null) => value === null ? '-' : value.toLocaleString('ko-KR', { maximumFractionDigits: 4 })

export default function CorporateCards() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const [cards, setCards] = useState<ConnectedCard[]>([])
  const [environment, setEnvironment] = useState('')
  const [cardId, setCardId] = useState('')
  const [startDate, setStartDate] = useState(`${today.slice(0, 7)}-01`)
  const [endDate, setEndDate] = useState(today)
  const [result, setResult] = useState<CardApprovalPage | null>(null)
  const [loadingCards, setLoadingCards] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const activeRequest = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    request<{ cards: ConnectedCard[]; environment: string }>({ action: 'cards' }, controller.signal)
      .then(data => { setCards(data.cards); setCardId(data.cards[0]?.id ?? ''); setEnvironment(data.environment) })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '카드 목록 조회에 실패했습니다.') })
      .finally(() => { if (!controller.signal.aborted) setLoadingCards(false) })
    return () => controller.abort()
  }, [reload])
  useEffect(() => () => activeRequest.current?.abort(), [])

  async function query(page = 1) {
    if (!cardId || loading || loadingCards) return
    setError('')
    if (!startDate || !endDate || endDate < startDate || (Date.parse(endDate) - Date.parse(startDate)) / 86400000 >= 200) { setError('조회 기간은 시작일부터 최대 200일로 설정해 주세요.'); return }
    const controller = new AbortController()
    activeRequest.current?.abort()
    activeRequest.current = controller
    setLoading(true); setResult(null)
    try { setResult(await request<CardApprovalPage>({ action: 'approvals', cardId, startDate, endDate, page }, controller.signal)) }
    catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '승인내역 조회에 실패했습니다.') }
    finally { if (!controller.signal.aborted) setLoading(false) }
  }
  function submit(event: FormEvent) { event.preventDefault(); void query() }
  function clearResult() { setResult(null); setError(''); setSelectedIds(new Set()) }
  function toggleRow(id: string, checked: boolean) {
    setSelectedIds(current => { const next = new Set(current); if (checked) next.add(id); else next.delete(id); return next })
  }
  function togglePage(checked: boolean) {
    setSelectedIds(current => { const next = new Set(current); for (const row of pageRows) { if (checked) next.add(row.id); else next.delete(row.id) } return next })
  }
  const busy = loading || loadingCards
  const pageRows = result?.records ?? []
  const pageSelected = pageRows.filter(row => selectedIds.has(row.id)).length
  const cardLast4 = result?.card.number.slice(-4) ?? ''

  return <section className="content-grid single">
    <div className="panel full">
      <div className="panel-heading"><div><h3>법인카드 사용내역</h3><span>바로빌에 수집된 승인·취소 내역을 조회합니다.</span></div>
        <button className="ghost-button" disabled={busy} type="button" onClick={() => { setError(''); setCards([]); setCardId(''); setResult(null); setLoadingCards(true); setReload(value => value + 1) }}>카드 목록 새로고침</button>
      </div>
      {environment === 'test' && <p className="card-query-hint" role="status">바로빌 테스트 서버에 연결되어 있습니다. 테스트 서버에 등록된 카드의 내역만 조회합니다.</p>}
      <form className="card-query-form" onSubmit={submit}>
        <label>법인카드<select value={cardId} disabled={busy || cards.length === 0} onChange={event => { setCardId(event.target.value); clearResult() }}>
          {cards.length === 0 && <option value="">{loadingCards ? '카드 목록을 불러오는 중…' : '조회할 법인카드가 없습니다'}</option>}
          {cards.map(card => <option key={card.id} value={card.id}>{card.company} {card.number}</option>)}
        </select></label>
        <label>시작일<input type="date" required value={startDate} disabled={busy} onChange={event => { setStartDate(event.target.value); clearResult() }} /></label>
        <label>종료일<input type="date" required value={endDate} disabled={busy} onChange={event => { setEndDate(event.target.value); clearResult() }} /></label>
        <button className="primary-button" type="submit" disabled={busy || !cardId}>{loading ? '조회 중…' : '내역 조회'}</button>
      </form>
      <p className="card-query-hint">최대 200일 · 페이지당 100건 · 일자 오름차순</p>
      {error && <p className="card-query-error" role="alert">{error}</p>}
      {!busy && !error && cards.length === 0 && <p role="status">바로빌에서 승인내역 수집이 설정된 법인카드와 조회 권한을 확인해 주세요.</p>}
      {loading && <p role="status">바로빌에서 승인내역을 불러오고 있습니다.</p>}
      {result ? <>
        <div className="card-results-heading"><strong>조회 결과 {result.total.toLocaleString('ko-KR')}건{selectedIds.size > 0 && ` · ${selectedIds.size.toLocaleString('ko-KR')}건 선택`}</strong><span>{result.card.company} {result.card.number} · {result.startDate} ~ {result.endDate}</span></div>
        <div className="table-wrap card-results-scroll" role="region" aria-label="법인카드 승인내역" tabIndex={0}>
          <table className="card-results-table"><thead><tr>
            <th className="card-check"><input type="checkbox" aria-label="이 페이지 전체 선택" disabled={pageRows.length === 0} checked={pageRows.length > 0 && pageSelected === pageRows.length} ref={input => { if (input) input.indeterminate = pageSelected > 0 && pageSelected < pageRows.length }} onChange={event => togglePage(event.target.checked)} /></th>
            <th>수주번호</th><th>일자 ↑</th><th>거래처</th><th>공급가액</th><th>부가세</th><th>금액</th><th>카드번호</th><th>회계반영</th>
          </tr></thead>
            <tbody>{result.records.map(row => {
              const supply = cardSupplyAmount(row)
              const cancelled = /취소|환불|거절/.test(row.approvalType)
              return <tr key={row.id} className={selectedIds.has(row.id) ? 'card-row-selected' : undefined}>
                <td className="card-check"><input type="checkbox" aria-label={`${row.dateTime} ${row.store} 선택`} checked={selectedIds.has(row.id)} onChange={event => toggleRow(row.id, event.target.checked)} /></td>
                <td>-</td>
                <td title={row.dateTime}>{row.dateTime.slice(0, 10)}</td><td>{row.store || '-'}</td>
                <td>{money(supply.value)}</td><td>{money(row.vatAmount)}</td>
                <td><span className={cancelled ? 'card-cancelled' : undefined} title={row.approvalType || undefined}>{money(row.amount)}</span></td>
                <td>{cardLast4 || '-'}</td>
                <td><span className="card-accounting">미반영</span></td>
              </tr>
            })}
              {result.records.length === 0 && <tr><td colSpan={9}>해당 기간에 수집된 승인내역이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card-pagination"><button className="ghost-button" disabled={loading || result.page <= 1} onClick={() => void query(result.page - 1)}>이전 페이지</button><span>{result.page} / {Math.max(1, result.totalPages)} 페이지</span><button className="ghost-button" disabled={loading || result.page >= result.totalPages} onClick={() => void query(result.page + 1)}>다음 페이지</button></div>
        <p className="card-query-hint">공급가액이 없거나 0인 원화 내역은 부가세·봉사료가 제공된 경우 금액에서 두 금액을 제외해 계산합니다.</p>
        <p className="card-query-hint">조회 내역은 공사별 지출에 자동 등록되지 않습니다.</p>
      </> : !busy && !error && cards.length > 0 && <div className="expense-source-empty"><strong>카드와 기간을 선택한 뒤 내역 조회를 눌러주세요.</strong><p>바로빌에서 수집한 사용내역을 확인할 수 있습니다.</p></div>}
    </div>
  </section>
}
