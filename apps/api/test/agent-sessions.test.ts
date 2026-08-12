// Integration tests for GET /api/agent/sessions + /sessions/:id —
// docs/feature/34.sidebar-workspace/spec.md §4.1, §6. Follows sync.test.ts's
// login-cookie pattern; fixtures insert agent_project + agent_session rows
// directly since no list-creating endpoint exists (sessions are born by chat).
import { beforeEach, describe, expect, it } from 'vitest'
import { uuidv7 } from '@better/core/id'
import { createApp } from '../src/app.ts'
import { db } from '../src/db/client.ts'
import { agentProject } from '../src/db/schema/agent-project.ts'
import { agentSession } from '../src/db/schema/agent-session.ts'
import { appUser } from '../src/db/schema/user.ts'
import { eq } from 'drizzle-orm'
import { resetDb, createTestUser, extractSessionCookie, readJson } from './helpers.ts'
import { deriveSessionTitle } from '../src/modules/agent/session-routes.ts'

const app = createApp()

async function loginCookie(email: string, password = 'testpassword123'): Promise<string> {
  const res = await app.request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return extractSessionCookie(res)
}

async function seedSession(email: string, history: unknown[], updatedAt: Date, closedAt: Date | null = null): Promise<string> {
  const [user] = await db.select().from(appUser).where(eq(appUser.email, email))
  const projectId = uuidv7()
  await db.insert(agentProject).values({
    id: projectId, userId: user!.id, kind: 'global', createdAt: updatedAt, updatedAt,
  })
  const sessionId = uuidv7()
  await db.insert(agentSession).values({
    id: sessionId, userId: user!.id, projectId,
    history: JSON.stringify(history),
    createdAt: updatedAt, updatedAt, closedAt,
  })
  return sessionId
}

beforeEach(async () => {
  await resetDb()
})

describe('deriveSessionTitle', () => {
  it('takes the first user message, whitespace collapsed', () => {
    const h = JSON.stringify([
      { role: 'system', content: 'ignored' },
      { role: 'user', content: '  rapikan\n sidebar  saya ' },
    ])
    expect(deriveSessionTitle(h)).toBe('rapikan sidebar saya')
  })

  it('truncates long first messages to 48 chars with an ellipsis', () => {
    const long = 'a'.repeat(80)
    const h = JSON.stringify([{ role: 'user', content: long }])
    const title = deriveSessionTitle(h)
    expect(title).toBe(`${'a'.repeat(48)}…`)
  })

  it('falls back for empty or malformed history', () => {
    expect(deriveSessionTitle('[]')).toBe('Percakapan baru')
    expect(deriveSessionTitle('not-json{')).toBe('Percakapan baru')
    // tool rows only — no visible user message
    expect(deriveSessionTitle(JSON.stringify([{ role: 'assistant', content: null }]))).toBe('Percakapan baru')
  })
})

describe('GET /api/agent/sessions', () => {
  it('lists own sessions newest-first with derived titles', async () => {
    await createTestUser('sessions-list@example.com')
    await seedSession('sessions-list@example.com', [{ role: 'user', content: 'chat lama' }], new Date('2026-08-01T00:00:00Z'))
    await seedSession('sessions-list@example.com', [{ role: 'user', content: 'chat baru' }], new Date('2026-08-10T00:00:00Z'))

    const cookie = await loginCookie('sessions-list@example.com')
    const res = await app.request('/api/agent/sessions', { headers: { cookie } })
    expect(res.status).toBe(200)
    const body = await readJson(res)
    expect(body.sessions.map((s: { title: string }) => s.title)).toEqual(['chat baru', 'chat lama'])
  })

  it('never leaks another user\'s sessions', async () => {
    await createTestUser('sessions-owner@example.com')
    await createTestUser('sessions-other@example.com')
    await seedSession('sessions-other@example.com', [{ role: 'user', content: 'rahasia' }], new Date())

    const cookie = await loginCookie('sessions-owner@example.com')
    const res = await app.request('/api/agent/sessions', { headers: { cookie } })
    const body = await readJson(res)
    expect(body.sessions).toEqual([])
  })
})

describe('GET /api/agent/sessions/:id', () => {
  it('returns visible messages only — tool rows and non-string content dropped', async () => {
    await createTestUser('sessions-detail@example.com')
    const id = await seedSession('sessions-detail@example.com', [
      { role: 'user', content: 'halo' },
      { role: 'assistant', content: null, tool_calls: [{ id: 'x' }] },
      { role: 'tool', content: 'raw tool output' },
      { role: 'assistant', content: 'halo juga' },
    ], new Date())

    const cookie = await loginCookie('sessions-detail@example.com')
    const res = await app.request(`/api/agent/sessions/${id}`, { headers: { cookie } })
    expect(res.status).toBe(200)
    const body = await readJson(res)
    expect(body.messages).toEqual([
      { role: 'user', content: 'halo' },
      { role: 'assistant', content: 'halo juga' },
    ])
    expect(body.closedAt).toBeNull()
  })

  it('a foreign session id 404s exactly like a missing one', async () => {
    await createTestUser('sessions-a@example.com')
    await createTestUser('sessions-b@example.com')
    const foreignId = await seedSession('sessions-b@example.com', [{ role: 'user', content: 'x' }], new Date())

    const cookie = await loginCookie('sessions-a@example.com')
    const foreign = await app.request(`/api/agent/sessions/${foreignId}`, { headers: { cookie } })
    const missing = await app.request(`/api/agent/sessions/${uuidv7()}`, { headers: { cookie } })
    expect(foreign.status).toBe(404)
    expect(missing.status).toBe(404)
  })

  it('reports closedAt for a closed session', async () => {
    await createTestUser('sessions-closed@example.com')
    const id = await seedSession(
      'sessions-closed@example.com',
      [{ role: 'user', content: 'sesi lama' }],
      new Date('2026-08-01T00:00:00Z'),
      new Date('2026-08-02T00:00:00Z'),
    )
    const cookie = await loginCookie('sessions-closed@example.com')
    const body = await readJson(await app.request(`/api/agent/sessions/${id}`, { headers: { cookie } }))
    expect(body.closedAt).toBe('2026-08-02T00:00:00.000Z')
  })
})
