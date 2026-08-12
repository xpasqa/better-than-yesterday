// mail-id.ts — Composite id `folder:uid` — message identity without cache.
// Format: "<role>:<uid>" e.g. "inbox:42", "sent:1337"

export type MailRole = 'inbox' | 'sent' | 'drafts' | 'junk' | 'trash'

const VALID_ROLES = new Set<string>(['inbox', 'sent', 'drafts', 'junk', 'trash'])

/**
 * Encodes a role + uid into a composite mail id string.
 * @example encodeMailId('inbox', 42) // "inbox:42"
 */
export function encodeMailId(role: MailRole, uid: number): string {
  return `${role}:${uid}`
}

/**
 * Decodes a composite mail id string into its role and uid parts.
 * @throws Error for invalid ids: empty, missing uid, non-integer uid,
 *   non-positive uid, unknown role, or too many segments.
 */
export function decodeMailId(id: string): { role: MailRole; uid: number } {
  if (!id) {
    throw new Error('Invalid mail id: empty string')
  }

  const parts = id.split(':')

  if (parts.length < 2) {
    throw new Error(`Invalid mail id: missing uid in "${id}"`)
  }

  if (parts.length > 2) {
    throw new Error(`Invalid mail id: too many segments in "${id}"`)
  }

  const [rolePart, uidPart] = parts

  if (!VALID_ROLES.has(rolePart)) {
    throw new Error(`Invalid mail id: unknown role "${rolePart}"`)
  }

  // Must be a string of digits only (no decimals, no signs)
  if (!/^\d+$/.test(uidPart)) {
    throw new Error(`Invalid mail id: uid must be a positive integer, got "${uidPart}"`)
  }

  const uid = parseInt(uidPart, 10)

  if (uid <= 0) {
    throw new Error(`Invalid mail id: uid must be a positive integer, got ${uid}`)
  }

  return { role: rolePart as MailRole, uid }
}
