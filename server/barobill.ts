import { createHmac } from 'node:crypto'
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import type { ConnectedCard, CardApprovalPage } from '../src/cardTypes.ts'

type Config = { certKey: string; corpNum: string; userId: string; test?: boolean }
type Fields = Record<string, string | number>
type Row = Record<string, unknown>
export class BarobillError extends Error {}
export class CardInputError extends Error {}
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}
const list = (value: unknown): Row[] => value == null || value === '' ? [] : (Array.isArray(value) ? value : [value]).map(object)
const text = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : ''
const escapeXml = (value: string | number) => String(value).replace(/[<>&"']/g, char => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[char]!))
const number = (value: unknown): number | null => {
  const raw = text(value).trim().replaceAll(',', '')
  if (!raw) return null
  if (!/^-?\d+(\.\d+)?$/.test(raw) || !Number.isFinite(Number(raw))) throw new BarobillError('바로빌 금액 형식을 확인할 수 없습니다.')
  return Number(raw)
}

export function barobillConfig(): Config {
  const certKey = process.env.BAROBILL_CERT_KEY?.trim() ?? ''
  const corpNum = (process.env.BAROBILL_CORP_NUM ?? process.env.BAROBILL_CROP_NUM ?? '').replaceAll('-', '').trim()
  const userId = process.env.BAROBILL_USER_ID?.trim() ?? ''
  if (!certKey || !/^\d{10}$/.test(corpNum) || !userId) throw new BarobillError('바로빌 인증 설정을 확인해 주세요.')
  return { certKey, corpNum, userId, test: process.env.BAROBILL_ENV === 'test' }
}

export function validateCardQuery(input: Row) {
  const startDate = text(input.startDate), endDate = text(input.endDate), cardId = text(input.cardId)
  const validDate = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day
  if (!validDate(startDate) || !validDate(endDate) || endDate < startDate || (Date.parse(endDate) - Date.parse(startDate)) / 86400000 >= 200) throw new CardInputError('조회 기간은 시작일부터 최대 200일로 설정해 주세요.')
  const page = input.page ?? 1
  if (!Number.isInteger(page) || Number(page) < 1 || Number(page) > 10000 || !/^[a-f0-9]{64}$/.test(cardId)) throw new CardInputError('카드와 조회 페이지를 확인해 주세요.')
  return { startDate, endDate, cardId, page: Number(page) }
}

export function createBarobillClient(config: Config, transport: typeof fetch = fetch) {
  const namespace = 'http://ws.baroservice.com/'
  const endpoint = config.test ? 'https://testws.baroservice.com/CARD.asmx' : 'https://ws.baroservice.com/CARD.asmx'
  const parser = new XMLParser({ removeNSPrefix: true, parseTagValue: false, trimValues: false })
  const token = (value: string) => createHmac('sha256', config.certKey).update(value).digest('hex')
  async function call(method: 'GetCardsByAuthID' | 'GetApprovalHistories', fields: Fields): Promise<Row> {
    const params = { CERTKEY: config.certKey, CorpNum: config.corpNum, ID: config.userId, ...fields }
    const body = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${method} xmlns="${namespace}">${Object.entries(params).map(([key, value]) => `<${key}>${escapeXml(value)}</${key}>`).join('')}</${method}></soap:Body></soap:Envelope>`
    let response: Response
    try { response = await transport(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `"${namespace}${method}"` }, body, signal: AbortSignal.timeout(20000), redirect: 'error' }) }
    catch { throw new BarobillError('바로빌 응답이 지연되거나 연결할 수 없습니다. 잠시 후 다시 조회해 주세요.') }
    if (!response.ok) throw new BarobillError('바로빌 서버에 연결할 수 없습니다. 잠시 후 다시 조회해 주세요.')
    const xml = await response.text()
    if (xml.length > 2000000 || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new BarobillError('바로빌 응답 형식을 확인할 수 없습니다.')
    const envelope = object(parser.parse(xml)), soapBody = object(object(envelope.Envelope).Body)
    if (soapBody.Fault) throw new BarobillError('바로빌에서 조회 요청을 처리하지 못했습니다.')
    const result = object(soapBody[`${method}Response`])[`${method}Result`]
    if (result === undefined) throw new BarobillError('바로빌 조회 결과가 누락되었습니다.')
    return object(result)
  }
  const safeCard = (card: Row): ConnectedCard => {
    const num = text(card.CardNum)
    return { id: token(num), company: text(card.CardCompanyName), number: `•••• ${num.slice(-4)}`, alias: text(card.Alias) }
  }
  async function authorizedCards() {
    const result = await call('GetCardsByAuthID', { CollectTarget: 'APPROVAL', AvailOnly: 1 })
    const cards = list(result.CardInfo)
    const code = text(cards[0]?.CardNum)
    if (/^-\d+$/.test(code)) throw new BarobillError(`바로빌 카드 목록 조회 오류 (${code}). 인증정보와 카드 조회 권한을 확인해 주세요.`)
    if (cards.some(card => !/^\d{12,20}$/.test(text(card.CardNum)))) throw new BarobillError('바로빌 카드번호 형식을 확인할 수 없습니다.')
    return cards.filter(card => text(card.CardType) === 'C')
  }
  return {
    environment: config.test ? 'test' as const : 'production' as const,
    async cards() { return (await authorizedCards()).map(safeCard) },
    async approvals(input: Row): Promise<CardApprovalPage> {
      const query = validateCardQuery(input)
      const cards = await authorizedCards(), card = cards.find(row => token(text(row.CardNum)) === query.cardId)
      if (!card) throw new CardInputError('조회 권한이 있는 법인카드를 다시 선택해 주세요.')
      const result = await call('GetApprovalHistories', { CardNum: text(card.CardNum), StartDate: query.startDate.replaceAll('-', ''), EndDate: query.endDate.replaceAll('-', ''), CountPerPage: 100, CurrentPage: query.page, OrderDirection: 1 })
      const current = Number(result.CurrentPage), total = Number(result.MaxIndex), pages = Number(result.MaxPageNum)
      if (Number.isInteger(current) && current < 0) throw new BarobillError(`바로빌 승인내역 조회 오류 (${current}). 카드 조회 권한과 수집 상태를 확인해 주세요.`)
      if (current !== query.page || !Number.isInteger(total) || total < 0 || !Number.isInteger(pages) || pages < 0) throw new BarobillError('바로빌 조회 페이지를 확인할 수 없습니다.')
      const records = list(object(result.Histories).CardApprovalHistory).map(row => {
        const date = text(row.ApprovalDT), amount = number(row.ApprovalAmount), key = text(row.HistoryKey)
        if (!/^\d{14}$/.test(date) || amount === null || !key) throw new BarobillError('바로빌 승인내역의 필수 항목을 확인할 수 없습니다.')
        return { id: token(`${text(card.CardNum)}:${key}`), dateTime: `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)} ${date.slice(8,10)}:${date.slice(10,12)}:${date.slice(12,14)}`, approvalType: text(row.ApprovalType), approvalNumber: text(row.ApprovalNum), store: text(row.StoreName), storeNumber: text(row.StoreCorpNum), amount, currency: text(row.CurrencyCode) || 'KRW', supplyAmount: number(row.Amount), vatAmount: number(row.Tax), serviceCharge: number(row.ServiceCharge), memo: text(row.Memo) }
      })
      return { records, page: current, totalPages: pages, total, card: safeCard(card), startDate: query.startDate, endDate: query.endDate }
    },
  }
}
