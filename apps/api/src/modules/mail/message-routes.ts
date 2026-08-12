// message-routes.ts — list, fetch, flag, move, send mail via IMAP/SMTP.
// All endpoints require an authenticated session (enforced by /api/* middleware).
import { Hono } from 'hono'
import { z } from 'zod'
import { simpleParser } from 'mailparser'
import type { FetchMessageObject } from 'imapflow'
import { encodeMailId, decodeMailId } from '@better/core/mail-id'
import type { MailRole } from '@better/core/mail-folders'
import { AppError } from '../../http/errors.ts'
import { withImap, smtpTransport, MailAuthError, MailUnavailableError, MailFoldersUnresolvedError } from './client.ts'
import { sanitizeMailHtml } from './sanitize.ts'
import { loadMailAccount } from './dto.ts'

export const mailMessageRoutes = new Hono()

// ─── Types ────────────────────────────────────────────────────────────────────

type MailFolder = 'inbox' | 'sent' | 'drafts' | 'junk' | 'trash'

interface MailMessage {
  id: string
  folder: MailFolder
  sender: string
  senderEmail: string
  subject: string
  body: string
  receivedAt: string
  isRead: boolean
  isFlagged: boolean
  attachments: string[]
  bodyHtml?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// role → MailFolder (frontend type — identical values, but typed separately)
const ROLE_TO_FOLDER: Record<MailRole, MailFolder> = {
  inbox: 'inbox',
  sent: 'sent',
  drafts: 'drafts',
  junk: 'junk',
  trash: 'trash',
}

const ALL_ROLES: MailRole[] = ['inbox', 'sent', 'drafts', 'junk', 'trash']

function toMailError(err: unknown): never {
  if (err instanceof MailAuthError) throw new AppError('MAIL_AUTH_FAILED', 401, err.message)
  if (err instanceof MailUnavailableError) throw new AppError('MAIL_UNAVAILABLE', 503 as AppError['status'], err.message)
  if (err instanceof MailFoldersUnresolvedError) throw new AppError('MAIL_FOLDERS_UNRESOLVED', 422, err.message, { missing: err.missing })
  throw err
}

/** Convert a FetchMessageObject (envelope only) to MailMessage DTO (no body). */
function imapMsgToDto(msg: FetchMessageObject, role: MailRole): MailMessage {
  const env = msg.envelope
  const from = env?.from?.[0]
  return {
    id: encodeMailId(role, msg.uid),
    folder: ROLE_TO_FOLDER[role],
    sender: from?.name ?? from?.address ?? '',
    senderEmail: from?.address ?? '',
    subject: env?.subject ?? '(no subject)',
    body: '',
    receivedAt: (env?.date ?? new Date()).toISOString(),
    isRead: msg.flags?.has('\\Seen') ?? false,
    isFlagged: msg.flags?.has('\\Flagged') ?? false,
    attachments: [],
  }
}

/** Fetch messages from a single folder, newest-first, with optional UID cursor. */
async function fetchFolderMessages(
  client: Parameters<Parameters<typeof withImap>[1]>[0],
  folderPath: string,
  role: MailRole,
  opts: { beforeUid?: number; limit: number },
): Promise<MailMessage[]> {
  await client.mailboxOpen(folderPath, { readOnly: true })

  const range = opts.beforeUid ? (`1:${opts.beforeUid - 1}` as const) : ('1:*' as const)

  const messages: MailMessage[] = []
  for await (const msg of client.fetch(range, {
    uid: true,
    envelope: true,
    flags: true,
    bodyStructure: true,
  }, { uid: true })) {
    messages.push(imapMsgToDto(msg, role))
  }

  // Sort descending by UID (newest first), take limit
  messages.sort((a, b) => {
    const aUid = decodeMailId(a.id).uid
    const bUid = decodeMailId(b.id).uid
    return bUid - aUid
  })
  return messages.slice(0, opts.limit)
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/mail/messages?folder=inbox&beforeUid=100&limit=50
mailMessageRoutes.get('/mail/messages', async (c) => {
  const userId = c.get('userId') as string
  const folder = (c.req.query('folder') ?? 'inbox') as string
  const beforeUid = c.req.query('beforeUid') ? Number(c.req.query('beforeUid')) : undefined
  const limit = c.req.query('limit') ? Math.min(Number(c.req.query('limit')), 200) : 50

  const { config, roles } = await loadMailAccount(userId)

  // Special case: folder=flagged → SEARCH FLAGGED across all 5 folders
  if (folder === 'flagged') {
    try {
      const allFlagged: MailMessage[] = []
      await withImap(config, async (client) => {
        for (const role of ALL_ROLES) {
          const folderPath = roles[role]
          await client.mailboxOpen(folderPath, { readOnly: true })
          const uids = await client.search({ flagged: true }, { uid: true })
          if (!uids || uids.length === 0) continue
          // fetch only flagged UIDs
          const uidRange = uids.join(',')
          for await (const msg of client.fetch(uidRange, {
            uid: true,
            envelope: true,
            flags: true,
          }, { uid: true })) {
            allFlagged.push(imapMsgToDto(msg, role))
          }
        }
      })
      allFlagged.sort((a, b) => {
        const aUid = decodeMailId(a.id).uid
        const bUid = decodeMailId(b.id).uid
        return bUid - aUid
      })
      return c.json({ messages: allFlagged.slice(0, limit) })
    } catch (err) {
      toMailError(err)
    }
  }

  // Validate role
  if (!ALL_ROLES.includes(folder as MailRole)) {
    throw new AppError('VALIDATION_ERROR', 422, `Unknown folder: ${folder}`)
  }
  const role = folder as MailRole

  try {
    const messages = await withImap(config, async (client) => {
      return fetchFolderMessages(client, roles[role], role, { beforeUid, limit })
    })
    return c.json({ messages })
  } catch (err) {
    toMailError(err)
  }
})

// GET /api/mail/messages/:id — full message including HTML body
mailMessageRoutes.get('/mail/messages/:id', async (c) => {
  const userId = c.get('userId') as string
  const rawId = c.req.param('id')

  let decoded: ReturnType<typeof decodeMailId>
  try {
    decoded = decodeMailId(rawId)
  } catch {
    throw new AppError('VALIDATION_ERROR', 422, `Invalid message id: ${rawId}`)
  }
  const { role, uid } = decoded

  const { config, roles } = await loadMailAccount(userId)

  try {
    const message = await withImap(config, async (client) => {
      await client.mailboxOpen(roles[role], { readOnly: true })

      const msg = await client.fetchOne(`${uid}`, {
        uid: true,
        envelope: true,
        flags: true,
        source: true,
      }, { uid: true })

      if (!msg) throw new AppError('NOT_FOUND', 404, 'Message not found')

      const parsed = await simpleParser(msg.source ?? Buffer.alloc(0))
      const bodyHtml = parsed.html ? sanitizeMailHtml(parsed.html) : undefined
      const bodyText = parsed.text ?? ''

      const dto = imapMsgToDto(msg, role)
      return {
        ...dto,
        body: bodyText,
        bodyHtml,
        attachments: (parsed.attachments ?? [])
          .map((a) => a.filename ?? 'attachment')
          .filter((n): n is string => Boolean(n)),
      }
    })
    return c.json(message)
  } catch (err) {
    if (err instanceof AppError) throw err
    toMailError(err)
  }
})

// PATCH /api/mail/messages/:id — { isRead?, isFlagged? }
mailMessageRoutes.patch('/mail/messages/:id', async (c) => {
  const userId = c.get('userId') as string
  const rawId = c.req.param('id')

  let decoded: ReturnType<typeof decodeMailId>
  try {
    decoded = decodeMailId(rawId)
  } catch {
    throw new AppError('VALIDATION_ERROR', 422, `Invalid message id: ${rawId}`)
  }
  const { role, uid } = decoded

  const patchSchema = z.object({
    isRead: z.boolean().optional(),
    isFlagged: z.boolean().optional(),
  })
  const body = patchSchema.parse(await c.req.json())

  const { config, roles } = await loadMailAccount(userId)

  try {
    await withImap(config, async (client) => {
      await client.mailboxOpen(roles[role])
      const uidStr = `${uid}`
      if (body.isRead !== undefined) {
        if (body.isRead) {
          await client.messageFlagsAdd(uidStr, ['\\Seen'], { uid: true })
        } else {
          await client.messageFlagsRemove(uidStr, ['\\Seen'], { uid: true })
        }
      }
      if (body.isFlagged !== undefined) {
        if (body.isFlagged) {
          await client.messageFlagsAdd(uidStr, ['\\Flagged'], { uid: true })
        } else {
          await client.messageFlagsRemove(uidStr, ['\\Flagged'], { uid: true })
        }
      }
    })
    return c.json({ ok: true })
  } catch (err) {
    toMailError(err)
  }
})

// DELETE /api/mail/messages/:id — move to Trash (not permanent delete)
mailMessageRoutes.delete('/mail/messages/:id', async (c) => {
  const userId = c.get('userId') as string
  const rawId = c.req.param('id')

  let decoded: ReturnType<typeof decodeMailId>
  try {
    decoded = decodeMailId(rawId)
  } catch {
    throw new AppError('VALIDATION_ERROR', 422, `Invalid message id: ${rawId}`)
  }
  const { role, uid } = decoded

  const { config, roles } = await loadMailAccount(userId)

  try {
    await withImap(config, async (client) => {
      await client.mailboxOpen(roles[role])
      await client.messageMove(`${uid}`, roles['trash'], { uid: true })
    })
    return c.body(null, 204)
  } catch (err) {
    toMailError(err)
  }
})

// POST /api/mail/messages/send — send via SMTP + APPEND copy to Sent
const sendSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  text: z.string(),
  html: z.string().optional(),
  inReplyTo: z.string().optional(),
  references: z.string().optional(),
})

mailMessageRoutes.post('/mail/messages/send', async (c) => {
  const userId = c.get('userId') as string
  const body = sendSchema.parse(await c.req.json())
  const { config, roles } = await loadMailAccount(userId)

  try {
    const transport = smtpTransport(config)
    let messageId: string | undefined
    try {
      const info = await transport.sendMail({
        from: config.email,
        to: body.to,
        subject: body.subject,
        text: body.text,
        html: body.html,
        inReplyTo: body.inReplyTo,
        references: body.references,
      })
      messageId = info.messageId
    } finally {
      transport.close()
    }

    // APPEND copy to Sent — SMTP does not save a copy automatically
    if (roles['sent']) {
      const msgId = messageId ?? `<${Date.now()}@${config.email.split('@')[1]}>`
      const rawLines = [
        `From: ${config.email}`,
        `To: ${body.to}`,
        `Subject: ${body.subject}`,
        body.inReplyTo ? `In-Reply-To: ${body.inReplyTo}` : null,
        body.references ? `References: ${body.references}` : null,
        `Date: ${new Date().toUTCString()}`,
        `Message-ID: ${msgId}`,
        `Content-Type: text/plain; charset=utf-8`,
        `MIME-Version: 1.0`,
        '',
        body.text,
      ]
      const raw = rawLines.filter((l): l is string => l !== null).join('\r\n')

      await withImap(config, async (client) => {
        await client.append(roles['sent'], raw, ['\\Seen'])
      })
    }

    return c.json({ ok: true, messageId: messageId ?? null })
  } catch (err) {
    if (err instanceof AppError) throw err
    toMailError(err)
  }
})
