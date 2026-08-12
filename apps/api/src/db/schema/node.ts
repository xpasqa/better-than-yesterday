// docs/feature/2.backend/1.todo/spec.md §3.1 — the single table behind both
// Todo and Outline. Every column here has a one-sentence reason in that
// spec; this file only declares shape, it does not re-argue it.
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { appUser } from './user.ts'
// `sync_seq` itself is declared in sync-seq.ts and picked up by drizzle-kit
// from the schema glob — referenced here only by name in the SQL default.

export const node = pgTable(
  'node',
  {
    id: text('id').primaryKey(), // UUIDv7, client-generated
    userId: text('user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    parentId: text('parent_id').references((): AnyPgColumn => node.id),
    kind: text('kind', { enum: ['area', 'project', 'section', 'item', 'note'] }).notNull().default('item'),
    rank: text('rank').notNull(),
    content: text('content').notNull().default(''),
    note: text('note'),
    // kind='note' only — the task this Outline row links to via #project
    // (32.outline-task-decoupling/spec.md §3.2). No cascade: deletion on
    // either side is independent (spec §7).
    linkedTaskId: text('linked_task_id').references((): AnyPgColumn => node.id),

    dueDate: date('due_date', { mode: 'string' }),
    dueTime: time('due_time'),
    durationMin: integer('duration_min'),
    recurrence: text('recurrence'),

    priority: smallint('priority'),
    tagIds: text('tag_ids').array().notNull().default(sql`'{}'::text[]`),
    color: text('color'),
    isFavorite: boolean('is_favorite').notNull().default(false),
    isInbox: boolean('is_inbox').notNull().default(false),
    isSomeday: boolean('is_someday').notNull().default(false),
    collapsed: boolean('collapsed').notNull().default(false),

    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(), // client-stamped — LWW basis
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    seq: bigint('seq', { mode: 'bigint' })
      .notNull()
      .default(sql`nextval('sync_seq')`),
  },
  (table) => [
    index('node_user_parent').on(table.userId, table.parentId),
    index('node_user_seq').on(table.userId, table.seq),
    index('node_due_open')
      .on(table.userId, table.dueDate)
      .where(sql`${table.completedAt} is null and ${table.deletedAt} is null`),
    uniqueIndex('node_one_inbox_per_user').on(table.userId).where(sql`${table.isInbox}`),
    check('node_kind_check', sql`${table.kind} in ('area','project','section','item','note')`),
    check('node_priority_check', sql`${table.priority} is null or ${table.priority} between 1 and 3`),
    check('node_content_length', sql`length(${table.content}) <= 2000`),
    check('node_time_needs_date', sql`${table.dueTime} is null or ${table.dueDate} is not null`),
    check('node_recur_needs_date', sql`${table.recurrence} is null or ${table.dueDate} is not null`),
  ],
)
