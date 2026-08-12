import { Hono } from 'hono'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { mailAccount } from '../../db/schema/mail.ts'
import { encryptSecret, decryptSecret } from '../../http/crypto.ts'
import { AppError } from '../../http/errors.ts'
import { testConnection, MailAuthError, MailUnavailableError, MailFoldersUnresolvedError } from './client.ts'
import { uuidv7 } from '@better/core/id'

export const mailAccountRoutes = new Hono()

const putBody = z.object({
  email: z.string().email(),
  password: z.string().optional(),  // kosong = pertahankan yang lama
  imapHost: z.string().min(1),
  imapPort: z.coerce.number().int().positive(),
  smtpHost: z.string().min(1),
  smtpPort: z.coerce.number().int().positive(),
})

function toMailError(err: unknown): never {
  if (err instanceof MailAuthError) throw new AppError('MAIL_AUTH_FAILED', 401, err.message)
  if (err instanceof MailUnavailableError) throw new AppError('MAIL_UNAVAILABLE', 503 as AppError['status'], err.message)
  if (err instanceof MailFoldersUnresolvedError) throw new AppError('MAIL_FOLDERS_UNRESOLVED', 422, err.message, { missing: err.missing })
  throw err
}

// GET /api/mail/account
mailAccountRoutes.get('/mail/account', async (c) => {
  const userId = c.get('userId') as string
  const [row] = await db.select().from(mailAccount).where(eq(mailAccount.userId, userId)).limit(1)
  if (!row) throw new AppError('MAIL_NOT_CONFIGURED', 404, 'No mail account configured')

  return c.json({
    email: row.email,
    imapHost: row.imapHost,
    imapPort: Number(row.imapPort),
    smtpHost: row.smtpHost,
    smtpPort: Number(row.smtpPort),
    hasPassword: true,  // never expose password
    folderInbox: row.folderInbox,
    folderSent: row.folderSent,
    folderDrafts: row.folderDrafts,
    folderJunk: row.folderJunk,
    folderTrash: row.folderTrash,
  })
})

// PUT /api/mail/account — upsert, test connection first
mailAccountRoutes.put('/mail/account', async (c) => {
  const userId = c.get('userId') as string
  const body = putBody.safeParse(await c.req.json())
  if (!body.success) throw new AppError('VALIDATION_ERROR', 422, 'Invalid input', body.error.flatten())

  const { email, imapHost, imapPort, smtpHost, smtpPort } = body.data

  // Determine password: use new one or keep existing
  let passwordPlain: string
  const [existing] = await db.select().from(mailAccount).where(eq(mailAccount.userId, userId)).limit(1)

  if (body.data.password && body.data.password.length > 0) {
    passwordPlain = body.data.password
  } else if (existing) {
    passwordPlain = decryptSecret(existing.passwordEnc)
  } else {
    throw new AppError('VALIDATION_ERROR', 422, 'Password required for new account')
  }

  // Test connection BEFORE writing — fail early
  let folderMap: Awaited<ReturnType<typeof testConnection>>
  try {
    folderMap = await testConnection({ email, password: passwordPlain, imapHost, imapPort, smtpHost, smtpPort })
  } catch (err) {
    toMailError(err)
  }

  const passwordEnc = encryptSecret(passwordPlain)
  const now = new Date()

  if (existing) {
    await db.update(mailAccount).set({
      email, imapHost, imapPort: String(imapPort), smtpHost, smtpPort: String(smtpPort),
      passwordEnc,
      folderInbox: folderMap!.roles.inbox,
      folderSent: folderMap!.roles.sent,
      folderDrafts: folderMap!.roles.drafts,
      folderJunk: folderMap!.roles.junk,
      folderTrash: folderMap!.roles.trash,
      folderRoleSource: folderMap!.sources,
      updatedAt: now,
    }).where(eq(mailAccount.userId, userId))
  } else {
    await db.insert(mailAccount).values({
      id: uuidv7(),
      userId, email, imapHost, imapPort: String(imapPort), smtpHost, smtpPort: String(smtpPort),
      passwordEnc,
      folderInbox: folderMap!.roles.inbox,
      folderSent: folderMap!.roles.sent,
      folderDrafts: folderMap!.roles.drafts,
      folderJunk: folderMap!.roles.junk,
      folderTrash: folderMap!.roles.trash,
      folderRoleSource: folderMap!.sources,
      createdAt: now,
      updatedAt: now,
    })
  }

  return c.json({ ok: true })
})

// DELETE /api/mail/account
mailAccountRoutes.delete('/mail/account', async (c) => {
  const userId = c.get('userId') as string
  await db.delete(mailAccount).where(eq(mailAccount.userId, userId))
  return c.body(null, 204)
})

// POST /api/mail/account/test — test without saving
mailAccountRoutes.post('/mail/account/test', async (c) => {
  const userId = c.get('userId') as string
  const body = putBody.safeParse(await c.req.json())
  if (!body.success) throw new AppError('VALIDATION_ERROR', 422, 'Invalid input', body.error.flatten())

  const { email, imapHost, imapPort, smtpHost, smtpPort } = body.data
  let passwordPlain = body.data.password ?? ''

  if (!passwordPlain) {
    const [existing] = await db.select().from(mailAccount).where(eq(mailAccount.userId, userId)).limit(1)
    if (existing) passwordPlain = decryptSecret(existing.passwordEnc)
    else throw new AppError('VALIDATION_ERROR', 422, 'Password required')
  }

  try {
    const folderMap = await testConnection({ email, password: passwordPlain, imapHost, imapPort, smtpHost, smtpPort })
    return c.json({ ok: true, folders: folderMap.roles })
  } catch (err) {
    toMailError(err)
  }
})
