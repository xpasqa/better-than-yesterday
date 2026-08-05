// POST /api/sync — the one endpoint behind Todo and Outline (spec induk
// §3.1, §3.2; 1.todo/spec.md §4). Scope of this version: `nodes` and
// `labels`. saved_filter/reminder/notification sync are not wired yet —
// they follow the identical upsert-with-LWW shape once needed.
import { Hono } from 'hono'
import { and, eq, gt, sql } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { node } from '../../db/schema/node.ts'
import { label } from '../../db/schema/label.ts'
import { AppError } from '../../http/errors.ts'
import { syncRequest, type NodeDto, type LabelDto } from './dto.ts'

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
    labelIds: dto.labelIds,
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
          labelIds: row.labelIds,
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

function toLabelRow(userId: string, dto: LabelDto) {
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

/** Same LWW + ownership guard as applyIncomingNodes, against `label`. */
async function applyIncomingLabels(userId: string, dtos: LabelDto[]): Promise<void> {
  for (const dto of dtos) {
    const row = toLabelRow(userId, dto)
    await db
      .insert(label)
      .values(row)
      .onConflictDoUpdate({
        target: label.id,
        set: {
          name: row.name,
          color: row.color,
          isFavorite: row.isFavorite,
          rank: row.rank,
          updatedAt: row.updatedAt,
          deletedAt: row.deletedAt,
          seq: sql`nextval('sync_seq')`,
        },
        setWhere: sql`${label.userId} = ${userId} and excluded.updated_at >= ${label.updatedAt}`,
      })
  }
}

function nodeToDto(row: typeof node.$inferSelect): NodeDto {
  return {
    id: row.id,
    parentId: row.parentId,
    kind: row.kind as NodeDto['kind'],
    rank: row.rank,
    content: row.content,
    note: row.note,
    dueDate: row.dueDate,
    // Postgres TIME always round-trips with seconds ("09:00:00") regardless
    // of what was written; normalize back to the wire format's 'HH:MM'.
    dueTime: row.dueTime?.slice(0, 5) ?? null,
    durationMin: row.durationMin,
    recurrence: row.recurrence,
    priority: row.priority as NodeDto['priority'],
    labelIds: row.labelIds,
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

function labelToDto(row: typeof label.$inferSelect): LabelDto {
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

syncRoutes.post('/sync', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => null)
  const parsed = syncRequest.safeParse(body)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 422, 'Invalid sync payload', parsed.error.flatten())
  }
  const { cursor, changes } = parsed.data
  const cursorBigint = BigInt(cursor)

  if (changes.nodes.length > 0) {
    await applyIncomingNodes(userId, changes.nodes)
  }
  if (changes.labels.length > 0) {
    await applyIncomingLabels(userId, changes.labels)
  }

  const [nodeRows, labelRows] = await Promise.all([
    db
      .select()
      .from(node)
      .where(and(eq(node.userId, userId), gt(node.seq, cursorBigint)))
      .orderBy(node.seq)
      .limit(500),
    db
      .select()
      .from(label)
      .where(and(eq(label.userId, userId), gt(label.seq, cursorBigint)))
      .orderBy(label.seq)
      .limit(500),
  ])

  // seq is one sequence shared by every syncable table, so the highest seq
  // seen across both result sets is the correct next cursor regardless of
  // which table it came from.
  let nextCursor = cursorBigint
  for (const r of nodeRows) if (r.seq > nextCursor) nextCursor = r.seq
  for (const r of labelRows) if (r.seq > nextCursor) nextCursor = r.seq

  return c.json({
    cursor: nextCursor.toString(),
    changes: { nodes: nodeRows.map(nodeToDto), labels: labelRows.map(labelToDto) },
  })
})
