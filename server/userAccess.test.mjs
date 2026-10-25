import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { createUserDirectory, normalizeEmail } from './userAccess.ts'
import { createUsersHandler } from '../api/users.ts'

function neonLike(db) {
  const sql = (strings, ...values) => {
    const text = strings.reduce((out, part, i) => out + part + (i < values.length ? `$${i + 1}` : ''), '')
    return { text, values, then: (resolve, reject) => db.query(text, values).then(result => result.rows).then(resolve, reject) }
  }
  sql.transaction = async queries => db.transaction(async tx => { const out = []; for (const q of queries) out.push((await tx.query(q.text, q.values)).rows); return out })
  return sql
}
const env = ['owner@x.com', 'kim@x.com', 'lee@hanmail.net']
const directoryOn = (sql, clock = { t: 0 }) => createUserDirectory({ sql: () => sql, envEmails: () => env, ttlMs: 15000, now: () => clock.t })

test('the environment list seeds the table once and the owner is always an admin', async () => {
  const sql = neonLike(new PGlite())
  const dir = directoryOn(sql)
  assert.deepEqual((await dir.members()).map(m => [m.email, m.role, m.owner]), [['owner@x.com', 'admin', true], ['kim@x.com', 'staff', false], ['lee@hanmail.net', 'staff', false]])
  assert.equal(await dir.roleOf('OWNER@x.com'), 'admin')
  assert.equal(await dir.roleOf('stranger@x.com'), null)
  await dir.remove('owner@x.com', 'kim@x.com')
  // A fresh instance must not re-add a removed seed address.
  assert.equal(await directoryOn(sql).roleOf('kim@x.com'), null)
})

test('admins add, promote and remove accounts; the owner and their own account are protected', async () => {
  const sql = neonLike(new PGlite())
  const dir = directoryOn(sql)
  await dir.put('owner@x.com', ' New.Person@Gmail.com ', 'staff')
  assert.equal(await dir.roleOf('new.person@gmail.com'), 'staff')
  await dir.put('owner@x.com', 'new.person@gmail.com', 'admin')
  assert.equal(await dir.roleOf('new.person@gmail.com'), 'admin')
  await assert.rejects(dir.put('new.person@gmail.com', 'owner@x.com', 'staff'), /소유자/)
  await assert.rejects(dir.remove('new.person@gmail.com', 'owner@x.com'), /소유자/)
  await assert.rejects(dir.remove('new.person@gmail.com', 'new.person@gmail.com'), /자신/)
  await assert.rejects(dir.put('new.person@gmail.com', 'new.person@gmail.com', 'staff'), /자신/)
  await assert.rejects(dir.put('owner@x.com', 'not-an-email', 'staff'), /이메일/)
  await assert.rejects(dir.put('owner@x.com', 'a@b.com', 'boss'), /권한/)
  assert.throws(() => normalizeEmail('a,b@c.com'), /이메일/)
})

test('other instances see changes once their short cache expires', async () => {
  const sql = neonLike(new PGlite())
  const clock = { t: 0 }
  const writer = directoryOn(sql), reader = directoryOn(sql, clock)
  assert.equal(await reader.roleOf('lee@hanmail.net'), 'staff')
  await writer.remove('owner@x.com', 'lee@hanmail.net')
  assert.equal(await reader.roleOf('lee@hanmail.net'), 'staff')
  clock.t = 16000
  assert.equal(await reader.roleOf('lee@hanmail.net'), null)
})

test('only admins reach the account API and writes need the same origin', async () => {
  const sql = neonLike(new PGlite())
  const dir = directoryOn(sql)
  let user = { email: 'kim@x.com', role: 'staff' }
  const handler = createUsersHandler({ readSession: async () => user, sameOrigin: req => req.headers.origin === 'https://site', settings: () => ({ origin: 'https://site' }), userDirectory: () => dir })
  const call = async (method, body, origin = 'https://site') => { const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v }, end(t) { this.body = JSON.parse(t) } }; await handler({ method, headers: { origin }, body }, res); return res }
  assert.equal((await call('GET')).statusCode, 403)
  user = { email: 'owner@x.com', role: 'admin' }
  assert.equal((await call('GET')).body.members.length, 3)
  assert.equal((await call('POST', { email: 'pysun2000@gmail.com', role: 'admin' }, 'https://evil')).statusCode, 403)
  const added = await call('POST', { email: 'pysun2000@gmail.com', role: 'admin' })
  assert.equal(added.body.members.find(m => m.email === 'pysun2000@gmail.com').role, 'admin')
  assert.equal((await call('DELETE', { email: 'owner@x.com' })).statusCode, 400)
  assert.equal((await call('DELETE', { email: 'pysun2000@gmail.com' })).body.members.length, 3)
})
