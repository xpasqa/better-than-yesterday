import { describe, it, expect } from 'vitest'
import { resolveFolderRoles } from './mail-folders.ts'
import type { ImapMailbox } from './mail-folders.ts'

describe('resolveFolderRoles', () => {
  it('Hostinger standard — specialUse complete, all 5 roles via extension', () => {
    const mailboxes: ImapMailbox[] = [
      { path: 'INBOX',       name: 'INBOX',  specialUse: '\\Inbox'  },
      { path: 'Sent',        name: 'Sent',   specialUse: '\\Sent'   },
      { path: 'Drafts',      name: 'Drafts', specialUse: '\\Drafts' },
      { path: 'Junk',        name: 'Junk',   specialUse: '\\Junk'   },
      { path: 'Trash',       name: 'Trash',  specialUse: '\\Trash'  },
    ]
    const result = resolveFolderRoles(mailboxes)

    expect(result.roles.inbox).toBe('INBOX')
    expect(result.roles.sent).toBe('Sent')
    expect(result.roles.drafts).toBe('Drafts')
    expect(result.roles.junk).toBe('Junk')
    expect(result.roles.trash).toBe('Trash')

    expect(result.sources.inbox).toBe('extension')
    expect(result.sources.sent).toBe('extension')
    expect(result.sources.drafts).toBe('extension')
    expect(result.sources.junk).toBe('extension')
    expect(result.sources.trash).toBe('extension')

    expect(result.missing).toEqual([])
  })

  it('cPanel layout — INBOX.* subfolders without specialUse, detected via name', () => {
    const mailboxes: ImapMailbox[] = [
      { path: 'INBOX',           name: 'INBOX'  },
      { path: 'INBOX.Sent',      name: 'Sent'   },
      { path: 'INBOX.Drafts',    name: 'Drafts' },
      { path: 'INBOX.spam',      name: 'spam'   },
      { path: 'INBOX.Trash',     name: 'Trash'  },
    ]
    const result = resolveFolderRoles(mailboxes)

    expect(result.roles.inbox).toBe('INBOX')
    expect(result.roles.sent).toBe('INBOX.Sent')
    expect(result.roles.drafts).toBe('INBOX.Drafts')
    expect(result.roles.junk).toBe('INBOX.spam')
    expect(result.roles.trash).toBe('INBOX.Trash')

    expect(result.sources.inbox).toBe('name')
    expect(result.sources.sent).toBe('name')
    expect(result.sources.drafts).toBe('name')
    expect(result.sources.junk).toBe('name')
    expect(result.sources.trash).toBe('name')

    expect(result.missing).toEqual([])
  })

  it('INBOX fallback — no recognisable inbox folder, inbox path defaults to INBOX, rest missing', () => {
    // No mailbox whose name/path matches any known inbox pattern — triggers the hard-coded default
    const mailboxes: ImapMailbox[] = [
      { path: 'Mail', name: 'Mail' },
    ]
    const result = resolveFolderRoles(mailboxes)

    expect(result.roles.inbox).toBe('INBOX')
    expect(result.sources.inbox).toBe('default')

    // sent, drafts, junk, trash are all missing
    expect(result.missing).toContain('sent')
    expect(result.missing).toContain('drafts')
    expect(result.missing).toContain('junk')
    expect(result.missing).toContain('trash')
    expect(result.missing).toHaveLength(4)
  })

  it('specialUse wins over name — folder named "Outbox" with specialUse="\\Sent" resolves as extension', () => {
    const mailboxes: ImapMailbox[] = [
      { path: 'INBOX',   name: 'INBOX'  },
      // Name is "Outbox" (no name match for sent), but specialUse declares \\Sent
      { path: 'Outbox',  name: 'Outbox', specialUse: '\\Sent' },
      // Another folder named "Sent" that would match by name — must NOT win
      { path: 'OldSent', name: 'Sent'   },
    ]
    const result = resolveFolderRoles(mailboxes)

    expect(result.roles.sent).toBe('Outbox')
    expect(result.sources.sent).toBe('extension')
    // 'OldSent' folder must not have claimed the sent role
    expect(result.roles.sent).not.toBe('OldSent')
  })
})
