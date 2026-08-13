// Extracted LWW upsert helpers — shared by sync/routes.ts and agent tools.
// Moving these out of routes.ts means agent writes flow through the same
// seq/ownership path as client sync (bug #6: agent changes were invisible
// to /sync because tool-executor.ts called db.update directly, bypassing
// the seq: nextval('sync_seq') stamp).
// docs/feature/35.agent-orchestrator/spec.md §6.1 (Blok A)
import { and, eq, sql } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { node } from '../../db/schema/node.ts'
import { tag } from '../../db/schema/tag.ts'
import { completion } from '../../db/schema/completion.ts'
import { reminder } from '../../db/schema/reminder.ts'
import type { NodeDto, TagDto, CompletionDto, ReminderDto } from './dto.ts'

// ── Row mappers ───────────────────────────────────────────────────────────────

export function toNodeRow(userId: string, dto: NodeDto) {
  return {
    id: dto.id,
    userId,
    parentId: dto.parentId,
    kind: dto.kind,
    rank: dto.rank,
    content: dto.content,
    note: dto.note,
    linkedTaskId: dto.linkedTaskId,
    dueDate: dto.dueDate,
    dueTime: dto.dueTime,
    durationMin: dto.durationMin,
    recurrence: dto.recurrence,
    priority: dto.priority,
    tagIds: dto.tagIds,
    color: dto.color,
    isFavorite: dto.isFavorite,
    isInbox: dto.isInbox,
    isSomeday: dto.isSomeday,
    collapsed: dto.collapsed,
    completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
    deletedAt: dto.deletedAt ? new Date(dto.deletedAt) : null,
  }
}

export function toTagRow(userId: string, dto: TagDto) {
  return {
    id: dto.id,
    userId,
    name: dto.name,
    color: dto.color,
    isFavorite: dto.isFavorite,
    rank: dto.rank,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
    deletedAt: dto.deletedAt ? new Date(dto.deletedAt) : null,
  }
}

export function toCompletionRow(userId: string, dto: CompletionDto) {
  return {
    id: dto.id,
    userId,
    nodeId: dto.nodeId,
    completedAt: new Date(dto.completedAt),
    occurredOn: dto.occurredOn,
  }
}

export function toReminderRow(userId: string, dto: ReminderDto) {
  return {
    id: dto.id,
    userId,
    nodeId: dto.nodeId,
    kind: dto.kind,
    remindAt: dto.remindAt ? new Date(dto.remindAt) : null,
    offsetMin: dto.offsetMin,
    fireAt: new Date(dto.fireAt),
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
    deletedAt: dto.deletedAt ? new Date(dto.deletedAt) : null,
  }
}

// ── LWW upserts ───────────────────────────────────────────────────────────────

/**
 * Row-level LWW upsert for nodes. The WHERE on the conflict path does two
 * jobs: refuses a write older than what's stored, AND refuses writes for
 * rows belonging to a different user. seq is always bumped so /sync sees it.
 */
export async function applyIncomingNodes(userId: string, dtos: NodeDto[]): Promise<void> {
  for (const dto of dtos) {
    const row = toNodeRow(userId, dto)
    await db
      .insert(node)
      .values(row)
      .onConflictDoUpdate({
        target: node.id,
        set: {
          parentId: row.parentId,
          kind: row.kind,
          rank: row.rank,
          content: row.content,
          note: row.note,
          linkedTaskId: row.linkedTaskId,
          dueDate: row.dueDate,
          dueTime: row.dueTime,
          durationMin: row.durationMin,
          recurrence: row.recurrence,
          priority: row.priority,
          tagIds: row.tagIds,
          color: row.color,
          isFavorite: row.isFavorite,
          isInbox: row.isInbox,
          isSomeday: row.isSomeday,
          collapsed: row.collapsed,
          completedAt: row.completedAt,
          updatedAt: row.updatedAt,
          deletedAt: row.deletedAt,
          seq: sql`nextval('sync_seq')`,
        },
        setWhere: sql`${node.userId} = ${userId} and excluded.updated_at >= ${node.updatedAt}`,
      })
  }
}

/** Same LWW + ownership guard as applyIncomingNodes, against `tag`. */
export async function applyIncomingTags(userId: string, dtos: TagDto[]): Promise<void> {
  for (const dto of dtos) {
    const row = toTagRow(userId, dto)
    await db
      .insert(tag)
      .values(row)
      .onConflictDoUpdate({
        target: tag.id,
        set: {
          name: row.name,
          color: row.color,
          isFavorite: row.isFavorite,
          rank: row.rank,
          updatedAt: row.updatedAt,
          deletedAt: row.deletedAt,
          seq: sql`nextval('sync_seq')`,
        },
        setWhere: sql`${tag.userId} = ${userId} and excluded.updated_at >= ${tag.updatedAt}`,
      })
  }
}

/**
 * Same LWW + ownership guard as applyIncomingNodes, against `reminder`.
 * Ownership guard: reminder.nodeId must belong to the same userId.
 */
export async function applyIncomingReminders(userId: string, dtos: ReminderDto[]): Promise<void> {
  for (const dto of dtos) {
    const owner = await db
      .select({ id: node.id })
      .from(node)
      .where(and(eq(node.id, dto.nodeId), eq(node.userId, userId)))
      .limit(1)
    if (owner.length === 0) continue
    const row = toReminderRow(userId, dto)
    await db
      .insert(reminder)
      .values(row)
      .onConflictDoUpdate({
        target: reminder.id,
        set: {
          kind: row.kind,
          remindAt: row.remindAt,
          offsetMin: row.offsetMin,
          fireAt: row.fireAt,
          updatedAt: row.updatedAt,
          deletedAt: row.deletedAt,
          seq: sql`nextval('sync_seq')`,
        },
        setWhere: sql`${reminder.userId} = ${userId} and excluded.updated_at >= ${reminder.updatedAt}`,
      })
  }
}

/**
 * Insert-only: completions are immutable after creation. Only completions
 * for nodes owned by the caller are accepted.
 */
export async function applyIncomingCompletions(userId: string, dtos: CompletionDto[]): Promise<void> {
  for (const dto of dtos) {
    const owner = await db
      .select({ id: node.id })
      .from(node)
      .where(and(eq(node.id, dto.nodeId), eq(node.userId, userId)))
      .limit(1)
    if (owner.length === 0) continue
    const row = toCompletionRow(userId, dto)
    await db.insert(completion).values(row).onConflictDoNothing()
  }
}
