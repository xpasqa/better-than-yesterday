// Reminder mutations — all writes go to Dexie first, then the outbox
// (same pattern as node-actions.ts). fireAt for kind='relative' is
// computed from the node's dueDate + dueTime in the browser's timezone.
import { uuidv7 } from '@better/core/id'
import type { Reminder } from '@better/core/reminder'
import { db } from './db.ts'
import { triggerSync } from './sync-client.ts'

export async function createReminder(
  reminder: Omit<Reminder, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
): Promise<Reminder> {
  const now = new Date().toISOString()
  const full: Reminder = {
    ...reminder,
    id: uuidv7(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  await db.transaction('rw', db.reminders, db.outbox, async () => {
    await db.reminders.put(full)
    await db.outbox.put({ key: `reminder:${full.id}`, entityType: 'reminder', payload: full })
  })
  triggerSync()
  return full
}

export async function deleteReminder(id: string): Promise<void> {
  const existing = await db.reminders.get(id)
  if (!existing) return
  const now = new Date().toISOString()
  const deleted: Reminder = { ...existing, deletedAt: now, updatedAt: now }
  await db.transaction('rw', db.reminders, db.outbox, async () => {
    await db.reminders.put(deleted)
    await db.outbox.put({ key: `reminder:${id}`, entityType: 'reminder', payload: deleted })
  })
  triggerSync()
}

/**
 * Recomputes fireAt for all active (non-deleted) reminders on a node
 * after the node's dueDate or dueTime changes.
 *
 * - kind='absolute': fireAt = remindAt (set at creation, never recalculated)
 * - kind='relative': fireAt = dueDate + dueTime - offsetMin (UTC)
 *   If the node has no dueDate or no dueTime, the reminder can't fire — skip.
 *
 * Timezone: uses the browser's local timezone via
 * Intl.DateTimeFormat().resolvedOptions().timeZone, the same source
 * todayInTimezone uses internally.
 */
export async function recalculateFireAt(nodeId: string): Promise<void> {
  const reminders = await db.reminders.where('nodeId').equals(nodeId).toArray()
  const active = reminders.filter((r) => r.deletedAt === null)
  if (active.length === 0) return

  const node = await db.nodes.get(nodeId)
  if (!node) return

  const now = new Date().toISOString()
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  const updated: Reminder[] = []

  for (const reminder of active) {
    if (reminder.kind === 'absolute') {
      // fireAt for absolute reminders is the remindAt itself — never changes.
      // Only re-write if it somehow drifted (shouldn't happen, but stay safe).
      if (reminder.fireAt !== reminder.remindAt) {
        updated.push({ ...reminder, fireAt: reminder.remindAt!, updatedAt: now })
      }
      continue
    }

    // kind='relative': need both dueDate and dueTime to compute a UTC instant.
    if (!node.dueDate || !node.dueTime) continue
    if (reminder.offsetMin === null) continue

    // Build a wall-clock datetime string in the browser timezone, then parse
    // it as UTC by constructing the ISO string with timezone offset from
    // Intl.DateTimeFormat, keeping arithmetic simple and DST-safe.
    const dueInstant = wallClockToUtc(node.dueDate, node.dueTime, tz)
    if (dueInstant === null) continue

    const fireInstant = new Date(dueInstant.getTime() - reminder.offsetMin * 60_000)
    const fireAt = fireInstant.toISOString()

    if (fireAt !== reminder.fireAt) {
      updated.push({ ...reminder, fireAt, updatedAt: now })
    }
  }

  if (updated.length === 0) return

  await db.transaction('rw', db.reminders, db.outbox, async () => {
    for (const r of updated) {
      await db.reminders.put(r)
      await db.outbox.put({ key: `reminder:${r.id}`, entityType: 'reminder', payload: r })
    }
  })
  triggerSync()
}

/**
 * Converts a 'YYYY-MM-DD' date + 'HH:MM' time in a given IANA timezone
 * into a UTC Date. Returns null if parsing fails.
 */
function wallClockToUtc(date: string, time: string, timezone: string): Date | null {
  try {
    // Build a local datetime string and find the UTC offset for that instant
    // using Intl.DateTimeFormat with the target timezone.
    const [year, month, day] = date.split('-').map(Number) as [number, number, number]
    const [hour, minute] = time.split(':').map(Number) as [number, number]

    // Approximate UTC instant assuming UTC first, then correct for offset.
    const approxUtc = new Date(Date.UTC(year, month - 1, day, hour, minute))

    // Get the offset at this approximate instant in the target timezone.
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(approxUtc)

    const localYear = Number(parts.find((p) => p.type === 'year')!.value)
    const localMonth = Number(parts.find((p) => p.type === 'month')!.value)
    const localDay = Number(parts.find((p) => p.type === 'day')!.value)
    const localHour = Number(parts.find((p) => p.type === 'hour')!.value)
    const localMinute = Number(parts.find((p) => p.type === 'minute')!.value)

    // Offset = approxUtc local time - target local time (in ms)
    const offsetMs =
      approxUtc.getTime() -
      Date.UTC(localYear, localMonth - 1, localDay, localHour % 24, localMinute)

    // True UTC = wall-clock components interpreted as local, shifted by offset
    return new Date(Date.UTC(year, month - 1, day, hour, minute) + offsetMs)
  } catch {
    return null
  }
}
