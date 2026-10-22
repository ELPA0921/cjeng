import { test } from 'node:test'
import assert from 'node:assert/strict'
import { packWorkspace } from './workspaceCodec.ts'
import { validateWorkspace } from './workspaceValidation.ts'

const log = { id:'w1', projectId:'work-unassigned', date:'2023-01-05', worker:'작업자', workerType:'인력', startTime:'07:30', endTime:'11:30', overtimeHours:0, location:'인천공장', task:'배관 보수', note:'원본 공사 보존', hours:4 }
const data = { expenses:[], workLogs:[log], purchases:[], deliveries:[], inactiveVendorKeys:[], deletedVendorKeys:[], vendorEdits:{}, customVendorContacts:{purchase:[],order:[]} }

test('compact work logs round-trip all fields and retain legacy object support', () => {
  assert.deepEqual(validateWorkspace(packWorkspace(data)), data)
  assert.deepEqual(validateWorkspace(data), data)
  assert.ok(JSON.stringify(packWorkspace(data)).length < JSON.stringify(data).length)
})

test('compact data still rejects invalid dates, types, duplicate IDs and malformed tuples', () => {
  for (const change of [{date:'2023-02-30'}, {hours:'4'}, {workerType:'알수없음'}]) {
    assert.throws(() => validateWorkspace(packWorkspace({...data,workLogs:[{...log,...change}]})))
  }
  assert.throws(() => validateWorkspace(packWorkspace({...data,workLogs:[log,log]})))
  assert.throws(() => validateWorkspace({...data,workLogs:[['incomplete']]}))
})
