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

async function enqueue(node: Node): Promise<void> {
  await db.transaction('rw', db.nodes, db.outbox, async () => {
    await db.nodes.put(node)
    await db.outbox.put({ key: `node:${node.id}`, entityType: 'node', payload: node })
  })
  triggerSync()
}

/**
 * Parses a quick-add line and creates the task. `#project` is matched
 * case-insensitively by substring against existing projects; anything that
 * doesn't resolve — no `#` at all, or a name nothing matches — lands in
 * Inbox rather than being rejected, per 1.todo/spec.md §5.
 */
export async function createTaskFromQuickAdd(
  input: string,
  ctx: { timezone: string; language: 'id' | 'en' },
): Promise<Node> {
  const parsed = parse(input, { now: new Date(), timezone: ctx.timezone, language: ctx.language })

  const allNodes = await db.nodes.toArray()
  let parentId: string | null = null
  if (parsed.projectQuery) {
    const match = allNodes.find(
      (n) => n.kind === 'project' && n.content.toLowerCase().includes(parsed.projectQuery!.toLowerCase()),
    )
    parentId = match?.id ?? null
  }
  if (!parentId) {
    parentId = findInbox(allNodes)?.id ?? null
  }

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
