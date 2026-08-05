// Local-first storage — spec induk §3.2: the network is never on the
// render path. Every mutation writes here first (< 16ms), then queues for
// the sync worker; reads always come from Dexie, never from a fetch.
import Dexie, { type Table } from 'dexie'
import type { Node } from '@better/core/node'

/** A local write not yet confirmed by the server. One row per node id — a second edit before the first synced just replaces the queued payload, so the outbox never grows unbounded from fast typing. */
export interface OutboxEntry {
  nodeId: string
  payload: Node
}

export interface MetaEntry {
  key: string
  value: string
}

export class BetterDb extends Dexie {
  nodes!: Table<Node, string>
  outbox!: Table<OutboxEntry, string>
  meta!: Table<MetaEntry, string>

  constructor() {
    super('better')
    this.version(1).stores({
      nodes: 'id, parentId, dueDate, [parentId+rank], isInbox',
      outbox: 'nodeId',
      meta: 'key',
    })
  }
}

export const db = new BetterDb()

/** Wipes all local data — called on logout, or on login as a different user than whatever was cached (single-device-sharing safety net). */
export async function clearLocalStore(): Promise<void> {
  await db.transaction('rw', db.nodes, db.outbox, db.meta, async () => {
    await db.nodes.clear()
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
