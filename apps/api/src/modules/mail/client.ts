// IMAP/SMTP connection helpers — always accept config as parameter,
// never read process.env directly.
import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'
import { resolveFolderRoles } from '@better/core/mail-folders'
import type { ImapMailbox } from '@better/core/mail-folders'

export interface MailConfig {
  email: string
  password: string       // plaintext (already decrypted by caller)
  imapHost: string
  imapPort: number
  smtpHost: string
  smtpPort: number
}

export class MailAuthError extends Error {
  readonly code = 'MAIL_AUTH_FAILED' as const
  readonly status = 401
}
export class MailUnavailableError extends Error {
  readonly code = 'MAIL_UNAVAILABLE' as const
  readonly status = 503
}
export class MailFoldersUnresolvedError extends Error {
  readonly code = 'MAIL_FOLDERS_UNRESOLVED' as const
  readonly status = 422
  readonly missing: string[]
  constructor(missing: string[]) {
    super(`Folder roles unresolved: ${missing.join(', ')}`)
    this.missing = missing
  }
}

/**
 * Opens an IMAP connection, runs fn, then always closes the connection.
 * disableAutoIdle: true — our connections are short, IDLE adds unnecessary round-trips.
 */
export async function withImap<T>(
  config: MailConfig,
  fn: (client: ImapFlow) => Promise<T>,
): Promise<T> {
  const client = new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: true,
    auth: { user: config.email, pass: config.password },
    logger: false,
    disableAutoIdle: true,
  })
  try {
    await client.connect()
    return await fn(client)
  } catch (err: unknown) {
    const msg = String((err as Error).message ?? '')
    if (msg.includes('auth') || msg.includes('credentials') || msg.includes('LOGIN') || msg.includes('AUTHENTICATE')) {
      throw new MailAuthError('IMAP authentication failed')
    }
    throw new MailUnavailableError(`IMAP unavailable: ${msg}`)
  } finally {
    await client.logout().catch(() => {/* ignore logout errors */})
  }
}

/** Creates a nodemailer SMTP transport (not yet connected — call verify() to test). */
export function smtpTransport(config: MailConfig) {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: true,
    auth: { user: config.email, pass: config.password },
  })
}

/**
 * Tests both IMAP login + folder resolution and SMTP verify.
 * Returns the resolved FolderRoleMap on success.
 * Throws MailAuthError | MailUnavailableError | MailFoldersUnresolvedError.
 */
export async function testConnection(config: MailConfig) {
  // Test IMAP + resolve folder roles
  const folderMap = await withImap(config, async (client) => {
    const rawList = await client.list()
    const mailboxes: ImapMailbox[] = rawList.map(m => ({
      path: m.path,
      name: m.name,
      specialUse: (m as unknown as { specialUse?: string }).specialUse,
    }))
    return resolveFolderRoles(mailboxes)
  })

  if (folderMap.missing.length > 0) {
    throw new MailFoldersUnresolvedError(folderMap.missing)
  }

  // Test SMTP
  const transport = smtpTransport(config)
  try {
    await transport.verify()
  } catch (err: unknown) {
    const msg = String((err as Error).message ?? '')
    if (msg.includes('auth') || msg.includes('credentials') || msg.includes('535')) {
      throw new MailAuthError('SMTP authentication failed')
    }
    throw new MailUnavailableError(`SMTP unavailable: ${msg}`)
  } finally {
    transport.close()
  }

  return folderMap
}
