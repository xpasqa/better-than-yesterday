import { beforeEach, describe, expect, it } from 'vitest'
import { uuidv7 } from '@better/core/id'
import { createApp } from '../src/app.ts'
import { resetDb, createTestUser, extractSessionCookie, makeNodeDto, makeLabelDto, makeCompletionDto, readJson } from './helpers.ts'

const app = createApp()

async function loginCookie(email: string, password = 'testpassword123'): Promise<string> {
  const res = await app.request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return extractSessionCookie(res)
}

async function sync(cookie: string, cursor: string, nodes: unknown[] = [], labels: unknown[] = [], completions: unknown[] = []) {
  const res = await app.request('/api/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ cursor, changes: { nodes, labels, completions } }),
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

describe('POST /api/sync — labels', () => {
  it('a created label round-trips with the same field values', async () => {
    await createTestUser('label@example.com')
    const cookie = await loginCookie('label@example.com')
    const labelId = uuidv7()
    const { status, body } = await sync(cookie, '0', [], [makeLabelDto({ id: labelId, name: 'penting', color: 'red' })])
    expect(status).toBe(200)
    const [returned] = body.changes.labels
    expect(returned.id).toBe(labelId)
    expect(returned.name).toBe('penting')
    expect(returned.color).toBe('red')
  })

  it('nodes and labels share one cursor — pulling after a label-only write also advances past it', async () => {
    await createTestUser('shared-cursor@example.com')
    const cookie = await loginCookie('shared-cursor@example.com')
    const boot = await sync(cookie, '0')
    const withLabel = await sync(cookie, boot.body.cursor, [], [makeLabelDto({ id: uuidv7() })])
    expect(BigInt(withLabel.body.cursor)).toBeGreaterThan(BigInt(boot.body.cursor))
    const idle = await sync(cookie, withLabel.body.cursor)
    expect(idle.body.changes.nodes).toEqual([])
    expect(idle.body.changes.labels).toEqual([])
  })

  it('an older incoming label update loses to what is already stored', async () => {
    await createTestUser('label-lww@example.com')
    const cookie = await loginCookie('label-lww@example.com')
    const labelId = uuidv7()
    const t1 = new Date(Date.now() - 10_000).toISOString()
    const t2 = new Date().toISOString()
    await sync(cookie, '0', [], [makeLabelDto({ id: labelId, name: 'kedua', updatedAt: t2 })])
    const stale = await sync(cookie, '0', [], [makeLabelDto({ id: labelId, name: 'basi', updatedAt: t1 })])
    const finalRow = stale.body.changes.labels.find((l: { id: string }) => l.id === labelId)
    expect(finalRow.name).toBe('kedua')
  })

  it('rejects a label name containing a space (the $name token cannot have one)', async () => {
    await createTestUser('label-shape@example.com')
    const cookie = await loginCookie('label-shape@example.com')
    const { status, body } = await sync(cookie, '0', [], [makeLabelDto({ id: uuidv7(), name: 'dua kata' })])
    expect(status).toBe(422)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('POST /api/sync — completions', () => {
  it('a created completion round-trips with the same field values', async () => {
    await createTestUser('completion@example.com')
    const cookie = await loginCookie('completion@example.com')
    const boot = await sync(cookie, '0')
    const inboxId = boot.body.changes.nodes[0].id

    const id = uuidv7()
    await sync(cookie, boot.body.cursor, [], [], [
      makeCompletionDto({ id, nodeId: inboxId, occurredOn: '2026-08-05' }),
    ])

    const after = await sync(cookie, '0')
    const row = after.body.changes.completions.find((c: { id: string }) => c.id === id)
    expect(row).toBeDefined()
    expect(row.nodeId).toBe(inboxId)
    expect(row.occurredOn).toBe('2026-08-05')
  })

  it('nodes, labels, and completions share one cursor', async () => {
    await createTestUser('completion-cursor@example.com')
    const cookie = await loginCookie('completion-cursor@example.com')
    const boot = await sync(cookie, '0')
    const inboxId = boot.body.changes.nodes[0].id

    const push = await sync(cookie, boot.body.cursor, [], [], [
      makeCompletionDto({ id: uuidv7(), nodeId: inboxId }),
    ])
    expect(push.body.cursor).not.toBe(boot.body.cursor)

    const pullAfter = await sync(cookie, push.body.cursor)
    expect(pullAfter.body.changes.nodes).toEqual([])
    expect(pullAfter.body.changes.labels).toEqual([])
    expect(pullAfter.body.changes.completions).toEqual([])
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
