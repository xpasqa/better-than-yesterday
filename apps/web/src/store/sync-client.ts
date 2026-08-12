// The client half of POST /api/sync (spec induk §3.2). Runs on an interval
// and right after any local write; never blocks the UI — a failed round
// trip just leaves the outbox for the next attempt.
import type { Node } from '@better/core/node'
import type { Tag } from '@better/core/tag'
import type { Completion } from '@better/core/completion'
import type { Reminder } from '@better/core/reminder'
import type { Notification } from '@better/core/notification'
import { db, getCursor, setCursor } from './db.ts'

export type SyncStatus = 'idle' | 'syncing' | 'offline'

type Listener = (status: SyncStatus) => void
const listeners = new Set<Listener>()
let currentStatus: SyncStatus = 'idle'

function setStatus(status: SyncStatus): void {
  if (status === currentStatus) return
  currentStatus = status
  for (const listener of listeners) listener(status)
}

export function onSyncStatusChange(listener: Listener): () => void {
  listeners.add(listener)
  listener(currentStatus)
  return () => listeners.delete(listener)
}

export function getSyncStatus(): SyncStatus {
  return currentStatus
}

/** Applies an incoming row only if it isn't older than what's already stored locally — same rule the server uses, so a client never regresses its own optimistic state from an in-flight round trip. */
async function mergeIncoming<T extends { id: string; updatedAt: string }>(
  table: { get: (id: string) => Promise<T | undefined>; put: (row: T) => Promise<string> },
  incomingRows: T[],
): Promise<void> {
  for (const incoming of incomingRows) {
    const existing = await table.get(incoming.id)
    if (!existing || incoming.updatedAt >= existing.updatedAt) {
      await table.put(incoming)
    }
  }
}

let syncing = false

/** One push-then-pull round trip. Safe to call concurrently — a call that arrives mid-sync is a no-op; the interval or next trigger picks up whatever was missed. */
export async function syncOnce(): Promise<void> {
  if (syncing) return
  syncing = true
  setStatus('syncing')
  try {
    const outboxEntries = await db.outbox.toArray()
    const nodes = outboxEntries.filter((e) => e.entityType === 'node').map((e) => e.payload as Node)
    const tags = outboxEntries.filter((e) => e.entityType === 'tag').map((e) => e.payload as Tag)
    const completions = outboxEntries.filter((e) => e.entityType === 'completion').map((e) => e.payload as Completion)
    const reminders = outboxEntries.filter((e) => e.entityType === 'reminder').map((e) => e.payload as Reminder)
    const cursor = await getCursor()

    const res = await fetch('/api/sync', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cursor, changes: { nodes, tags, completions, reminders } }),
    })
    if (!res.ok) throw new Error(`sync failed: ${res.status}`)
    const body = await res.json() as {
      cursor: string
      changes: { nodes: Node[]; tags: Tag[]; completions: Completion[]; reminders: Reminder[]; notifications: Notification[] }
    }

    await db.transaction('rw', db.nodes, db.tags, db.completions, db.reminders, db.notifications, db.outbox, async () => {
      await db.outbox.clear()
      await mergeIncoming(db.nodes, body.changes.nodes)
      await mergeIncoming(db.tags, body.changes.tags)
      for (const row of body.changes.completions) {
        await db.completions.put(row)
      }
      await mergeIncoming(db.reminders, body.changes.reminders)
      // Notifications are pull-only — db.put directly (no updatedAt field).
      for (const row of body.changes.notifications) {
        await db.notifications.put(row)
      }
    })
    await setCursor(body.cursor)
    setStatus('idle')
  } catch {
    setStatus('offline')
  } finally {
    syncing = false
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined

/** Called after every local write — coalesces bursts (e.g. fast typing) into one round trip instead of one per keystroke. */
export function triggerSync(): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => void syncOnce(), 400)
}

let intervalId: ReturnType<typeof setInterval> | undefined

/** Background poll so changes from another device still arrive even with nothing local to push. */
export function startSyncLoop(intervalMs = 5000): () => void {
  void syncOnce()
  intervalId = setInterval(() => void syncOnce(), intervalMs)
  return () => {
    if (intervalId) clearInterval(intervalId)
  }
}
