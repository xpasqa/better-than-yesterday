// Mirrors the `label` table — docs/feature/2.backend/1.todo/spec.md §3.2.
// A label is an entity (not a bare string) so renaming one takes effect
// everywhere without rewriting every node that references it: `node.labelIds`
// stores ids, never names.
export interface Label {
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
