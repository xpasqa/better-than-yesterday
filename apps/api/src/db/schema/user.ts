import { bigint, boolean, pgTable, smallint, text, time, timestamp } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

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
  // sql`` literal, not BigInt(...): drizzle-kit's snapshot serializer
  // crashes on JSON.stringify(BigInt) when diffing a raw BigInt default.
  storageQuotaBytes: bigint('storage_quota_bytes', { mode: 'bigint' }).notNull().default(sql`10737418240`),

  // Finance — spec 30.finance §5.5. Menempel di app_user seperti preferensi
  // lain supaya ikut PATCH /api/me dan Finance tidak butuh endpoint setting.
  financeBusinessEnabled: boolean('finance_business_enabled').notNull().default(false),
  financeSavingsTargetMode: text('finance_savings_target_mode'), // 'amount' | 'percent'
  financeSavingsTargetValue: bigint('finance_savings_target_value', { mode: 'number' }),
})
