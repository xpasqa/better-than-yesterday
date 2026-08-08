// Logbook — combines regular completed tasks and recurring task occurrences
// into a single chronological log. See docs/feature/17.logbook/spec.md.
//
// Key invariant: recurring tasks NEVER get completedAt set — each tick
// writes a row to the `completion` table instead. A logbook that only reads
// completedAt would miss all recurring history (spec §2).
import type { Node } from './node.ts'
import type { Completion } from './completion.ts'

/**
 * One entry in the Logbook — either a regular task that was completed
 * (source='task') or a single recurring-task occurrence (source='occurrence').
 */
export interface LogEntry {
  /** The node this entry belongs to. */
  node: Node
  /** ISO timestamp — when the task/occurrence was completed. */
  completedAt: string
  /** 'YYYY-MM-DD' for occurrences (the due-date slot that was ticked),
   *  null for regular tasks. */
  occurredOn: string | null
  /** Whether this came from the completion table or the node itself. */
  source: 'task' | 'occurrence'
}

/**
 * Builds the full Logbook from the two sources that together cover all
 * completed work:
 *
 * 1. Regular tasks  — `kind==='item' && deletedAt===null && completedAt!==null`
 * 2. Recurring occ. — every row in `completions`, node looked up from `nodes`
 *
 * Entries whose node is not found or is soft-deleted are silently skipped.
 * Result is sorted by `completedAt` descending (most recent first).
 */
export function logbook(nodes: Node[], completions: Completion[]): LogEntry[] {
  const nodeById = new Map<string, Node>()
  for (const n of nodes) {
    nodeById.set(n.id, n)
  }

  const entries: LogEntry[] = []

  // Source 1: regular tasks with completedAt
  for (const n of nodes) {
    if (n.kind === 'item' && n.deletedAt === null && n.completedAt !== null) {
      entries.push({
        node: n,
        completedAt: n.completedAt,
        occurredOn: null,
        source: 'task',
      })
    }
  }

  // Source 2: recurring-task occurrences from the completion table
  for (const c of completions) {
    const n = nodeById.get(c.nodeId)
    // Skip if node doesn't exist or has been soft-deleted
    if (!n || n.deletedAt !== null) continue
    entries.push({
      node: n,
      completedAt: c.completedAt,
      occurredOn: c.occurredOn,
      source: 'occurrence',
    })
  }

  // Sort most-recent first
  entries.sort((a, b) => (a.completedAt < b.completedAt ? 1 : a.completedAt > b.completedAt ? -1 : 0))

  return entries
}
