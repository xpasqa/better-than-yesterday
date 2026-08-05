// View filters — every Todo/Outline screen is one of these, computed over
// the synced tree on the client. See docs/feature/2.backend/1.todo/spec.md
// §6. Scope of this version: today, upcoming, inbox, project, completed,
// and the depth-first subtree walk both Project and Outline build on. Not
// yet implemented: label view, saved-filter query language, search, and
// board grouping — see the phase todo lists for those.
import type { Node } from './node.ts'
import { findInbox } from './node.ts'

function isActiveItem(n: Node): boolean {
  return n.kind === 'item' && n.deletedAt === null && n.completedAt === null
}

function byRank(a: Node, b: Node): number {
  return a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0
}

/**
 * Today's sort: due time first (undated-time last), then priority
 * (no-priority last), then manual rank as the final tiebreak.
 */
function byTodayOrder(a: Node, b: Node): number {
  const timeA = a.dueTime ?? '99:99'
  const timeB = b.dueTime ?? '99:99'
  if (timeA !== timeB) return timeA < timeB ? -1 : 1

  const prioA = a.priority ?? 4
  const prioB = b.priority ?? 4
  if (prioA !== prioB) return prioA - prioB

  return byRank(a, b)
}

/** All descendants of `parentId`, depth-first, each level in rank order. Shared by Project and Outline. */
export function subtreeDepthFirst(nodes: Node[], parentId: string | null): Node[] {
  const childrenByParent = new Map<string | null, Node[]>()
  for (const n of nodes) {
    if (n.deletedAt !== null) continue
    const list = childrenByParent.get(n.parentId)
    if (list) list.push(n)
    else childrenByParent.set(n.parentId, [n])
  }
  for (const list of childrenByParent.values()) list.sort(byRank)

  const result: Node[] = []
  function walk(id: string | null): void {
    for (const child of childrenByParent.get(id) ?? []) {
      result.push(child)
      walk(child.id)
    }
  }
  walk(parentId)
  return result
}

/**
 * `due_date <= today`, incomplete, at any depth — split into the overdue
 * block (always shown above today's items, never silently dropped) and
 * today's own items.
 */
export function today(nodes: Node[], todayStr: string): { overdue: Node[]; today: Node[] } {
  const due = nodes.filter((n) => isActiveItem(n) && n.dueDate !== null && n.dueDate <= todayStr)
  return {
    overdue: due.filter((n) => n.dueDate! < todayStr).sort(byTodayOrder),
    today: due.filter((n) => n.dueDate === todayStr).sort(byTodayOrder),
  }
}

/** `due_date > today`, grouped by date, chronological — undated items never appear here. */
export function upcoming(nodes: Node[], todayStr: string): Array<{ date: string; items: Node[] }> {
  const groups = new Map<string, Node[]>()
  for (const n of nodes) {
    if (!isActiveItem(n) || n.dueDate === null || n.dueDate <= todayStr) continue
    const list = groups.get(n.dueDate)
    if (list) list.push(n)
    else groups.set(n.dueDate, [n])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, items]) => ({ date, items: items.sort(byTodayOrder) }))
}

/** Active items anywhere in a project's subtree — sections and the project row itself are structure, not content. */
export function project(nodes: Node[], projectId: string): Node[] {
  return subtreeDepthFirst(nodes, projectId).filter(isActiveItem)
}

/** The signed-in user's Inbox, found by flag (§3.1a) — empty until `user add` has seeded one. */
export function inbox(nodes: Node[]): Node[] {
  const root = findInbox(nodes)
  return root ? project(nodes, root.id) : []
}

/** `completed_at IS NOT NULL`, most recent first. Pagination is a slice at the call site. */
export function completed(nodes: Node[]): Node[] {
  return nodes
    .filter((n) => n.kind === 'item' && n.deletedAt === null && n.completedAt !== null)
    .sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : a.completedAt! > b.completedAt! ? -1 : 0))
}
