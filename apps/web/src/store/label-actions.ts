// Labels are entities, not strings (1.todo/spec.md §3.2) — renaming one
// must not touch a single `node` row, so `node.labelIds` always holds ids,
// resolved here from the `$name` text quick-add produces.
import { uuidv7 } from '@better/core/id'
import { between } from '@better/core/rank'
import type { Label } from '@better/core/label'
import { db } from './db.ts'
import { triggerSync } from './sync-client.ts'

/** Default color for labels created implicitly via quick-add's `$name` token. */
const DEFAULT_LABEL_COLOR = '#dc4c3e'

async function enqueueLabel(label: Label): Promise<void> {
  await db.transaction('rw', db.labels, db.outbox, async () => {
    await db.labels.put(label)
    await db.outbox.put({ key: `label:${label.id}`, entityType: 'label', payload: label })
  })
  triggerSync()
}

async function createLabel(name: string, color: string, existing: Label[]): Promise<Label> {
  const lastRank = existing.length > 0 ? existing.reduce((a, b) => (a.rank > b.rank ? a : b)).rank : null
  const now = new Date().toISOString()
  const label: Label = {
    id: uuidv7(),
    userId: '', // filled in by the server from the session; the client value is never trusted
    name,
    color,
    isFavorite: false,
    rank: between(lastRank, null),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    seq: 0,
  }
  await enqueueLabel(label)
  return label
}

/** Creates a new label with the given name and color. Returns the new label. */
export async function createLabelFromUI(name: string, color: string): Promise<Label> {
  const existing = await db.labels.filter((l) => l.deletedAt === null).toArray()
  return createLabel(name, color, existing)
}

/**
 * Turns quick-add's `$name` matches into label ids, creating any label that
 * doesn't exist yet (case-insensitive match) rather than dropping it —
 * quick-add never silently discards a recognized token.
 */
export async function resolveOrCreateLabelIds(names: string[]): Promise<string[]> {
  if (names.length === 0) return []
  const active = await db.labels.filter((l) => l.deletedAt === null).toArray()
  const ids: string[] = []
  for (const name of names) {
    const normalized = name.toLowerCase()
    const found = active.find((l) => l.name.toLowerCase() === normalized)
    if (found) {
      ids.push(found.id)
      continue
    }
    const created = await createLabel(name, DEFAULT_LABEL_COLOR, active)
    active.push(created) // so a repeated name later in the same call resolves to it, not a duplicate
    ids.push(created.id)
  }
  return ids
}
