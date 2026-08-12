// POST /api/sync — the one endpoint behind Todo and Outline (spec induk
// §3.1, §3.2; 1.todo/spec.md §4). Scope: `nodes`, `tags`, `completions`,
// and `reminders`.
import { Hono } from 'hono'
import { and, eq, gt, sql } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { node } from '../../db/schema/node.ts'
import { tag } from '../../db/schema/tag.ts'
import { completion } from '../../db/schema/completion.ts'
import { reminder } from '../../db/schema/reminder.ts'
import { notification } from '../../db/schema/notification.ts'
import { AppError } from '../../http/errors.ts'
import { syncRequest, type NodeDto, type TagDto, type CompletionDto, type ReminderDto, type NotificationDto } from './dto.ts'

export const syncRoutes = new Hono()

function toNodeRow(userId: string, dto: NodeDto) {
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

/**
 * Row-level LWW upsert. The WHERE on the conflict path does two jobs at
 * once: it refuses an incoming write that is older than what's already
 * stored (`excluded.updated_at >= node.updated_at`), AND — just as
 * important — it refuses to touch a row that belongs to a *different* user
 * (`node.user_id = <userId>`), so a client can never overwrite another
 * user's row even if a client-generated id somehow collided with one.
 * Either failure mode leaves the existing row exactly as it was.
 */
async function applyIncomingNodes(userId: string, dtos: NodeDto[]): Promise<void> {
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

function toTagRow(userId: string, dto: TagDto) {
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

/** Same LWW + ownership guard as applyIncomingNodes, against `tag`. */
async function applyIncomingTags(userId: string, dtos: TagDto[]): Promise<void> {
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

function toCompletionRow(userId: string, dto: CompletionDto) {
  return {
    id: dto.id,
    userId,
    nodeId: dto.nodeId,
    completedAt: new Date(dto.completedAt),
    occurredOn: dto.occurredOn,
  }
}

function toReminderRow(userId: string, dto: ReminderDto) {
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

/**
 * Same LWW + ownership guard as applyIncomingNodes, against `reminder`.
 * Ownership guard: reminder.nodeId must belong to the same userId.
 * Soft-deletes are accepted (deletedAt set) — the server just records them.
 */
async function applyIncomingReminders(userId: string, dtos: ReminderDto[]): Promise<void> {
  for (const dto of dtos) {
    // Ownership guard: only accept reminders for nodes this user owns.
    const owner = await db.select({ id: node.id }).from(node)
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
 * Insert-only: completions are immutable after creation (spec §8). The
 * DO NOTHING on conflict means a retry is always safe — the original row
 * is kept and the caller sees a 200 either way.
 * Only completions for nodes owned by the caller are accepted — foreign
 * nodeIds are silently dropped.
 */
async function applyIncomingCompletions(userId: string, dtos: CompletionDto[]): Promise<void> {
  for (const dto of dtos) {
    // Ownership guard: only accept completions for nodes this user owns.
    const owner = await db.select({ id: node.id }).from(node)
      .where(and(eq(node.id, dto.nodeId), eq(node.userId, userId)))
      .limit(1)
    if (owner.length === 0) continue
    const row = toCompletionRow(userId, dto)
    await db.insert(completion).values(row).onConflictDoNothing()
  }
}

function nodeToDto(row: typeof node.$inferSelect): NodeDto {
  return {
    id: row.id,
    parentId: row.parentId,
    kind: row.kind,
    rank: row.rank,
    content: row.content,
    note: row.note,
    linkedTaskId: row.linkedTaskId,
    dueDate: row.dueDate,
    // Postgres TIME columns return 'HH:MM:SS' — strip the seconds so the
    // value is always in the 'HH:MM' format the client expects.
    dueTime: row.dueTime ? row.dueTime.slice(0, 5) : row.dueTime,
    durationMin: row.durationMin,
    recurrence: row.recurrence,
    priority: row.priority as NodeDto['priority'],
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
  }
}

function tagToDto(row: typeof tag.$inferSelect): TagDto {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    isFavorite: row.isFavorite,
    rank: row.rank,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  }
}

function completionToDto(row: typeof completion.$inferSelect) {
  return {
    id: row.id,
    nodeId: row.nodeId,
    completedAt: row.completedAt.toISOString(),
    occurredOn: row.occurredOn,
  }
}

function reminderToDto(row: typeof reminder.$inferSelect): ReminderDto {
  return {
    id: row.id,
    nodeId: row.nodeId,
    kind: row.kind,
    remindAt: row.remindAt?.toISOString() ?? null,
    offsetMin: row.offsetMin,
    fireAt: row.fireAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  }
}

function notificationToDto(row: typeof notification.$inferSelect): NotificationDto {
  return {
    id: row.id,
    kind: row.kind,
    nodeId: row.nodeId,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
  }
}

syncRoutes.post('/sync', async (c) => {
  const userId = c.get('userId' as never) as string
  if (!userId) throw new AppError('UNAUTHORIZED', 401, 'Unauthorized')

  const body = syncRequest.safeParse(await c.req.json())
  if (!body.success) throw new AppError('VALIDATION_ERROR', 422, body.error.message)

  const { cursor, changes } = body.data
  const cursorBigint = BigInt(cursor)

  if (changes.nodes.length > 0) await applyIncomingNodes(userId, changes.nodes)
  if (changes.tags.length > 0) await applyIncomingTags(userId, changes.tags)
  if (changes.completions.length > 0) await applyIncomingCompletions(userId, changes.completions)
  if (changes.reminders.length > 0) await applyIncomingReminders(userId, changes.reminders)

  // Pull: fetch everything newer than cursor across all syncable entity types.
  // notifications are pull-only (server writes, client never pushes them).
  const [nodeRows, tagRows, completionRows, reminderRows, notificationRows] = await Promise.all([
    db
      .select()
      .from(node)
      .where(and(eq(node.userId, userId), gt(node.seq, cursorBigint)))
      .orderBy(node.seq)
      .limit(500),
    db
      .select()
      .from(tag)
      .where(and(eq(tag.userId, userId), gt(tag.seq, cursorBigint)))
      .orderBy(tag.seq)
      .limit(500),
    db
      .select()
      .from(completion)
      .where(and(eq(completion.userId, userId), gt(completion.seq, cursorBigint)))
      .orderBy(completion.seq)
      .limit(500),
    db
      .select()
      .from(reminder)
      .where(and(eq(reminder.userId, userId), gt(reminder.seq, cursorBigint)))
      .orderBy(reminder.seq)
      .limit(500),
    db
      .select()
      .from(notification)
      .where(and(eq(notification.userId, userId), gt(notification.seq, cursorBigint)))
      .orderBy(notification.seq)
      .limit(500),
  ])

  // seq is one sequence shared by every syncable table, so the highest seq
  // seen across all five result sets is the correct next cursor regardless
  // of which table it came from.
  let nextCursor = cursorBigint
  for (const r of nodeRows) if (r.seq > nextCursor) nextCursor = r.seq
  for (const r of tagRows) if (r.seq > nextCursor) nextCursor = r.seq
  for (const r of completionRows) if (r.seq > nextCursor) nextCursor = r.seq
  for (const r of reminderRows) if (r.seq > nextCursor) nextCursor = r.seq
  for (const r of notificationRows) if (r.seq > nextCursor) nextCursor = r.seq

  return c.json({
    cursor: nextCursor.toString(),
    changes: {
      nodes: nodeRows.map(nodeToDto),
      tags: tagRows.map(tagToDto),
      completions: completionRows.map(completionToDto),
      reminders: reminderRows.map(reminderToDto),
      notifications: notificationRows.map(notificationToDto),
    },
  })
})
