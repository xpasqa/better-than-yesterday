// Guards every route mounted after it in app.ts. Verifies the cookie's
// signature and expiry only — it never queries the database, so it costs
// nothing extra on every request (infra spec §5).
import { getCookie } from 'hono/cookie'
import type { MiddlewareHandler } from 'hono'
import { AppError } from './errors.ts'
import { SESSION_COOKIE_NAME, verifySessionToken } from '../modules/auth/session.ts'

declare module 'hono' {
  interface ContextVariableMap {
    userId: string
  }
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE_NAME)
  const session = token ? verifySessionToken(token) : null
  if (!session) {
    throw new AppError('UNAUTHORIZED', 401, 'No valid session')
  }
  c.set('userId', session.userId)
  await next()
}
