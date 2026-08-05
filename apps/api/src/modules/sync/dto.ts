// Wire shapes for /api/sync. Field names are camelCase (matching
// packages/core's `Node` type) — the db layer maps to snake_case, this
// layer maps JSON to and from it.
import { z } from 'zod'

export const nodeDto = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  kind: z.enum(['project', 'section', 'item']),
  rank: z.string().min(1),
  content: z.string().max(2000),
  note: z.string().nullable(),
  dueDate: z.string().date().nullable(),
  dueTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .nullable(),
  durationMin: z.number().int().positive().nullable(),
  recurrence: z.string().nullable(),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  labelIds: z.array(z.string()),
  color: z.string().nullable(),
  isFavorite: z.boolean(),
  isInbox: z.boolean(),
  collapsed: z.boolean(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
})
export type NodeDto = z.infer<typeof nodeDto>

const MAX_BATCH = 500

export const syncRequest = z.object({
  cursor: z.string().regex(/^\d+$/),
  changes: z.object({
    nodes: z.array(nodeDto).max(MAX_BATCH).default([]),
  }),
})
export type SyncRequest = z.infer<typeof syncRequest>
