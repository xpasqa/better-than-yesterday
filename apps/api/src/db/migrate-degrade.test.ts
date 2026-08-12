// Integration test for drizzle/0010_outline_degrade_orphan_items.sql —
// exercises the exact migration query against the real test database
// (test/setup.ts points DATABASE_URL there) instead of the migration
// runner, so it can supply its own fixtures and roll them back.
// docs/feature/32.outline-task-decoupling/spec.md §8, §10.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { eq } from 'drizzle-orm'
import { db } from './client.ts'
import { node } from './schema/node.ts'
import { appUser } from './schema/user.ts'

const userId = 'test-degrade-user'
const now = new Date('2026-01-01T00:00:00Z')

function baseNode(overrides: Partial<typeof node.$inferInsert> & { id: string; kind: string }) {
  return {
    userId,
    parentId: null,
    rank: 'a0',
    content: '',
    createdAt: now,
    updatedAt: now,
    seq: 1n,
    ...overrides,
  }
}

async function runDegradeMigration(): Promise<void> {
  await db.execute(sql`
    WITH RECURSIVE anchored AS (
      SELECT id FROM node WHERE kind IN ('project', 'area')
      UNION ALL
      SELECT n.id FROM node n JOIN anchored a ON n.parent_id = a.id
    )
    UPDATE node
    SET kind = 'note', updated_at = now(), seq = nextval('sync_seq')
    WHERE kind = 'item' AND id NOT IN (SELECT id FROM anchored)
  `)
}

describe('0010_outline_degrade_orphan_items', () => {
  beforeEach(async () => {
    await db.insert(appUser).values({
      id: userId,
      email: `${userId}@example.com`,
      passwordHash: 'x',
    })
  })

  afterEach(async () => {
    await db.delete(node).where(eq(node.userId, userId))
    await db.delete(appUser).where(eq(appUser.id, userId))
  })

  it('degrades a root-level stray item to note, and its seq advances', async () => {
    await db.insert(node).values(baseNode({ id: 'stray', kind: 'item', parentId: null }))

    await runDegradeMigration()

    const [row] = await db.select().from(node).where(eq(node.id, 'stray'))
    expect(row?.kind).toBe('note')
    expect(row!.seq).toBeGreaterThan(1n)
  })

  it('keeps a task inside a project as item', async () => {
    await db.insert(node).values(baseNode({ id: 'proj', kind: 'project', parentId: null }))
    await db.insert(node).values(baseNode({ id: 'task', kind: 'item', parentId: 'proj', seq: 1n }))

    await runDegradeMigration()

    const [row] = await db.select().from(node).where(eq(node.id, 'task'))
    expect(row?.kind).toBe('item')
    expect(row!.seq).toBe(1n)
  })

  it('keeps a task nested under area -> project as item', async () => {
    await db.insert(node).values(baseNode({ id: 'area', kind: 'area', parentId: null }))
    await db.insert(node).values(baseNode({ id: 'proj2', kind: 'project', parentId: 'area' }))
    await db.insert(node).values(baseNode({ id: 'task2', kind: 'item', parentId: 'proj2', seq: 1n }))

    await runDegradeMigration()

    const [row] = await db.select().from(node).where(eq(node.id, 'task2'))
    expect(row?.kind).toBe('item')
  })

  it('keeps Inbox contents as item (Inbox is kind=project)', async () => {
    await db.insert(node).values(baseNode({ id: 'inbox', kind: 'project', parentId: null, isInbox: true }))
    await db.insert(node).values(baseNode({ id: 'inbox-task', kind: 'item', parentId: 'inbox', seq: 1n }))

    await runDegradeMigration()

    const [row] = await db.select().from(node).where(eq(node.id, 'inbox-task'))
    expect(row?.kind).toBe('item')
  })

  it('leaves non-item kinds and already-unaffected rows untouched', async () => {
    await db.insert(node).values(baseNode({ id: 'proj3', kind: 'project', parentId: null, seq: 1n }))

    await runDegradeMigration()

    const [row] = await db.select().from(node).where(eq(node.id, 'proj3'))
    expect(row?.kind).toBe('project')
    expect(row!.seq).toBe(1n)
  })
})
