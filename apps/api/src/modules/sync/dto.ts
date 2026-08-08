// Wire shapes for /api/sync. Field names are camelCase (matching
// packages/core's `Node` type) — the db layer maps to snake_case, this
// layer maps JSON to and from it.
import { z } from 'zod'

export const nodeDto = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  kind: z.enum(['area', 'project', 'section', 'item']),
  rank: z.string().min(1),
  content: z.string().max(2000),
  note: z.string().nullable(),
  dueDate: z.string().date().nullable(),
  dueTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .nullable(),
  durationMin: z.number().int().positive().nullable(),
  recurrence: z
    .string()
    .regex(
      /^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;INTERVAL=\d+|;BYDAY=[A-Z]{2}(,[A-Z]{2})*|;BYMONTHDAY=\d{1,2}|;BYMONTH=\d{1,2};BYMONTHDAY=\d{1,2})?$/,
    )
    .nullable(),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  tagIds: z.array(z.string()),
  color: z.string().nullable(),
  isFavorite: z.boolean(),
  isInbox: z.boolean(),
  isSomeday: z.boolean(),
  collapsed: z.boolean(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
})
export type NodeDto = z.infer<typeof nodeDto>

// name has no spaces — it's the literal $name token (1.todo/spec.md §3.2).
export const tagDto = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(60).regex(/^\S+$/),
  color: z.string(),
  isFavorite: z.boolean(),
  rank: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
})
export type TagDto = z.infer<typeof tagDto>

// A completion row never changes after it's written (1.todo/spec.md §8) —
// no updatedAt/deletedAt here, unlike node and tag.
export const completionDto = z.object({
  id: z.string().uuid(),
  nodeId: z.string().uuid(),
  completedAt: z.string().datetime(),
  occurredOn: z.string().date().nullable(),
})
export type CompletionDto = z.infer<typeof completionDto>

const MAX_BATCH = 500

export const syncRequest = z.object({
  cursor: z.string().regex(/^\d+$/),
  changes: z.object({
    nodes: z.array(nodeDto).max(MAX_BATCH).default([]),
    tags: z.array(tagDto).max(MAX_BATCH).default([]),
    completions: z.array(completionDto).max(MAX_BATCH).default([]),
  }),
})
export type SyncRequest = z.infer<typeof syncRequest>
