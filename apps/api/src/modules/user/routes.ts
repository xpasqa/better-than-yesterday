// PATCH /api/me — update user preferences (timezone only for now)
import { Hono } from 'hono'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { appUser } from '../../db/schema/user.ts'
import { AppError } from '../../http/errors.ts'

const prefsSchema = z.object({
  // A bogus timezone makes localDate() return the wrong day SILENTLY — the
  // kind of bug that surfaces weeks later. Reject it at the door.
  timezone: z
    .string()
    .refine((tz) => Intl.supportedValuesOf('timeZone').includes(tz), { message: 'unknown timezone' })
    .optional(),
})

export const userRoutes = new Hono()

userRoutes.patch('/me', async (c) => {
  const userId = c.get('userId') // set by requireAuth middleware in app.ts
  if (!userId) return c.json({ error: 'unauthorized' }, 401)

  const parsed = prefsSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'invalid' }, 400)

  // An empty body is not an error — it just writes nothing. Rejecting it
  // would only add a branch that has to be tested.
  if (Object.keys(parsed.data).length > 0) {
    await db.update(appUser).set(parsed.data).where(eq(appUser.id, userId))
  }

  const [user] = await db.select().from(appUser).where(eq(appUser.id, userId))
  if (!user) throw new AppError('UNAUTHORIZED', 401, 'Session refers to a user that no longer exists')
  return c.json({ user: { id: user.id, email: user.email, name: user.name, timezone: user.timezone } })
})
