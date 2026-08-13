// Integration tests for the workspace tools — docs/feature/35.agent-orchestrator/spec.md §7.
//
// These exist because the previous round shipped with `npm run verify` green
// while four of thirteen tools were missing, the executor watched for a tool
// name that did not exist, and every agent write skipped `seq`. Unit tests on
// pure functions cannot catch any of that; these hit real Postgres.
import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { uuidv7 } from '@better/core/id'
import { between } from '@better/core/rank'
import { db } from '../src/db/client.ts'
import { node } from '../src/db/schema/node.ts'
import { agentProject } from '../src/db/schema/agent-project.ts'
import { executeTool } from '../src/modules/agent/tool-executor.ts'
import { ALL_TOOL_NAMES } from '../src/modules/agent/tools.ts'
import { resetDb, createTestUser } from './helpers.ts'

let userId: string
let otherId: string
let projectId: string
/** Real agent_project row — file tools carry an FK to it. */
let agentProjectId: string

function ctx(id = userId) {
  return { userId: id, projectId: agentProjectId, sessionId: 's', nodeId: null, timezone: 'UTC' }
}

async function seedNode(owner: string, fields: Partial<typeof node.$inferInsert> & { kind: 'project' | 'item' | 'area' | 'section' }): Promise<string> {
  const id = fields.id ?? uuidv7()
  const now = new Date()
  await db.insert(node).values({
    parentId: null, dueDate: null, recurrence: null,
    ...fields,
    id, userId: owner,
    rank: fields.rank ?? between(null, null),
    content: fields.content ?? 'x',
    createdAt: now, updatedAt: now,
  })
  return id
}

async function seqOf(id: string): Promise<bigint> {
  const [row] = await db.select({ seq: node.seq }).from(node).where(eq(node.id, id)).limit(1)
  return row!.seq
}

beforeEach(async () => {
  await resetDb()
  const u = await createTestUser('tools@test.dev')
  const o = await createTestUser('other@test.dev')
  userId = u.id
  otherId = o.id
  projectId = await seedNode(userId, { kind: 'project', content: 'Redesign situs' })

  agentProjectId = uuidv7()
  const now = new Date()
  await db.insert(agentProject).values({
    id: agentProjectId, userId, nodeId: null, kind: 'global', memory: '',
    createdAt: now, updatedAt: now,
  })
})

describe('tool surface', () => {
  // The executor's switch and the tool definitions used to drift apart in
  // silence: runner.ts watched for `create_task` while the tool was `add_task`,
  // so chat never emitted a patch event and the UI never refreshed.
  it('every advertised tool is handled by the executor', async () => {
    const unhandled: string[] = []
    for (const name of ALL_TOOL_NAMES) {
      const result = await executeTool(name, {}, ctx())
      if (result.text.startsWith('Error: tool tidak dikenal')) unhandled.push(name)
    }
    expect(unhandled).toEqual([])
  })

  it('advertises all thirteen workspace tools', () => {
    for (const name of [
      'list_workspace', 'list_tasks', 'search_tasks', 'get_task', 'create_task',
      'update_task', 'complete_task', 'delete_task', 'move_task',
      'manage_project', 'manage_section', 'manage_tag', 'set_reminder',
    ]) {
      expect(ALL_TOOL_NAMES).toContain(name)
    }
  })
})

describe('writes go through applyIncoming*', () => {
  // Bug #6: agent writes used db.update directly, which leaves seq untouched,
  // so /sync never sent the change and the UI only saw it after a full reload.
  it('bumps seq when creating', async () => {
    const before = await seqOf(projectId)
    const result = await executeTool('create_task', { text: 'beli kopi', projectId }, ctx())
    expect(result.isError).toBe(false)
    const created = result.effects.nodeIds[0]!
    expect(await seqOf(created)).toBeGreaterThan(before)
  })

  it('bumps seq when updating', async () => {
    const taskId = await seedNode(userId, { kind: 'item', parentId: projectId, content: 'lama' })
    const before = await seqOf(taskId)
    await executeTool('update_task', { taskId, content: 'baru' }, ctx())
    expect(await seqOf(taskId)).toBeGreaterThan(before)
  })

  it('reports touched node ids as effects rather than in prose', async () => {
    const result = await executeTool('create_task', { text: 'ada efeknya' }, ctx())
    expect(result.effects.nodeIds).toHaveLength(1)
    expect(result.effects.undo).toHaveLength(1)
    expect(result.effects.undo[0]).toMatchObject({ kind: 'node', before: null })
  })
})

describe('complete_task', () => {
  it('closes a one-off task', async () => {
    const taskId = await seedNode(userId, { kind: 'item', parentId: projectId, content: 'sekali' })
    await executeTool('complete_task', { taskId }, ctx())
    const [row] = await db.select().from(node).where(eq(node.id, taskId)).limit(1)
    expect(row!.completedAt).not.toBeNull()
  })

  // Routing this through update_task would set completedAt and kill the repeat.
  // That is exactly why complete_task is a separate tool (spec §7.3).
  it('advances a repeating task instead of closing it', async () => {
    const taskId = await seedNode(userId, {
      kind: 'item', parentId: projectId, content: 'standup',
      dueDate: '2026-08-13', recurrence: 'FREQ=DAILY',
    })
    const result = await executeTool('complete_task', { taskId }, ctx())
    expect(result.isError).toBe(false)

    const [row] = await db.select().from(node).where(eq(node.id, taskId)).limit(1)
    expect(row!.completedAt).toBeNull()
    expect(row!.dueDate).toBe('2026-08-14')
  })

  it('reopens with undo', async () => {
    const taskId = await seedNode(userId, { kind: 'item', parentId: projectId, content: 'sekali' })
    await executeTool('complete_task', { taskId }, ctx())
    await executeTool('complete_task', { taskId, undo: true }, ctx())
    const [row] = await db.select().from(node).where(eq(node.id, taskId)).limit(1)
    expect(row!.completedAt).toBeNull()
  })
})

describe('move_task', () => {
  it('refuses a move that would make a task its own ancestor', async () => {
    const parent = await seedNode(userId, { kind: 'item', parentId: projectId, content: 'induk' })
    const child = await seedNode(userId, { kind: 'item', parentId: parent, content: 'anak' })
    const result = await executeTool('move_task', { taskId: parent, parentId: child }, ctx())
    expect(result.isError).toBe(true)
    expect(result.text).toMatch(/turunan dirinya sendiri/)
  })

  it('reparents and keeps ordering sane', async () => {
    const other = await seedNode(userId, { kind: 'project', content: 'Project lain' })
    const taskId = await seedNode(userId, { kind: 'item', parentId: projectId, content: 'pindah' })
    const result = await executeTool('move_task', { taskId, parentId: other }, ctx())
    expect(result.isError).toBe(false)
    const [row] = await db.select().from(node).where(eq(node.id, taskId)).limit(1)
    expect(row!.parentId).toBe(other)
  })
})

describe('manage_section', () => {
  it('re-parents children to the project instead of orphaning them', async () => {
    const sectionId = await seedNode(userId, { kind: 'section', parentId: projectId, content: 'Riset' })
    const taskId = await seedNode(userId, { kind: 'item', parentId: sectionId, content: 'baca paper' })

    const result = await executeTool('manage_section', { action: 'delete', projectId, sectionId }, ctx())
    expect(result.isError).toBe(false)

    const [task] = await db.select().from(node).where(eq(node.id, taskId)).limit(1)
    expect(task!.parentId).toBe(projectId)
    expect(task!.deletedAt).toBeNull()
  })
})

describe('validation mirrors the database', () => {
  it('rejects dueTime without dueDate before Postgres has to', async () => {
    const taskId = await seedNode(userId, { kind: 'item', parentId: projectId, content: 'x' })
    const result = await executeTool('update_task', { taskId, dueTime: '09:00' }, ctx())
    expect(result.isError).toBe(true)
    expect(result.text).toMatch(/dueTime butuh dueDate/)
  })
})

describe('isolation', () => {
  // user_id is injected by the handler, never taken from tool arguments, so a
  // foreign id must read as "not found" rather than leaking its existence.
  it('cannot read another user\'s task', async () => {
    const foreign = await seedNode(otherId, { kind: 'item', content: 'rahasia' })
    const result = await executeTool('get_task', { taskId: foreign }, ctx())
    expect(result.isError).toBe(true)
    expect(result.text).toMatch(/tidak ditemukan/)
  })

  it('cannot modify another user\'s task', async () => {
    const foreign = await seedNode(otherId, { kind: 'item', content: 'rahasia' })
    const result = await executeTool('update_task', { taskId: foreign, content: 'diretas' }, ctx())
    expect(result.isError).toBe(true)
    const [row] = await db.select().from(node).where(eq(node.id, foreign)).limit(1)
    expect(row!.content).toBe('rahasia')
  })

  it('list_tasks never returns another user\'s rows', async () => {
    await seedNode(otherId, { kind: 'item', content: 'punya orang lain', dueDate: '2020-01-01' })
    await seedNode(userId, { kind: 'item', parentId: projectId, content: 'punya saya', dueDate: '2020-01-01' })
    const result = await executeTool('list_tasks', { view: 'today' }, ctx())
    expect(result.text).toContain('punya saya')
    expect(result.text).not.toContain('punya orang lain')
  })
})

describe('list_tasks views', () => {
  it('rejects an unknown view instead of guessing', async () => {
    const result = await executeTool('list_tasks', { view: 'kemarin' }, ctx())
    expect(result.isError).toBe(true)
  })

  it("requires projectId for view='project'", async () => {
    const result = await executeTool('list_tasks', { view: 'project' }, ctx())
    expect(result.isError).toBe(true)
    expect(result.text).toMatch(/projectId/)
  })

  it('lists a project view without needing nodeId', async () => {
    await seedNode(userId, { kind: 'item', parentId: projectId, content: 'dalam project' })
    const result = await executeTool('list_tasks', { view: 'project', projectId }, ctx())
    expect(result.isError).toBe(false)
    expect(result.text).toContain('dalam project')
  })
})

describe('tags', () => {
  it('creates tags on demand when a task names them', async () => {
    const result = await executeTool('create_task', { text: 'tulis draf', tags: ['nulis'] }, ctx())
    expect(result.isError).toBe(false)
    const created = result.effects.nodeIds[0]!
    const [row] = await db.select().from(node).where(eq(node.id, created)).limit(1)
    expect(row!.tagIds).toHaveLength(1)
  })

  it('refuses a duplicate tag name', async () => {
    await executeTool('manage_tag', { action: 'create', name: 'fokus' }, ctx())
    const again = await executeTool('manage_tag', { action: 'create', name: 'Fokus' }, ctx())
    expect(again.isError).toBe(true)
  })
})

describe('set_reminder', () => {
  it('needs a due date for a relative reminder', async () => {
    const taskId = await seedNode(userId, { kind: 'item', parentId: projectId, content: 'x' })
    const result = await executeTool('set_reminder', { taskId, kind: 'relative', offsetMin: 30 }, ctx())
    expect(result.isError).toBe(true)
    expect(result.text).toMatch(/due date/)
  })

  it('sets an absolute reminder', async () => {
    const taskId = await seedNode(userId, { kind: 'item', parentId: projectId, content: 'x' })
    const result = await executeTool(
      'set_reminder',
      { taskId, kind: 'absolute', remindAt: '2026-09-01T08:00:00.000Z' },
      ctx(),
    )
    expect(result.isError).toBe(false)
  })
})

describe('unknown tool', () => {
  it('names the failure rather than throwing', async () => {
    const result = await executeTool('rm_rf', {}, ctx())
    expect(result.isError).toBe(true)
    expect(result.text).toMatch(/tidak dikenal/)
  })
})

describe('nodeId is a hint, not a gate', () => {
  // Bug #2: every task tool bailed out with "no project context" because the
  // client never set nodeId, so the agent could not see a single task.
  it('list_workspace works with nodeId null', async () => {
    const result = await executeTool('list_workspace', {}, { ...ctx(), nodeId: null })
    expect(result.isError).toBe(false)
    expect(result.text).toContain('Redesign situs')
  })

  it('create_task works with nodeId null', async () => {
    const result = await executeTool('create_task', { text: 'tanpa konteks' }, { ...ctx(), nodeId: null })
    expect(result.isError).toBe(false)
  })
})

describe('undo trail', () => {
  it('captures the row as it was before an update', async () => {
    const taskId = await seedNode(userId, { kind: 'item', parentId: projectId, content: 'sebelum' })
    const result = await executeTool('update_task', { taskId, content: 'sesudah' }, ctx())
    const entry = result.effects.undo[0]
    expect(entry).toMatchObject({ kind: 'node', id: taskId })
    expect((entry as { before: { content: string } }).before.content).toBe('sebelum')
  })

  it('captures file contents before a delete', async () => {
    const written = await executeTool('write_file', { path: 'catatan.md', content: 'isi asli' }, ctx())
    expect(written.isError).toBe(false)
    const result = await executeTool('delete_file', { path: 'catatan.md' }, ctx())
    expect(result.isError).toBe(false)
    expect(result.effects.undo.at(-1)).toMatchObject({ kind: 'file', path: 'catatan.md', before: 'isi asli' })
  })
})
