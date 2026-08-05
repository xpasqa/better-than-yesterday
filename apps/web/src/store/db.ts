// Local-first storage — spec induk §3.2: the network is never on the
// render path. Every mutation writes here first (< 16ms), then queues for
// the sync worker; reads always come from Dexie, never from a fetch.
import Dexie, { type Table } from 'dexie'
import type { Node } from '@better/core/node'
import type { Label } from '@better/core/label'

/**
 * A local write not yet confirmed by the server, keyed `${entityType}:${id}`
 * so a second edit before the first synced just replaces the queued
 * payload — the outbox never grows unbounded from fast typing.
 */
export interface OutboxEntry {
  key: string
  entityType: 'node' | 'label'
  payload: Node | Label
}

export interface MetaEntry {
  key: string
  value: string
}

interface OutboxEntryV1 {
  nodeId: string
  payload: Node
}

export class BetterDb extends Dexie {
  nodes!: Table<Node, string>
  labels!: Table<Label, string>
  outbox!: Table<OutboxEntry, string>
  meta!: Table<MetaEntry, string>

  constructor() {
    super('better')
    this.version(1).stores({
      nodes: 'id, parentId, dueDate, [parentId+rank], isInbox',
      outbox: 'nodeId',
      meta: 'key',
    })
    // v2 adds labels and moves queued writes to `pending`, keyed
    // `${entityType}:${id}` instead of the old outbox's bare `nodeId`.
    // Dexie can't change a store's primary key in place ("Not yet support
    // for changing primary key"), so the fix is the documented pattern:
    // add the new store under a new name, migrate rows across while the
    // old store still exists in this same version's transaction, then drop
    // the old one.
    this.version(2)
      .stores({
        nodes: 'id, parentId, dueDate, [parentId+rank], isInbox',
        labels: 'id, name',
        pending: 'key, entityType',
        outbox: null,
        meta: 'key',
      })
      .upgrade(async (tx) => {
        const old = await tx.table<OutboxEntryV1, string>('outbox').toArray()
        for (const entry of old) {
          await tx
            .table('pending')
            .put({ key: `node:${entry.nodeId}`, entityType: 'node', payload: entry.payload })
        }
      })
    // v3 renames `pending` back to the name the rest of the app expects
    // (`outbox`) now that the primary key it needed is already in place.
    this.version(3)
      .stores({
        nodes: 'id, parentId, dueDate, [parentId+rank], isInbox',
        labels: 'id, name',
        outbox: 'key, entityType',
        pending: null,
        meta: 'key',
      })
      .upgrade(async (tx) => {
        const rows = await tx.table<OutboxEntry, string>('pending').toArray()
        for (const row of rows) {
          await tx.table('outbox').put(row)
        }
      })
  }
}

export const db = new BetterDb()

/** Wipes all local data — called on logout, or on login as a different user than whatever was cached (single-device-sharing safety net). */
export async function clearLocalStore(): Promise<void> {
  await db.transaction('rw', db.nodes, db.labels, db.outbox, db.meta, async () => {
    await db.nodes.clear()
    await db.labels.clear()
    await db.outbox.clear()
    await db.meta.clear()
  })
}

export async function getCursor(): Promise<string> {
  const row = await db.meta.get('cursor')
  return row?.value ?? '0'
}

export async function setCursor(cursor: string): Promise<void> {
  await db.meta.put({ key: 'cursor', value: cursor })
}
