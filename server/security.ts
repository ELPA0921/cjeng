import { randomBytes, timingSafeEqual } from 'node:crypto'
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { neon } from '@neondatabase/serverless'
import { createUserDirectory, type Role } from './userAccess.ts'

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))
const sessionCookie = '__Host-cjeng-session'
const nonceCookie = '__Host-cjeng-nonce'
export type User = { email: string; name: string; sub: string; role: Role }

export function settings() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const secret = process.env.WORKSPACE_SESSION_SECRET
  const databaseUrl = process.env.DATABASE_URL
  const storage = process.env.WORKSPACE_STORAGE || 'postgres'
  const sheetsEndpoint = process.env.WORKSPACE_SHEETS_ENDPOINT
  const sheetsSecret = process.env.WORKSPACE_SHEETS_SECRET
  const origin = process.env.WORKSPACE_ORIGIN
  const allowed = new Set((process.env.WORKSPACE_ALLOWED_EMAILS ?? '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean))
  const storageReady = storage === 'sheets'
    ? sheetsEndpoint && /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(sheetsEndpoint) && sheetsSecret && sheetsSecret.length >= 32
    : storage === 'postgres' && databaseUrl
  if (!clientId || !secret || secret.length < 32 || !storageReady || !origin || allowed.size === 0) {
    throw new Error('공유 수주대장 연결 설정이 필요합니다.')
  }
  if (new URL(origin).origin !== origin || !origin.startsWith('https://')) throw new Error('접속 주소 설정을 확인하세요.')
  return { clientId, secret: new TextEncoder().encode(secret), databaseUrl, origin, allowed, storage, sheetsEndpoint, sheetsSecret }
}

// Signed-in staff come from the database list (cached briefly); the environment list seeds it and names the owner.
let directory = createUserDirectory({
  sql: () => { const config = settings(); return config.storage === 'postgres' && config.databaseUrl ? neon(config.databaseUrl) : null },
  envEmails: () => [...settings().allowed],
})
export const userDirectory = () => directory
export function useUserDirectory(next: ReturnType<typeof createUserDirectory>) { directory = next }
export const ownerEmail = () => settings().allowed.values().next().value ?? ''

export function cookie(req: IncomingMessage, name: string) {
  return (req.headers.cookie ?? '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1)
}

export function sameOrigin(req: IncomingMessage, origin: string) {
  return req.headers.origin === origin && req.headers['content-type']?.split(';')[0] === 'application/json'
}

export function createLoginNonce(res: ServerResponse) {
  const nonce = randomBytes(32).toString('hex')
  res.setHeader('Set-Cookie', `${nonceCookie}=${nonce}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=300`)
  return nonce
}

export async function readSession(req: IncomingMessage): Promise<User | null> {
  const config = settings()
  const token = cookie(req, sessionCookie)
  if (!token) return null
  let payload
  try { ({ payload } = await jwtVerify(token, config.secret, { algorithms: ['HS256'], issuer: config.origin, audience: 'cjeng-workspace' })) }
  catch { return null }
  if (typeof payload.email !== 'string' || typeof payload.sub !== 'string') return null
  // A database outage must surface as an error, not as everyone being signed out.
  const role = await directory.roleOf(payload.email)
  if (!role) return null
  return { email: payload.email, sub: payload.sub, name: typeof payload.name === 'string' ? payload.name : payload.email, role }
}

export async function signIn(req: IncomingMessage, res: ServerResponse, credential: unknown): Promise<User> {
  const config = settings()
  if (typeof credential !== 'string' || credential.length > 15000) throw new Error('Google 로그인을 다시 시도하세요.')
  const { payload } = await jwtVerify(credential, googleKeys, { algorithms: ['RS256'], issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: config.clientId, requiredClaims: ['exp', 'iat', 'sub', 'nonce'] })
  const expectedNonce = cookie(req, nonceCookie)
  if (typeof payload.nonce !== 'string' || !expectedNonce || payload.nonce.length !== expectedNonce.length || !timingSafeEqual(Buffer.from(payload.nonce), Buffer.from(expectedNonce))) throw new Error('Google 로그인을 다시 시도하세요.')
  const role = payload.email_verified === true && typeof payload.email === 'string' ? await directory.roleOf(payload.email) : null
  if (!role || typeof payload.email !== 'string') throw new Error('접근이 허용된 직원 계정으로 로그인해 주세요.')
  const user = { email: payload.email.toLowerCase(), sub: payload.sub!, name: typeof payload.name === 'string' ? payload.name : payload.email, role }
  const token = await new SignJWT({ email: user.email, name: user.name }).setProtectedHeader({ alg: 'HS256' }).setSubject(user.sub).setIssuer(config.origin).setAudience('cjeng-workspace').setIssuedAt().setExpirationTime('8h').sign(config.secret)
  res.setHeader('Set-Cookie', [
    `${sessionCookie}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`,
    `${nonceCookie}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  ])
  return user
}

export function signOut(res: ServerResponse) {
  res.setHeader('Set-Cookie', [sessionCookie, nonceCookie].map(name => `${name}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`))
}
