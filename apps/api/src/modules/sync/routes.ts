// POST /api/sync — the one endpoint behind Todo and Outline (spec induk
// §3.1, §3.2; 1.todo/spec.md §4). Scope of this version: `nodes`, `tags`,
// and `completions`. reminder/notification sync are not wired yet — they
// follow the identical upsert-with-LWW shape once needed.
import { Hono } from 'hono'
import { and, eq, gt, sql } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { node } from '../../db/schema/node.ts'
import { tag } from '../../db/schema/tag.ts'
import { completion } from '../../db/schema/completion.ts'
import { AppError } from '../../http/errors.ts'
import { syncRequest, type NodeDto, type TagDto, type CompletionDto } from './dto.ts'

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
    dueDate: dto.dueDate,
    dueTime: dto.dueTime,
    durationMin: dto.durationMin,
    recurrence: dto.recurrence,
    priority: dto.priority,
    tagIds: dto.tagIds,
    color: dto.color,
    isFavorite: dto.isFavorite,
    isInbox: dto.isInbox,
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
          dueDate: row.dueDate,
          dueTime: row.dueTime,
          durationMin: row.durationMin,
          recurrence: row.recurrence,
          priority: row.priority,
          tagIds: row.tagIds,
          color: row.color,
          isFavorite: row.isFavorite,
          isInbox: row.isInbox,
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

  // Pull: fetch everything newer than cursor across all three entity types.
  const [nodeRows, tagRows, completionRows] = await Promise.all([
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
  ])

  // seq is one sequence shared by every syncable table, so the highest seq
  // seen across all three result sets is the correct next cursor regardless
  // of which table it came from.
  let nextCursor = cursorBigint
  for (const r of nodeRows) if (r.seq > nextCursor) nextCursor = r.seq
  for (const r of tagRows) if (r.seq > nextCursor) nextCursor = r.seq
  for (const r of completionRows) if (r.seq > nextCursor) nextCursor = r.seq

  return c.json({
    cursor: nextCursor.toString(),
    changes: {
      nodes: nodeRows.map(nodeToDto),
      tags: tagRows.map(tagToDto),
      completions: completionRows.map(completionToDto),
    },
  })
})
