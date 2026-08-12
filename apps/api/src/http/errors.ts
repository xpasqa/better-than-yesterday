// One error shape for every endpoint in this app — spec induk §3.3. A route
// throws AppError for anything the caller could plausibly have caused
// (bad input, no session, not found); anything else is a bug, and
// errorHandler turns it into a 500 without ever leaking its message or
// stack to the response.
import type { ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  // Mail-specific
  | 'MAIL_NOT_CONFIGURED'
  | 'MAIL_AUTH_FAILED'
  | 'MAIL_UNAVAILABLE'
  | 'MAIL_FOLDERS_UNRESOLVED'

export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: 400 | 401 | 404 | 409 | 422 | 429 | 500
  readonly details?: unknown

  constructor(code: ErrorCode, status: AppError['status'], message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status
    this.details = details
  }
}

function envelope(code: ErrorCode, message: string, details?: unknown) {
  return { error: { code, message, ...(details !== undefined ? { details } : {}) } }
}

/**
 * Mounted once in app.ts, after the route tree. Hono calls this for any
 * thrown value a handler didn't catch. Zod errors (a boundary check that
 * forgot to `safeParse`) become 422s automatically; everything unexpected
 * becomes a bare 500 — the real error still goes to server logs via
 * request-log's catch, never to the client.
 */
export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json(envelope(err.code, err.message, err.details), err.status)
  }
  if (err instanceof ZodError) {
    return c.json(envelope('VALIDATION_ERROR', 'Invalid input', err.flatten()), 422)
  }
  if (err instanceof HTTPException) {
    return c.json(envelope('INTERNAL', err.message), err.status)
  }
  console.error(err)
  return c.json(envelope('INTERNAL', 'Internal server error'), 500)
}
