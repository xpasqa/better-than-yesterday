// Projects and Areas are nodes (spec induk §2.1). Area = kind='area',
// Project = kind='project'. Hierarchy: Area → Project → Task.
//
// No cycle-detection needed: areas always have parentId=null and projects
// can only parent to areas (different kind), making cycles structurally
// impossible — a project can never become its own ancestor.
import { uuidv7 } from '@better/core/id'
import { between } from '@better/core/rank'
import { sanitizeNode, type Node } from '@better/core/node'
import { db } from './db.ts'
import { triggerSync } from './sync-client.ts'

/**
 * `sanitizeNode` enforces the DB's date/recurrence/time CHECK constraints
 * before the write lands (issue #28). Projects and areas always set those
 * fields null, so this is effectively a no-op here — kept for consistency
 * with the other enqueue* functions so this file doesn't drift from the
 * invariant if it ever grows new paths.
 */
async function enqueueNode(node: Node): Promise<void> {
  const safe = sanitizeNode(node)
  await db.transaction('rw', db.nodes, db.outbox, async () => {
    await db.nodes.put(safe)
    await db.outbox.put({ key: `node:${safe.id}`, entityType: 'node', payload: safe })
  })
  triggerSync()
}

/** Enqueue multiple node writes in a single Dexie transaction. */
async function enqueueNodes(nodes: Node[]): Promise<void> {
  const safe = nodes.map(sanitizeNode)
  await db.transaction('rw', db.nodes, db.outbox, async () => {
    for (const n of safe) {
      await db.nodes.put(n)
      await db.outbox.put({ key: `node:${n.id}`, entityType: 'node', payload: n })
    }
  })
  triggerSync()
}

/** Last rank among siblings sharing the same parentId. */
function lastSiblingRank(parentId: string | null, allNodes: Node[]): string | null {
  const siblings = allNodes.filter((n) => n.parentId === parentId && n.deletedAt === null)
  return siblings.length > 0 ? siblings.reduce((a, b) => (a.rank > b.rank ? a : b)).rank : null
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

/**
 * Creates a new Area. Areas always have parentId=null — they are top-level
 * containers and never complete (spec §4.2).
 * Returns the new area's id.
 */
export async function createArea(name: string, color: string | null, allNodes: Node[]): Promise<string> {
  const trimmed = name.trim()
  const now = new Date().toISOString()
  const area: Node = {
    id: uuidv7(),
    userId: '',
    parentId: null,
    kind: 'area',
    // Rank among area siblings only — orphan projects share the same parentId=null
    // but are a different kind and should not influence area ordering.
    rank: between(lastSiblingRank(null, allNodes.filter(n => n.kind === 'area')), null),
    content: trimmed,
    note: null,
    dueDate: null,
    dueTime: null,
    durationMin: null,
    recurrence: null,
    priority: null,
    tagIds: [],
    color,
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
  await enqueueNode(area)
  return area.id
}

/**
 * Creates a new Project, optionally nested under an Area.
 * Invariant: areaId must be null OR the id of a node with kind='area'.
 * Violation → writes nothing and returns null.
 * Returns the new project's id, or null on invariant violation.
 */
export async function createProject(
  name: string,
  color: string | null,
  areaId: string | null,
  allNodes: Node[],
): Promise<string | null> {
  // Enforce invariant: parent must be null or an area node
  if (areaId !== null) {
    const parent = allNodes.find((n) => n.id === areaId)
    if (!parent || parent.kind !== 'area') return null
  }

  const trimmed = name.trim()
  const now = new Date().toISOString()
  const project: Node = {
    id: uuidv7(),
    userId: '',
    parentId: areaId,
    kind: 'project',
    rank: between(lastSiblingRank(areaId, allNodes), null),
    content: trimmed,
    note: null,
    dueDate: null,
    dueTime: null,
    durationMin: null,
    recurrence: null,
    priority: null,
    tagIds: [],
    color,
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
  await enqueueNode(project)
  return project.id
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

/**
 * Patch name, color, parentId, or isFavorite on any node.
 *
 * Invariants enforced before writing anything:
 *   - area.parentId must stay null (areas are always root-level)
 *   - project.parentId must be null or the id of a kind='area' node
 * Any violation → no write, returns false.
 */
export async function updateNodeMeta(
  id: string,
  patch: Partial<Pick<Node, 'content' | 'color' | 'parentId' | 'isFavorite'>>,
  allNodes: Node[],
): Promise<boolean> {
  const node = allNodes.find((n) => n.id === id)
  if (!node) return false

  const updated: Node = { ...node, ...patch, updatedAt: new Date().toISOString() }

  // Validate invariants for areas and projects
  if (updated.kind === 'area') {
    if (updated.parentId !== null) return false
  } else if (updated.kind === 'project') {
    if (updated.parentId !== null) {
      const parent = allNodes.find((n) => n.id === updated.parentId)
      if (!parent || parent.kind !== 'area') return false
    }
  }

  await enqueueNode(updated)
  return true
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

/**
 * Collects all descendants of a node (recursive, using allNodes as the
 * in-memory tree). Returns every node in the subtree including the root.
 */
function collectSubtree(rootId: string, allNodes: Node[]): Node[] {
  const result: Node[] = []
  const queue = [rootId]
  while (queue.length > 0) {
    const id = queue.shift()!
    const node = allNodes.find((n) => n.id === id)
    if (node) {
      result.push(node)
      // Enqueue children
      allNodes.filter((n) => n.parentId === id).forEach((n) => queue.push(n.id))
    }
  }
  return result
}

/**
 * Soft-deletes a node and all its descendants in a single Dexie transaction.
 * All soft-deleted nodes go into the outbox so sync picks them up.
 */
export async function deleteWithDescendants(id: string, allNodes: Node[]): Promise<void> {
  const subtree = collectSubtree(id, allNodes)
  if (subtree.length === 0) return

  const now = new Date().toISOString()
  const deleted = subtree.map((n) => ({ ...n, deletedAt: now, updatedAt: now }))
  await enqueueNodes(deleted)
}

/**
 * Counts direct project children and all task (item-only) descendants
 * under a given node. Used for the delete confirmation dialog.
 * Sections are structural headings, not user tasks — excluded from count.
 */
export function countDescendants(id: string, allNodes: Node[]): { projects: number; tasks: number } {
  const subtree = collectSubtree(id, allNodes).filter((n) => n.id !== id)
  return {
    projects: subtree.filter((n) => n.kind === 'project').length,
    tasks: subtree.filter((n) => n.kind === 'item').length,
  }
}

// ---------------------------------------------------------------------------
// QUICK-ADD (#project token)
// ---------------------------------------------------------------------------

/**
 * Resolves `#name` to an existing project's id, creating a root project if
 * nothing matches. Returns `null` only when `query` is blank.
 * Quick-add never assigns an area — that would require user intent (spec §B).
 */
export async function resolveOrCreateProjectId(query: string, allNodes: Node[]): Promise<string | null> {
  const trimmed = query.trim()
  if (!trimmed) return null
  const normalized = trimmed.toLowerCase()

  const found = allNodes.find((n) => n.kind === 'project' && n.content.toLowerCase() === normalized)
  if (found) return found.id

  const now = new Date().toISOString()
  const project: Node = {
    id: uuidv7(),
    userId: '',
    parentId: null,
    kind: 'project',
    rank: between(lastSiblingRank(null, allNodes), null),
    content: trimmed,
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
  await enqueueNode(project)
  allNodes.push(project) // so a second #name later in the same batch resolves here, not a duplicate
  return project.id
}
