// S3-compatible client configured from env vars.
// docs/feature/2.backend/4.storage/spec.md §5 — iDrive e2 (path-style)
import { S3Client } from '@aws-sdk/client-s3'
import { config } from '../config.ts'

function buildS3Client(): S3Client | null {
  if (!config.S3_ENDPOINT || !config.S3_ACCESS_KEY_ID || !config.S3_SECRET_ACCESS_KEY || !config.S3_BUCKET) {
    return null // storage not configured — routes will return 503
  }
  return new S3Client({
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true, // required for iDrive e2
  })
}

export const s3 = buildS3Client()
export const S3_BUCKET = config.S3_BUCKET ?? ''

/** Canonical S3 key for a storage file: 'storage/{userId}/{fileId}' */
export function storageKey(userId: string, fileId: string): string {
  return `storage/${userId}/${fileId}`
}
