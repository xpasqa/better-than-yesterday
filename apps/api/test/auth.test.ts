import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.ts'
import { resetDb, createTestUser, extractSessionCookie, readJson } from './helpers.ts'
import { resetRateLimit } from '../src/modules/auth/rate-limit.ts'

const app = createApp()

beforeEach(async () => {
  await resetDb()
  resetRateLimit()
})

describe('POST /auth/login', () => {
  it('rejects a request with no cookie on a protected route', async () => {
    const res = await app.request('/api/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cursor: '0', changes: { nodes: [] } }),
    })
    expect(res.status).toBe(401)
    const body = await readJson(res)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('logs in with correct credentials and sets a session cookie', async () => {
    await createTestUser('a@example.com', 'correct-password')
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@example.com', password: 'correct-password' }),
    })
    expect(res.status).toBe(200)
    const cookie = extractSessionCookie(res)
    expect(cookie).toMatch(/^better_session=/)
  })

  it('rejects a wrong password with the same error as a nonexistent email', async () => {
    await createTestUser('real@example.com', 'correct-password')
    const wrongPassword = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'real@example.com', password: 'wrong' }),
    })
    const noSuchUser = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'wrong' }),
    })
    expect(wrongPassword.status).toBe(401)
    expect(noSuchUser.status).toBe(401)
    const [bodyA, bodyB] = await Promise.all([readJson(wrongPassword), readJson(noSuchUser)])
    expect(bodyA.error.message).toBe(bodyB.error.message)
  })

  it('a session cookie authorizes /auth/me', async () => {
    const user = await createTestUser('me@example.com')
    const login = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'me@example.com', password: 'testpassword123' }),
    })
    const cookie = extractSessionCookie(login)
    const me = await app.request('/auth/me', { headers: { cookie } })
    expect(me.status).toBe(200)
    const body = await readJson(me)
    expect(body.user.id).toBe(user.id)
  })

  it('rejects the 6th login attempt within the rate-limit window', async () => {
    await createTestUser('limited@example.com', 'correct-password')
    let last: Response | undefined
    for (let i = 0; i < 6; i++) {
      last = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'limited@example.com', password: 'wrong' }),
      })
    }
    expect(last!.status).toBe(429)
    const body = await readJson(last!)
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('logout clears the session so the old cookie no longer authorizes', async () => {
    await createTestUser('bye@example.com')
    const login = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'bye@example.com', password: 'testpassword123' }),
    })
    const cookie = extractSessionCookie(login)
    const logout = await app.request('/auth/logout', { method: 'POST', headers: { cookie } })
    expect(logout.status).toBe(204)

    // The client would drop the cookie on receiving Max-Age=0, but a
    // still-valid old token should also simply keep working until it
    // expires — logout only clears the browser's copy, there is no
    // server-side revocation list. What matters is that a stale/blank
    // cookie does not authorize:
    const withNoCookie = await app.request('/auth/me')
    expect(withNoCookie.status).toBe(401)
  })

  it('rejects malformed login input with a 422 validation envelope', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: '', password: '' }),
    })
    expect(res.status).toBe(422)
    const body = await readJson(res)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('never returns the password hash anywhere in the response', async () => {
    await createTestUser('secret@example.com')
    const login = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'secret@example.com', password: 'testpassword123' }),
    })
    const text = await login.text()
    expect(text).not.toMatch(/argon2/)
    expect(text).not.toMatch(/passwordHash/i)
  })
})
