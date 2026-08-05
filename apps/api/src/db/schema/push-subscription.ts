// docs/feature/2.backend/1.todo/spec.md §3.6 — belongs to a device, not to
// data, so it never travels through /sync.
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { appUser } from './user.ts'

export const pushSubscription = pgTable('push_subscription', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => appUser.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: text('user_agent').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  failedAt: timestamp('failed_at', { withTimezone: true }),
})
