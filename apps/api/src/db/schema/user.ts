import { bigint, pgTable, smallint, text, time, timestamp } from 'drizzle-orm/pg-core'

export const appUser = pgTable('app_user', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull().default(''),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

  // Preferences — spec induk: timezone lives on the user, not the device.
  timezone: text('timezone').notNull().default('Asia/Jakarta'),
  weekStart: smallint('week_start').notNull().default(1), // 1 = Monday
  defaultRemindTime: time('default_remind_time').notNull().default('09:00'),
  digestTime: time('digest_time'), // null = digest off
  language: text('language').notNull().default('id'),

  // Storage quota in bytes — default 10 GiB (storage spec §7)
  storageQuotaBytes: bigint('storage_quota_bytes', { mode: 'bigint' }).notNull().default(BigInt(10737418240)),
})
