// dto.ts — helpers shared between message route handlers.
// Loads a user's mail account from DB and decrypts credentials.
import { eq } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { mailAccount } from '../../db/schema/mail.ts'
import { decryptSecret } from '../../http/crypto.ts'
import { AppError } from '../../http/errors.ts'
import type { MailConfig } from './client.ts'
import type { MailRole } from '@better/core/mail-folders'

export interface AccountWithConfig {
  config: MailConfig
  roles: Record<MailRole, string>  // role → IMAP path
}

/** Load akun mail user, throw 404 jika tidak ada atau folder belum resolved. */
export async function loadMailAccount(userId: string): Promise<AccountWithConfig> {
  const [row] = await db.select().from(mailAccount).where(eq(mailAccount.userId, userId)).limit(1)
  if (!row) throw new AppError('MAIL_NOT_CONFIGURED', 404, 'No mail account configured')
  if (!row.folderInbox || !row.folderSent || !row.folderDrafts || !row.folderJunk || !row.folderTrash) {
    throw new AppError('MAIL_FOLDERS_UNRESOLVED', 422, 'Folder roles not resolved, run test connection again')
  }
  return {
    config: {
      email: row.email,
      password: decryptSecret(row.passwordEnc),
      imapHost: row.imapHost,
      imapPort: Number(row.imapPort),
      smtpHost: row.smtpHost,
      smtpPort: Number(row.smtpPort),
    },
    roles: {
      inbox: row.folderInbox,
      sent: row.folderSent,
      drafts: row.folderDrafts,
      junk: row.folderJunk,
      trash: row.folderTrash,
    },
  }
}
