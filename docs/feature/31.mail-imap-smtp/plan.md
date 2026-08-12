# Mail IMAP/SMTP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyambungkan `MailView` ke mailbox IMAP/SMTP sungguhan sebagai proxy hidup (model Roundcube) — tanpa cache, tanpa sync engine.

**Architecture:** Satu tabel `mail_account` menyimpan kredensial terenkripsi + path folder per peran. Setiap permintaan HTTP membuka koneksi IMAP berumur pendek, menjalankan perintahnya, lalu menutup. Logika murni (pemetaan peran folder, id komposit, header threading) hidup di `packages/core` dengan tes unit; I/O IMAP/SMTP hidup di `apps/api/src/modules/mail/`.

**Tech Stack:** Hono · Drizzle + Postgres · `imapflow` · `nodemailer` · `mailparser` · `isomorphic-dompurify` · Vitest · React/Vite

**Spec:** [`spec.md`](./spec.md) — baca §0 (kenapa tanpa cache) sebelum mulai.

## Global Constraints

- **Status: sudah dikerjakan.** Blok A–G merged ke master lewat `6d798d6` (epic #111), lebih awal dari fase 5 yang direncanakan. Rencana di bawah kini jadi catatan rancangan, bukan instruksi kerja — lihat [`todo.md`](./todo.md) untuk apa yang masih perlu diverifikasi.
- Node 22, ESM, ekstensi `.ts` eksplisit di semua import relatif (konvensi repo).
- `apps/api/src/config.ts` adalah **satu-satunya** file yang boleh membaca `process.env`.
- Modul IMAP/SMTP **menerima config sebagai parameter**, tidak pernah membaca env sendiri (spec §3).
- Envelope error wajib: `{ error: { code, message, ...details } }` lewat `AppError` di `apps/api/src/http/errors.ts`.
- Resource milik user lain → **404**, tidak pernah 403.
- Tipe frontend di `apps/web/src/types/index.ts` adalah kontrak; API dibentuk agar cocok dengannya. Satu-satunya penambahan yang diizinkan: `bodyHtml?: string` (spec §5).
- Port TLS implisit saja: IMAP 993, SMTP 465. Tanpa STARTTLS, tanpa plaintext.
- `imapflow` selalu dikonstruksi dengan `disableAutoIdle: true`; jangan pernah menjalankan perintah IMAP di dalam loop `fetch()` — pakai `fetchAll()` (spec §8.1).
- Perintah verifikasi: `npm run verify` (typecheck + lint + test + build).

---

## File Structure

**Dibuat:**

| File | Tanggung jawab |
|---|---|
| `packages/core/src/mail-folders.ts` | Murni: petakan hasil `list()` IMAP → path per peran + sumbernya |
| `packages/core/src/mail-id.ts` | Murni: encode/decode id komposit `folder:uid` |
| `packages/core/src/mail-threading.ts` | Murni: susun `In-Reply-To`/`References`/subject balasan |
| `apps/api/src/db/schema/mail.ts` | Tabel `mail_account` |
| `apps/api/src/http/crypto.ts` | Helper enkripsi bersama (dipindah dari `modules/agent/crypto.ts`) |
| `apps/api/src/modules/mail/client.ts` | Factory koneksi IMAP & transport SMTP dari objek config |
| `apps/api/src/modules/mail/account-service.ts` | CRUD `mail_account` + uji koneksi + resolusi peran folder |
| `apps/api/src/modules/mail/sanitize.ts` | Sanitasi HTML + blokir remote image |
| `apps/api/src/modules/mail/dto.ts` | Bentuk respons agar cocok tipe frontend |
| `apps/api/src/modules/mail/message-service.ts` | Baca/tulis pesan lewat IMAP |
| `apps/api/src/modules/mail/send-service.ts` | Kirim SMTP + `APPEND` ke Sent |
| `apps/api/src/modules/mail/routes.ts` | Router Hono + skema Zod |
| `apps/web/src/api/mail.ts` | Klien HTTP frontend |
| `apps/web/src/components/MailSettings.tsx` (+`.css`) | Form akun mail |

**Diubah:** `apps/api/src/app.ts` (mount router) · `apps/api/src/modules/agent/crypto.ts` (jadi re-export) · `packages/core/package.json` (tiga export baru) · `apps/api/test/helpers.ts` (`mail_account` di `resetDb`) · `apps/web/src/types/index.ts` (`bodyHtml?`) · `apps/web/src/components/MailView.tsx` + `MailReadingPane.tsx` + `MailList.tsx` + `MailComposeForm.tsx`

---

## Task A: Fondasi — dependensi, crypto bersama, tabel akun

**Files:**
- Create: `apps/api/src/db/schema/mail.ts`, `apps/api/src/http/crypto.ts`
- Modify: `apps/api/src/modules/agent/crypto.ts`, `apps/api/test/helpers.ts:12`, `apps/api/package.json`
- Test: `apps/api/src/http/crypto.test.ts`

**Interfaces:**
- Consumes: `config.APP_ENCRYPTION_KEY` dari `apps/api/src/config.ts`
- Produces: `encryptSecret(plaintext: string): string`, `decryptSecret(enc: string): string`, tabel `mailAccount`

- [ ] **Step 1: Pasang dependensi**

```bash
npm i -w @better/api imapflow nodemailer mailparser isomorphic-dompurify
npm i -D -w @better/api @types/nodemailer
```

- [ ] **Step 2: Pindahkan crypto ke lokasi bersama**

Salin isi `apps/api/src/modules/agent/crypto.ts` ke `apps/api/src/http/crypto.ts`, ganti nama fungsi jadi `encryptSecret`/`decryptSecret`, dan perbaiki path import config jadi `../config.ts`. Format enkripsi (`<iv>:<tag>:<ciphertext>`) tidak berubah — data lama tetap terbaca.

- [ ] **Step 3: Jadikan file lama re-export**

```ts
// apps/api/src/modules/agent/crypto.ts
// Dipindah ke http/crypto.ts karena kini dipakai modul agent dan mail.
export { encryptSecret as encryptApiKey, decryptSecret as decryptApiKey } from '../../http/crypto.ts'
```

- [ ] **Step 4: Tulis tes crypto yang gagal**

```ts
// apps/api/src/http/crypto.test.ts
import { describe, expect, it } from 'vitest'
import { decryptSecret, encryptSecret } from './crypto.ts'

describe('crypto', () => {
  it('round-trips a secret', () => {
    expect(decryptSecret(encryptSecret('hunter2'))).toBe('hunter2')
  })

  it('produces a different ciphertext each time (random IV)', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'))
  })

  it('rejects a malformed payload', () => {
    expect(() => decryptSecret('nope')).toThrow()
  })
})
```

- [ ] **Step 5: Jalankan — pastikan gagal**

Run: `npm test -w @better/api -- crypto`
Expected: FAIL — `./crypto.ts` belum ada saat Step 2 dilewati; PASS setelah Step 2.

- [ ] **Step 6: Buat skema tabel**

```ts
// apps/api/src/db/schema/mail.ts
import { integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { appUser } from './user.ts'

export const mailAccount = pgTable('mail_account', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => appUser.id, { onDelete: 'cascade' }),
  emailAddress: text('email_address').notNull(),
  imapHost: text('imap_host').notNull(),
  imapPort: integer('imap_port').notNull().default(993),
  smtpHost: text('smtp_host').notNull(),
  smtpPort: integer('smtp_port').notNull().default(465),
  username: text('username').notNull(),
  passwordEnc: text('password_enc').notNull(),
  inboxPath: text('inbox_path').notNull().default('INBOX'),
  sentPath: text('sent_path').notNull(),
  draftsPath: text('drafts_path').notNull(),
  junkPath: text('junk_path').notNull(),
  trashPath: text('trash_path').notNull(),
  folderRoleSource: jsonb('folder_role_source').notNull().$type<Record<string, string>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex('mail_account_user').on(table.userId)])
```

- [ ] **Step 7: Generate migrasi**

Run: `npm run db:generate` — periksa file SQL baru di `apps/api/drizzle/` sebelum lanjut.

- [ ] **Step 8: Tambahkan tabel ke `resetDb`**

Di `apps/api/test/helpers.ts:12`, sisipkan `mail_account,` ke dalam daftar `truncate table` (sebelum `app_user`).

- [ ] **Step 9: Verifikasi & commit**

```bash
npm run verify
git add -A && git commit -m "feat(mail): skema mail_account, crypto bersama, dependensi IMAP/SMTP"
```

---

## Task B: Pemetaan peran folder (murni)

**Files:**
- Create: `packages/core/src/mail-folders.ts`, `packages/core/src/mail-folders.test.ts`
- Modify: `packages/core/package.json` (tambah export `./mail-folders`)

**Interfaces:**
- Produces: `type MailRole = 'inbox'|'sent'|'drafts'|'junk'|'trash'`, `interface ImapMailbox`, `interface FolderRoleMap`, `resolveFolderRoles(mailboxes: ImapMailbox[]): { ok: true; value: FolderRoleMap } | { ok: false; missing: MailRole[] }`

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// packages/core/src/mail-folders.test.ts
import { describe, expect, it } from 'vitest'
import { resolveFolderRoles, type ImapMailbox } from './mail-folders.ts'

const box = (path: string, specialUse?: string, specialUseSource?: 'extension' | 'name'): ImapMailbox =>
  ({ path, specialUse, specialUseSource })

describe('resolveFolderRoles', () => {
  it('prefers server-advertised specialUse over name matching', () => {
    const r = resolveFolderRoles([
      box('INBOX', '\\Inbox', 'extension'),
      box('Terkirim', '\\Sent', 'extension'),
      box('Sent', undefined),
      box('Drafts', '\\Drafts', 'extension'),
      box('Junk', '\\Junk', 'extension'),
      box('Trash', '\\Trash', 'extension'),
    ])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.paths.sent).toBe('Terkirim')
    expect(r.value.sources.sent).toBe('extension')
  })

  it('falls back to case-insensitive name matching, including cPanel INBOX.* layout', () => {
    const r = resolveFolderRoles([
      box('INBOX'),
      box('INBOX.Sent'),
      box('INBOX.Drafts'),
      box('INBOX.spam'),
      box('INBOX.Trash'),
    ])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.paths.sent).toBe('INBOX.Sent')
    expect(r.value.paths.junk).toBe('INBOX.spam')
    expect(r.value.sources.sent).toBe('name')
  })

  it('reports every role it could not resolve', () => {
    const r = resolveFolderRoles([box('INBOX'), box('INBOX.Sent')])
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.missing).toEqual(['drafts', 'junk', 'trash'])
  })

  it('defaults inbox to INBOX when nothing else identifies it', () => {
    const r = resolveFolderRoles([
      box('INBOX'), box('Sent'), box('Drafts'), box('Junk'), box('Trash'),
    ])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.paths.inbox).toBe('INBOX')
  })
})
```

- [ ] **Step 2: Jalankan — pastikan gagal**

Run: `npm test -w @better/core -- mail-folders`
Expected: FAIL — `Cannot find module './mail-folders.ts'`

- [ ] **Step 3: Implementasi minimal**

```ts
// packages/core/src/mail-folders.ts
// Memetakan hasil LIST IMAP ke lima peran yang dipakai UI.
// Murni: tanpa I/O, supaya quirk folder tiap provider bisa diuji tanpa server.
// docs/feature/31.mail-imap-smtp/spec.md §4

export type MailRole = 'inbox' | 'sent' | 'drafts' | 'junk' | 'trash'

export interface ImapMailbox {
  path: string
  /** mis. '\\Sent' — hanya ada bila server mengiklankannya */
  specialUse?: string
  specialUseSource?: 'user' | 'extension' | 'name'
}

export interface FolderRoleMap {
  paths: Record<MailRole, string>
  sources: Record<MailRole, 'extension' | 'name' | 'default'>
}

export const MAIL_ROLES: readonly MailRole[] = ['inbox', 'sent', 'drafts', 'junk', 'trash']

const SPECIAL_USE: Record<MailRole, string> = {
  inbox: '\\Inbox', sent: '\\Sent', drafts: '\\Drafts', junk: '\\Junk', trash: '\\Trash',
}

// Nama yang lazim dipakai cPanel/Hostinger, Gmail, Outlook, dan Zoho.
const NAMES: Record<MailRole, string[]> = {
  inbox: ['inbox'],
  sent: ['sent', 'sent items', 'sent mail', 'sent messages', 'terkirim'],
  drafts: ['drafts', 'draft', 'konsep'],
  junk: ['junk', 'spam', 'bulk mail', 'junk e-mail'],
  trash: ['trash', 'deleted', 'deleted items', 'deleted messages', 'sampah'],
}

/** Buang prefiks hierarki ('INBOX.Sent' → 'sent') supaya cocok dengan daftar nama. */
function leaf(path: string): string {
  return path.split(/[./]/).pop()?.toLowerCase().trim() ?? ''
}

export function resolveFolderRoles(
  mailboxes: ImapMailbox[],
): { ok: true; value: FolderRoleMap } | { ok: false; missing: MailRole[] } {
  const paths = {} as Record<MailRole, string>
  const sources = {} as Record<MailRole, 'extension' | 'name' | 'default'>
  const missing: MailRole[] = []

  for (const role of MAIL_ROLES) {
    const advertised = mailboxes.find((m) => m.specialUse === SPECIAL_USE[role])
    if (advertised) {
      paths[role] = advertised.path
      sources[role] = 'extension'
      continue
    }
    const named = mailboxes.find((m) => NAMES[role].includes(leaf(m.path)))
    if (named) {
      paths[role] = named.path
      sources[role] = 'name'
      continue
    }
    if (role === 'inbox') {
      paths.inbox = 'INBOX'
      sources.inbox = 'default'
      continue
    }
    missing.push(role)
  }

  return missing.length > 0 ? { ok: false, missing } : { ok: true, value: { paths, sources } }
}
```

- [ ] **Step 4: Tambahkan export**

Di `packages/core/package.json`, tambahkan `"./mail-folders": "./src/mail-folders.ts"`.

- [ ] **Step 5: Jalankan — pastikan lulus**

Run: `npm test -w @better/core -- mail-folders`
Expected: PASS (4 tes)

- [ ] **Step 6: Commit**

```bash
git add packages/core && git commit -m "feat(mail): pemetaan peran folder IMAP yang murni dan teruji"
```

---

## Task C: Id komposit & header threading (murni)

**Files:**
- Create: `packages/core/src/mail-id.ts`, `packages/core/src/mail-id.test.ts`, `packages/core/src/mail-threading.ts`, `packages/core/src/mail-threading.test.ts`
- Modify: `packages/core/package.json`

**Interfaces:**
- Consumes: `MailRole` dari `./mail-folders.ts`
- Produces: `encodeMailId(role, uid): string`, `decodeMailId(id): { role: MailRole; uid: number } | null`, `buildReplyHeaders(source, mode): ThreadingHeaders`

- [ ] **Step 1: Tulis tes id yang gagal**

```ts
// packages/core/src/mail-id.test.ts
import { describe, expect, it } from 'vitest'
import { decodeMailId, encodeMailId } from './mail-id.ts'

describe('mail id', () => {
  it('round-trips', () => {
    expect(decodeMailId(encodeMailId('inbox', 42))).toEqual({ role: 'inbox', uid: 42 })
  })

  it('rejects malformed ids', () => {
    for (const bad of ['inbox', 'inbox:', 'inbox:abc', 'inbox:-1', 'inbox:1.5', 'bogus:1', 'inbox:1:2', '']) {
      expect(decodeMailId(bad), bad).toBeNull()
    }
  })
})
```

- [ ] **Step 2: Jalankan — pastikan gagal**

Run: `npm test -w @better/core -- mail-id`
Expected: FAIL — modul belum ada

- [ ] **Step 3: Implementasi id**

```ts
// packages/core/src/mail-id.ts
// Tanpa cache tidak ada id lokal: identitas pesan adalah (peran folder, UID).
// docs/feature/31.mail-imap-smtp/spec.md §5
import { MAIL_ROLES, type MailRole } from './mail-folders.ts'

export function encodeMailId(role: MailRole, uid: number): string {
  return `${role}:${uid}`
}

export function decodeMailId(id: string): { role: MailRole; uid: number } | null {
  const parts = id.split(':')
  if (parts.length !== 2) return null
  const [role, rawUid] = parts as [string, string]
  if (!MAIL_ROLES.includes(role as MailRole)) return null
  if (!/^\d+$/.test(rawUid)) return null
  const uid = Number(rawUid)
  if (!Number.isSafeInteger(uid) || uid < 1) return null
  return { role: role as MailRole, uid }
}
```

- [ ] **Step 4: Tulis tes threading yang gagal**

```ts
// packages/core/src/mail-threading.test.ts
import { describe, expect, it } from 'vitest'
import { buildReplyHeaders } from './mail-threading.ts'

const source = {
  messageId: '<abc@publion.org>',
  references: ['<root@publion.org>'],
  subject: 'Invoice Agustus',
}

describe('buildReplyHeaders', () => {
  it('chains References and sets In-Reply-To', () => {
    const h = buildReplyHeaders(source, 'reply')
    expect(h.inReplyTo).toBe('<abc@publion.org>')
    expect(h.references).toBe('<root@publion.org> <abc@publion.org>')
    expect(h.subject).toBe('Re: Invoice Agustus')
  })

  it('does not stack another prefix on an existing one', () => {
    expect(buildReplyHeaders({ ...source, subject: 'Re: Invoice' }, 'reply').subject).toBe('Re: Invoice')
    expect(buildReplyHeaders({ ...source, subject: 're: invoice' }, 'reply').subject).toBe('re: invoice')
  })

  it('uses Fwd: when forwarding', () => {
    expect(buildReplyHeaders(source, 'forward').subject).toBe('Fwd: Invoice Agustus')
  })

  it('omits threading headers when the source has no Message-ID', () => {
    const h = buildReplyHeaders({ messageId: null, references: [], subject: 'Halo' }, 'reply')
    expect(h.inReplyTo).toBeUndefined()
    expect(h.references).toBeUndefined()
    expect(h.subject).toBe('Re: Halo')
  })
})
```

- [ ] **Step 5: Jalankan — pastikan gagal**

Run: `npm test -w @better/core -- mail-threading`
Expected: FAIL — modul belum ada

- [ ] **Step 6: Implementasi threading**

```ts
// packages/core/src/mail-threading.ts
// Subject 'Re: ...' saja tidak cukup — tanpa In-Reply-To/References,
// threading rusak di sisi penerima.
// docs/feature/31.mail-imap-smtp/spec.md §7
export interface SourceMessage {
  messageId: string | null
  references: string[]
  subject: string
}

export interface ThreadingHeaders {
  inReplyTo?: string
  references?: string
  subject: string
}

const PREFIX = { reply: 'Re: ', forward: 'Fwd: ' } as const

export function buildReplyHeaders(
  source: SourceMessage,
  mode: 'reply' | 'forward',
): ThreadingHeaders {
  const prefix = PREFIX[mode]
  const alreadyPrefixed = source.subject.trim().toLowerCase().startsWith(prefix.toLowerCase())
  const subject = alreadyPrefixed ? source.subject : `${prefix}${source.subject}`

  if (!source.messageId) return { subject }

  const chain = [...source.references, source.messageId]
  return { inReplyTo: source.messageId, references: chain.join(' '), subject }
}
```

- [ ] **Step 7: Tambahkan dua export ke `packages/core/package.json`**

`"./mail-id": "./src/mail-id.ts"`, `"./mail-threading": "./src/mail-threading.ts"`

- [ ] **Step 8: Jalankan & commit**

```bash
npm test -w @better/core
git add packages/core && git commit -m "feat(mail): id komposit folder:uid dan penyusun header threading"
```

---

## Task D: Sanitasi HTML + blokir remote image

**Files:**
- Create: `apps/api/src/modules/mail/sanitize.ts`, `apps/api/src/modules/mail/sanitize.test.ts`

**Interfaces:**
- Produces: `sanitizeMailHtml(raw: string): string`

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// apps/api/src/modules/mail/sanitize.test.ts
import { describe, expect, it } from 'vitest'
import { sanitizeMailHtml } from './sanitize.ts'

describe('sanitizeMailHtml', () => {
  it('strips scripts and event handlers', () => {
    const out = sanitizeMailHtml('<p>hai</p><script>alert(1)</script><img src="x" onerror="alert(1)">')
    expect(out).not.toContain('script')
    expect(out).not.toContain('onerror')
    expect(out).toContain('hai')
  })

  it('moves remote image sources out of src', () => {
    const out = sanitizeMailHtml('<img src="https://track.example/p.gif?u=1">')
    expect(out).not.toMatch(/\ssrc=/)
    expect(out).toContain('data-blocked-src="https://track.example/p.gif?u=1"')
  })

  it('blocks srcset too', () => {
    const out = sanitizeMailHtml('<img srcset="https://track.example/a.png 1x">')
    expect(out).not.toMatch(/\ssrcset=/)
    expect(out).toContain('data-blocked-srcset')
  })

  it('neutralises javascript: links', () => {
    expect(sanitizeMailHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:')
  })

  it('keeps ordinary formatting and links intact', () => {
    const out = sanitizeMailHtml('<p><b>tebal</b> <a href="https://example.com">tautan</a></p>')
    expect(out).toContain('<b>tebal</b>')
    expect(out).toContain('href="https://example.com"')
  })

  it('returns an empty string for empty input', () => {
    expect(sanitizeMailHtml('')).toBe('')
  })
})
```

- [ ] **Step 2: Jalankan — pastikan gagal**

Run: `npm test -w @better/api -- sanitize`
Expected: FAIL — modul belum ada

- [ ] **Step 3: Implementasi**

```ts
// apps/api/src/modules/mail/sanitize.ts
// Badan email adalah HTML dari pengirim tak dikenal — lapis pertama dari tiga.
// Lapis kedua: remote image dipindah ke data-blocked-* supaya tracking pixel
// tidak memberi tahu pengirim bahwa email dibuka.
// Lapis ketiga (<iframe sandbox>) ada di sisi klien.
// docs/feature/31.mail-imap-smtp/spec.md §8
import createDOMPurify from 'isomorphic-dompurify'

const BLOCKED_URL_ATTRS = ['src', 'srcset', 'background', 'poster'] as const

createDOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (!(node instanceof Element)) return
  for (const attr of BLOCKED_URL_ATTRS) {
    const value = node.getAttribute(attr)
    if (value === null) continue
    node.removeAttribute(attr)
    node.setAttribute(`data-blocked-${attr}`, value)
  }
})

export function sanitizeMailHtml(raw: string): string {
  if (raw.trim() === '') return ''
  return createDOMPurify.sanitize(raw, {
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'base', 'link'],
    ADD_ATTR: BLOCKED_URL_ATTRS.map((a) => `data-blocked-${a}`),
  })
}
```

- [ ] **Step 4: Jalankan — pastikan lulus**

Run: `npm test -w @better/api -- sanitize`
Expected: PASS (6 tes)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/mail && git commit -m "feat(mail): sanitasi HTML email dan blokir remote image"
```

---

## Task E: Koneksi, akun, dan endpoint Settings

**Files:**
- Create: `apps/api/src/modules/mail/client.ts`, `apps/api/src/modules/mail/account-service.ts`, `apps/api/src/modules/mail/routes.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/mail-account.test.ts`, tambah kasus ke `apps/api/test/isolation.test.ts`

**Interfaces:**
- Consumes: `resolveFolderRoles` (Task B), `encryptSecret`/`decryptSecret` (Task A), `mailAccount` (Task A)
- Produces: `interface MailConfig { imapHost; imapPort; smtpHost; smtpPort; username; password }`, `withImap<T>(cfg, fn): Promise<T>`, `sendSmtp(cfg, message)`, `testConnection(cfg)`, `getAccount(userId)`, `saveAccount(userId, input)`, `deleteAccount(userId)`

- [ ] **Step 1: Factory koneksi**

```ts
// apps/api/src/modules/mail/client.ts
// Config datang sebagai parameter — modul ini tidak pernah membaca process.env.
// Koneksi berumur pendek: buka, jalankan, tutup (spec §3).
import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'

export interface MailConfig {
  imapHost: string; imapPort: number
  smtpHost: string; smtpPort: number
  username: string; password: string
}

export async function withImap<T>(cfg: MailConfig, fn: (c: ImapFlow) => Promise<T>): Promise<T> {
  const client = new ImapFlow({
    host: cfg.imapHost,
    port: cfg.imapPort,
    secure: true,
    auth: { user: cfg.username, pass: cfg.password },
    disableAutoIdle: true, // koneksi kita pendek; IDLE hanya menambah round-trip
    logger: false,
  })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.logout().catch(() => client.close())
  }
}

export function smtpTransport(cfg: MailConfig) {
  return nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: true,
    auth: { user: cfg.username, pass: cfg.password },
  })
}
```

- [ ] **Step 2: Uji koneksi + resolusi folder di `account-service.ts`**

`testConnection(cfg)` menjalankan: `withImap` → `client.list()` → petakan ke `ImapMailbox[]` (`path`, `specialUse`, `specialUseSource`) → `resolveFolderRoles()`; lalu `smtpTransport(cfg).verify()`. Kembalikan `{ ok: true, roles }` atau lempar `AppError`:

| Kegagalan | `AppError` |
|---|---|
| Login IMAP/SMTP ditolak | `('MAIL_AUTH_FAILED', 401, 'Kredensial mail ditolak server')` |
| Host tidak terjangkau/timeout | `('MAIL_UNAVAILABLE', 503, 'Server mail tidak dapat dihubungi')` |
| `resolveFolderRoles` gagal | `('MAIL_FOLDERS_UNRESOLVED', 422, 'Folder tidak dikenali', { missing })` |

- [ ] **Step 3: Tulis tes endpoint akun yang gagal**

```ts
// apps/api/test/mail-account.test.ts — pola mengikuti finance.test.ts
// Tes ini TIDAK menyentuh server IMAP: testConnection di-mock dengan vi.mock
// supaya jalur HTTP, enkripsi, dan isolasi bisa diuji tanpa jaringan.
```

Kasus wajib:
1. `GET /api/mail/account` tanpa akun → `404` kode `MAIL_NOT_CONFIGURED`
2. `PUT` dengan `testConnection` sukses → `200`, baris tersimpan, `folderRoleSource` terisi
3. `GET` setelah itu → memuat `hasPassword: true`, **tidak** memuat `password` maupun `passwordEnc`
4. `PUT` dengan `testConnection` melempar `MAIL_AUTH_FAILED` → `401` dan **tidak ada baris tersimpan**
5. `PUT` kedua dengan `password` kosong → password lama dipertahankan (decrypt tetap menghasilkan nilai awal)
6. `DELETE` → baris hilang, `GET` berikutnya `404`

- [ ] **Step 4: Jalankan — pastikan gagal**

Run: `npm test -w @better/api -- mail-account`
Expected: FAIL — rute belum di-mount

- [ ] **Step 5: Implementasi service + routes, lalu mount**

`routes.ts` mengikuti pola `modules/agent/settings-routes.ts`: `c.get('userId')`, Zod `safeParse`, `throw new AppError('VALIDATION_ERROR', 422, …)`. Di `apps/api/src/app.ts`, mount di belakang `requireAuth` sejajar router lain: `app.route('/api/mail', mailRoutes)`.

- [ ] **Step 6: Jalankan — pastikan lulus**

Run: `npm test -w @better/api -- mail-account`
Expected: PASS (6 kasus)

- [ ] **Step 7: Tambahkan kasus isolasi**

Di `apps/api/test/isolation.test.ts`, tambahkan: user A menyimpan akun; user B `GET`/`PUT`/`DELETE` → user B melihat **404**, dan akun user A tetap utuh.

- [ ] **Step 8: Verifikasi & commit**

```bash
npm run verify
git add -A && git commit -m "feat(mail): endpoint akun, uji koneksi, resolusi peran folder"
```

---

## Task F: Baca & tulis pesan lewat IMAP

**Files:**
- Create: `apps/api/src/modules/mail/dto.ts`, `apps/api/src/modules/mail/message-service.ts`, `apps/api/src/modules/mail/send-service.ts`
- Modify: `apps/api/src/modules/mail/routes.ts`
- Test: `apps/api/src/modules/mail/dto.test.ts`, `apps/api/test/mail-message.test.ts`

**Interfaces:**
- Consumes: `withImap`/`smtpTransport` (Task E), `encodeMailId`/`decodeMailId` + `buildReplyHeaders` (Task C), `sanitizeMailHtml` (Task D), `FolderRoleMap` (Task B)
- Produces: `toMailMessageDto(role, msg): MailMessageDto`, `listMessages(cfg, roles, role, opts)`, `getMessage(cfg, roles, id)`, `setFlags(cfg, roles, id, patch)`, `moveToTrash(cfg, roles, id)`, `sendMail(cfg, roles, input)`

- [ ] **Step 1: Tulis tes DTO yang gagal**

`dto.test.ts` memberi objek `FetchMessageObject` tiruan (envelope, flags `Set`, `internalDate`, `bodyStructure`) dan menegaskan hasilnya **persis** cocok tipe frontend: `id === 'inbox:42'`, `folder === 'inbox'`, `isRead` benar dari `flags.has('\\Seen')`, `receivedAt` ISO, `attachments` berisi nama saja, `bodyHtml` sudah tersanitasi.

- [ ] **Step 2: Jalankan — pastikan gagal**

Run: `npm test -w @better/api -- dto`
Expected: FAIL — modul belum ada

- [ ] **Step 3: Implementasi DTO**

Pemetaan mengikuti tabel spec §5. `body` dari bagian `text/plain`; `bodyHtml` dari bagian `text/html` yang dilewatkan `sanitizeMailHtml`; bila tak ada bagian HTML, `bodyHtml` dibiarkan `undefined`.

- [ ] **Step 4: Implementasi `message-service.ts`**

- `listMessages` — `getMailboxLock(path)`, lalu `fetchAll` rentang UID menurun dari `beforeUid` (default terbaru), `limit` maks 200, ambil `envelope`+`flags`+`bodyStructure` saja (tanpa `source`).
- `getMessage` — `decodeMailId`, `fetchOne` dengan `source`, urai lewat `mailparser`.
- `setFlags` — `messageFlagsAdd`/`messageFlagsRemove` dengan `{ uid: true }`.
- `moveToTrash` — `messageMove(uid, roles.paths.trash, { uid: true })`.
- `role === 'flagged'` → `SEARCH FLAGGED` pada kelima path dalam satu koneksi, gabungkan, tanpa paginasi (spec §6).

**Aturan wajib:** jangan panggil perintah IMAP lain di dalam loop `fetch()` — pakai `fetchAll()` lalu proses setelahnya.

- [ ] **Step 5: Implementasi `send-service.ts`**

Urutan spec §7: susun header lewat `buildReplyHeaders` bila `inReplyToId` ada → `transport.sendMail()` → `client.append(roles.paths.sent, raw, ['\\Seen'])`. `APPEND` gagal **tidak** membatalkan respons sukses; kembalikan `{ sent: true, appendedToSent: false }`.

- [ ] **Step 6: Tes integrasi**

`mail-message.test.ts` dengan `withImap` di-mock: list memetakan DTO benar · `beforeUid` diteruskan · `flagged` menggabungkan lintas folder · `PATCH` memanggil `messageFlagsAdd` dengan `{ uid: true }` · `DELETE` memanggil `messageMove` ke path Trash · `send` memanggil `append` ke path Sent · `append` gagal → tetap `200` dengan `appendedToSent: false` · id tak sah → `422`.

- [ ] **Step 7: Verifikasi & commit**

```bash
npm run verify
git add -A && git commit -m "feat(mail): baca, flag, pindah, dan kirim pesan lewat IMAP/SMTP"
```

---

## Task G: Frontend — sambungkan MailView & halaman Settings

**Files:**
- Create: `apps/web/src/api/mail.ts`, `apps/web/src/components/MailSettings.tsx` + `.css`
- Modify: `apps/web/src/types/index.ts`, `MailView.tsx`, `MailList.tsx`, `MailReadingPane.tsx`, `MailComposeForm.tsx`
- Test: `e2e/mail.spec.ts`

- [ ] **Step 1: Tambahkan satu field ke tipe frontend**

Di `apps/web/src/types/index.ts`, tambahkan `bodyHtml?: string` ke `MailMessage`. Aditif dan opsional — tidak ada field lain yang boleh ditambahkan (spec §5).

- [ ] **Step 2: Klien HTTP**

`apps/web/src/api/mail.ts` membungkus kedelapan endpoint spec §6, mengikuti pola klien API yang sudah ada di `apps/web/src/api/`.

- [ ] **Step 3: Reading pane pakai iframe sandbox**

`MailReadingPane` merender `bodyHtml` lewat `<iframe sandbox srcDoc={html} />` — **tanpa** `allow-scripts` dan **tanpa** `allow-same-origin`. Tambahkan state `showImages`; saat aktif, ganti `data-blocked-src` → `src` (dan `data-blocked-srcset` → `srcset`) pada string HTML sebelum diberikan ke `srcDoc`. Bila `bodyHtml` kosong, render `body` teks apa adanya.

- [ ] **Step 4: MailView ambil dari API**

Ganti sumber `mailMessages` dari `mockData.ts` jadi `listMessages()` per folder aktif. Klik pesan → `getMessage()` untuk badan penuh → `PATCH { isRead: true }`. Flag toggle optimistic dengan revert saat gagal. Kirim non-optimistic (loading sampai respons). Pertahankan seed mock sebagai fixture — jangan hapus `mockData.ts`.

- [ ] **Step 5: Tiga keadaan kegagalan**

Petakan kode error spec §6.1 ke UI: `MAIL_NOT_CONFIGURED` → CTA "Hubungkan akun mail di Settings" · `MAIL_AUTH_FAILED` → arahkan ke Settings · `MAIL_UNAVAILABLE` → tombol "Coba lagi". Jangan pernah menampilkan daftar kosong tanpa penjelasan.

- [ ] **Step 6: Halaman Settings**

`MailSettings.tsx` mengikuti pola `AgentSettingsView` yang sudah ada: form host/port/username/password, tombol "Test connection" (`POST /account/test`), submit lewat `PUT`. Password kosong = tidak diubah. Tampilkan pesan error spesifik dari server, bukan pesan generik.

- [ ] **Step 7: E2E**

`e2e/mail.spec.ts`: tanpa akun → CTA Settings terlihat · kredensial salah → pesan spesifik · dengan akun (API di-stub) → inbox terisi · buka pesan → iframe ada, `data-blocked-src` masih ada sebelum tombol ditekan · klik "Tampilkan gambar" → berubah jadi `src`.

- [ ] **Step 8: Verifikasi penuh & commit**

```bash
npm run verify
npm run test:e2e -- mail
git add -A && git commit -m "feat(mail): sambungkan MailView ke API dan tambah halaman Settings mail"
```

- [ ] **Step 9: Verifikasi manual di browser (gate Done)**

Policy §2 mensyaratkan verifikasi **benar-benar dijalankan** sebelum kartu boleh pindah ke Done: buka aplikasi dengan akun sungguhan, baca satu email, balas, dan pastikan balasan muncul di Sent serta ter-thread benar di klien mail lain. Tanpa langkah ini kartu tetap di **Review**, sehijau apa pun tesnya.

---

## Self-Review

**Cakupan spec:**

| Bagian spec | Task |
|---|---|
| §4 tabel `mail_account` | A |
| §4 `folderRoleSource`, §9 resolusi peran | B, E |
| §5 id komposit + kontrak DTO | C, F |
| §6 endpoint | E (akun), F (pesan) |
| §6.1 kegagalan kelas satu | E (kode), G (UI) |
| §7 kirim + APPEND + threading | C (murni), F (I/O) |
| §8 kredensial terenkripsi | A, E |
| §8 tiga lapis HTML | D (lapis 1–2), G (lapis 3) |
| §8.1 aturan `imapflow` | E, F |
| §10 testing | tersebar; E2E di G |
| §12 success criteria | G Step 9 |

Tidak ada bagian spec tanpa task.

**Konsistensi tipe:** `MailRole` didefinisikan sekali di `mail-folders.ts` dan dipakai ulang oleh `mail-id.ts`, DTO, dan service. `FolderRoleMap.paths`/`.sources` dipakai dengan nama yang sama di Task E dan F. `encodeMailId`/`decodeMailId` dipakai konsisten di F.

**Catatan risiko:** Task F adalah task terbesar dan satu-satunya yang menyentuh IMAP secara nyata. Bila saat dikerjakan ternyata terlalu besar untuk satu review, pecah pada batas alami baca/tulis: F1 (DTO + `listMessages` + `getMessage`), F2 (`setFlags` + `moveToTrash` + `sendMail`).
