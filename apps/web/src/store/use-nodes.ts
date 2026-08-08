import { useLiveQuery } from 'dexie-react-hooks'
import type { Node } from '@better/core/node'
import type { Tag } from '@better/core/tag'
import type { Completion } from '@better/core/completion'
import { db } from './db.ts'

/** Every non-deleted node, live — re-renders on any local write or synced change. */
export function useAllNodes(): Node[] {
  return useLiveQuery(() => db.nodes.filter((n) => n.deletedAt === null).toArray(), [], []) ?? []
}

/** Every non-deleted tag, live. */
export function useAllTags(): Tag[] {
  return useLiveQuery(() => db.tags.filter((t) => t.deletedAt === null).toArray(), [], []) ?? []
}

/** All completion rows, live — recurring-task occurrence history. */
export function useAllCompletions(): Completion[] {
  return useLiveQuery(() => db.completions.toArray(), [], []) ?? []
}
