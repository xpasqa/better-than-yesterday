// Every mutation: write to Dexie first (this is what makes the UI update
// in under 16ms, per spec induk §3.2), then queue the same row for the
// sync worker. There is no other write path — Board, Outline, and Today
// will all eventually call through here once they're migrated off mock
// data (docs/feature/2.backend/1.todo/todo.md blocks C–J).
import { uuidv7 } from '@better/core/id'
import { between } from '@better/core/rank'
import { findInbox, type Node } from '@better/core/node'
import { parse } from '@better/core/parse'
import { db } from './db.ts'
import { triggerSync } from './sync-client.ts'
import { resolveOrCreateLabelIds } from './label-actions.ts'
import { resolveOrCreateProjectId } from './project-actions.ts'

async function enqueue(node: Node): Promise<void> {
  await db.transaction('rw', db.nodes, db.outbox, async () => {
    await db.nodes.put(node)
    await db.outbox.put({ key: `node:${node.id}`, entityType: 'node', payload: node })
  })
  triggerSync()
}

/**
 * Parses a quick-add line and creates the task. `#project` resolves to an
 * existing project case-insensitively by exact name, or creates a new one —
 * an unrecognized `#name` becomes a real project rather than silently
 * falling back to Inbox, mirroring how `$label` is resolved (1.todo/spec.md
 * §5: never discard a recognized token). Without a `#`, `defaultParentId`
 * is used (a specific project when quick-add is opened from that project's
 * own view, or the Inbox otherwise).
 */
export async function createTaskFromQuickAdd(
  input: string,
  ctx: { timezone: string; language: 'id' | 'en'; defaultParentId?: string | null },
): Promise<Node> {
  const parsed = parse(input, { now: new Date(), timezone: ctx.timezone, language: ctx.language })

  const allNodes = await db.nodes.toArray()
  const parentId = parsed.projectQuery
    ? await resolveOrCreateProjectId(parsed.projectQuery, allNodes)
    : (ctx.defaultParentId ?? findInbox(allNodes)?.id ?? null)

  const siblings = allNodes.filter((n) => n.parentId === parentId)
  const lastRank = siblings.length > 0 ? siblings.reduce((a, b) => (a.rank > b.rank ? a : b)).rank : null
  const labelIds = await resolveOrCreateLabelIds(parsed.labelNames)

  const now = new Date().toISOString()
  const node: Node = {
    id: uuidv7(),
    userId: '', // filled in by the server from the session; the client value is never trusted
    parentId,
    kind: 'item',
    rank: between(lastRank, null),
    content: parsed.content,
    note: null,
    dueDate: parsed.dueDate,
    dueTime: parsed.dueTime,
    durationMin: parsed.durationMin,
    recurrence: parsed.recurrence,
    priority: parsed.priority,
    labelIds,
    color: null,
    isFavorite: false,
    isInbox: false,
    collapsed: false,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    seq: 0, // server-assigned; irrelevant for a row the client is creating
  }

  await enqueue(node)
  return node
}

export async function toggleTaskComplete(node: Node): Promise<void> {
  const now = new Date().toISOString()
  await enqueue({ ...node, completedAt: node.completedAt ? null : now, updatedAt: now })
}

export async function deleteTask(node: Node): Promise<void> {
  const now = new Date().toISOString()
  await enqueue({ ...node, deletedAt: now, updatedAt: now })
}
