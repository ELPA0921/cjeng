import { useEffect, useState, type FormEvent } from 'react'
import ModalClose from './ModalClose'
import './UserManager.css'

type Role = 'admin' | 'staff'
type Member = { email: string; name: string; role: Role; addedBy: string; addedAt: string; owner: boolean }
const roleLabel: Record<Role, string> = { admin: '관리자', staff: '직원' }

async function call(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: object) {
  const response = await fetch('/api/users', { method, credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || '계정 목록을 불러오지 못했습니다.')
  return data.members as Member[]
}

// A name note saved when the field loses focus; Enter saves, Escape cancels.
// Keyed by the saved name, so a fresh member list resets the draft.
function NameCell({ member, busy, onSave }: { member: Member; busy: boolean; onSave: (name: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState(member.name)
  async function save() {
    if (draft.trim() === member.name) { setDraft(member.name); return }
    if (!await onSave(draft)) setDraft(member.name)
  }
  return <input className="user-manager-name" aria-label={`${member.email} 이름`} value={draft} maxLength={40} disabled={busy} placeholder="이름 입력"
    onChange={event => setDraft(event.target.value)} onBlur={() => void save()}
    onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraft(member.name); event.currentTarget.blur() } }} />
}

export default function UserManager({ me, onClose }: { me: string; onClose: () => void }) {
  const [members, setMembers] = useState<Member[] | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('staff')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { call('GET').then(setMembers).catch(err => setError(err.message)) }, [])

  async function run(task: () => Promise<Member[]>, done: string) {
    setBusy(true); setError(''); setMessage('')
    try { setMembers(await task()); setMessage(done); return true }
    catch (err) { setError(err instanceof Error ? err.message : '저장하지 못했습니다.'); return false }
    finally { setBusy(false) }
  }
  async function add(event: FormEvent) {
    event.preventDefault()
    const address = email.trim().toLowerCase()
    if (members?.some(member => member.email === address)) { setError('이미 등록된 계정입니다. 아래 목록에서 권한을 바꿀 수 있습니다.'); return }
    if (await run(() => call('POST', { email: address, role, name }), `${address} 계정을 ${roleLabel[role]}(으)로 추가했습니다.`)) { setEmail(''); setName('') }
  }
  const rename = (member: Member, next: string) => run(() => call('PATCH', { email: member.email, name: next }), next.trim() ? `${member.email} 이름을 저장했습니다.` : `${member.email} 이름을 지웠습니다.`)
  const changeRole = (member: Member, next: Role) => run(() => call('POST', { email: member.email, role: next }), `${member.email} 권한을 ${roleLabel[next]}(으)로 바꿨습니다.`)
  function remove(member: Member) {
    if (!window.confirm(`${member.email} 계정의 접속을 막을까요? 사용 중이면 곧바로 로그아웃됩니다.`)) return
    void run(() => call('DELETE', { email: member.email }), `${member.email} 계정을 삭제했습니다.`)
  }

  return <div className="modal-backdrop" role="presentation">
    <section className="modal-panel user-manager" role="dialog" aria-modal="true" aria-labelledby="user-manager-title">
      <div className="modal-heading user-manager-heading">
        <div><h3 id="user-manager-title">직원 계정 관리</h3><span>로그인할 수 있는 구글 계정과 권한을 관리합니다.</span></div>
        <ModalClose onClose={onClose} />
      </div>
      <form className="user-manager-add" onSubmit={add}>
        <label>구글 계정 이메일<input type="email" required value={email} disabled={busy} placeholder="name@gmail.com" onChange={event => setEmail(event.target.value)} /></label>
        <label>이름<input value={name} maxLength={40} disabled={busy} placeholder="예: 홍길동 부장" onChange={event => setName(event.target.value)} /></label>
        <label>권한<select value={role} disabled={busy} onChange={event => setRole(event.target.value as Role)}><option value="staff">직원</option><option value="admin">관리자</option></select></label>
        <button className="primary-button" type="submit" disabled={busy || !email.trim()}>추가</button>
      </form>
      <p className="user-manager-hint">구글 로그인을 쓰므로 구글 계정으로 등록된 주소여야 합니다. 다음·네이버 주소는 그 주소로 구글 계정을 만든 뒤 로그인할 수 있습니다. 관리자는 직원 계정을 추가·삭제하고 권한을 바꿀 수 있습니다. 이름은 누구 계정인지 적어 두는 메모로, 칸을 고친 뒤 다른 곳을 누르거나 Enter를 누르면 저장됩니다.</p>
      {error && <p className="card-query-error" role="alert">{error}</p>}
      {message && <p className="user-manager-message" role="status">{message}</p>}
      {!members ? !error && <p role="status">계정 목록을 불러오는 중입니다.</p> : <div className="table-wrap user-manager-list">
        <table><thead><tr><th>이메일</th><th>이름</th><th>권한</th><th>추가한 사람</th><th>추가일</th><th>삭제</th></tr></thead>
          <tbody>{members.map(member => {
            const locked = member.owner || member.email === me
            return <tr key={member.email}>
              <td className="user-manager-email">{member.email}{member.owner && <small>소유자</small>}{member.email === me && !member.owner && <small>나</small>}</td>
              <td><NameCell key={member.name} member={member} busy={busy} onSave={next => rename(member, next)} /></td>
              <td>{locked ? roleLabel[member.role] : <select aria-label={`${member.email} 권한`} value={member.role} disabled={busy} onChange={event => void changeRole(member, event.target.value as Role)}><option value="staff">직원</option><option value="admin">관리자</option></select>}</td>
              <td>{member.addedBy || '-'}</td>
              <td>{member.addedAt ? member.addedAt.slice(0, 10) : '-'}</td>
              <td>{locked ? '-' : <button type="button" className="ghost-button user-manager-remove" disabled={busy} onClick={() => remove(member)}>삭제</button>}</td>
            </tr>
          })}</tbody>
        </table>
      </div>}
    </section>
  </div>
}
