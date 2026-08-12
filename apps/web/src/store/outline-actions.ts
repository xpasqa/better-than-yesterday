// Outline writes through the same node table Todo uses (spec induk §2.1) —
// this file only adds the operations Outline needs that Todo doesn't:
// arbitrary content edits, collapse state, and the structural moves that
// back Tab/Shift+Tab. Reparenting itself is core/tree.ts (2.outline/spec.md
// §7, §12) — this is just the Dexie-write wrapper around it, mirroring
// node-actions.ts's enqueue pattern.
//
// blankNode() creates kind='note', not kind='item': an Outline row is a
// plain sentence, never a task, until #project + the link popup says
// otherwise — even when written inside a project's zoomed view. See
// docs/feature/32.outline-task-decoupling/spec.md §2, §3.1.
import { uuidv7 } from '@better/core/id'
import { between } from '@better/core/rank'
import { indent as treeIndent, outdent as treeOutdent, move as treeMove } from '@better/core/tree'
import { sanitizeNode, type Node } from '@better/core/node'
import { db } from './db.ts'
import { triggerSync } from './sync-client.ts'

/**
 * `sanitizeNode` (shared with node-actions.ts's `enqueue` — issue #28)
 * enforces the DB's date/recurrence/time CHECK constraints before the write
 * lands. `patchNode` below takes an arbitrary patch, so a future caller
 * that clears `dueDate` without also clearing `recurrence`/`dueTime` is
 * exactly the scenario this guards against — see node-actions.ts's `enqueue`
 * doc comment for the failure mode (issue #23).
 */
async function enqueueNode(node: Node): Promise<void> {
  const safe = sanitizeNode(node)
  await db.transaction('rw', db.nodes, db.outbox, async () => {
    await db.nodes.put(safe)
    await db.outbox.put({ key: `node:${safe.id}`, entityType: 'node', payload: safe })
  })
  triggerSync()
}

export async function patchNode(node: Node, patch: Partial<Node>): Promise<void> {
  await enqueueNode({ ...node, ...patch, updatedAt: new Date().toISOString() })
}

function blankNode(parentId: string | null, rank: string): Node {
  const now = new Date().toISOString()
  return {
    id: uuidv7(),
    userId: '',
    parentId,
    kind: 'note',
    rank,
    content: '',
    note: null,
    linkedTaskId: null,
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
}

/** Enter: a new empty sibling right after `after`, same parent — 2.outline/spec.md §7. */
export async function createSiblingNode(after: Node, allNodes: Node[]): Promise<Node> {
  const next = allNodes
    .filter((n) => n.parentId === after.parentId && n.rank > after.rank)
    .reduce<Node | null>((min, n) => (min === null || n.rank < min.rank ? n : min), null)
  const node = blankNode(after.parentId, between(after.rank, next?.rank ?? null))
  await enqueueNode(node)
  return node
}

/** "Add item" at the root level — a plain note document, not a Todo project (§9). */
export async function createRootNode(allNodes: Node[]): Promise<Node> {
  const roots = allNodes.filter((n) => n.parentId === null)
  const lastRank = roots.length > 0 ? roots.reduce((a, b) => (a.rank > b.rank ? a : b)).rank : null
  const node = blankNode(null, between(lastRank, null))
  await enqueueNode(node)
  return node
}

/** Tab. Returns false on the documented no-op (no previous sibling) so the caller can leave focus alone. */
export async function indentNode(node: Node, allNodes: Node[]): Promise<boolean> {
  const result = treeIndent(allNodes, node.id)
  if (!result) return false
  await patchNode(node, result)
  return true
}

/** Shift+Tab. Returns false on the documented no-op (already top-level). */
export async function outdentNode(node: Node, allNodes: Node[]): Promise<boolean> {
  const result = treeOutdent(allNodes, node.id)
  if (!result) return false
  await patchNode(node, result)
  return true
}

/** ⌘↑ / ⌘↓ (§7). Returns false on the documented no-op (no sibling in that direction). */
export async function swapWithSibling(node: Node, allNodes: Node[], direction: 'up' | 'down'): Promise<boolean> {
  const siblings = allNodes.filter((n) => n.parentId === node.parentId).sort(byRank)
  const idx = siblings.findIndex((s) => s.id === node.id)
  if (idx === -1) return false

  if (direction === 'up') {
    if (idx === 0) return false
    const prev = siblings[idx - 1]!
    await patchNode(node, treeMove(allNodes, node.id, node.parentId, prev.id))
  } else {
    if (idx >= siblings.length - 1) return false
    const afterNext = siblings[idx + 2] ?? null
    await patchNode(node, treeMove(allNodes, node.id, node.parentId, afterNext?.id ?? null))
  }
  return true
}

function byRank(a: Node, b: Node): number {
  return a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0
}
