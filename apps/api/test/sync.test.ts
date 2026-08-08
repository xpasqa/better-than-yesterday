import { beforeEach, describe, expect, it } from 'vitest'
import { uuidv7 } from '@better/core/id'
import { createApp } from '../src/app.ts'
import { resetDb, createTestUser, extractSessionCookie, makeNodeDto, makeTagDto, makeCompletionDto, readJson } from './helpers.ts'

const app = createApp()

async function loginCookie(email: string, password = 'testpassword123'): Promise<string> {
  const res = await app.request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return extractSessionCookie(res)
}

async function sync(cookie: string, cursor: string, nodes: unknown[] = [], tags: unknown[] = [], completions: unknown[] = []) {
  const res = await app.request('/api/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ cursor, changes: { nodes, tags, completions } }),
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
      priority: 2,
    })
    await sync(cookie, boot.body.cursor, [dto])

    const after = await sync(cookie, '0')
    const task = after.body.changes.nodes.find((n: { id: string }) => n.id === taskId)
    expect(task).toBeDefined()
    expect(task.content).toBe('beli tiket pesawat')
    expect(task.dueDate).toBe('2026-08-06')
    expect(task.dueTime).toBe('09:00')
    expect(task.priority).toBe(2)
  })

  it('an older push loses to a newer local row (LWW)', async () => {
    await createTestUser('lww@example.com')
    const cookie = await loginCookie('lww@example.com')
    const boot = await sync(cookie, '0')
    const inboxId = boot.body.changes.nodes[0].id

    const id = uuidv7()
    const newer = makeNodeDto({ id, parentId: inboxId, content: 'newer', updatedAt: '2026-08-06T12:00:00.000Z' })
    const older = makeNodeDto({ id, parentId: inboxId, content: 'older', updatedAt: '2026-08-06T11:00:00.000Z' })

    await sync(cookie, boot.body.cursor, [newer])
    await sync(cookie, boot.body.cursor, [older])

    const after = await sync(cookie, '0')
    const row = after.body.changes.nodes.find((n: { id: string }) => n.id === id)
    expect(row.content).toBe('newer')
  })

  it('a soft-deleted task is included in the diff with deletedAt set', async () => {
    await createTestUser('del@example.com')
    const cookie = await loginCookie('del@example.com')
    const boot = await sync(cookie, '0')
    const inboxId = boot.body.changes.nodes[0].id

    const id = uuidv7()
    const now = new Date().toISOString()
    await sync(cookie, boot.body.cursor, [
      makeNodeDto({ id, parentId: inboxId, content: 'to be deleted', deletedAt: now }),
    ])

    const after = await sync(cookie, '0')
    const row = after.body.changes.nodes.find((n: { id: string }) => n.id === id)
    expect(row).toBeDefined()
    expect(row.deletedAt).not.toBeNull()
  })

  it('a tag round-trips correctly', async () => {
    await createTestUser('tag@example.com')
    const cookie = await loginCookie('tag@example.com')
    const boot = await sync(cookie, '0')

    const tagId = uuidv7()
    const dto = makeTagDto({ id: tagId, name: 'urgent', color: '#dc4c3e' })
    await sync(cookie, boot.body.cursor, [], [dto])

    const after = await sync(cookie, '0')
    const tag = after.body.changes.tags.find((t: { id: string }) => t.id === tagId)
    expect(tag).toBeDefined()
    expect(tag.name).toBe('urgent')
    expect(tag.color).toBe('#dc4c3e')
  })

  it('an older tag push loses to a newer local row (LWW)', async () => {
    await createTestUser('tag-lww@example.com')
    const cookie = await loginCookie('tag-lww@example.com')
    const boot = await sync(cookie, '0')

    const id = uuidv7()
    const newer = makeTagDto({ id, name: 'new-name', updatedAt: '2026-08-06T12:00:00.000Z' })
    const older = makeTagDto({ id, name: 'old-name', updatedAt: '2026-08-06T11:00:00.000Z' })

    await sync(cookie, boot.body.cursor, [], [newer])
    await sync(cookie, boot.body.cursor, [], [older])

    const after = await sync(cookie, '0')
    const row = after.body.changes.tags.find((t: { id: string }) => t.id === id)
    expect(row.name).toBe('new-name')
  })
})

describe('POST /api/sync — completions', () => {
  it('a completion round-trips with the same field values', async () => {
    await createTestUser('completion@example.com')
    const cookie = await loginCookie('completion@example.com')
    const boot = await sync(cookie, '0')
    const inboxId = boot.body.changes.nodes[0].id
    const id = uuidv7()

    await sync(cookie, boot.body.cursor, [], [], [makeCompletionDto({ id, nodeId: inboxId, occurredOn: '2026-08-01' })])

    const after = await sync(cookie, '0')
    const row = after.body.changes.completions.find((c: { id: string }) => c.id === id)
    expect(row).toBeDefined()
    expect(row.occurredOn).toBe('2026-08-01')
  })

  it('a completion push for a node not owned by the user is silently ignored', async () => {
    await createTestUser('comp-iso-a@example.com')
    await createTestUser('comp-iso-b@example.com')
    const cookieA = await loginCookie('comp-iso-a@example.com')
    const cookieB = await loginCookie('comp-iso-b@example.com')

    const bootA = await sync(cookieA, '0')
    const nodeIdA = bootA.body.changes.nodes[0].id
    const bootB = await sync(cookieB, '0')

    const foreignId = uuidv7()
    await sync(cookieB, bootB.body.cursor, [], [], [makeCompletionDto({ id: foreignId, nodeId: nodeIdA })])

    const checkB = await sync(cookieB, '0')
    expect(checkB.body.changes.completions).toEqual([])
  })

  it('a retried push with the same completion id is a harmless no-op, not an overwrite', async () => {
    await createTestUser('completion-retry@example.com')
    const cookie = await loginCookie('completion-retry@example.com')
    const boot = await sync(cookie, '0')
    const inboxId = boot.body.changes.nodes[0].id
    const id = uuidv7()

    await sync(cookie, boot.body.cursor, [], [], [makeCompletionDto({ id, nodeId: inboxId, occurredOn: '2026-08-01' })])
    // Same id, different occurredOn — simulates a retried request after a
    // dropped response. Must NOT overwrite the original.
    await sync(cookie, boot.body.cursor, [], [], [makeCompletionDto({ id, nodeId: inboxId, occurredOn: '2026-08-02' })])

    const after = await sync(cookie, '0')
    const rows = after.body.changes.completions.filter((c: { id: string }) => c.id === id)
    expect(rows).toHaveLength(1)
    expect(rows[0].occurredOn).toBe('2026-08-01')
  })
})
