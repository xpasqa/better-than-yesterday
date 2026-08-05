import { beforeEach, describe, expect, it } from 'vitest'
import { uuidv7 } from '@better/core/id'
import { createApp } from '../src/app.ts'
import { resetDb, createTestUser, extractSessionCookie, makeNodeDto, readJson } from './helpers.ts'

const app = createApp()

async function loginCookie(email: string, password = 'testpassword123'): Promise<string> {
  const res = await app.request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return extractSessionCookie(res)
}

async function sync(cookie: string, cursor: string, nodes: unknown[] = []) {
  const res = await app.request('/api/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ cursor, changes: { nodes } }),
  })
  return { status: res.status, body: await readJson(res) }
}

beforeEach(async () => {
  await resetDb()
})

describe('POST /api/sync — bootstrap', () => {
  it('a fresh device (cursor 0) receives the seeded Inbox', async () => {
    await createTestUser('boot@example.com')
    const cookie = await loginCookie('boot@example.com')
    const { status, body } = await sync(cookie, '0')
    expect(status).toBe(200)
    expect(body.changes.nodes).toHaveLength(1)
    expect(body.changes.nodes[0].content).toBe('Inbox')
    expect(body.cursor).not.toBe('0')
  })

  it('an up-to-date device gets an empty diff and an unchanged cursor', async () => {
    await createTestUser('idle@example.com')
    const cookie = await loginCookie('idle@example.com')
    const first = await sync(cookie, '0')
    const second = await sync(cookie, first.body.cursor)
    expect(second.body.changes.nodes).toEqual([])
    expect(second.body.cursor).toBe(first.body.cursor)
  })
})

describe('POST /api/sync — pushing changes', () => {
  it('a created task round-trips with the same field values', async () => {
    await createTestUser('push@example.com')
    const cookie = await loginCookie('push@example.com')
    const boot = await sync(cookie, '0')
    const inboxId = boot.body.changes.nodes[0].id

    const taskId = uuidv7()
    const dto = makeNodeDto({
      id: taskId,
      parentId: inboxId,
      content: 'beli tiket pesawat',
      dueDate: '2026-08-06',
      dueTime: '09:00',
      priority: 1,
    })
    const { status, body } = await sync(cookie, boot.body.cursor, [dto])
    expect(status).toBe(200)
    const [returned] = body.changes.nodes
    expect(returned.id).toBe(taskId)
    expect(returned.content).toBe('beli tiket pesawat')
    expect(returned.dueDate).toBe('2026-08-06')
    expect(returned.dueTime).toBe('09:00')
    expect(returned.priority).toBe(1)
  })

  it('rejects a batch larger than 500 with a validation error', async () => {
    await createTestUser('bulk@example.com')
    const cookie = await loginCookie('bulk@example.com')
    const tooMany = Array.from({ length: 501 }, () => makeNodeDto({ id: uuidv7() }))
    const { status, body } = await sync(cookie, '0', tooMany)
    expect(status).toBe(422)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('a soft-deleted node comes back as a tombstone, not removed from the feed', async () => {
    await createTestUser('del@example.com')
    const cookie = await loginCookie('del@example.com')
    const boot = await sync(cookie, '0')
    const taskId = uuidv7()
    const created = await sync(cookie, boot.body.cursor, [makeNodeDto({ id: taskId })])

    const now = new Date().toISOString()
    const deleted = await sync(cookie, created.body.cursor, [
      makeNodeDto({ id: taskId, updatedAt: now, deletedAt: now }),
    ])
    expect(deleted.body.changes.nodes[0].deletedAt).not.toBeNull()

    // A fresh device bootstrapping afterward still sees the tombstone, so
    // it can remove its own local copy too.
    const freshBoot = await sync(cookie, '0')
    const seen = freshBoot.body.changes.nodes.find((n: { id: string }) => n.id === taskId)
    expect(seen.deletedAt).not.toBeNull()
  })
})

describe('POST /api/sync — last-write-wins', () => {
  it('an older incoming update loses to what is already stored', async () => {
    await createTestUser('lww@example.com')
    const cookie = await loginCookie('lww@example.com')
    const boot = await sync(cookie, '0')
    const taskId = uuidv7()

    const t1 = new Date(Date.now() - 10_000).toISOString()
    const t2 = new Date().toISOString()

    await sync(cookie, boot.body.cursor, [makeNodeDto({ id: taskId, content: 'second write', updatedAt: t2 })])
    const stale = await sync(cookie, '0', [
      makeNodeDto({ id: taskId, content: 'stale write should lose', updatedAt: t1 }),
    ])
    const finalRow = stale.body.changes.nodes.find((n: { id: string }) => n.id === taskId)
    expect(finalRow.content).toBe('second write')
  })

  it('a newer incoming update wins over what is stored', async () => {
    await createTestUser('lww2@example.com')
    const cookie = await loginCookie('lww2@example.com')
    const boot = await sync(cookie, '0')
    const taskId = uuidv7()

    const t1 = new Date(Date.now() - 10_000).toISOString()
    const t2 = new Date().toISOString()

    await sync(cookie, boot.body.cursor, [makeNodeDto({ id: taskId, content: 'first write', updatedAt: t1 })])
    const fresh = await sync(cookie, '0', [makeNodeDto({ id: taskId, content: 'newer write should win', updatedAt: t2 })])
    const finalRow = fresh.body.changes.nodes.find((n: { id: string }) => n.id === taskId)
    expect(finalRow.content).toBe('newer write should win')
  })

  it('every applied write gets a fresh seq, advancing the cursor', async () => {
    await createTestUser('seq@example.com')
    const cookie = await loginCookie('seq@example.com')
    const boot = await sync(cookie, '0')
    const taskId = uuidv7()
    const first = await sync(cookie, boot.body.cursor, [makeNodeDto({ id: taskId })])
    const second = await sync(cookie, first.body.cursor, [
      makeNodeDto({ id: taskId, content: 'updated', updatedAt: new Date().toISOString() }),
    ])
    expect(BigInt(second.body.cursor)).toBeGreaterThan(BigInt(first.body.cursor))
  })
})
