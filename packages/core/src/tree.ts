// Structural operations shared by Outline and Board — see
// docs/feature/2.backend/2.outline/spec.md §6 (the outline keyboard table)
// and docs/feature/2.backend/spec.md §2.1 (task and outline node are the
// same row, so there is exactly one implementation of "move a row").
//
// Every function here is pure: given the current rows and an id, it returns
// the `{ parentId, rank }` the caller should write — it never mutates the
// input array or touches storage. The caller (Dexie on the client) applies
// the result and persists it.
import { between } from './rank.ts'

export interface TreeNodeLike {
  id: string
  parentId: string | null
  rank: string
}

function byRank(a: TreeNodeLike, b: TreeNodeLike): number {
  return a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0
}

function findNode(nodes: TreeNodeLike[], id: string): TreeNodeLike {
  const node = nodes.find((n) => n.id === id)
  if (!node) throw new Error(`tree: node not found: ${id}`)
  return node
}

/** Children of `parentId`, in rank order, optionally excluding one id. */
function children(nodes: TreeNodeLike[], parentId: string | null, excludeId?: string): TreeNodeLike[] {
  return nodes.filter((n) => n.parentId === parentId && n.id !== excludeId).sort(byRank)
}

/**
 * True if reparenting `nodeId` under `candidateParentId` would make a node
 * its own ancestor — walks from the candidate up to the root looking for
 * `nodeId`. A dangling `parentId` (points at a row that isn't in `nodes`)
 * is treated as "not a cycle": the caller only has a partial view (e.g. one
 * project's rows), not evidence of one.
 */
export function wouldCreateCycle(
  nodes: TreeNodeLike[],
  nodeId: string,
  candidateParentId: string | null,
): boolean {
  if (candidateParentId === null) return false
  if (candidateParentId === nodeId) return true

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const visited = new Set<string>()
  let current: string | null = candidateParentId
  while (current !== null) {
    if (current === nodeId) return true
    if (visited.has(current)) return true // pre-existing cycle elsewhere — refuse to extend it
    visited.add(current)
    const node: TreeNodeLike | undefined = byId.get(current)
    if (!node) return false
    current = node.parentId
  }
  return false
}

/**
 * Tab: become the previous sibling's last child, carrying any children of
 * its own along for free (they still point at `nodeId` as their parent).
 * Returns `null` when there is no previous sibling — the documented no-op.
 */
export function indent(nodes: TreeNodeLike[], nodeId: string): { parentId: string; rank: string } | null {
  const node = findNode(nodes, nodeId)
  const siblings = children(nodes, node.parentId)
  const index = siblings.findIndex((s) => s.id === nodeId)
  if (index <= 0) return null

  const previousSibling = siblings[index - 1]!
  const newSiblings = children(nodes, previousSibling.id, nodeId)
  const lastChild = newSiblings.at(-1) ?? null
  return { parentId: previousSibling.id, rank: between(lastChild?.rank ?? null, null) }
}

/**
 * Shift+Tab: become the parent's next sibling. Returns `null` when the node
 * is already top-level — the documented no-op.
 */
export function outdent(nodes: TreeNodeLike[], nodeId: string): { parentId: string | null; rank: string } | null {
  const node = findNode(nodes, nodeId)
  if (node.parentId === null) return null

  const parent = findNode(nodes, node.parentId)
  const grandSiblings = children(nodes, parent.parentId)
  const parentIndex = grandSiblings.findIndex((s) => s.id === parent.id)
  const nextAfterParent = grandSiblings[parentIndex + 1] ?? null
  return { parentId: parent.parentId, rank: between(parent.rank, nextAfterParent?.rank ?? null) }
}

/**
 * General reparent/reorder — what a drag in Board or Outline resolves to.
 * `beforeId: null` appends at the end of the target parent's children.
 * Throws if the move would create a cycle, or if `beforeId` isn't actually
 * a sibling under `newParentId` (a stale drag target).
 */
export function move(
  nodes: TreeNodeLike[],
  nodeId: string,
  newParentId: string | null,
  beforeId: string | null,
): { parentId: string | null; rank: string } {
  if (wouldCreateCycle(nodes, nodeId, newParentId)) {
    throw new Error(`tree.move: moving ${nodeId} under ${String(newParentId)} would create a cycle`)
  }

  const siblings = children(nodes, newParentId, nodeId)

  if (beforeId === null) {
    const last = siblings.at(-1) ?? null
    return { parentId: newParentId, rank: between(last?.rank ?? null, null) }
  }

  const targetIndex = siblings.findIndex((s) => s.id === beforeId)
  if (targetIndex === -1) {
    throw new Error(`tree.move: beforeId ${beforeId} is not a sibling under ${String(newParentId)}`)
  }
  const target = siblings[targetIndex]!
  const previous = siblings[targetIndex - 1] ?? null
  return { parentId: newParentId, rank: between(previous?.rank ?? null, target.rank) }
}
