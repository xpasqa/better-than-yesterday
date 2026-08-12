// mail.ts — API client for all mail endpoints.
// All requests use credentials: 'include' (session cookie auth).
// Error shape: { code: string; message: string }

import type { MailMessage, MailView } from '../types'

export interface MailAccountConfig {
  email: string
  imapHost: string
  imapPort: number
  smtpHost: string
  smtpPort: number
  hasPassword: boolean
  folderInbox: string | null
  folderSent: string | null
  folderDrafts: string | null
  folderJunk: string | null
  folderTrash: string | null
}

export interface MailSaveParams {
  email: string
  password?: string
  imapHost: string
  imapPort: number
  smtpHost: string
  smtpPort: number
}

/** Reads `body.code` on non-ok responses and throws a typed Error. */
async function handleResponse(res: Response): Promise<void> {
  if (res.ok) return
  let code = 'MAIL_ERROR'
  let message = `HTTP ${res.status}`
  try {
    const body = await res.json() as { code?: string; message?: string }
    if (body.code) code = body.code
    if (body.message) message = body.message
  } catch {
    // ignore parse failure — use defaults above
  }
  const err = new Error(message)
  ;(err as Error & { code: string }).code = code
  throw err
}

async function handleJsonResponse<T>(res: Response): Promise<T> {
  if (res.ok) return res.json() as Promise<T>
  let code = 'MAIL_ERROR'
  let message = `HTTP ${res.status}`
  try {
    const body = await res.json() as { code?: string; message?: string }
    if (body.code) code = body.code
    if (body.message) message = body.message
  } catch {
    // ignore parse failure
  }
  const err = new Error(message)
  ;(err as Error & { code: string }).code = code
  throw err
}

export async function fetchMessages(folder: MailView, beforeUid?: number): Promise<MailMessage[]> {
  const params = new URLSearchParams({ folder })
  if (beforeUid !== undefined) params.set('beforeUid', String(beforeUid))
  const res = await fetch(`/api/mail/messages?${params}`, { credentials: 'include' })
  return handleJsonResponse<MailMessage[]>(res)
}

export async function fetchMessage(id: string): Promise<MailMessage> {
  const res = await fetch(`/api/mail/messages/${encodeURIComponent(id)}`, { credentials: 'include' })
  return handleJsonResponse<MailMessage>(res)
}

export async function patchMessage(
  id: string,
  patch: { isRead?: boolean; isFlagged?: boolean },
): Promise<void> {
  const res = await fetch(`/api/mail/messages/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  return handleResponse(res)
}

export async function deleteMessage(id: string): Promise<void> {
  const res = await fetch(`/api/mail/messages/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  return handleResponse(res)
}

export async function sendMessage(params: {
  to: string
  subject: string
  text: string
  html?: string
  inReplyTo?: string
  references?: string
}): Promise<void> {
  const res = await fetch('/api/mail/send', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  return handleResponse(res)
}

export async function getMailAccount(): Promise<MailAccountConfig | null> {
  const res = await fetch('/api/mail/account', { credentials: 'include' })
  if (res.status === 404) return null
  return handleJsonResponse<MailAccountConfig>(res)
}

export async function saveMailAccount(data: MailSaveParams): Promise<void> {
  const res = await fetch('/api/mail/account', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse(res)
}

export async function testMailAccount(
  data: MailSaveParams,
): Promise<{ ok: boolean; folders?: Record<string, string> }> {
  const res = await fetch('/api/mail/account/test', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleJsonResponse<{ ok: boolean; folders?: Record<string, string> }>(res)
}

export async function deleteMailAccount(): Promise<void> {
  const res = await fetch('/api/mail/account', {
    method: 'DELETE',
    credentials: 'include',
  })
  return handleResponse(res)
}
