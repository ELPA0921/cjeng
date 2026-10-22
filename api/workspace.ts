import type { IncomingMessage, ServerResponse } from 'node:http'
import { readSession, sameOrigin, settings } from '../server/security.ts'
import { workspaceSheetsRequest } from '../server/googleSheets.ts'
import { validateWorkspace } from '../server/workspaceValidation.ts'
import { validateRevision } from '../server/orderValidation.ts'

export function createWorkspaceHandler(deps={readSession,sameOrigin,settings,workspaceSheetsRequest}) {
return async function handler(req: IncomingMessage & {body?: unknown},res: ServerResponse) {
  res.setHeader('Cache-Control','private, no-store')
  res.setHeader('Content-Type','application/json; charset=utf-8')
  res.setHeader('X-Content-Type-Options','nosniff')
  try {
    const user=await deps.readSession(req)
    if (!user) {res.statusCode=401;res.end(JSON.stringify({error:'직원 계정으로 로그인해 주세요.'}));return}
    if(req.method==='GET'){res.end(JSON.stringify(await deps.workspaceSheetsRequest('workspace-read')));return}
    if(req.method!=='PUT'){res.statusCode=405;res.setHeader('Allow','GET, PUT');res.end('{}');return}
    if(!deps.sameOrigin(req,deps.settings().origin)){res.statusCode=403;res.end(JSON.stringify({error:'접속 주소를 확인하세요.'}));return}
    let input
    try {
      if(Number(req.headers['content-length'])>2000000)throw new Error('자료가 너무 큽니다.')
      const body=typeof req.body==='string'?JSON.parse(req.body):req.body as {data?:unknown;revision?:unknown;initialize?:unknown}
      input={data:validateWorkspace(body?.data),revision:validateRevision(body?.revision),initialize:body?.initialize===true}
      if(typeof input.revision!=='string')throw new Error('자료를 다시 불러오세요.')
    }catch(error){res.statusCode=400;res.end(JSON.stringify({error:error instanceof Error?error.message:'입력값을 확인하세요.'}));return}
    if(input.initialize && user.email!==deps.settings().allowed.values().next().value){res.statusCode=403;res.end(JSON.stringify({error:'관리자가 기존 자료를 연결할 때까지 기다려 주세요.'}));return}
    const result=await deps.workspaceSheetsRequest('workspace-write',{...input,email:user.email})
    if(!result){res.statusCode=409;res.end(JSON.stringify({error:'다른 직원이 먼저 자료를 수정했습니다. 입력 내용을 복사해 두고 창을 닫은 뒤 다시 열어주세요.'}));return}
    res.end(JSON.stringify(result))
  }catch{res.statusCode=503;res.end(JSON.stringify({error:'공유 자료에 연결할 수 없습니다. 저장되지 않았습니다.'}))}
}
}
export default createWorkspaceHandler()
