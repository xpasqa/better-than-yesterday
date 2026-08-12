// PATCH /api/notifications/:id/read — marks a notification as read.
// Client never creates notifications (server-only); only action from client
// is to mark one as read (sets readAt = now).
import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { notification } from '../../db/schema/notification.ts'
import { AppError } from '../../http/errors.ts'

export const notificationRoutes = new Hono()

notificationRoutes.patch('/notifications/:id/read', async (c) => {
  const userId = c.get('userId' as never) as string
  if (!userId) throw new AppError('UNAUTHORIZED', 401, 'Unauthorized')

  const id = c.req.param('id')

  const rows = await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.id, id), eq(notification.userId, userId)))
    .returning()

  if (rows.length === 0) {
    throw new AppError('NOT_FOUND', 404, 'Notification not found')
  }

  return c.json({ ok: true })
})
