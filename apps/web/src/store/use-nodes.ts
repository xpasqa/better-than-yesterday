import { useLiveQuery } from 'dexie-react-hooks'
import type { Node } from '@better/core/node'
import type { Label } from '@better/core/label'
import { db } from './db.ts'

/** Every non-deleted node, live — re-renders on any local write or synced change. */
export function useAllNodes(): Node[] {
  return useLiveQuery(() => db.nodes.filter((n) => n.deletedAt === null).toArray(), [], []) ?? []
}

/** Every non-deleted label, live. */
export function useAllLabels(): Label[] {
  return useLiveQuery(() => db.labels.filter((l) => l.deletedAt === null).toArray(), [], []) ?? []
}
