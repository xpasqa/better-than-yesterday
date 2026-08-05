import { useLiveQuery } from 'dexie-react-hooks'
import type { Node } from '@better/core/node'
import { db } from './db.ts'

/** Every non-deleted node, live — re-renders on any local write or synced change. */
export function useAllNodes(): Node[] {
  return useLiveQuery(() => db.nodes.filter((n) => n.deletedAt === null).toArray(), [], []) ?? []
}
