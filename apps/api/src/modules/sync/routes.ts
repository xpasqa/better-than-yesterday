// POST /api/sync — the one endpoint behind Todo and Outline (spec induk
// §3.1, §3.2; 1.todo/spec.md §4). Scope: `nodes`, `tags`, `completions`,
// and `reminders`.
import { Hono } from 'hono'
import { and, eq, gt } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { node } from '../../db/schema/node.ts'
import { tag } from '../../db/schema/tag.ts'
import { completion } from '../../db/schema/completion.ts'
import { reminder } from '../../db/schema/reminder.ts'
import { notification } from '../../db/schema/notification.ts'
import { AppError } from '../../http/errors.ts'
import { syncRequest, type NodeDto, type TagDto, type ReminderDto, type NotificationDto } from './dto.ts'
import {
  applyIncomingNodes,
  applyIncomingTags,
  applyIncomingCompletions,
  applyIncomingReminders,
} from './apply.ts'

export const syncRoutes = new Hono()


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
