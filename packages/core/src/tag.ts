// Mirrors the `tag` table — docs/feature/2.backend/1.todo/spec.md §3.2.
// A tag is an entity (not a bare string) so renaming one takes effect
// everywhere without rewriting every node that references it: `node.tagIds`
// stores ids, never names.
export interface Tag {
  id: string
  userId: string
  name: string // no spaces — the $name token
  color: string
  isFavorite: boolean
  rank: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  seq: number
}
