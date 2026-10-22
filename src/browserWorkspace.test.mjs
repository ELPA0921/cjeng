import {test} from 'node:test'
import assert from 'node:assert/strict'
import {browserWorkspace,mergeBrowserWorkspace} from './browserWorkspace.ts'
import {defaultExpenses,defaultWorkLogs} from './sampleData.ts'
import {emptyWorkspace} from './workspaceTypes.ts'
test('browser migration preserves real records and project links, skips untouched examples, and leaves local sources intact',()=>{
  const data=new Map(Object.entries({
    'cost-app-orders':JSON.stringify([{id:'local-project',year:'2026',orderNo:'26001',orderDate:'2026-01-01'}]),
    'cost-app-expenses':JSON.stringify([...defaultExpenses,{...defaultExpenses[0],id:'real-expense',projectId:'local-project',memo:'실제 자료'}]),
    'cost-app-worklogs-v2':JSON.stringify(defaultWorkLogs),
  }))
  globalThis.localStorage={getItem:key=>data.get(key)??null}
  const before=JSON.stringify([...data])
  const result=browserWorkspace([{id:'shared-project',year:'2026',orderNo:'26001',orderDate:'2026-01-01'}])
  assert.equal(result.expenses.length,1)
  assert.equal(result.expenses[0].projectId,'shared-project')
  assert.equal(result.workLogs.length,0)
  assert.equal(result.deliveries.length,75)
  assert.equal(JSON.stringify([...data]),before)
  data.set('cost-app-worklogs-v2','invalid-json')
  assert.throws(()=>browserWorkspace([]),/원본/)
  delete globalThis.localStorage
})
test('later browser import keeps shared edits, deduplicates deliveries, and adds only missing records',()=>{
  const shared=emptyWorkspace(),local=emptyWorkspace()
  shared.expenses=[{id:'same',memo:'직원이 수정한 최신 자료'}]
  local.expenses=[{id:'same',memo:'과거 브라우저 자료'},{id:'new',memo:'추가'}]
  const row={id:'d1',date:'2026-10-22',client:'',company:'',address:'',item:'실적',specification:'',airflow:'',note:''}
  shared.deliveries=[row];local.deliveries=[{...row,id:'another-id'}]
  const merged=mergeBrowserWorkspace(shared,local)
  assert.equal(merged.data.expenses[0].memo,'직원이 수정한 최신 자료')
  assert.equal(merged.data.expenses.length,2)
  assert.equal(merged.data.deliveries.length,1)
  assert.equal(merged.added,1)
  assert.equal(merged.conflicts,1)
  assert.equal(shared.expenses.length,1)
})
