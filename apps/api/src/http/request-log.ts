// One line per request: method, path, status, duration. No request/response
// bodies, no headers — those can carry the password or session cookie this
// app is trying to keep out of logs (spec induk §5, §8).
import type { MiddlewareHandler } from 'hono'

export const requestLog: MiddlewareHandler = async (c, next) => {
  const start = performance.now()
  await next()
  const ms = (performance.now() - start).toFixed(1)
  console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`)
}
