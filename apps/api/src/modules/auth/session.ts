// Signed session cookie — no session table (infra spec §5). The payload is
// just `{ userId, exp }`; the signature is what makes it trustworthy, so a
// verified token never needs a database round trip.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { config } from '../../config.ts'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

interface SessionPayload {
  userId: string
  exp: number // epoch ms
}

function base64url(input: Buffer): string {
  return input.toString('base64url')
}

function sign(payload: string): string {
  return base64url(createHmac('sha256', config.SESSION_SECRET).update(payload).digest())
}

/** Creates a signed token good for 30 days from `now`. */
export function createSessionToken(userId: string, now: number = Date.now()): string {
  const payload: SessionPayload = { userId, exp: now + THIRTY_DAYS_MS }
  const payloadB64 = base64url(Buffer.from(JSON.stringify(payload)))
  return `${payloadB64}.${sign(payloadB64)}`
}

/**
 * Verifies signature and expiry. Returns `null` for anything wrong —
 * malformed, tampered, or expired — rather than throwing, since "no valid
 * session" is an ordinary, expected outcome for auth-middleware to react to.
 */
export function verifySessionToken(token: string, now: number = Date.now()): { userId: string } | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, signature] = parts as [string, string]

  const expectedSignature = sign(payloadB64)
  const actual = Buffer.from(signature)
  const expected = Buffer.from(expectedSignature)
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null

  let payload: SessionPayload
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as SessionPayload
  } catch {
    return null
  }
  if (typeof payload.userId !== 'string' || typeof payload.exp !== 'number') return null
  if (payload.exp <= now) return null

  return { userId: payload.userId }
}

export const SESSION_COOKIE_NAME = 'better_session'
export const SESSION_MAX_AGE_SECONDS = THIRTY_DAYS_MS / 1000
