import { test } from 'node:test'
import assert from 'node:assert/strict'
import { XMLParser } from 'fast-xml-parser'
import { createBarobillClient, validateCardQuery } from './barobill.ts'
import { createCardHandler } from '../api/barobill-cards.ts'
import { sameOrigin } from './security.ts'

const config = { certKey: 'test<&credential', idSecret: 'id-secret', corpNum: '1234567890', userId: 'user' }
const cardNum = '1234567890124858'
const reply = (method, result) => new Response(`<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${method}Response><${method}Result>${result}</${method}Result></${method}Response></soap:Body></soap:Envelope>`)
const cardsXml = `<CardInfo><CardNum>${cardNum}</CardNum><CardType>C</CardType><CardCompanyName>테스트카드</CardCompanyName><Alias>현장</Alias><WebPwd>never-return</WebPwd></CardInfo><CardInfo><CardNum>1234567890129999</CardNum><CardType>P</CardType></CardInfo>`
const pageXml = `<CurrentPage>2</CurrentPage><MaxIndex>101</MaxIndex><MaxPageNum>2</MaxPageNum><Histories><CardApprovalHistory><HistoryKey>unique-1</HistoryKey><ApprovalDT>20261022112233</ApprovalDT><ApprovalType>부분취소</ApprovalType><ApprovalNum>001234</ApprovalNum><ApprovalAmount>-12.34</ApprovalAmount><CurrencyCode>USD</CurrencyCode><StoreName>A &amp; B</StoreName><Amount></Amount><Tax></Tax><ServiceCharge>0</ServiceCharge></CardApprovalHistory></Histories>`

test('SOAP escapes credentials, masks cards, excludes personal cards and never returns login details', async () => {
  const client = createBarobillClient(config, async (url, init) => {
    assert.equal(url, 'https://ws.baroservice.com/CARD.asmx')
    assert.equal(new XMLParser({removeNSPrefix:true}).parse(init.body).Envelope.Body.GetCardsByAuthID.CERTKEY, config.certKey)
    assert.match(init.body, /<CollectTarget>APPROVAL<\/CollectTarget>/)
    return reply('GetCardsByAuthID', cardsXml)
  })
  const cards = await client.cards()
  assert.equal(cards.length, 1); assert.equal(cards[0].number, '•••• 4858')
  assert.doesNotMatch(JSON.stringify(cards), /123456789012|never-return|credential/)
})

test('approval paging preserves negative foreign currency amounts, leading zeros and missing tax', async () => {
  let calls = 0
  const client = createBarobillClient(config, async (_url, init) => {
    calls++
    if (init.body.includes('<GetCardsByAuthID ')) return reply('GetCardsByAuthID', cardsXml)
    assert.match(init.body, /<CurrentPage>2<\/CurrentPage>/)
    assert.match(init.body, /<OrderDirection>1<\/OrderDirection>/)
    return reply('GetApprovalHistories', pageXml)
  })
  const [card] = await client.cards()
  const result = await client.approvals({ cardId:card.id, startDate:'2026-10-01', endDate:'2026-10-23', page:2 })
  assert.equal(calls,3); assert.equal(result.total,101); assert.equal(result.totalPages,2)
  assert.equal(result.records[0].amount,-12.34); assert.equal(result.records[0].currency,'USD')
  assert.equal(result.records[0].approvalType,'부분취소'); assert.equal(result.records[0].approvalNumber,'001234')
  assert.equal(result.records[0].vatAmount,null); assert.equal(result.records[0].serviceCharge,0)
  assert.equal(result.records[0].store,'A & B'); assert.doesNotMatch(JSON.stringify(result),new RegExp(cardNum))
})

test('invalid dates and unauthorized card tokens cannot query approval histories', async () => {
  const cardId = 'a'.repeat(64)
  for (const dates of [['2026-02-30','2026-03-01'],['2026-10-23','2026-10-01'],['2026-01-01','2026-12-31']]) assert.throws(()=>validateCardQuery({cardId,startDate:dates[0],endDate:dates[1]}), /200일/)
  let calls = 0
  const client = createBarobillClient(config, async () => { calls++; return reply('GetCardsByAuthID',cardsXml) })
  await assert.rejects(()=>client.approvals({cardId,startDate:'2026-10-01',endDate:'2026-10-23'}),/권한/)
  assert.equal(calls,1)
})

test('upstream error codes and faults cannot leak raw XML or credentials', async () => {
  const client = createBarobillClient(config, async () => reply('GetCardsByAuthID','<CardInfo><CardNum>-10002</CardNum></CardInfo>'))
  await assert.rejects(()=>client.cards(), /-10002/)
  const fault = createBarobillClient(config, async () => new Response('<Envelope><Body><Fault><faultstring>secret data</faultstring></Fault></Body></Envelope>'))
  await assert.rejects(()=>fault.cards(),error=>!error.message.includes('secret data'))
})

test('card API requires staff session and same origin before calling Barobill; errors stay generic', async () => {
  const origin = 'https://workspace.example.test'
  let user = null, calls = 0
  const deps = { readSession:async()=>user, sameOrigin, settings:()=>({origin}), client:()=>({cards:async()=>{calls++; throw new Error('sensitive credential')}, approvals:async()=>({})}) }
  const handler = createCardHandler(deps)
  const req = {method:'POST',headers:{origin,'content-type':'application/json'},body:{action:'cards'}}
  const res = ()=>({statusCode:200,setHeader(){},end(body){this.body=JSON.parse(body)}})
  let response=res(); await handler(req,response); assert.equal(response.statusCode,401); assert.equal(calls,0)
  user={email:'staff@example.test'}
  response=res(); await handler({...req,headers:{...req.headers,origin:'https://evil.example'}},response); assert.equal(response.statusCode,403); assert.equal(calls,0)
  response=res(); await handler(req,response); assert.equal(response.statusCode,503); assert.doesNotMatch(JSON.stringify(response.body),/sensitive/)
})

test('all cards merges every page of every card by date and pages the result with per-row card numbers', async () => {
  const second = '9876543210123888'
  const twoCards = `<CardInfo><CardNum>${cardNum}</CardNum><CardType>C</CardType><CardCompanyName>테스트카드</CardCompanyName></CardInfo><CardInfo><CardNum>${second}</CardNum><CardType>C</CardType><CardCompanyName>국민카드</CardCompanyName></CardInfo>`
  const history = (key, dt) => `<CardApprovalHistory><HistoryKey>${key}</HistoryKey><ApprovalDT>${dt}</ApprovalDT><ApprovalAmount>1000</ApprovalAmount><CurrencyCode>KRW</CurrencyCode><StoreName>${key}</StoreName></CardApprovalHistory>`
  const pages = { [cardNum]: [[history('a1', '20261002090000'), history('a2', '20261005090000')], [history('a3', '20261007090000')]], [second]: [[history('b1', '20261003090000')]] }
  const client = createBarobillClient(config, async (_url, init) => {
    if (init.body.includes('<GetCardsByAuthID ')) return reply('GetCardsByAuthID', twoCards)
    const card = init.body.match(/<CardNum>(\d+)<\/CardNum>/)[1], page = Number(init.body.match(/<CurrentPage>(\d+)<\/CurrentPage>/)[1])
    const list = pages[card]
    return reply('GetApprovalHistories', `<CurrentPage>${page}</CurrentPage><MaxIndex>${list.flat().length}</MaxIndex><MaxPageNum>${list.length}</MaxPageNum><Histories>${list[page - 1].join('')}</Histories>`)
  })
  const result = await client.approvals({ cardId: 'all', startDate: '2026-10-01', endDate: '2026-10-23' })
  assert.deepEqual(result.records.map(row => `${row.store}:${row.cardNumber}`), ['a1:4858', 'b1:3888', 'a2:4858', 'a3:4858'])
  assert.equal(result.total, 4); assert.equal(result.totalPages, 1); assert.equal(result.card.company, '전체 카드')
  await assert.rejects(client.approvals({ cardId: 'all', startDate: '2026-10-01', endDate: '2026-10-23', page: 2 }), /페이지/)
  assert.equal(validateCardQuery({ cardId: 'all', startDate: '2026-10-01', endDate: '2026-10-02' }).cardId, 'all')
  assert.throws(() => validateCardQuery({ cardId: 'everything', startDate: '2026-10-01', endDate: '2026-10-02' }), /카드/)
})

test('card and approval ids stay the same when only the Barobill cert key changes', async () => {
  const history = '<CurrentPage>1</CurrentPage><MaxIndex>1</MaxIndex><MaxPageNum>1</MaxPageNum><Histories><CardApprovalHistory><HistoryKey>k1</HistoryKey><ApprovalDT>20261022112233</ApprovalDT><ApprovalAmount>1000</ApprovalAmount></CardApprovalHistory></Histories>'
  const ids = async (certKey, idSecret) => {
    const client = createBarobillClient({ ...config, certKey, idSecret }, async (_url, init) => init.body.includes('<GetCardsByAuthID ') ? reply('GetCardsByAuthID', cardsXml) : reply('GetApprovalHistories', history))
    const [card] = await client.cards()
    return [card.id, (await client.approvals({ cardId: card.id, startDate: '2026-10-01', endDate: '2026-10-23' })).records[0].id]
  }
  assert.deepEqual(await ids('test-key', 'stable'), await ids('production-key', 'stable'))
  assert.notDeepEqual(await ids('test-key', 'stable'), await ids('test-key', 'other'))
})
