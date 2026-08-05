// docs/feature/2.backend/1.todo/spec.md §3.3
import { bigint, boolean, check, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { appUser } from './user.ts'

export const savedFilter = pgTable(
  'saved_filter',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    query: text('query').notNull(), // the filter language, §7
    color: text('color').notNull().default('grey'),
    isFavorite: boolean('is_favorite').notNull().default(false),
    rank: text('rank').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    seq: bigint('seq', { mode: 'bigint' })
      .notNull()
      .default(sql`nextval('sync_seq')`),
  },
  (table) => [
    index('saved_filter_user_seq').on(table.userId, table.seq),
    check('saved_filter_name_shape', sql`length(trim(${table.name})) between 1 and 60`),
  ],
)
