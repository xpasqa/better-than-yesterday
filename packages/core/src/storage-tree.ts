// Storage folder cycle detection — same pattern as core/tree.ts §wouldCreateCycle.
// docs/feature/2.backend/4.storage/spec.md §8 (folder move safety)
// Pure function — no I/O.

export interface FolderLike {
  id: string
  parentId: string | null
}

/**
 * Returns true if setting `folderId`'s parent to `newParentId` would
 * create a cycle (a folder becoming its own ancestor).
 * A dangling parentId (not in `folders`) is treated as not a cycle — the
 * caller may have a partial view.
 */
export function wouldCreateCycle(
  folders: FolderLike[],
  folderId: string,
  newParentId: string | null,
): boolean {
  if (newParentId === null) return false
  if (newParentId === folderId) return true

  const byId = new Map(folders.map((f) => [f.id, f]))
  const visited = new Set<string>()
  let current: string | null = newParentId

  while (current !== null) {
    if (current === folderId) return true
    if (visited.has(current)) return true // pre-existing cycle — refuse to extend
    visited.add(current)
    const folder = byId.get(current)
    if (!folder) return false // dangling reference — not a cycle from our view
    current = folder.parentId
  }

  return false
}
