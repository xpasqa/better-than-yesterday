// docs/feature/mail-imap/spec.md — tabel konfigurasi akun mail per user.
import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { appUser } from './user.ts'

export const mailAccount = pgTable('mail_account', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => appUser.id, { onDelete: 'cascade' }).unique(),
  email: text('email').notNull(),
  // IMAP
  imapHost: text('imap_host').notNull(),
  imapPort: text('imap_port').notNull(),
  // SMTP
  smtpHost: text('smtp_host').notNull(),
  smtpPort: text('smtp_port').notNull(),
  // Password tersimpan terenkripsi
  passwordEnc: text('password_enc').notNull(),
  // Lima path peran folder (null = belum ditemukan)
  folderInbox: text('folder_inbox'),
  folderSent: text('folder_sent'),
  folderDrafts: text('folder_drafts'),
  folderJunk: text('folder_junk'),
  folderTrash: text('folder_trash'),
  // Source deteksi per-peran (jsonb)
  folderRoleSource: jsonb('folder_role_source'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
