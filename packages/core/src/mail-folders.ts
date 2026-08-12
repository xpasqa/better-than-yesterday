// IMAP folder role resolution — maps server-advertised mailboxes to the five
// canonical roles the UI depends on. Priority order: RFC 6154 SPECIAL-USE
// extension attribute → case-insensitive name matching → INBOX default.

export type MailRole = 'inbox' | 'sent' | 'drafts' | 'junk' | 'trash'

export interface ImapMailbox {
  path: string       // raw IMAP path, e.g. 'INBOX', 'INBOX.Sent', 'Sent Items'
  specialUse?: string // RFC 6154 attribute, e.g. '\\Sent', '\\Drafts'
  name: string       // display name — last path segment
}

export type RoleSource = 'extension' | 'name' | 'default'

export interface FolderRoleMap {
  roles: Record<MailRole, string>     // role → IMAP path
  sources: Record<MailRole, RoleSource>
  missing: MailRole[]
}

// RFC 6154 special-use attribute → role
const SPECIAL_USE_MAP: Record<string, MailRole> = {
  '\\inbox': 'inbox',
  '\\sent': 'sent',
  '\\drafts': 'drafts',
  '\\junk': 'junk',
  '\\spam': 'junk',
  '\\trash': 'trash',
}

// Case-insensitive name/path patterns → role
const NAME_PATTERNS: Array<{ role: MailRole; patterns: string[] }> = [
  { role: 'inbox', patterns: ['inbox'] },
  { role: 'sent', patterns: ['sent', 'sent items', 'sent mail', 'sent messages'] },
  { role: 'drafts', patterns: ['drafts', 'draft'] },
  { role: 'junk', patterns: ['junk', 'spam', 'junk mail', 'junk e-mail', 'bulk mail'] },
  { role: 'trash', patterns: ['trash', 'deleted items', 'deleted messages', 'bin'] },
]

const ALL_ROLES: MailRole[] = ['inbox', 'sent', 'drafts', 'junk', 'trash']

/**
 * Resolves a flat list of IMAP mailboxes into the five canonical mail roles.
 *
 * Priority:
 * 1. RFC 6154 SPECIAL-USE extension attribute  → source 'extension'
 * 2. Case-insensitive name / path match         → source 'name'
 * 3. Fallback: 'inbox' → path 'INBOX'           → source 'default'
 */
export function resolveFolderRoles(mailboxes: ImapMailbox[]): FolderRoleMap {
  const roles = {} as Record<MailRole, string>
  const sources = {} as Record<MailRole, RoleSource>

  // Pass 1 — extension (SPECIAL-USE wins unconditionally)
  for (const mb of mailboxes) {
    if (!mb.specialUse) continue
    const role = SPECIAL_USE_MAP[mb.specialUse.toLowerCase()]
    if (role && roles[role] === undefined) {
      roles[role] = mb.path
      sources[role] = 'extension'
    }
  }

  // Pass 2 — name matching for roles not yet resolved
  for (const mb of mailboxes) {
    const nameLower = mb.name.toLowerCase()
    const pathLower = mb.path.toLowerCase()

    for (const { role, patterns } of NAME_PATTERNS) {
      if (roles[role] !== undefined) continue // already claimed
      if (patterns.includes(nameLower) || patterns.includes(pathLower)) {
        roles[role] = mb.path
        sources[role] = 'name'
        break
      }
    }
  }

  // Pass 3 — inbox default
  if (roles.inbox === undefined) {
    roles.inbox = 'INBOX'
    sources.inbox = 'default'
  }

  const missing = ALL_ROLES.filter((r) => r !== 'inbox' && roles[r] === undefined)

  return { roles, sources, missing }
}
