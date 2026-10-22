import { useCallback, useEffect, useRef, useState } from 'react'
import App from './App'
import type { Order } from './orderTypes'
import './SharedWorkspace.css'

type User = { email: string; name: string; sub: string }
type Session = { user: User | null; clientId?: string; nonce?: string }
type Snapshot = { orders: Order[]; revision: number }
type GoogleIdentity = { initialize: (config: { client_id: string; nonce: string; callback: (response: { credential: string }) => void }) => void; renderButton: (element: HTMLElement, config: { theme: string; size: string; text: string; locale: string }) => void; disableAutoSelect: () => void }
declare global { interface Window { google?: { accounts: { id: GoogleIdentity } } } }

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json', ...init?.headers } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(body.error || '서버에 연결할 수 없습니다.'), { status: response.status })
  return body as T
}

function GoogleButton({ clientId, nonce, onCredential }: { clientId: string; nonce: string; onCredential: (credential: string) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const render = () => {
      if (!active || !host.current || !window.google) return
      window.google.accounts.id.initialize({ client_id: clientId, nonce, callback: response => onCredential(response.credential) })
      host.current.replaceChildren()
      window.google.accounts.id.renderButton(host.current, { theme: 'outline', size: 'large', text: 'signin_with', locale: 'ko' })
    }
    let script = document.querySelector<HTMLScriptElement>('script[data-cjeng-google]')
    if (window.google) render()
    else {
      if (!script) {
        script = document.createElement('script')
        script.src = 'https://accounts.google.com/gsi/client'
        script.async = true
        script.dataset.cjengGoogle = 'true'
        document.head.appendChild(script)
      }
      script.addEventListener('load', render)
      script.addEventListener('error', failed)
    }
    function failed() { if (active) setError('Google 로그인 화면을 불러오지 못했습니다. 새로고침 후 다시 시도하세요.') }
    return () => { active = false; script?.removeEventListener('load', render); script?.removeEventListener('error', failed) }
  }, [clientId, nonce, onCredential])
  return <><div ref={host} />{error && <p role="alert">{error}</p>}</>
}

function SignedInWorkspace({ user, onSignOut }: { user: User; onSignOut: () => Promise<void> }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const [signOutError, setSignOutError] = useState('')
  const refresh = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try {
      const data = await api<Snapshot>('/api/orders')
      setSnapshot(data)
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '수주대장을 불러오지 못했습니다.')
    } finally { busy.current = false }
  }, [])
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    busy.current = true
    void api<Snapshot>('/api/orders', { signal: controller.signal })
      .then(data => { if (active) { setSnapshot(data); setMessage('') } })
      .catch(error => { if (active) setMessage(error instanceof Error ? error.message : '수주대장을 불러오지 못했습니다.') })
      .finally(() => { if (active) busy.current = false })
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 10000)
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    return () => { active = false; controller.abort(); window.clearInterval(interval); window.removeEventListener('focus', onFocus) }
  }, [refresh])
  async function save(orders: Order[], revision: number) {
    if (busy.current) { setMessage('다른 요청을 처리 중입니다. 잠시 후 다시 저장해 주세요.'); return false }
    busy.current = true
    setSaving(true)
    try {
      const data = await api<Snapshot>('/api/orders', { method: 'PUT', body: JSON.stringify({ orders, revision }) })
      setSnapshot(data)
      setMessage('수주대장 저장 완료')
      return true
    } catch (error) {
      const text = error instanceof Error ? error.message : '저장하지 못했습니다. 다시 시도해 주세요.'
      setMessage(text)
      if ((error as { status?: number }).status === 409) {
        try { setSnapshot(await api<Snapshot>('/api/orders')) } catch { /* Keep the last successfully loaded data. */ }
      }
      window.alert(text)
      return false
    } finally { busy.current = false; setSaving(false) }
  }
  return <>
    <div className="shared-workspace-bar">
      <div><strong>수주대장 공유 중</strong><span>{user.name} · {user.email}</span><small>수주대장은 직원들과 공유됩니다. 지출·작업일보 등 다른 자료는 이 브라우저에 저장됩니다.</small></div>
      <div className="shared-workspace-buttons">
        <button type="button" className="ghost-button" disabled={saving} onClick={() => void refresh()}>최신 상태 확인</button>
        <button type="button" className="ghost-button" disabled={saving} onClick={() => { setSignOutError(''); void onSignOut().catch(() => setSignOutError('로그아웃에 실패했습니다. 다시 시도해 주세요.')) }}>로그아웃</button>
      </div>
    </div>
    {(message || signOutError) && <p className="shared-workspace-message" role="status">{signOutError || message}</p>}
    {!snapshot ? <div className="workspace-login"><p>{message || '공유 수주대장을 불러오는 중입니다.'}</p><button className="ghost-button" onClick={() => void refresh()}>다시 불러오기</button></div>
      : <><div inert={saving || undefined}><App orderStore={{ ...snapshot, save }} /></div>{saving && <div className="workspace-saving" role="status">수주대장 저장 중…</div>}</>}
  </>
}

export default function SharedWorkspace() {
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState('')
  const [signingIn, setSigningIn] = useState(false)
  const loadSession = useCallback(async () => {
    try { setSession(await api<Session>('/api/session')); setError('') }
    catch (failure) { setError(failure instanceof Error ? failure.message : '로그인 설정을 확인하세요.') }
  }, [])
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    void api<Session>('/api/session', { signal: controller.signal })
      .then(data => { if (active) { setSession(data); setError('') } })
      .catch(failure => { if (active) setError(failure instanceof Error ? failure.message : '로그인 설정을 확인하세요.') })
    return () => { active = false; controller.abort() }
  }, [])
  const onCredential = useCallback(async (credential: string) => {
    setSigningIn(true)
    setError('')
    try { setSession(await api<Session>('/api/session', { method: 'POST', body: JSON.stringify({ credential }) })) }
    catch (failure) {
      setError(failure instanceof Error ? failure.message : '로그인하지 못했습니다.')
      try { setSession(await api<Session>('/api/session')) } catch { /* Show the sign-in error. */ }
    } finally { setSigningIn(false) }
  }, [])
  async function signOut() {
    await api('/api/session', { method: 'DELETE' })
    window.google?.accounts.id.disableAutoSelect()
    setSession(null)
    await loadSession()
  }
  if (session?.user) return <SignedInWorkspace key={session.user.sub} user={session.user} onSignOut={signOut} />
  return <main className="workspace-login"><section className="workspace-login-card">
    <span className="workspace-login-brand">CHANGJO ENGINEERING</span>
    <h1>창조이엔지 공사 관리</h1>
    <p>허용된 직원 Google 계정으로 로그인해 주세요.</p>
    {error && <p role="alert">{error}</p>}
    {signingIn ? <p role="status">로그인 확인 중입니다.</p> : session?.clientId && session.nonce ? <GoogleButton clientId={session.clientId} nonce={session.nonce} onCredential={onCredential} /> : <button type="button" className="ghost-button" onClick={() => void loadSession()}>로그인 연결 확인</button>}
  </section></main>
}
