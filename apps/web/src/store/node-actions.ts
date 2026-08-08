// Every mutation: write to Dexie first (this is what makes the UI update
// in under 16ms, per spec induk §3.2), then queue the same row for the
// sync worker. There is no other write path — Board, Outline, and Today
// will all eventually call through here once they're migrated off mock
// data (docs/feature/2.backend/1.todo/todo.md blocks C–J).
import { uuidv7 } from '@better/core/id'
import { between } from '@better/core/rank'
import { findInbox, sanitizeNode, type Node } from '@better/core/node'
import { parse } from '@better/core/parse'
import { anchorRecurrence, nextOccurrence, nextOccurrenceAfter } from '@better/core/recurrence'
import { todayInTimezone } from '@better/core/date'
import type { Completion } from '@better/core/completion'
import { db } from './db.ts'
import { triggerSync } from './sync-client.ts'
import { resolveOrCreateTagIds } from './tag-actions.ts'
import { resolveOrCreateProjectId } from './project-actions.ts'

/**
 * Every Todo node write funnels through here (see the file's header
 * comment — there is no other write path for this store). `sanitizeNode`
 * (shared with Outline's and Project's own `enqueueNode` — issue #28)
 * enforces the DB's date/recurrence/time CHECK constraints before the write
 * lands: without it, any caller that clears `dueDate` (e.g.
 * `updateNode(id, { dueDate: null })` from NodeDetailModal's "Clear date"
 * button) without also clearing `recurrence`/`dueTime` produces a node that
 * crashes the sync push with an uncaught Postgres error — and since outbox
 * pushes as one batch, that one poisoned node silently blocks ALL
 * subsequent sync for the user, forever (issue #23).
 */
async function enqueue(node: Node): Promise<void> {
  const safe = sanitizeNode(node)
  await db.transaction('rw', db.nodes, db.outbox, async () => {
    await db.nodes.put(safe)
    await db.outbox.put({ key: `node:${safe.id}`, entityType: 'node', payload: safe })
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

  // Most of the eight spec.md §8 recurrence patterns ("setiap hari", "setiap
  // bulan", "setiap tahun", "setiap tanggal N", "setiap N hari", "setiap
  // hari kerja") have no accompanying date phrase — that's the expected,
  // normal way to type them ("siram tanaman setiap hari" needs no start
  // date). Default dueDate to today (in the task's timezone) whenever a
  // recurrence phrase was recognized but no date was, matching Todoist's
  // behavior — this also guarantees dueDate is non-null whenever recurrence
  // is set, satisfying the DB's node_recur_needs_date CHECK
  // (apps/api/src/db/schema/node.ts), with enqueue()'s own guard as a
  // second line of defense.
  const dueDate = parsed.dueDate ?? (parsed.recurrence ? todayInTimezone(ctx.timezone) : null)
  // Bare "FREQ=MONTHLY"/"FREQ=YEARLY" (from "setiap bulan"/"setiap tahun",
  // which don't name a day) need an anchor baked in, or nextOccurrence would
  // re-derive the day-of-month from whatever the *current* due date is on
  // each call and drift permanently after crossing a short month (issue #25).
  const recurrence = anchorRecurrence(parsed.recurrence, dueDate)

  const allNodes = await db.nodes.toArray()
  const parentId = parsed.projectQuery
    ? await resolveOrCreateProjectId(parsed.projectQuery, allNodes)
    : (ctx.defaultParentId ?? findInbox(allNodes)?.id ?? null)

  const siblings = allNodes.filter((n) => n.parentId === parentId)
  const lastRank = siblings.length > 0 ? siblings.reduce((a, b) => (a.rank > b.rank ? a : b)).rank : null
  const tagIds = await resolveOrCreateTagIds(parsed.tagNames)

  const now = new Date().toISOString()
  const node: Node = {
    id: uuidv7(),
    userId: '', // filled in by the server from the session; the client value is never trusted
    parentId,
    kind: 'item',
    rank: between(lastRank, null),
    content: parsed.content,
    note: null,
    dueDate,
    dueTime: parsed.dueTime,
    durationMin: parsed.durationMin,
    recurrence,
    priority: parsed.priority,
    tagIds,
    color: null,
    isFavorite: false,
    isInbox: false,
    isSomeday: false,
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

/**
 * Completing a recurring task never closes it (1.todo/spec.md §8) — its
 * due date advances to the next occurrence instead, and one `completion`
 * row is written as the audit trail. A non-recurring task keeps the plain
 * toggle-completedAt behavior. Both writes happen in one Dexie transaction
 * so a crash between them can't leave a completion logged without its
 * node's due date having actually advanced.
 *
 * A task that's been overdue a while catches all the way up to today in
 * this one call (Todoist-style, issue #26) via `nextOccurrenceAfter` —
 * not one call per missed occurrence. Only one `completion` row is
 * written regardless of how many occurrences were caught up, with
 * `occurredOn` set to the original (stale) due date: this logs the
 * action taken, not a backfilled history of every date that was missed.
 */
export async function toggleTaskComplete(node: Node, timezone: string): Promise<void> {
  const now = new Date().toISOString()

  if (!node.completedAt && node.recurrence && node.dueDate) {
    const completion: Completion = {
      id: uuidv7(),
      userId: '',
      nodeId: node.id,
      completedAt: now,
      occurredOn: node.dueDate,
      seq: 0,
    }
    const nextDueDate = nextOccurrenceAfter(node.recurrence, node.dueDate, todayInTimezone(timezone))
    const advanced: Node = { ...node, dueDate: nextDueDate, updatedAt: now }

    await db.transaction('rw', db.nodes, db.completions, db.outbox, async () => {
      await db.nodes.put(advanced)
      await db.outbox.put({ key: `node:${advanced.id}`, entityType: 'node', payload: advanced })
      await db.completions.put(completion)
      await db.outbox.put({ key: `completion:${completion.id}`, entityType: 'completion', payload: completion })
    })
    triggerSync()
    return
  }

  await enqueue({ ...node, completedAt: node.completedAt ? null : now, updatedAt: now })
}

/** Advances a recurring task's due date to the next occurrence without logging a completion — 1.todo/spec.md §8's "skip". No-op on a non-recurring task. */
export async function skipRecurrence(node: Node): Promise<void> {
  if (!node.recurrence || !node.dueDate) return
  const now = new Date().toISOString()
  await enqueue({ ...node, dueDate: nextOccurrence(node.recurrence, node.dueDate), updatedAt: now })
}

export async function deleteTask(node: Node): Promise<void> {
  const now = new Date().toISOString()
  await enqueue({ ...node, deletedAt: now, updatedAt: now })
}

/**
 * Creates a minimal subtask (child item) under `parentId`.
 * No quick-add parsing — content is used verbatim (spec §5: no surprise
 * date/tag extraction inside a checklist).
 */
export async function createSubtask(parentId: string, content: string): Promise<void> {
  const allNodes = await db.nodes.toArray()
  const siblings = allNodes.filter((n) => n.parentId === parentId && n.kind === 'item' && n.deletedAt === null)
  const lastRank = siblings.length > 0 ? siblings.reduce((a, b) => (a.rank > b.rank ? a : b)).rank : null
  const now = new Date().toISOString()
  const node: Node = {
    id: uuidv7(),
    userId: '',
    parentId,
    kind: 'item',
    rank: between(lastRank, null),
    content: content.trim(),
    note: null,
    dueDate: null,
    dueTime: null,
    durationMin: null,
    recurrence: null,
    priority: null,
    tagIds: [],
    color: null,
    isFavorite: false,
    isInbox: false,
    isSomeday: false,
    collapsed: false,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    seq: 0,
  }
  await enqueue(node)
}

/** Patch a node with the given fields. Uses LWW: sets updatedAt to now.
 *
 * When `patch.dueDate` is provided and the merged node has a recurrence rule,
 * re-anchors the rule to the new date (issue #75: picking a date chip after
 * the parser already anchored e.g. BYMONTHDAY=8 must update the anchor to
 * match the new date, otherwise the task permanently fires on the wrong day).
 */
export async function updateNode(id: string, patch: Partial<Omit<Node, 'id' | 'userId' | 'createdAt' | 'seq'>>): Promise<void> {
  const existing = await db.nodes.get(id)
  if (!existing) return
  const now = new Date().toISOString()
  const merged = { ...existing, ...patch, id, updatedAt: now }
  if ('dueDate' in patch && merged.recurrence) {
    merged.recurrence = anchorRecurrence(merged.recurrence, merged.dueDate) ?? merged.recurrence
  }
  await enqueue(merged)
}
