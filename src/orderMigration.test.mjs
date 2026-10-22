import {test} from 'node:test'
import assert from 'node:assert/strict'
import {sharedProjectIdMap,remapProjectReferences} from './orderMigration.ts'
test('shared IDs preserve local expense and worklog links using year and order number',()=>{
  const local=[{id:'old',year:'2023',orderNo:'23001',orderDate:''},{id:'unmatched',year:'2024',orderNo:'24001',orderDate:'2024-01-01'}]
  const shared=[{...local[0],id:'shared-2023-23001'},{...local[1],year:'2025',id:'different-year'}]
  const map=sharedProjectIdMap(local,shared)
  const records=[{projectId:'old',note:'비고 유지'},{projectId:'unmatched',note:'연결 없는 자료 보존'}]
  assert.deepEqual(remapProjectReferences(records,map),[{projectId:'shared-2023-23001',note:'비고 유지'},records[1]])
  assert.equal(records[0].projectId,'old')
  assert.deepEqual(remapProjectReferences(remapProjectReferences(records,map),map),remapProjectReferences(records,map))
})
