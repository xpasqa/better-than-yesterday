// One Postgres sequence shared by every syncable table (spec induk §2.5):
// `seq` is the sync cursor, and a single sequence across all of them means
// one cursor covers node, label, saved_filter, and reminder together in one
// /sync round trip instead of one cursor per table.
import { pgSequence } from 'drizzle-orm/pg-core'

export const syncSeq = pgSequence('sync_seq')
