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
  function clearResult() { setResult(null); setError('') }
  const busy = loading || loadingCards

  return <section className="content-grid single">
    <div className="panel full">
      <div className="panel-heading"><div><h3>법인카드 사용내역</h3><span>바로빌에 수집된 승인·취소 내역을 조회합니다.</span></div>
        <button className="ghost-button" disabled={busy} type="button" onClick={() => { setError(''); setCards([]); setCardId(''); setResult(null); setLoadingCards(true); setReload(value => value + 1) }}>카드 목록 새로고침</button>
      </div>
      {environment === 'test' && <p className="card-query-hint" role="status">바로빌 테스트 서버에 연결되어 있습니다. 테스트 서버에 등록된 카드의 내역만 조회합니다.</p>}
      <form className="card-query-form" onSubmit={submit}>
        <label>법인카드<select value={cardId} disabled={busy || cards.length === 0} onChange={event => { setCardId(event.target.value); clearResult() }}>
          {cards.length === 0 && <option value="">{loadingCards ? '카드 목록을 불러오는 중…' : '조회할 법인카드가 없습니다'}</option>}
          {cards.map(card => <option key={card.id} value={card.id}>{card.company} {card.number}{card.alias ? ` · ${card.alias}` : ''}</option>)}
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
        <div className="card-results-heading"><strong>조회 결과 {result.total.toLocaleString('ko-KR')}건</strong><span>{result.card.company} {result.card.number} · {result.startDate} ~ {result.endDate}</span></div>
        <div className="table-wrap card-results-scroll" role="region" aria-label="법인카드 승인내역" tabIndex={0}>
          <table className="card-results-table"><thead><tr><th>사용일시 ↑</th><th>가맹점</th><th>승인구분</th><th>승인번호</th><th>통화</th><th>승인금액</th><th>공급가액</th><th>부가세</th><th>메모</th></tr></thead>
            <tbody>{result.records.map(row => {
              const supply = cardSupplyAmount(row)
              return <tr key={row.id}><td>{row.dateTime}</td><td>{row.store || '-'}</td><td><span className={/취소|환불|거절/.test(row.approvalType) ? 'card-cancelled' : ''}>{row.approvalType || '-'}</span></td><td>{row.approvalNumber || '-'}</td><td>{row.currency}</td><td>{money(row.amount)}</td><td>{money(supply.value)}{supply.calculated && <small className="card-calculated" title="승인금액에서 부가세와 봉사료를 제외한 계산값">계산</small>}</td><td>{money(row.vatAmount)}</td><td>{row.memo || '-'}</td></tr>
            })}
              {result.records.length === 0 && <tr><td colSpan={9}>해당 기간에 수집된 승인내역이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card-pagination"><button className="ghost-button" disabled={loading || result.page <= 1} onClick={() => void query(result.page - 1)}>이전 페이지</button><span>{result.page} / {Math.max(1, result.totalPages)} 페이지</span><button className="ghost-button" disabled={loading || result.page >= result.totalPages} onClick={() => void query(result.page + 1)}>다음 페이지</button></div>
        <p className="card-query-hint">공급가액이 없거나 0인 원화 내역은 부가세·봉사료가 제공된 경우 승인금액에서 두 금액을 제외해 계산합니다. 계산한 공급가액은 ‘계산’으로 표시합니다.</p>
        <p className="card-query-hint">조회 내역은 공사별 지출에 자동 등록되지 않습니다.</p>
      </> : !busy && !error && cards.length > 0 && <div className="expense-source-empty"><strong>카드와 기간을 선택한 뒤 내역 조회를 눌러주세요.</strong><p>바로빌에서 수집한 사용내역을 확인할 수 있습니다.</p></div>}
    </div>
  </section>
}
