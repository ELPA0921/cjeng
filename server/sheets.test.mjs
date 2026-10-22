import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import {createHash,createHmac} from 'node:crypto'
import {signedEnvelope} from './googleSheets.ts'
const secret='test-only-shared-secret-12345678901234567890'
const headers=['년도','수주번호','수주일자','준공예정일','상태','담당자','수주처','공사현장','공사명','비고','내부ID','이전 수주처']
function fixture(){
  let grid=[headers,['2023','23001','','2023-09-19','준공','담당','수주처','현장','테스트 공사','비고,\n두 줄','shared-1','이전 부서']]
  let writes=0
  const replay=new Map()
  const range=(r,c,n,w)=>({getDisplayValues:()=>Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>String(grid[r-1+i]?.[c-1+j]??''))),setValues:rows=>{writes++;rows.forEach((row,i)=>{grid[r-1+i]=row.map(value=>value.startsWith("'")?value.slice(1):value)})}})
  const sheet={getLastRow:()=>grid.length,getMaxRows:()=>1000,getRange:range}
  let extraGrid=[],extraSheet=null
  const workbook={getSheetByName:name=>name==='수주대장'?sheet:extraSheet,insertSheet:()=>{
    extraSheet={getLastRow:()=>extraGrid.length,getMaxRows:()=>1000,getRange:(r,c,n,w)=>({getDisplayValues:()=>Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>String(extraGrid[r-1+i]?.[c-1+j]??''))),setValues:rows=>{extraGrid=structuredClone(rows);writes++}})}
    return extraSheet
  }}
  const context=vm.createContext({
    console, Date, PropertiesService:{getScriptProperties:()=>({getProperty:key=>key==='CJENG_API_SECRET'?secret:'test-sheet'})},
    Utilities:{Charset:{UTF_8:'utf8'},DigestAlgorithm:{SHA_256:'sha256'},computeHmacSha256Signature:(v,k)=>[...createHmac('sha256',k).update(v).digest()],computeDigest:(a,v)=>[...createHash(a).update(v).digest()]},
    ContentService:{MimeType:{JSON:'application/json'},createTextOutput:text=>({text,setMimeType(){return this}})},
    SpreadsheetApp:{openById:()=>workbook,flush:()=>{}},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
    CacheService:{getScriptCache:()=>({get:key=>replay.get(key),put:(key,v)=>replay.set(key,v)})},
  })
  vm.runInContext(readFileSync(new URL('../google-apps-script/Code.gs',import.meta.url),'utf8'),context)
  const send=envelope=>JSON.parse(context.doPost({postData:{contents:JSON.stringify(envelope)}}).text)
  return {send,writes:()=>writes,grid:()=>grid,extraGrid:()=>extraGrid}
}
test('Google Sheets bridge rejects unsigned, modified, expired and replayed requests',()=>{
  const f=fixture()
  assert.equal(f.send({payload:'{}',signature:'invalid'}).ok,false)
  const read=signedEnvelope('read',null,secret)
  assert.equal(f.send(read).ok,true)
  assert.equal(f.send(read).ok,false)
  const altered={...signedEnvelope('read',null,secret),signature:'0'.repeat(64)}
  assert.equal(f.send(altered).ok,false)
  const payload=JSON.stringify({action:'read',data:null,issuedAt:Date.now()-120000,nonce:'00000000-0000-0000-0000-000000000000'})
  assert.equal(f.send({payload,signature:createHmac('sha256',secret).update(payload).digest('hex')}).ok,false)
  assert.equal(f.writes(),0)
})

test('all-menu sheet state is initialized once, chunks safely, and rejects stale concurrent writes',()=>{
  const f=fixture()
  const initial=f.send(signedEnvelope('workspace-read',null,secret)).data
  assert.equal(initial.initialized,false)
  assert.equal(f.send(signedEnvelope('workspace-write',{data:initial.data,revision:initial.revision,initialize:false},secret)).conflict,true)
  const data={...initial.data,expenses:[{id:'e',projectId:'shared-1',amount:1234,supplyAmount:1122,vatAmount:112,memo:'=수식 아님\n'+ '긴 한글 메모, "인용"\n'.repeat(4000)}],workLogs:[{id:'w',hours:8.5,workerType:'직원',note:'야간 작업'}],deliveries:[{id:'d',item:'납품',note:'+문자'}]}
  const saved=f.send(signedEnvelope('workspace-write',{data,revision:initial.revision,initialize:true},secret))
  assert.equal(saved.ok,true)
  assert.ok(f.extraGrid().length>2)
  assert.ok(f.extraGrid().slice(1).every(row=>row[0].startsWith('json:')&&row[0].length<=30005))
  assert.deepEqual(f.send(signedEnvelope('workspace-read',null,secret)).data.data,data)
  assert.equal(f.send(signedEnvelope('workspace-write',{data,revision:saved.data.revision,initialize:true},secret)).conflict,true)
  const changed={...data,deletedVendorKeys:['purchase-0']}
  const updated=f.send(signedEnvelope('workspace-write',{data:changed,revision:saved.data.revision,initialize:false},secret))
  assert.equal(updated.ok,true)
  assert.equal(f.send(signedEnvelope('workspace-write',{data,revision:saved.data.revision,initialize:false},secret)).conflict,true)
  assert.equal(f.send(signedEnvelope('read',null,secret)).data.orders.length,1)
})
test('Google Sheets bridge preserves unknown dates and legacy data and rejects stale writes',()=>{
  const f=fixture()
  const first=f.send(signedEnvelope('read',null,secret)).data
  assert.equal(first.orders[0].orderDate,'')
  assert.equal(first.orders[0].client2,'이전 부서')
  const changed=structuredClone(first);changed.orders[0].status='보류'
  const saved=f.send(signedEnvelope('write',changed,secret))
  assert.equal(saved.ok,true)
  assert.notEqual(saved.data.revision,first.revision)
  assert.equal(f.send(signedEnvelope('write',first,secret)).conflict,true)
  const reread=f.send(signedEnvelope('read',null,secret)).data
  assert.equal(reread.orders[0].status,'보류')
  assert.equal(reread.orders[0].note,'비고,\n두 줄')
  assert.equal(reread.orders[0].client2,'이전 부서')
  assert.equal(f.writes(),1)
})
