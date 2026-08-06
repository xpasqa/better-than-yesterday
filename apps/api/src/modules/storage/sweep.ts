// Weekly orphan sweep — deletes 'pending' storage_file rows older than 7 days
// and their S3 objects. Runs in-process on a timer (no queue needed at this scale).
// docs/feature/2.backend/4.storage/spec.md §8
import { DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { s3, S3_BUCKET } from '../../db/s3-client.ts'
import { getPendingOrphans, deletePendingOrphans } from './service.ts'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export async function runOrphanSweep(): Promise<void> {
  if (!s3) return // storage not configured — skip silently

  const orphans = await getPendingOrphans(SEVEN_DAYS_MS)
  if (!orphans.length) return

  // Delete from S3 first (max 1000 per request — AWS batch limit)
  for (let i = 0; i < orphans.length; i += 1000) {
    const batch = orphans.slice(i, i + 1000)
    await s3.send(new DeleteObjectsCommand({
      Bucket: S3_BUCKET,
      Delete: { Objects: batch.map(o => ({ Key: o.s3Key })) },
    }))
  }

  // Then delete from DB
  await deletePendingOrphans(orphans.map(o => o.id))

  console.log(`[orphan-sweep] removed ${orphans.length} orphaned pending files`)
}

/** Schedule weekly orphan sweep in-process. Call once at app startup. */
export function scheduleOrphanSweep(): void {
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000
  // Run once 1 minute after startup, then weekly
  setTimeout(() => {
    void runOrphanSweep()
    setInterval(() => { void runOrphanSweep() }, WEEK_MS)
  }, 60_000)
}
