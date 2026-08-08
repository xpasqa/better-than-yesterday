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

/** Result type for mutations that must report errors to the caller. */
export type TagMutationResult = { ok: true } | { ok: false; reason: string }

/**
 * Validates a tag name: 1–60 chars after trim, no spaces.
 * Same rule as createTag — names are `$token` tokens in quick-add.
 */
function validateTagName(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length === 0) return 'Name must not be empty'
  if (trimmed.length > 60) return 'Name must be 60 characters or fewer'
  if (/\s/.test(trimmed)) return 'Name must not contain spaces'
  return null
}

/**
 * Updates a tag's name and/or color. Returns `{ok:true}` on success or
 * `{ok:false, reason}` on validation/conflict failure — never throws.
 *
 * Name rules: 1–60 chars after trim, no spaces, case-insensitively unique
 * among live tags. Enforcing uniqueness here prevents the ambiguity that
 * `resolveOrCreateTagIds` would face when matching `$name` tokens.
 */
export async function updateTag(
  id: string,
  patch: { name?: string; color?: string },
): Promise<TagMutationResult> {
  const existing = await db.tags.get(id)
  if (!existing || existing.deletedAt !== null) {
    return { ok: false, reason: 'Tag not found' }
  }

  let name = existing.name
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim()
    const error = validateTagName(trimmed)
    if (error) return { ok: false, reason: error }

    // Reject duplicate names (case-insensitive) among other live tags
    const active = await db.tags.filter((t) => t.deletedAt === null && t.id !== id).toArray()
    const conflict = active.find((t) => t.name.toLowerCase() === trimmed.toLowerCase())
    if (conflict) return { ok: false, reason: `Tag "${conflict.name}" already exists` }

    name = trimmed
  }

  const color = patch.color ?? existing.color
  const now = new Date().toISOString()
  const updated: Tag = { ...existing, name, color, updatedAt: now }
  await enqueueTag(updated)
  return { ok: true }
}

/**
 * Soft-deletes a tag by setting `deletedAt`. Does NOT touch `node.tagIds` —
 * the render layer already filters orphaned ids via `.filter(Boolean)`, so
 * the tag silently disappears from all task displays without any node writes.
 */
export async function deleteTag(id: string): Promise<void> {
  const existing = await db.tags.get(id)
  if (!existing || existing.deletedAt !== null) return
  const now = new Date().toISOString()
  const deleted: Tag = { ...existing, deletedAt: now, updatedAt: now }
  await enqueueTag(deleted)
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
