// Bootstrap: load the repo-root .env before config.ts parses process.env,
// assemble the app, listen, and shut down cleanly on SIGTERM — the signal
// Docker sends on `compose down`.
import './load-env.ts'

const { config } = await import('./config.ts')
const { serve } = await import('@hono/node-server')
const { createApp } = await import('./app.ts')

const { scheduleReminderDelivery } = await import('./modules/reminders/scheduler.ts')

const app = createApp()

if (config.NODE_ENV !== 'test') {
  scheduleReminderDelivery()
}

const server = serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(`better-api listening on :${info.port} (${config.NODE_ENV})`)
})

function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down`)
  server.close(() => process.exit(0))
  // Belt-and-braces: force exit if something keeps the event loop alive.
  setTimeout(() => process.exit(1), 5000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
