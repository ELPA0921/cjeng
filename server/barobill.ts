import { createHmac } from 'node:crypto'
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import type { ConnectedCard, CardApprovalPage } from '../src/cardTypes.ts'
import type { PurchaseTaxInvoice, PurchaseTaxInvoicePage } from '../src/taxInvoiceTypes.ts'

type Config = { certKey: string; idSecret: string; corpNum: string; userId: string; test?: boolean }
type Fields = Record<string, string | number>
type Row = Record<string, unknown>
export class BarobillError extends Error {}
export class CardInputError extends Error {}
export const allCardsId = 'all'
// Upper bound for one card when merging every card; keeps a single request from paging forever.
const maxPagesPerCard = 30
const maxTaxInvoicePages = 50
// Barobill splits the API by service; card calls send the user as ID, tax invoice calls as UserID.
const methodService = { GetCardsByAuthID: 'CARD', GetApprovalHistories: 'CARD', GetPeriodTaxInvoicePurchaseList: 'TI' } as const
type Method = keyof typeof methodService
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
  const idSecret = process.env.BAROBILL_ID_SECRET?.trim() ?? ''
  if (!certKey || !idSecret || !/^\d{10}$/.test(corpNum) || !userId) throw new BarobillError('바로빌 인증 설정을 확인해 주세요.')
  return { certKey, idSecret, corpNum, userId, test: process.env.BAROBILL_ENV === 'test' }
}

function validatePeriod(input: Row) {
  const startDate = text(input.startDate), endDate = text(input.endDate)
  const validDate = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day
  if (!validDate(startDate) || !validDate(endDate) || endDate < startDate || (Date.parse(endDate) - Date.parse(startDate)) / 86400000 >= 200) throw new CardInputError('조회 기간은 시작일부터 최대 200일로 설정해 주세요.')
  const page = input.page ?? 1
  if (!Number.isInteger(page) || Number(page) < 1 || Number(page) > 10000) throw new CardInputError('조회 페이지를 확인해 주세요.')
  return { startDate, endDate, page: Number(page) }
}

export function validateCardQuery(input: Row) {
  const cardId = text(input.cardId)
  const period = validatePeriod(input)
  if (cardId !== allCardsId && !/^[a-f0-9]{64}$/.test(cardId)) throw new CardInputError('카드와 조회 페이지를 확인해 주세요.')
  return { ...period, cardId }
}

export function createBarobillClient(config: Config, transport: typeof fetch = fetch) {
  const namespace = 'http://ws.baroservice.com/'
  const parser = new XMLParser({ removeNSPrefix: true, parseTagValue: false, trimValues: false })
  // Card and approval ids are stored with accounting records, so they use a dedicated key
  // that survives Barobill cert key reissues while still hiding the card number.
  const token = (value: string) => createHmac('sha256', config.idSecret).update(value).digest('hex')
  async function call(method: Method, fields: Fields): Promise<Row> {
    const service = methodService[method]
    return object(await send(service, method, { CERTKEY: config.certKey, CorpNum: config.corpNum, [service === 'CARD' ? 'ID' : 'UserID']: config.userId, ...fields }))
  }
  // Barobill reports failures as negative codes; ask it for the matching explanation.
  async function failure(service: 'CARD' | 'TI', what: string, code: number | string) {
    let detail = ''
    try { detail = text(await send(service, 'GetErrString', { CERTKEY: config.certKey, ErrCode: Number(code) })).trim() } catch { /* keep the code alone */ }
    return new BarobillError(`바로빌 ${what} 오류 (${code})${detail ? `: ${detail}` : ''}`)
  }
  async function send(service: 'CARD' | 'TI', method: string, params: Fields): Promise<unknown> {
    const endpoint = `https://${config.test ? 'testws' : 'ws'}.baroservice.com/${service}.asmx`
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
    return result
  }
  const safeCard = (card: Row): ConnectedCard => {
    const num = text(card.CardNum)
    return { id: token(num), company: text(card.CardCompanyName), number: `•••• ${num.slice(-4)}`, alias: text(card.Alias) }
  }
  async function authorizedCards() {
    const result = await call('GetCardsByAuthID', { CollectTarget: 'APPROVAL', AvailOnly: 1 })
    const cards = list(result.CardInfo)
    const code = text(cards[0]?.CardNum)
    if (/^-\d+$/.test(code)) throw await failure('CARD', '카드 목록 조회', code)
    if (cards.some(card => !/^\d{12,20}$/.test(text(card.CardNum)))) throw new BarobillError('바로빌 카드번호 형식을 확인할 수 없습니다.')
    return cards.filter(card => text(card.CardType) === 'C')
  }
  async function approvalPage(card: Row, query: { startDate: string; endDate: string }, page: number) {
    const result = await call('GetApprovalHistories', { CardNum: text(card.CardNum), StartDate: query.startDate.replaceAll('-', ''), EndDate: query.endDate.replaceAll('-', ''), CountPerPage: 100, CurrentPage: page, OrderDirection: 1 })
    const current = Number(result.CurrentPage), total = Number(result.MaxIndex), pages = Number(result.MaxPageNum)
    if (Number.isInteger(current) && current < 0) throw await failure('CARD', '승인내역 조회', current)
    if (current !== page || !Number.isInteger(total) || total < 0 || !Number.isInteger(pages) || pages < 0) throw new BarobillError('바로빌 조회 페이지를 확인할 수 없습니다.')
    const cardNumber = text(card.CardNum).slice(-4)
    const records = list(object(result.Histories).CardApprovalHistory).map(row => {
      const date = text(row.ApprovalDT), amount = number(row.ApprovalAmount), key = text(row.HistoryKey)
      if (!/^\d{14}$/.test(date) || amount === null || !key) throw new BarobillError('바로빌 승인내역의 필수 항목을 확인할 수 없습니다.')
      // Cancellations come with a negative amount but positive tax and supply; give every part the amount's sign.
      const signed = (part: number | null) => !part || amount >= 0 ? part : -Math.abs(part)
      return { id: token(`${text(card.CardNum)}:${key}`), dateTime: `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)} ${date.slice(8,10)}:${date.slice(10,12)}:${date.slice(12,14)}`, approvalType: text(row.ApprovalType), approvalNumber: text(row.ApprovalNum), store: text(row.StoreName), storeNumber: text(row.StoreCorpNum), amount, currency: text(row.CurrencyCode) || 'KRW', supplyAmount: signed(number(row.Amount)), vatAmount: signed(number(row.Tax)), serviceCharge: signed(number(row.ServiceCharge)), memo: text(row.Memo), cardNumber }
    })
    return { records, total, pages }
  }
  async function everyApproval(card: Row, query: { startDate: string; endDate: string }) {
    const first = await approvalPage(card, query, 1)
    if (first.pages > maxPagesPerCard) throw new CardInputError('전체 카드로 보기에는 내역이 너무 많습니다. 조회 기간을 줄이거나 카드를 선택해 주세요.')
    const records = [...first.records]
    for (let page = 2; page <= first.pages; page++) records.push(...(await approvalPage(card, query, page)).records)
    return records
  }
  const day = (value: string) => /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : value
  function purchaseInvoice(row: Row): PurchaseTaxInvoice {
    const approvalNumber = text(row.NTSSendKey).trim(), writeDate = day(text(row.WriteDate).trim()), amount = number(row.TotalAmount)
    if (!approvalNumber || !/^\d{4}-\d{2}-\d{2}$/.test(writeDate) || amount === null) throw new BarobillError('바로빌 세금계산서의 필수 항목을 확인할 수 없습니다.')
    const corpNum = text(row.InvoicerCorpNum).replaceAll('-', '')
    return {
      id: token(`tax:${approvalNumber}`), approvalNumber, writeDate,
      vendor: text(row.InvoicerCorpName).trim(),
      vendorCorpNum: /^\d{10}$/.test(corpNum) ? `${corpNum.slice(0, 3)}-${corpNum.slice(3, 5)}-${corpNum.slice(5)}` : corpNum,
      itemName: text(row.ItemName).trim(), supplyAmount: number(row.AmountTotal), vatAmount: number(row.TaxTotal), amount,
      modified: text(row.ModifyCode).trim() !== '',
    }
  }
  // TaxType 1 is 세금계산서 and 2 is 계산서 (면세); DateType 1 filters by 작성일자.
  async function purchaseInvoicesOfType(taxType: number, query: { startDate: string; endDate: string }) {
    const records: PurchaseTaxInvoice[] = []
    for (let page = 1, pages = 1; page <= pages; page++) {
      const result = await call('GetPeriodTaxInvoicePurchaseList', { TaxType: taxType, DateType: 1, StartDate: query.startDate.replaceAll('-', ''), EndDate: query.endDate.replaceAll('-', ''), CountPerPage: 100, CurrentPage: page })
      const current = Number(result.CurrentPage)
      pages = Number(result.MaxPageNum)
      if (Number.isInteger(current) && current < 0) throw await failure('TI', '세금계산서 조회', current)
      if (!Number.isInteger(pages) || pages < 0 || (pages > 0 && current !== page)) throw new BarobillError('바로빌 조회 페이지를 확인할 수 없습니다.')
      if (pages > maxTaxInvoicePages) throw new CardInputError('세금계산서가 너무 많습니다. 조회 기간을 줄여 주세요.')
      records.push(...list(object(result.SimpleTaxInvoiceExList).SimpleTaxInvoiceEx).map(purchaseInvoice))
    }
    return records
  }
  return {
    environment: config.test ? 'test' as const : 'production' as const,
    async purchaseTaxInvoices(input: Row): Promise<PurchaseTaxInvoicePage> {
      const query = validatePeriod(input)
      const byApproval = new Map<string, PurchaseTaxInvoice>()
      for (const taxType of [1, 2]) for (const invoice of await purchaseInvoicesOfType(taxType, query)) byApproval.set(invoice.approvalNumber, invoice)
      const records = [...byApproval.values()].sort((a, b) => a.writeDate.localeCompare(b.writeDate) || a.vendor.localeCompare(b.vendor, 'ko-KR'))
      const totalPages = Math.ceil(records.length / 100)
      if (query.page > Math.max(1, totalPages)) throw new CardInputError('조회 페이지를 확인해 주세요.')
      return { records: records.slice((query.page - 1) * 100, query.page * 100), page: query.page, totalPages, total: records.length, startDate: query.startDate, endDate: query.endDate }
    },
    async cards() { return (await authorizedCards()).map(safeCard) },
    async approvals(input: Row): Promise<CardApprovalPage> {
      const query = validateCardQuery(input)
      const cards = await authorizedCards()
      if (query.cardId === allCardsId) {
        // Barobill pages per card, so merge every card by date and page the result here.
        const records = (await Promise.all(cards.map(card => everyApproval(card, query)))).flat()
          .sort((a, b) => a.dateTime.localeCompare(b.dateTime) || a.cardNumber.localeCompare(b.cardNumber))
        const totalPages = Math.ceil(records.length / 100)
        if (query.page > Math.max(1, totalPages)) throw new CardInputError('카드와 조회 페이지를 확인해 주세요.')
        return { records: records.slice((query.page - 1) * 100, query.page * 100), page: query.page, totalPages, total: records.length, card: { id: allCardsId, company: '전체 카드', number: '', alias: '' }, startDate: query.startDate, endDate: query.endDate }
      }
      const card = cards.find(row => token(text(row.CardNum)) === query.cardId)
      if (!card) throw new CardInputError('조회 권한이 있는 법인카드를 다시 선택해 주세요.')
      const { records, total, pages } = await approvalPage(card, query, query.page)
      return { records, page: query.page, totalPages: pages, total, card: safeCard(card), startDate: query.startDate, endDate: query.endDate }
    },
  }
}
