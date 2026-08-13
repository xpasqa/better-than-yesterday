// Server-side DTO helpers for the node table — lets agent tools call the same
// core functions (views.ts, parse.ts, rank.ts) that the client uses, with
// identical types. Blok A — docs/feature/35.agent-orchestrator/spec.md §6.1
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { node } from '../../db/schema/node.ts'
import type { Node } from '@better/core/node'

// ── DB row → core Node ────────────────────────────────────────────────────────

export function toDto(row: typeof node.$inferSelect): Node {
  return {
    id: row.id,
    userId: row.userId,
    parentId: row.parentId,
    kind: row.kind,
    rank: row.rank,
    content: row.content,
    note: row.note,
    linkedTaskId: row.linkedTaskId,
    dueDate: row.dueDate,
    // Postgres TIME returns 'HH:MM:SS' — strip seconds so it matches 'HH:MM'
    dueTime: row.dueTime ? row.dueTime.slice(0, 5) : row.dueTime,
    durationMin: row.durationMin,
    recurrence: row.recurrence,
    priority: row.priority as Node['priority'],
    tagIds: row.tagIds,
    color: row.color,
    isFavorite: row.isFavorite,
    isInbox: row.isInbox,
    isSomeday: row.isSomeday,
    collapsed: row.collapsed,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    seq: Number(row.seq),
  }
}

// ── core Node → partial DB row (for agent writes) ─────────────────────────────

export function fromCore(n: Node) {
  return {
    id: n.id,
    userId: n.userId,
    parentId: n.parentId,
    kind: n.kind,
    rank: n.rank,
    content: n.content,
    note: n.note,
    linkedTaskId: n.linkedTaskId,
    dueDate: n.dueDate,
    dueTime: n.dueTime,
    durationMin: n.durationMin,
    recurrence: n.recurrence,
    priority: n.priority,
    tagIds: n.tagIds,
    color: n.color,
    isFavorite: n.isFavorite,
    isInbox: n.isInbox,
    isSomeday: n.isSomeday,
    collapsed: n.collapsed,
    completedAt: n.completedAt ? new Date(n.completedAt) : null,
    createdAt: new Date(n.createdAt),
    updatedAt: new Date(n.updatedAt),
    deletedAt: n.deletedAt ? new Date(n.deletedAt) : null,
  }
}

// ── Query ─────────────────────────────────────────────────────────────────────

/** Load all non-deleted nodes for a user as core Node[]. */
export async function loadNodes(userId: string): Promise<Node[]> {
  const rows = await db
    .select()
    .from(node)
    .where(and(eq(node.userId, userId), isNull(node.deletedAt)))
  return rows.map(toDto)
}
