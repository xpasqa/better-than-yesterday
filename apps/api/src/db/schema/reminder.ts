// docs/feature/2.backend/1.todo/spec.md §3.4. `fireAt` is computed client-side
// from due_date/due_time/offset in the user's timezone, so the server-side
// scheduler never has to know what timezone means for this row.
import { bigint, check, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { appUser } from './user.ts'
import { node } from './node.ts'

export const reminder = pgTable(
  'reminder',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    nodeId: text('node_id')
      .notNull()
      .references(() => node.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['absolute', 'relative'] }).notNull(),
    remindAt: timestamp('remind_at', { withTimezone: true }), // kind='absolute'
    offsetMin: integer('offset_min'), // kind='relative', before due_time
    fireAt: timestamp('fire_at', { withTimezone: true }).notNull(),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    seq: bigint('seq', { mode: 'bigint' })
      .notNull()
      .default(sql`nextval('sync_seq')`),
  },
  (table) => [
    index('reminder_due').on(table.fireAt).where(sql`${table.deliveredAt} is null and ${table.deletedAt} is null`),
    check(
      'reminder_shape',
      sql`(${table.kind} = 'absolute' and ${table.remindAt} is not null) or (${table.kind} = 'relative' and ${table.offsetMin} is not null)`,
    ),
  ],
)
