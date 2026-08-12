// Assembles the Hono app: middleware order, then every module mounted once.
// Adding a new domain in a later phase means adding one line here — the
// shape itself never changes (infra spec §3).
import { Hono } from 'hono'
import { requestLog } from './http/request-log.ts'
import { errorHandler } from './http/errors.ts'
import { requireAuth } from './http/auth-middleware.ts'
import { authRoutes } from './modules/auth/routes.ts'
import { syncRoutes } from './modules/sync/routes.ts'
import { agentRoutes } from './modules/agent/routes.ts'
import { storageRoutes } from './modules/storage/routes.ts'
import { userRoutes } from './modules/user/routes.ts'
import { financeRoutes } from './modules/finance/routes.ts'
import { pushRoutes } from './modules/push/routes.ts'
import { scheduleOrphanSweep } from './modules/storage/sweep.ts'

export function createApp() {
  const app = new Hono()

  app.use('*', requestLog)
  app.onError(errorHandler)
  app.use((_c, next) => next()) // body size limiting handled per-route below if ever needed

  // Public — no cookie required.
  app.get('/health', async (c) => {
    return c.json({ ok: true })
  })
  app.route('/auth', authRoutes)

  // Everything under /api requires a valid session. Each module below is
  // the only place that ever grows as new phases land.
  app.use('/api/*', requireAuth)
  app.route('/api', syncRoutes)
  app.route('/api', agentRoutes)
  app.route('/api', storageRoutes)
  app.route('/api', financeRoutes)
  app.route('/api', userRoutes)
  app.route('/api', pushRoutes)

  // Schedule weekly orphan sweep in-process
  scheduleOrphanSweep()

  return app
}
