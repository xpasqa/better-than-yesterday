// The one shape shared by Todo and Outline — see spec induk §2.1: a task is
// a node with a due_date; a project is a node with kind='project'; there is
// no separate Task/Project/Section/OutlineNode type. Mirrors the `node`
// table in docs/feature/2.backend/1.todo/spec.md §3.1 field for field.
export type NodeKind = 'project' | 'section' | 'item'

export interface Node {
  id: string
  userId: string
  parentId: string | null
  kind: NodeKind
  rank: string
  content: string
  note: string | null

  dueDate: string | null // 'YYYY-MM-DD'
  dueTime: string | null // 'HH:MM', requires dueDate
  durationMin: number | null
  recurrence: string | null // RRULE subset; requires dueDate

  priority: 1 | 2 | 3 | null // null = Todoist's P4, "no priority"
  labelIds: string[]
  color: string | null // meaningful on kind='project' only
  isFavorite: boolean
  isInbox: boolean // meaningful on kind='project' only; exactly one true per user
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

/** Rows a client can create offline, unpopulated until the sync layer fills them in. */
export type NewNode = Omit<Node, 'seq'>
