// docs/feature/2.backend/1.todo/spec.md §8 — the only table not asked for
// directly by any view; without it, completing a recurring task would leave
// nothing behind in Completed.
import { bigint, date, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { appUser } from './user.ts'
import { node } from './node.ts'

export const completion = pgTable('completion', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => appUser.id, { onDelete: 'cascade' }),
  nodeId: text('node_id')
    .notNull()
    .references(() => node.id, { onDelete: 'cascade' }),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
  occurredOn: date('occurred_on', { mode: 'string' }),
  seq: bigint('seq', { mode: 'bigint' })
    .notNull()
    .default(sql`nextval('sync_seq')`),
})
