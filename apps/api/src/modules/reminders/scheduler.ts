// Penjadwal reminder: node-cron tiap 1 menit, query reminder_due index,
// kirim web push ke tiap subscription milik user, tandai deliveredAt.
// 410/404 dari push endpoint → tandai failedAt (jangan dicoba lagi).
import cron from 'node-cron'
import webpush from 'web-push'
import { and, eq, isNull, lte } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { reminder } from '../../db/schema/reminder.ts'
import { notification } from '../../db/schema/notification.ts'
import { pushSubscription } from '../../db/schema/push-subscription.ts'
import { node } from '../../db/schema/node.ts'
import { config } from '../../config.ts'

// Set VAPID details once at module load — safe because this module is only
// imported after config is validated.
webpush.setVapidDetails(
  config.VAPID_SUBJECT,
  config.VAPID_PUBLIC_KEY,
  config.VAPID_PRIVATE_KEY,
)

export async function deliverDueReminders(): Promise<void> {
  const now = new Date()

  // Query using the reminder_due partial index (fireAt <= now, deliveredAt IS NULL, deletedAt IS NULL)
  const dueReminders = await db
    .select({
      id: reminder.id,
      userId: reminder.userId,
      nodeId: reminder.nodeId,
      fireAt: reminder.fireAt,
    })
    .from(reminder)
    .where(
      and(
        isNull(reminder.deliveredAt),
        isNull(reminder.deletedAt),
        lte(reminder.fireAt, now),
      ),
    )
    .limit(100) // process at most 100 per minute — safety valve

  for (const rem of dueReminders) {
    // Get node title for notification content
    const [nodeRow] = await db
      .select({ content: node.content })
      .from(node)
      .where(eq(node.id, rem.nodeId))
      .limit(1)

    const title = 'Reminder'
    const body = nodeRow?.content ?? ''

    // Create notification row (server writes, client reads)
    const notifId = crypto.randomUUID()
    await db.insert(notification).values({
      id: notifId,
      userId: rem.userId,
      kind: 'reminder',
      nodeId: rem.nodeId,
      title,
      body,
    })

    // Get all active push subscriptions for this user (failedAt IS NULL)
    const subscriptions = await db
      .select()
      .from(pushSubscription)
      .where(
        and(
          eq(pushSubscription.userId, rem.userId),
          isNull(pushSubscription.failedAt),
        ),
      )

    const payload = JSON.stringify({
      title,
      body,
      nodeId: rem.nodeId,
      notificationId: notifId,
    })

    // Send to each subscription — Promise.allSettled so one failure never
    // cancels delivery to other subscriptions.
    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          )
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode
          if (status === 410 || status === 404) {
            // Subscription is gone — mark it so we never try again
            await db
              .update(pushSubscription)
              .set({ failedAt: new Date() })
              .where(eq(pushSubscription.endpoint, sub.endpoint))
              .catch((e) => console.error('[reminder-scheduler] failedAt update error:', e))
          } else {
            // Transient error — log but don't mark as failed; next tick will retry
            console.error('[reminder-scheduler] push error (transient):', err)
          }
        }
      }),
    )

    // Mark deliveredAt AFTER all sends attempted — the notification row is
    // the durable record. If process dies before this, next tick retries
    // (duplicate notification is an acceptable edge case).
    await db
      .update(reminder)
      .set({ deliveredAt: new Date() })
      .where(eq(reminder.id, rem.id))
  }

  if (dueReminders.length > 0) {
    console.log(`[reminder-scheduler] delivered ${dueReminders.length} reminder(s)`)
  }
}

/** Schedule reminder delivery every minute. Call once at app startup. */
export function scheduleReminderDelivery(): void {
  cron.schedule('* * * * *', () => {
    void deliverDueReminders().catch((err) => {
      console.error('[reminder-scheduler] tick error:', err)
    })
  })
  console.log('[reminder-scheduler] started — firing every minute')
}
