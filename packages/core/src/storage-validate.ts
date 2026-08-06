// Storage upload validation — the only gate before a presign key is signed.
// docs/feature/2.backend/4.storage/spec.md §5.1
// 100% branch coverage required — every path here guards a real security boundary.

export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

// Allowlist: common safe MIME types for documents, images, data
export const MIME_ALLOWLIST = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'image/avif', 'image/heic', 'image/heif',
  'application/pdf',
  'text/plain', 'text/csv', 'text/markdown',
  'application/json',
  'application/zip', 'application/gzip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/msword',
  'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm',
  'video/mp4', 'video/webm', 'video/ogg',
])

// Explicit blocklist regardless of MIME: file types that are dangerous to serve
export const EXTENSION_BLOCKLIST = new Set([
  '.html', '.htm', '.js', '.mjs', '.cjs', '.ts',
  '.jsx', '.tsx', '.php', '.py', '.rb', '.sh',
  '.bash', '.zsh', '.ps1', '.bat', '.cmd', '.exe',
  '.dll', '.so', '.dylib',
])

export interface UploadInput {
  name: string     // original filename
  mimeType: string
  sizeBytes: number
}

export interface QuotaInfo {
  usedBytes: number
  limitBytes: number
}

export type ValidationError =
  | { code: 'FILE_TOO_LARGE'; maxBytes: number }
  | { code: 'MIME_NOT_ALLOWED'; mimeType: string }
  | { code: 'EXTENSION_BLOCKED'; extension: string }
  | { code: 'NAME_INVALID'; reason: string }
  | { code: 'QUOTA_EXCEEDED'; usedBytes: number; limitBytes: number }

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: ValidationError }

/**
 * Validates a pending upload against size, MIME, name, and quota constraints.
 * Pure function — no I/O. Returns ok or a typed error.
 */
export function validateUpload(input: UploadInput, quota: QuotaInfo): ValidationResult {
  // 1. Size
  if (input.sizeBytes > MAX_FILE_SIZE) {
    return { ok: false, error: { code: 'FILE_TOO_LARGE', maxBytes: MAX_FILE_SIZE } }
  }

  // 2. Extension blocklist (checked before MIME allowlist — defense in depth)
  const name = input.name.trim()
  const lastDot = name.lastIndexOf('.')
  const ext = lastDot >= 0 ? name.slice(lastDot).toLowerCase() : ''
  if (ext && EXTENSION_BLOCKLIST.has(ext)) {
    return { ok: false, error: { code: 'EXTENSION_BLOCKED', extension: ext } }
  }

  // 3. MIME allowlist
  if (!MIME_ALLOWLIST.has(input.mimeType)) {
    return { ok: false, error: { code: 'MIME_NOT_ALLOWED', mimeType: input.mimeType } }
  }

  // 4. Name length (1–255 chars after trim)
  if (name.length < 1 || name.length > 255) {
    return {
      ok: false,
      error: { code: 'NAME_INVALID', reason: 'Name must be 1–255 characters after trimming whitespace' },
    }
  }

  // 5. Quota
  if (quota.usedBytes + input.sizeBytes > quota.limitBytes) {
    return {
      ok: false,
      error: { code: 'QUOTA_EXCEEDED', usedBytes: quota.usedBytes, limitBytes: quota.limitBytes },
    }
  }

  return { ok: true }
}
