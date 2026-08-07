// Mirrors the `completion` table — docs/feature/2.backend/1.todo/spec.md §8.
// The trail a recurring task leaves behind: completing one never closes the
// task (its due_date just advances instead), so without this row Completed
// and any "days in a row" stat would have nothing to show for it. Rows here
// are write-once — nothing ever updates a completion after it's created.
export interface Completion {
  id: string
  userId: string
  nodeId: string
  completedAt: string // ISO timestamp
  occurredOn: string | null // 'YYYY-MM-DD' — the due_date occurrence that was completed
  seq: number
}
