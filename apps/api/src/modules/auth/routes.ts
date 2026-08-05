// POST /auth/login, POST /auth/logout, GET /auth/me — infra spec §5.
import { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import { verify } from '@node-rs/argon2'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/client.ts'
import { appUser } from '../../db/schema/user.ts'
import { AppError } from '../../http/errors.ts'
import { requireAuth } from '../../http/auth-middleware.ts'
import { config } from '../../config.ts'
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from './session.ts'
import { isRateLimited, recordAttempt } from './rate-limit.ts'
import { hashPassword } from './password.ts'

// A verify() call against a hash of a random password, computed once at
// startup. A login for an email that doesn't exist still spends this same
// argon2 verification time before failing, so "no such user" and "wrong
// password" are not distinguishable by a timing side-channel.
const dummyHashPromise = hashPassword(crypto.randomUUID())

const loginInput = z.object({
  email: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(200),
})

function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  // Behind Caddy, the real client address arrives via X-Forwarded-For.
  // Falling back to a constant when absent (local dev, direct connection)
  // still rate-limits per email, just without the IP dimension.
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}

export const authRoutes = new Hono()

authRoutes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = loginInput.safeParse(body)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 422, 'Invalid login input', parsed.error.flatten())
  }
  const { password } = parsed.data
  const email = parsed.data.email.toLowerCase()
  const ip = clientIp(c)

  if (isRateLimited(email, ip)) {
    throw new AppError('RATE_LIMITED', 429, 'Too many login attempts. Try again later.')
  }
  recordAttempt(email, ip)

  const [user] = await db.select().from(appUser).where(eq(appUser.email, email)).limit(1)

  const passwordOk = user
    ? await verify(user.passwordHash, password)
    : await verify(await dummyHashPromise, password).then(() => false)

  if (!user || !passwordOk) {
    throw new AppError('UNAUTHORIZED', 401, 'Email or password is incorrect')
  }

  const token = createSessionToken(user.id)
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  })

  return c.json({ user: { id: user.id, email: user.email, name: user.name } })
})

authRoutes.post('/logout', (c) => {
  deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' })
  return c.body(null, 204)
})

authRoutes.get('/me', requireAuth, async (c) => {
  const userId = c.get('userId')
  const [user] = await db.select().from(appUser).where(eq(appUser.id, userId)).limit(1)
  if (!user) throw new AppError('UNAUTHORIZED', 401, 'Session refers to a user that no longer exists')
  return c.json({ user: { id: user.id, email: user.email, name: user.name, timezone: user.timezone } })
})
