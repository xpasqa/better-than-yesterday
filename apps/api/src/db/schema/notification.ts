// docs/feature/2.backend/1.todo/spec.md §3.5 — server-created, client only
// marks read; never written by a client sync push.
import { bigint, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { appUser } from './user.ts'
import { node } from './node.ts'

export const notification = pgTable('notification', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => appUser.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ['reminder', 'digest', 'overdue'] }).notNull(),
  nodeId: text('node_id').references(() => node.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  body: text('body').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp('read_at', { withTimezone: true }),
  seq: bigint('seq', { mode: 'bigint' })
    .notNull()
    .default(sql`nextval('sync_seq')`),
})
