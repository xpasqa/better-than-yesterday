// Tags are entities, not strings (1.todo/spec.md §3.2) — renaming one
// must not touch a single `node` row, so `node.tagIds` always holds ids,
// resolved here from the `$name` text quick-add produces.
import { uuidv7 } from '@better/core/id'
import { between } from '@better/core/rank'
import type { Tag } from '@better/core/tag'
import { db } from './db.ts'
import { triggerSync } from './sync-client.ts'

/** Default color for tags created implicitly via quick-add's `$name` token. */
const DEFAULT_TAG_COLOR = '#dc4c3e'

async function enqueueTag(tag: Tag): Promise<void> {
  await db.transaction('rw', db.tags, db.outbox, async () => {
    await db.tags.put(tag)
    await db.outbox.put({ key: `tag:${tag.id}`, entityType: 'tag', payload: tag })
  })
  triggerSync()
}

async function createTag(name: string, color: string, existing: Tag[]): Promise<Tag> {
  const lastRank = existing.length > 0 ? existing.reduce((a, b) => (a.rank > b.rank ? a : b)).rank : null
  const now = new Date().toISOString()
  const tag: Tag = {
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
  await enqueueTag(tag)
  return tag
}

/** Creates a new tag with the given name and color. Returns the new tag. */
export async function createTagFromUI(name: string, color: string): Promise<Tag> {
  const existing = await db.tags.filter((t) => t.deletedAt === null).toArray()
  return createTag(name, color, existing)
}

/**
 * Turns quick-add's `$name` matches into tag ids, creating any tag that
 * doesn't exist yet (case-insensitive match) rather than dropping it —
 * quick-add never silently discards a recognized token.
 */
export async function resolveOrCreateTagIds(names: string[]): Promise<string[]> {
  if (names.length === 0) return []
  const active = await db.tags.filter((t) => t.deletedAt === null).toArray()
  const ids: string[] = []
  for (const name of names) {
    const normalized = name.toLowerCase()
    const found = active.find((t) => t.name.toLowerCase() === normalized)
    if (found) {
      ids.push(found.id)
      continue
    }
    const created = await createTag(name, DEFAULT_TAG_COLOR, active)
    active.push(created) // so a repeated name later in the same call resolves to it, not a duplicate
    ids.push(created.id)
  }
  return ids
}
