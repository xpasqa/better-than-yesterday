// The one shape shared by Todo and Outline — see spec induk §2.1: a task is
// a node with a due_date; a project is a node with kind='project'; there is
// no separate Task/Project/Section/OutlineNode type. Mirrors the `node`
// table in docs/feature/2.backend/1.todo/spec.md §3.1 field for field.
// node.tagIds stores tag entity ids (never names) — see tag.ts.
// 'note' (docs/feature/32.outline-task-decoupling/spec.md §3.1): a plain
// Outline row, excluded from every Todo view (kind === 'item' is their only
// membership test) unless linked to a task via linkedTaskId.
export type NodeKind = 'area' | 'project' | 'section' | 'item' | 'note'

export interface Node {
  id: string
  userId: string
  parentId: string | null
  kind: NodeKind
  rank: string
  content: string
  note: string | null
  linkedTaskId: string | null // kind='note' only — the task this Outline row links to via #project (32.outline-task-decoupling/spec.md §3.2)

  dueDate: string | null // 'YYYY-MM-DD'
  dueTime: string | null // 'HH:MM', requires dueDate
  durationMin: number | null
  recurrence: string | null // RRULE subset; requires dueDate

  priority: 1 | 2 | 3 | null // null = Todoist's P4, "no priority"
  tagIds: string[]
  color: string | null // meaningful on kind='project' only
  isFavorite: boolean
  isInbox: boolean // meaningful on kind='project' only; exactly one true per user
  isSomeday: boolean // deferred indefinitely — hidden from Today, Upcoming, and Anytime
  collapsed: boolean

  completedAt: string | null // ISO timestamp; null = not done
  createdAt: string
  updatedAt: string // client-stamped; the basis for LWW
  deletedAt: string | null // soft delete
  seq: number
}

/** The signed-in user's Inbox project — found by flag, never by a shared id (§3.1a). */
export function findInbox(nodes: Node[]): Node | undefined {
  return nodes.find((n) => n.isInbox)
}

/**
 * Enforces the DB's `node_recur_needs_date`/`node_time_needs_date` CHECK
 * constraints before a node is ever written: with no `dueDate`, `recurrence`
 * and `dueTime` can't be set either. Every write path (Todo's `enqueue`,
 * Outline's and Project's own `enqueueNode`) should pass every node through
 * this before persisting — a node that violates this crashes the sync push
 * with an uncaught Postgres error, and since the outbox pushes as one batch,
 * that one poisoned node silently blocks ALL subsequent sync for the user
 * (issue #23/#28).
 */
export function sanitizeNode(node: Node): Node {
  return node.dueDate ? node : { ...node, dueTime: null, recurrence: null }
}

/** Rows a client can create offline, unpopulated until the sync layer fills them in. */
export type NewNode = Omit<Node, 'seq'>
