// POST /api/push-subscriptions — store a Web Push subscription for the
// authenticated user's device. DELETE /api/push-subscriptions/:endpoint —
// remove it (e.g. on logout or when the browser signals expiry).
// This endpoint is intentionally outside /sync — subscriptions belong to a
// device, not to the user's data graph (spec §3.6).
import { Hono } from 'hono'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { pushSubscription } from '../../db/schema/push-subscription.ts'
import { AppError } from '../../http/errors.ts'

export const pushRoutes = new Hono()

const subscribeInput = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().max(200).default(''),
})

pushRoutes.post('/push-subscriptions', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => null)
  const parsed = subscribeInput.safeParse(body)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 422, 'Invalid push subscription input', parsed.error.flatten())
  }

  const { endpoint, p256dh, auth, userAgent } = parsed.data

  // Upsert: if this endpoint already exists for this user, update keys.
  // If it belongs to a different user (very unlikely), reject.
  const [existing] = await db
    .select()
    .from(pushSubscription)
    .where(eq(pushSubscription.endpoint, endpoint))
    .limit(1)

  if (existing) {
    if (existing.userId !== userId) {
      throw new AppError('CONFLICT', 409, 'Endpoint already registered to another user')
    }
    // Already registered — idempotent, nothing to do.
    return c.json({ ok: true }, 200)
  }

  await db.insert(pushSubscription).values({
    id: crypto.randomUUID(),
    userId,
    endpoint,
    p256dh,
    auth,
    userAgent,
  })

  return c.json({ ok: true }, 201)
})

pushRoutes.delete('/push-subscriptions/:endpoint', async (c) => {
  const userId = c.get('userId')
  // endpoint arrives URL-encoded in the path param
  const endpoint = decodeURIComponent(c.req.param('endpoint'))

  const [existing] = await db
    .select()
    .from(pushSubscription)
    .where(eq(pushSubscription.endpoint, endpoint))
    .limit(1)

  if (!existing) {
    // Already gone — idempotent
    return c.body(null, 204)
  }

  if (existing.userId !== userId) {
    throw new AppError('NOT_FOUND', 404, 'Subscription not found')
  }

  await db.delete(pushSubscription).where(eq(pushSubscription.endpoint, endpoint))

  return c.body(null, 204)
})
