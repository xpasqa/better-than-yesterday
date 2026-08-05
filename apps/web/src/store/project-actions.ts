// Projects are just nodes with kind='project' (spec induk §2.1) — creating
// one from quick-add's `#name` mirrors exactly how label-actions.ts handles
// `$name`: match an existing one case-insensitively by name, or create a
// new root if nothing matches. `#name` never silently falls back to Inbox
// when it could instead give the user the project they typed, per
// 1.todo/spec.md §5 ("never discard a recognized token").
import { uuidv7 } from '@better/core/id'
import { between } from '@better/core/rank'
import type { Node } from '@better/core/node'
import { db } from './db.ts'
import { triggerSync } from './sync-client.ts'

async function enqueueNode(node: Node): Promise<void> {
  await db.transaction('rw', db.nodes, db.outbox, async () => {
    await db.nodes.put(node)
    await db.outbox.put({ key: `node:${node.id}`, entityType: 'node', payload: node })
  })
  triggerSync()
}

/** Resolves `#name` to an existing project's id, creating one if nothing matches. Returns `null` only when `query` itself is empty. */
export async function resolveOrCreateProjectId(query: string, allNodes: Node[]): Promise<string | null> {
  const trimmed = query.trim()
  if (!trimmed) return null

  const normalized = trimmed.toLowerCase()
  const found = allNodes.find((n) => n.kind === 'project' && n.content.toLowerCase() === normalized)
  if (found) return found.id

  const roots = allNodes.filter((n) => n.parentId === null)
  const lastRank = roots.length > 0 ? roots.reduce((a, b) => (a.rank > b.rank ? a : b)).rank : null
  const now = new Date().toISOString()
  const project: Node = {
    id: uuidv7(),
    userId: '',
    parentId: null,
    kind: 'project',
    rank: between(lastRank, null),
    content: trimmed,
    note: null,
    dueDate: null,
    dueTime: null,
    durationMin: null,
    recurrence: null,
    priority: null,
    labelIds: [],
    color: null,
    isFavorite: false,
    isInbox: false,
    collapsed: false,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    seq: 0,
  }
  await enqueueNode(project)
  allNodes.push(project) // so a second #name later in the same batch resolves to it, not a duplicate
  return project.id
}
