# Finance Implementation Plan

> **Untuk agent pelaksana:** SUB-SKILL WAJIB — pakai
> `superpowers:subagent-driven-development` (disarankan) atau
> `superpowers:executing-plans` untuk mengerjakan plan ini task demi task.
> Langkah memakai checkbox (`- [ ]`) supaya bisa ditandai.

**Spec:** [`spec.md`](spec.md) — rujukan pasal di plan ini (§4.3, §9.1, dst)
menunjuk ke sana.

**Goal:** Modul pencatatan keuangan personal + bisnis di dalam app ini: satu
tabel transaksi, semua saldo dihitung dari agregasi, delapan aksi UI yang
menyembunyikan istilah teknis.

**Architecture:** Server-backed seperti modul Storage dan Mail — bukan
local-first. Aturan bentuk data (§6) dan pemetaan aksi (§7) hidup sebagai
fungsi murni di `@better/core` dan dipakai bersama client dan API. Tidak ada
kolom saldo di mana pun; §9 seluruhnya query agregasi.

**Tech Stack:** Hono + drizzle-orm + Postgres 16 (API) · React 19 + Vite
(web) · vitest (unit + integrasi) · Playwright (e2e) · `@better/core` sebagai
paket bersama.

## Global Constraints

- **Prinsip 2 tidak boleh dilanggar:** tidak ada kolom saldo di tabel mana pun.
  Kalau sebuah task terasa butuh menyimpan saldo, task itu salah — kembali ke
  §2 spec.
- **Rambu kantong:** `pocket` berhenti di `'personal' | 'business'`. Jangan
  tambah nilai ketiga.
- `amount` selalu **bigint rupiah bulat dan positif**. Arah uang ditentukan
  `type`, bukan tanda minus. Tidak ada float, tidak ada desimal.
- Setiap query agregasi dan listing **wajib** memfilter
  `user_id = :user AND deleted_at IS NULL`.
- Nama tabel diawali `finance_`; id memakai `uuidv7()` dari `@better/core/id`,
  di-generate server.
- Bentuk respons API mengikuti **tipe frontend** (camelCase), bukan kolom DB —
  CLAUDE.md: frontend types adalah kontrak.
- Tanggal transaksi adalah `date` (DATE lokal user), bukan timestamp. Pakai
  `todayInTimezone(user.timezone)` dari `@better/core/date`.
- Verifikasi tiap task: `npm run verify` di root (typecheck + lint + test +
  build).

## Prasyarat tes integrasi

Blok A sampai E butuh Postgres tes yang sudah jalan. Sekali saja, sebelum mulai:

```bash
docker compose -f docker-compose.test.yml up -d
DATABASE_URL=postgresql://postgres@127.0.0.1:55432/better_test \
  npm run db:migrate -w @better/api
```

Setiap kali blok A menambah migrasi, jalankan ulang perintah `db:migrate` di
atas sebelum menjalankan tes.

## File map

**Dibuat:**

| File | Tanggung jawab |
|---|---|
| `packages/core/src/finance-validate.ts` | Tipe bersama + `validateTransaction` (§6) |
| `packages/core/src/finance-validate.test.ts` | Satu kasus per baris tabel §6 |
| `packages/core/src/finance-action.ts` | `buildTransaction` — 8 aksi (§7) |
| `packages/core/src/finance-action.test.ts` | Satu kasus per baris tabel §7 |
| `apps/api/src/db/schema/finance.ts` | Tiga tabel + indeks + check |
| `apps/api/src/modules/finance/seed.ts` | `ensureFinanceSeed` |
| `apps/api/src/modules/finance/queries.ts` | Agregasi §9.1–9.7 |
| `apps/api/src/modules/finance/service.ts` | CRUD + idempotency + cascade §11.2 |
| `apps/api/src/modules/finance/dto.ts` | Baris DB → bentuk tipe frontend |
| `apps/api/src/modules/finance/routes.ts` | Endpoint §8 |
| `apps/api/test/finance.test.ts` | Integrasi §9 + idempotency + cascade |
| `apps/web/src/store/finance-api.ts` | Pembungkus fetch `/api/finance/*` |
| `apps/web/src/components/finance/FinanceView.tsx` | Shell + empat tab |
| `apps/web/src/components/finance/FinanceHome.tsx` | Beranda (§9.4, §9.5, target, chip) |
| `apps/web/src/components/finance/TransactionList.tsx` | Tab Riwayat |
| `apps/web/src/components/finance/AccountsTab.tsx` | Tab Akun + kekayaan bersih |
| `apps/web/src/components/finance/ReceivablesTab.tsx` | Tab Piutang + §11.2/§11.3 |
| `apps/web/src/components/finance/ActionPicker.tsx` | Daftar situasi §7 |
| `apps/web/src/components/finance/TransactionForm.tsx` | Form per aksi |
| `apps/web/src/components/finance/FinanceSetup.tsx` | Setup awal §10.4 |
| `apps/web/src/components/finance/Finance.css` | Gaya modul |
| `e2e/finance.spec.ts` | Alur 90% |

**Diubah:**

| File | Perubahan |
|---|---|
| `apps/api/src/db/schema/user.ts` | +3 kolom setting (§5.5) |
| `apps/api/src/db/client.ts` | daftarkan schema finance |
| `apps/api/src/app.ts` | `app.route('/api', financeRoutes)` |
| `apps/api/src/modules/user/routes.ts` | `PATCH /me` menerima 3 setting |
| `apps/api/test/helpers.ts` | `resetDb` men-truncate tabel finance |
| `apps/web/src/types/index.ts` | `ViewType` + tipe Finance |
| `apps/web/src/routes.ts` | field `sub` |
| `apps/web/src/components/Sidebar.tsx` | item nav Finance |
| `apps/web/src/App.tsx` | render `FinanceView` |
| `packages/core/package.json` | dua entry `exports` baru |

---

## Task A: Skema, setting, dan seed

**Files:**
- Create: `apps/api/src/db/schema/finance.ts`
- Create: `apps/api/src/modules/finance/seed.ts`
- Modify: `apps/api/src/db/schema/user.ts`
- Modify: `apps/api/src/db/client.ts`
- Modify: `apps/api/test/helpers.ts` (`resetDb`)
- Test: `apps/api/test/finance.test.ts`

**Interfaces:**
- Consumes: `appUser` dari `./user.ts`; `uuidv7` dari `@better/core/id`.
- Produces: tabel `financeAccount`, `financeCategory`, `financeTransaction`;
  `ensureFinanceSeed(userId: string): Promise<{ receivableAccountId: string }>`.

- [ ] **Step 1: Tulis skema finance**

Create `apps/api/src/db/schema/finance.ts`:

```ts
// docs/feature/30.finance/spec.md §5 — tiga tabel, tanpa satu pun kolom saldo.
import { bigint, boolean, check, date, index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { appUser } from './user.ts'

export const financeAccount = pgTable(
  'finance_account',
  {
    id: text('id').primaryKey(), // UUIDv7, server-generated
    userId: text('user_id').notNull().references(() => appUser.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    kind: text('kind').notNull(), // 'cash' | 'bank' | 'receivable'
    // Kantong bawaan untuk form input saja — kebenaran soal uang di dalamnya
    // tetap di from_pocket/to_pocket tiap transaksi (spec §5.1).
    pocket: text('pocket').notNull().default('personal'),
    isSpendable: boolean('is_spendable').notNull().default(true),
    isSystem: boolean('is_system').notNull().default(false),
    isArchived: boolean('is_archived').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('finance_account_user').on(t.userId),
    // Akun Piutang adalah akun sistem: tepat satu per user.
    uniqueIndex('finance_account_receivable').on(t.userId).where(sql`${t.kind} = 'receivable'`),
    check('finance_account_kind_check', sql`${t.kind} IN ('cash','bank','receivable')`),
    check('finance_account_pocket_check', sql`${t.pocket} IN ('personal','business')`),
  ],
)

export const financeCategory = pgTable(
  'finance_category',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => appUser.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull(), // 'income' | 'expense'
    icon: text('icon'),
    isArchived: boolean('is_archived').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('finance_category_user').on(t.userId),
    check('finance_category_type_check', sql`${t.type} IN ('income','expense')`),
  ],
)

export const financeTransaction = pgTable(
  'finance_transaction',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => appUser.id, { onDelete: 'cascade' }),
    // DATE lokal user, bukan timestamp UTC — spec §11.7.
    date: date('date').notNull(),
    type: text('type').notNull(), // 'income' | 'expense' | 'transfer'
    // Rupiah bulat. mode 'number' aman: nilainya jauh di bawah 2^53.
    amount: bigint('amount', { mode: 'number' }).notNull(),
    categoryId: text('category_id').references(() => financeCategory.id),
    fromAccountId: text('from_account_id').references(() => financeAccount.id),
    fromPocket: text('from_pocket'),
    toAccountId: text('to_account_id').references(() => financeAccount.id),
    toPocket: text('to_pocket'),
    counterparty: text('counterparty'),
    note: text('note'),
    idempotencyKey: text('idempotency_key'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('finance_tx_user_date').on(t.userId, t.date.desc()),
    index('finance_tx_from_account').on(t.userId, t.fromAccountId),
    index('finance_tx_to_account').on(t.userId, t.toAccountId),
    index('finance_tx_counterparty').on(t.userId, t.counterparty),
    index('finance_tx_pocket').on(t.userId, t.date, t.fromPocket),
    uniqueIndex('finance_tx_idempotency').on(t.userId, t.idempotencyKey),
    check('finance_tx_type_check', sql`${t.type} IN ('income','expense','transfer')`),
    check('finance_tx_amount_check', sql`${t.amount} > 0`),
    check('finance_tx_from_pocket_check', sql`${t.fromPocket} IS NULL OR ${t.fromPocket} IN ('personal','business')`),
    check('finance_tx_to_pocket_check', sql`${t.toPocket} IS NULL OR ${t.toPocket} IN ('personal','business')`),
  ],
)
```

Bentuk `from`/`to` per tipe **sengaja tidak** di-`check` di DB — aturannya
kondisional dan lebih jelas dibaca sebagai kode di Task B (§6).

- [ ] **Step 2: Tambah tiga kolom setting ke `app_user`**

Modify `apps/api/src/db/schema/user.ts` — tambahkan di dalam `pgTable`, tepat
setelah `storageQuotaBytes`:

```ts
  // Finance — spec 30.finance §5.5. Menempel di app_user seperti preferensi
  // lain supaya ikut PATCH /api/me dan Finance tidak butuh endpoint setting.
  financeBusinessEnabled: boolean('finance_business_enabled').notNull().default(false),
  financeSavingsTargetMode: text('finance_savings_target_mode'), // 'amount' | 'percent'
  financeSavingsTargetValue: bigint('finance_savings_target_value', { mode: 'number' }),
```

Tambahkan `boolean` ke daftar impor `drizzle-orm/pg-core` di baris 1 file itu.

- [ ] **Step 3: Daftarkan skema ke client**

Modify `apps/api/src/db/client.ts` — tambahkan impor setelah baris
`import * as storage from './schema/storage.ts'`:

```ts
import * as finance from './schema/finance.ts'
```

lalu tambahkan `...finance` ke objek `schema` yang diteruskan ke `drizzle()`,
mengikuti persis bentuk `...storage` yang sudah ada di file itu.

- [ ] **Step 4: Generate migrasi dan terapkan ke DB tes**

```bash
npm run db:generate -w @better/api
docker compose -f docker-compose.test.yml up -d
DATABASE_URL=postgresql://postgres@127.0.0.1:55432/better_test \
  npm run db:migrate -w @better/api
```

Expected: file baru muncul di `apps/api/drizzle/`, dan perintah migrate
mencetak `Migrations applied.`

- [ ] **Step 5: Ajarkan `resetDb` soal tabel baru**

Modify `apps/api/test/helpers.ts` — di dalam `resetDb`, tambahkan ketiga tabel
di **depan** daftar truncate (urutan tidak penting karena `cascade`, tapi tetap
kelompokkan):

```ts
    sql`truncate table finance_transaction, finance_account, finance_category, storage_file, storage_folder, storage_area, agent_file, agent_session, agent_project, ai_settings, completion, tag, node, notification, push_subscription, reminder, app_user restart identity cascade`,
```

Melewatkan langkah ini membuat tes finance bocor ke tes lain — dan gagalnya
baru muncul saat urutan file tes berubah, jauh dari penyebabnya.

- [ ] **Step 6: Tulis tes seed yang gagal**

Create `apps/api/test/finance.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../src/db/client.ts'
import { financeAccount, financeCategory } from '../src/db/schema/finance.ts'
import { ensureFinanceSeed } from '../src/modules/finance/seed.ts'
import { resetDb, createTestUser } from './helpers.ts'

beforeEach(async () => {
  await resetDb()
})

describe('ensureFinanceSeed', () => {
  it('membuat Dompet dan Piutang, tanpa akun Tabungan (spec §4.3)', async () => {
    const user = await createTestUser('seed@example.com')
    await ensureFinanceSeed(user.id)

    const accounts = await db.select().from(financeAccount).where(eq(financeAccount.userId, user.id))
    expect(accounts.map((a) => a.name).sort()).toEqual(['Dompet', 'Piutang'])

    const piutang = accounts.find((a) => a.kind === 'receivable')!
    expect(piutang.isSystem).toBe(true)
    expect(piutang.isSpendable).toBe(false)

    const dompet = accounts.find((a) => a.kind === 'cash')!
    expect(dompet.isSpendable).toBe(true)
    expect(dompet.isSystem).toBe(false)
  })

  it('membuat 12 kategori default', async () => {
    const user = await createTestUser('seed2@example.com')
    await ensureFinanceSeed(user.id)

    const cats = await db.select().from(financeCategory).where(eq(financeCategory.userId, user.id))
    expect(cats.filter((c) => c.type === 'income').map((c) => c.name)).toEqual(['Gaji', 'Bonus', 'Project', 'Lain-lain'])
    expect(cats.filter((c) => c.type === 'expense')).toHaveLength(8)
  })

  it('idempoten — dipanggil dua kali tidak menggandakan apa pun', async () => {
    const user = await createTestUser('seed3@example.com')
    const first = await ensureFinanceSeed(user.id)
    const second = await ensureFinanceSeed(user.id)

    expect(second.receivableAccountId).toBe(first.receivableAccountId)
    const accounts = await db.select().from(financeAccount).where(eq(financeAccount.userId, user.id))
    expect(accounts).toHaveLength(2)
  })
})
```

- [ ] **Step 7: Jalankan tes, pastikan gagal**

Run: `npm test -w @better/api -- finance`
Expected: FAIL — `Failed to resolve import ".../modules/finance/seed.ts"`

- [ ] **Step 8: Implementasi seed**

Create `apps/api/src/modules/finance/seed.ts`:

```ts
// Seed lazy, bukan migrasi — persis pola getOrCreatePersonalArea di modul
// storage. Dipanggil di awal tiap request finance (spec §8), jadi user lama
// tidak butuh backfill dan user baru tidak butuh langkah ekstra.
import { and, eq } from 'drizzle-orm'
import { uuidv7 } from '@better/core/id'
import { db } from '../../db/client.ts'
import { financeAccount, financeCategory } from '../../db/schema/finance.ts'

const INCOME_CATEGORIES = ['Gaji', 'Bonus', 'Project', 'Lain-lain']
const EXPENSE_CATEGORIES = ['Makan', 'Transport', 'Tagihan', 'Belanja', 'Hiburan', 'Kesehatan', 'Relasi', 'Lain-lain']

export interface FinanceSeed {
  receivableAccountId: string
}

export async function ensureFinanceSeed(userId: string): Promise<FinanceSeed> {
  const [existing] = await db
    .select({ id: financeAccount.id })
    .from(financeAccount)
    .where(and(eq(financeAccount.userId, userId), eq(financeAccount.kind, 'receivable')))
    .limit(1)
  if (existing) return { receivableAccountId: existing.id }

  const receivableId = uuidv7()
  await db.transaction(async (tx) => {
    await tx.insert(financeAccount).values([
      {
        id: uuidv7(), userId, name: 'Dompet', kind: 'cash', pocket: 'personal',
        isSpendable: true, isSystem: false, sortOrder: 0,
      },
      {
        // Akun sistem: tidak bisa dihapus maupun di-rename (spec §5.1).
        id: receivableId, userId, name: 'Piutang', kind: 'receivable', pocket: 'personal',
        isSpendable: false, isSystem: true, sortOrder: 100,
      },
    ])
    await tx.insert(financeCategory).values([
      ...INCOME_CATEGORIES.map((name, i) => ({ id: uuidv7(), userId, name, type: 'income', sortOrder: i })),
      ...EXPENSE_CATEGORIES.map((name, i) => ({ id: uuidv7(), userId, name, type: 'expense', sortOrder: i })),
    ])
  })
  return { receivableAccountId: receivableId }
}
```

Perhatikan `.onConflictDoNothing()` **tidak** dipakai: unique index
`finance_account_receivable` yang menjadikan pemanggilan kedua tidak pernah
sampai ke insert, karena `select` di atas sudah menemukan barisnya.

- [ ] **Step 9: Jalankan tes, pastikan lulus**

Run: `npm test -w @better/api -- finance`
Expected: PASS — 3 tes.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/db/schema/finance.ts apps/api/src/db/schema/user.ts \
  apps/api/src/db/client.ts apps/api/src/modules/finance/seed.ts \
  apps/api/test/helpers.ts apps/api/test/finance.test.ts apps/api/drizzle
git commit -m "feat(finance): skema tiga tabel, setting di app_user, seed lazy"
```

---

## Task B: Aturan bersama di `@better/core`

**Files:**
- Create: `packages/core/src/finance-validate.ts`
- Create: `packages/core/src/finance-validate.test.ts`
- Create: `packages/core/src/finance-action.ts`
- Create: `packages/core/src/finance-action.test.ts`
- Modify: `packages/core/package.json` (`exports`)

**Interfaces:**
- Consumes: `addDays`, `compareDates` dari `@better/core/date`.
- Produces:
  - `type Pocket = 'personal' | 'business'`
  - `type FinanceType = 'income' | 'expense' | 'transfer'`
  - `interface TransactionDraft` (10 field, lihat Step 1)
  - `type Violation = { field: string; code: string }`
  - `validateTransaction(draft: TransactionDraft, ctx: ValidateContext): Violation[]`
  - `type FinanceActionId` (8 nilai)
  - `buildTransaction(action: FinanceActionId, input: ActionInput, ctx: ActionContext): TransactionDraft`

- [ ] **Step 1: Tulis tes validator yang gagal**

Create `packages/core/src/finance-validate.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { validateTransaction, type TransactionDraft, type ValidateContext } from './finance-validate.ts'

const ctx: ValidateContext = {
  today: '2026-08-11',
  receivableAccountId: 'acc-piutang',
  categoryType: 'expense',
  archivedIds: [],
}

function draft(overrides: Partial<TransactionDraft> = {}): TransactionDraft {
  return {
    date: '2026-08-11',
    type: 'expense',
    amount: 25000,
    categoryId: 'cat-makan',
    fromAccountId: 'acc-bca',
    fromPocket: 'personal',
    toAccountId: null,
    toPocket: null,
    counterparty: null,
    note: null,
    ...overrides,
  }
}

function codes(...args: Parameters<typeof validateTransaction>): string[] {
  return validateTransaction(...args).map((v) => v.code)
}

describe('bentuk per tipe (spec §6)', () => {
  it('expense yang benar tidak melanggar apa pun', () => {
    expect(validateTransaction(draft(), ctx)).toEqual([])
  })

  it('expense wajib punya from', () => {
    expect(codes(draft({ fromAccountId: null, fromPocket: null }), ctx)).toContain('FROM_REQUIRED')
  })

  it('expense tidak boleh punya to', () => {
    expect(codes(draft({ toAccountId: 'acc-bca', toPocket: 'personal' }), ctx)).toContain('TO_FORBIDDEN')
  })

  it('expense wajib punya kategori', () => {
    expect(codes(draft({ categoryId: null }), ctx)).toContain('CATEGORY_REQUIRED')
  })

  it('expense menolak kategori bertipe income', () => {
    expect(codes(draft(), { ...ctx, categoryType: 'income' })).toContain('CATEGORY_TYPE_MISMATCH')
  })

  it('income wajib punya to dan tidak boleh punya from', () => {
    const d = draft({ type: 'income', fromAccountId: null, fromPocket: null, toAccountId: null, toPocket: null })
    expect(codes(d, { ...ctx, categoryType: 'income' })).toContain('TO_REQUIRED')
    const withFrom = draft({ type: 'income', toAccountId: 'acc-bca', toPocket: 'personal' })
    expect(codes(withFrom, { ...ctx, categoryType: 'income' })).toContain('FROM_FORBIDDEN')
  })

  it('transfer wajib punya from dan to, dan tidak boleh punya kategori', () => {
    const d = draft({
      type: 'transfer', categoryId: 'cat-makan',
      toAccountId: 'acc-tabungan', toPocket: 'personal',
    })
    expect(codes(d, ctx)).toContain('CATEGORY_FORBIDDEN')
  })

  it('transfer ke dirinya sendiri persis ditolak', () => {
    const d = draft({
      type: 'transfer', categoryId: null,
      toAccountId: 'acc-bca', toPocket: 'personal',
    })
    expect(codes(d, ctx)).toContain('SELF_TRANSFER')
  })

  it('transfer akun sama tapi beda kantong diterima — itu prive', () => {
    const d = draft({
      type: 'transfer', categoryId: null, fromPocket: 'business',
      toAccountId: 'acc-bca', toPocket: 'personal',
    })
    expect(validateTransaction(d, ctx)).toEqual([])
  })
})

describe('aturan tambahan (spec §6)', () => {
  it('amount harus positif', () => {
    expect(codes(draft({ amount: 0 }), ctx)).toContain('AMOUNT_NOT_POSITIVE')
    expect(codes(draft({ amount: -1 }), ctx)).toContain('AMOUNT_NOT_POSITIVE')
  })

  it('date maksimal H+1', () => {
    expect(validateTransaction(draft({ date: '2026-08-12' }), ctx)).toEqual([])
    expect(codes(draft({ date: '2026-08-13' }), ctx)).toContain('DATE_TOO_FAR_FUTURE')
  })

  it('transaksi yang menyentuh akun Piutang wajib punya counterparty', () => {
    const d = draft({
      type: 'transfer', categoryId: null,
      toAccountId: 'acc-piutang', toPocket: 'personal',
    })
    expect(codes(d, ctx)).toContain('COUNTERPARTY_REQUIRED')
    expect(validateTransaction({ ...d, counterparty: 'Budi' }, ctx)).toEqual([])
  })

  it('akun atau kategori terarsip tidak boleh dipakai transaksi baru', () => {
    expect(codes(draft(), { ...ctx, archivedIds: ['acc-bca'] })).toContain('ARCHIVED')
    expect(codes(draft(), { ...ctx, archivedIds: ['cat-makan'] })).toContain('ARCHIVED')
  })
})
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `npm test -w @better/core -- finance-validate`
Expected: FAIL — `Failed to resolve import './finance-validate.ts'`

- [ ] **Step 3: Implementasi validator**

Create `packages/core/src/finance-validate.ts`:

```ts
// Bentuk data transaksi — docs/feature/30.finance/spec.md §6.
// Fungsi murni, tanpa I/O: dipakai client untuk mematikan tombol Simpan
// sebelum request, dan dipakai API sebagai penjaga sebenarnya.
import { addDays, compareDates } from './date.ts'

export type Pocket = 'personal' | 'business'
export type FinanceType = 'income' | 'expense' | 'transfer'

export interface TransactionDraft {
  date: string // YYYY-MM-DD, tanggal lokal user
  type: FinanceType
  amount: number // rupiah bulat, selalu positif
  categoryId: string | null
  fromAccountId: string | null
  fromPocket: Pocket | null
  toAccountId: string | null
  toPocket: Pocket | null
  counterparty: string | null
  note: string | null
}

export type ViolationCode =
  | 'AMOUNT_NOT_POSITIVE'
  | 'DATE_TOO_FAR_FUTURE'
  | 'CATEGORY_REQUIRED'
  | 'CATEGORY_FORBIDDEN'
  | 'CATEGORY_TYPE_MISMATCH'
  | 'FROM_REQUIRED'
  | 'FROM_FORBIDDEN'
  | 'TO_REQUIRED'
  | 'TO_FORBIDDEN'
  | 'SELF_TRANSFER'
  | 'COUNTERPARTY_REQUIRED'
  | 'ARCHIVED'

export type ViolationField = 'amount' | 'date' | 'categoryId' | 'fromAccountId' | 'toAccountId' | 'counterparty'

export interface Violation {
  field: ViolationField
  code: ViolationCode
}

export interface ValidateContext {
  /** Tanggal hari ini di timezone user — YYYY-MM-DD. */
  today: string
  /** Id akun Piutang milik user; null kalau belum di-seed. */
  receivableAccountId: string | null
  /**
   * Tipe kategori yang dirujuk draft.categoryId, di-resolve pemanggil
   * (client dari daftar kategori yang sudah dimuat, server dari DB).
   * null bila draft tidak punya kategori.
   */
  categoryType: 'income' | 'expense' | null
  /** Id akun & kategori yang is_archived — tidak boleh dipakai transaksi baru. */
  archivedIds: string[]
}

export function validateTransaction(draft: TransactionDraft, ctx: ValidateContext): Violation[] {
  const v: Violation[] = []
  const hasFrom = draft.fromAccountId !== null
  const hasTo = draft.toAccountId !== null

  // 1. Bentuk from/to/category per tipe — tabel §6.
  if (draft.type === 'income') {
    if (hasFrom) v.push({ field: 'fromAccountId', code: 'FROM_FORBIDDEN' })
    if (!hasTo) v.push({ field: 'toAccountId', code: 'TO_REQUIRED' })
  } else if (draft.type === 'expense') {
    if (!hasFrom) v.push({ field: 'fromAccountId', code: 'FROM_REQUIRED' })
    if (hasTo) v.push({ field: 'toAccountId', code: 'TO_FORBIDDEN' })
  } else {
    if (!hasFrom) v.push({ field: 'fromAccountId', code: 'FROM_REQUIRED' })
    if (!hasTo) v.push({ field: 'toAccountId', code: 'TO_REQUIRED' })
  }

  if (draft.type === 'transfer') {
    if (draft.categoryId !== null) v.push({ field: 'categoryId', code: 'CATEGORY_FORBIDDEN' })
  } else if (draft.categoryId === null) {
    v.push({ field: 'categoryId', code: 'CATEGORY_REQUIRED' })
  } else if (ctx.categoryType !== null && ctx.categoryType !== draft.type) {
    v.push({ field: 'categoryId', code: 'CATEGORY_TYPE_MISMATCH' })
  }

  // 2. Arah uang ditentukan type, bukan tanda minus.
  if (!(draft.amount > 0)) v.push({ field: 'amount', code: 'AMOUNT_NOT_POSITIVE' })

  // 3. Toleransi satu hari untuk selisih timezone perangkat.
  if (compareDates(draft.date, addDays(ctx.today, 1)) === 1) {
    v.push({ field: 'date', code: 'DATE_TOO_FAR_FUTURE' })
  }

  // 4. Transfer ke diri sendiri persis: akun sama DAN kantong sama.
  if (
    draft.type === 'transfer' && hasFrom && hasTo &&
    draft.fromAccountId === draft.toAccountId && draft.fromPocket === draft.toPocket
  ) {
    v.push({ field: 'toAccountId', code: 'SELF_TRANSFER' })
  }

  // 5. Piutang tanpa nama orang = daftar piutang yang tidak bisa dibaca (§9.6).
  const touchesReceivable =
    ctx.receivableAccountId !== null &&
    (draft.fromAccountId === ctx.receivableAccountId || draft.toAccountId === ctx.receivableAccountId)
  if (touchesReceivable && !draft.counterparty?.trim()) {
    v.push({ field: 'counterparty', code: 'COUNTERPARTY_REQUIRED' })
  }

  // 6. Terarsip tetap sah di transaksi lama, tidak untuk yang baru (§11.6).
  const archived = new Set(ctx.archivedIds)
  if (draft.fromAccountId && archived.has(draft.fromAccountId)) v.push({ field: 'fromAccountId', code: 'ARCHIVED' })
  if (draft.toAccountId && archived.has(draft.toAccountId)) v.push({ field: 'toAccountId', code: 'ARCHIVED' })
  if (draft.categoryId && archived.has(draft.categoryId)) v.push({ field: 'categoryId', code: 'ARCHIVED' })

  return v
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `npm test -w @better/core -- finance-validate`
Expected: PASS — 13 tes.

- [ ] **Step 5: Tulis tes mapping aksi yang gagal**

Create `packages/core/src/finance-action.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildTransaction, type ActionContext } from './finance-action.ts'

const ctx: ActionContext = {
  today: '2026-08-11',
  lastUsedAccountId: 'acc-bca',
  receivableAccountId: 'acc-piutang',
  salaryCategoryId: 'cat-gaji',
  projectCategoryId: 'cat-project',
}

describe('buildTransaction (spec §7)', () => {
  it('expense: default akun terakhir, kantong personal, hari ini', () => {
    expect(buildTransaction('expense', { amount: 25000, categoryId: 'cat-makan' }, ctx)).toEqual({
      date: '2026-08-11', type: 'expense', amount: 25000, categoryId: 'cat-makan',
      fromAccountId: 'acc-bca', fromPocket: 'personal',
      toAccountId: null, toPocket: null, counterparty: null, note: null,
    })
  })

  it('salary: income ke akun pilihan, kategori Gaji', () => {
    const d = buildTransaction('salary', { amount: 9_000_000, accountId: 'acc-bca' }, ctx)
    expect(d).toMatchObject({ type: 'income', toAccountId: 'acc-bca', toPocket: 'personal', categoryId: 'cat-gaji', fromAccountId: null })
  })

  it('save: transfer personal→personal, tanpa kategori', () => {
    const d = buildTransaction('save', { amount: 500_000, accountId: 'acc-bca', toAccountId: 'acc-tabungan' }, ctx)
    expect(d).toMatchObject({
      type: 'transfer', fromAccountId: 'acc-bca', fromPocket: 'personal',
      toAccountId: 'acc-tabungan', toPocket: 'personal', categoryId: null,
    })
  })

  it('lend: transfer ke akun Piutang dengan nama orang', () => {
    const d = buildTransaction('lend', { amount: 200_000, counterparty: 'Budi' }, ctx)
    expect(d).toMatchObject({ type: 'transfer', fromAccountId: 'acc-bca', toAccountId: 'acc-piutang', counterparty: 'Budi' })
  })

  it('repaid: transfer dari akun Piutang kembali ke akun', () => {
    const d = buildTransaction('repaid', { amount: 200_000, counterparty: 'Budi', accountId: 'acc-bca' }, ctx)
    expect(d).toMatchObject({ type: 'transfer', fromAccountId: 'acc-piutang', toAccountId: 'acc-bca', counterparty: 'Budi' })
  })

  it('project-income: income ke kantong business, kategori Project', () => {
    const d = buildTransaction('project-income', { amount: 5_000_000, accountId: 'acc-bisnis-a', counterparty: 'Redesign' }, ctx)
    expect(d).toMatchObject({ type: 'income', toAccountId: 'acc-bisnis-a', toPocket: 'business', categoryId: 'cat-project', counterparty: 'Redesign' })
  })

  it('drawing: transfer lintas kantong business→personal', () => {
    const d = buildTransaction('drawing', { amount: 3_000_000, accountId: 'acc-bisnis-a', toAccountId: 'acc-bca' }, ctx)
    expect(d).toMatchObject({ type: 'transfer', fromPocket: 'business', toPocket: 'personal', categoryId: null })
  })

  it('business-expense: expense dari kantong business', () => {
    const d = buildTransaction('business-expense', { amount: 150_000, accountId: 'acc-bisnis-a', categoryId: 'cat-transport' }, ctx)
    expect(d).toMatchObject({ type: 'expense', fromAccountId: 'acc-bisnis-a', fromPocket: 'business', toAccountId: null })
  })

  it('date bisa di-override untuk transaksi backdate (§11.5)', () => {
    const d = buildTransaction('expense', { amount: 1000, categoryId: 'cat-makan', date: '2026-07-03' }, ctx)
    expect(d.date).toBe('2026-07-03')
  })
})
```

- [ ] **Step 6: Jalankan tes, pastikan gagal**

Run: `npm test -w @better/core -- finance-action`
Expected: FAIL — `Failed to resolve import './finance-action.ts'`

- [ ] **Step 7: Implementasi mapping aksi**

Create `packages/core/src/finance-action.ts`:

```ts
// Pemetaan situasi UI → bentuk data — docs/feature/30.finance/spec.md §7.
// User memilih situasi ("Ngutangin"); file ini yang menerjemahkannya ke
// type + pocket + account. Istilah di kolom kanan tabel §7 tidak pernah
// muncul di layar.
import type { Pocket, TransactionDraft } from './finance-validate.ts'

export type FinanceActionId =
  | 'expense'
  | 'salary'
  | 'save'
  | 'lend'
  | 'repaid'
  | 'project-income'
  | 'drawing'
  | 'business-expense'

export interface ActionInput {
  amount: number
  /** Akun yang dipilih user. Artinya tergantung aksi — sumber atau tujuan. */
  accountId?: string | null
  /** Akun tujuan, hanya untuk 'save' dan 'drawing' yang punya dua sisi. */
  toAccountId?: string | null
  categoryId?: string | null
  counterparty?: string | null
  note?: string | null
  /** Default hari ini; diisi hanya untuk transaksi backdate. */
  date?: string
}

export interface ActionContext {
  today: string
  lastUsedAccountId: string | null
  receivableAccountId: string | null
  salaryCategoryId: string | null
  projectCategoryId: string | null
}

/** Kantong tiap sisi ditentukan aksinya, bukan hasil lookup akun (§7). */
const POCKETS: Record<FinanceActionId, { from: Pocket | null; to: Pocket | null }> = {
  'expense': { from: 'personal', to: null },
  'salary': { from: null, to: 'personal' },
  'save': { from: 'personal', to: 'personal' },
  'lend': { from: 'personal', to: 'personal' },
  'repaid': { from: 'personal', to: 'personal' },
  'project-income': { from: null, to: 'business' },
  'drawing': { from: 'business', to: 'personal' },
  'business-expense': { from: 'business', to: null },
}

export function buildTransaction(
  action: FinanceActionId,
  input: ActionInput,
  ctx: ActionContext,
): TransactionDraft {
  const picked = input.accountId ?? ctx.lastUsedAccountId
  const pockets = POCKETS[action]

  let type: TransactionDraft['type']
  let fromAccountId: string | null
  let toAccountId: string | null
  let categoryId: string | null

  switch (action) {
    case 'expense':
      type = 'expense'; fromAccountId = picked; toAccountId = null; categoryId = input.categoryId ?? null
      break
    case 'business-expense':
      type = 'expense'; fromAccountId = picked; toAccountId = null; categoryId = input.categoryId ?? null
      break
    case 'salary':
      type = 'income'; fromAccountId = null; toAccountId = picked; categoryId = ctx.salaryCategoryId
      break
    case 'project-income':
      type = 'income'; fromAccountId = null; toAccountId = picked; categoryId = ctx.projectCategoryId
      break
    case 'save':
    case 'drawing':
      type = 'transfer'; fromAccountId = picked; toAccountId = input.toAccountId ?? null; categoryId = null
      break
    case 'lend':
      type = 'transfer'; fromAccountId = picked; toAccountId = ctx.receivableAccountId; categoryId = null
      break
    case 'repaid':
      type = 'transfer'; fromAccountId = ctx.receivableAccountId; toAccountId = picked; categoryId = null
      break
  }

  return {
    date: input.date ?? ctx.today,
    type,
    amount: input.amount,
    categoryId,
    fromAccountId,
    fromPocket: fromAccountId === null ? null : pockets.from,
    toAccountId,
    toPocket: toAccountId === null ? null : pockets.to,
    counterparty: input.counterparty ?? null,
    note: input.note ?? null,
  }
}
```

- [ ] **Step 8: Daftarkan kedua modul di `exports`**

Modify `packages/core/package.json` — tambahkan setelah `"./storage-tree"`:

```json
    "./finance-validate": "./src/finance-validate.ts",
    "./finance-action": "./src/finance-action.ts",
```

Tanpa ini `apps/api` dan `apps/web` tidak bisa mengimpornya — dan error-nya
baru muncul di task berikutnya, jauh dari penyebabnya.

- [ ] **Step 9: Jalankan seluruh tes core, pastikan lulus**

Run: `npm test -w @better/core`
Expected: PASS — termasuk 13 tes validate dan 9 tes action.

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/finance-validate.ts packages/core/src/finance-validate.test.ts \
  packages/core/src/finance-action.ts packages/core/src/finance-action.test.ts \
  packages/core/package.json
git commit -m "feat(finance): invariant §6 dan mapping aksi §7 di @better/core"
```

---

## Task C: Query agregasi §9

**Files:**
- Create: `apps/api/src/modules/finance/queries.ts`
- Test: `apps/api/test/finance.test.ts` (tambah `describe` baru)

**Interfaces:**
- Consumes: `financeAccount`/`financeTransaction` (Task A), `firstOfNextMonth`
  dari `@better/core/date`.
- Produces:
  - `accountBalances(userId): Promise<AccountBalance[]>` — §9.1 + §9.3
  - `spendablePersonal(userId): Promise<number>` — §9.4
  - `monthlySummary(userId, month, pocket, accountId?): Promise<Summary>` — §9.5
  - `receivables(userId, receivableAccountId): Promise<Receivable[]>` — §9.6
  - `netWorth(userId): Promise<number>` — §9.7
  - `interface AccountBalance { id, name, kind, pocket, isSpendable, isSystem, isArchived, sortOrder, balance, pockets: { personal, business } }`
  - `interface Summary { month, masuk, keluar, tersimpan }`
  - `interface Receivable { counterparty: string; sisa: number }`

- [ ] **Step 1: Tulis tes agregasi yang gagal**

Modify `apps/api/test/finance.test.ts` — tambahkan impor dan blok berikut di
akhir file:

```ts
import { financeTransaction } from '../src/db/schema/finance.ts'
import { uuidv7 } from '@better/core/id'
import { accountBalances, spendablePersonal, monthlySummary, receivables, netWorth } from '../src/modules/finance/queries.ts'

/** Menyisipkan satu transaksi apa adanya — melewati validator, karena yang diuji di sini agregasinya. */
async function insertTx(userId: string, tx: Record<string, unknown>) {
  await db.insert(financeTransaction).values({
    id: uuidv7(), userId, date: '2026-08-05', amount: 0, type: 'expense', ...tx,
  } as typeof financeTransaction.$inferInsert)
}

async function accountIdByName(userId: string, name: string): Promise<string> {
  const [row] = await db.select().from(financeAccount)
    .where(and(eq(financeAccount.userId, userId), eq(financeAccount.name, name)))
  return row!.id
}

describe('agregasi §9', () => {
  it('saldo akun = masuk lewat to_ dikurangi keluar lewat from_ (§9.1)', async () => {
    const user = await createTestUser('agg1@example.com')
    await ensureFinanceSeed(user.id)
    const dompet = await accountIdByName(user.id, 'Dompet')

    await insertTx(user.id, { type: 'income', amount: 1_000_000, toAccountId: dompet, toPocket: 'personal' })
    await insertTx(user.id, { type: 'expense', amount: 250_000, fromAccountId: dompet, fromPocket: 'personal' })

    const balances = await accountBalances(user.id)
    expect(balances.find((a) => a.id === dompet)!.balance).toBe(750_000)
  })

  it('transaksi terhapus tidak dihitung', async () => {
    const user = await createTestUser('agg2@example.com')
    await ensureFinanceSeed(user.id)
    const dompet = await accountIdByName(user.id, 'Dompet')

    await insertTx(user.id, { type: 'income', amount: 1_000_000, toAccountId: dompet, toPocket: 'personal' })
    await insertTx(user.id, { type: 'income', amount: 9_000_000, toAccountId: dompet, toPocket: 'personal', deletedAt: new Date() })

    const balances = await accountBalances(user.id)
    expect(balances.find((a) => a.id === dompet)!.balance).toBe(1_000_000)
  })

  it('satu rekening memecah saldonya per kantong (§9.3)', async () => {
    const user = await createTestUser('agg3@example.com')
    await ensureFinanceSeed(user.id)
    const dompet = await accountIdByName(user.id, 'Dompet')

    await insertTx(user.id, { type: 'income', amount: 1_000_000, toAccountId: dompet, toPocket: 'personal' })
    await insertTx(user.id, { type: 'income', amount: 4_000_000, toAccountId: dompet, toPocket: 'business' })

    const row = (await accountBalances(user.id)).find((a) => a.id === dompet)!
    expect(row.pockets).toEqual({ personal: 1_000_000, business: 4_000_000 })
    expect(row.balance).toBe(5_000_000)
  })

  it('headline mengecualikan akun non-spendable (§9.4)', async () => {
    const user = await createTestUser('agg4@example.com')
    await ensureFinanceSeed(user.id)
    const dompet = await accountIdByName(user.id, 'Dompet')
    const piutang = await accountIdByName(user.id, 'Piutang')

    await insertTx(user.id, { type: 'income', amount: 1_000_000, toAccountId: dompet, toPocket: 'personal' })
    await insertTx(user.id, {
      type: 'transfer', amount: 200_000, counterparty: 'Budi',
      fromAccountId: dompet, fromPocket: 'personal', toAccountId: piutang, toPocket: 'personal',
    })

    // Uang yang aman dipakai = 800rb. Piutang 200rb tidak ikut.
    expect(await spendablePersonal(user.id)).toBe(800_000)
    expect(await netWorth(user.id)).toBe(1_000_000)
  })

  it('nabung dan ngutangin bukan Keluar; prive adalah Masuk (§9.5)', async () => {
    const user = await createTestUser('agg5@example.com')
    await ensureFinanceSeed(user.id)
    const dompet = await accountIdByName(user.id, 'Dompet')
    const piutang = await accountIdByName(user.id, 'Piutang')
    const [tabungan] = await db.insert(financeAccount).values({
      id: uuidv7(), userId: user.id, name: 'Tabungan', kind: 'bank', pocket: 'personal', isSpendable: false,
    }).returning()

    await insertTx(user.id, { type: 'income', amount: 9_000_000, toAccountId: dompet, toPocket: 'personal' })
    await insertTx(user.id, { type: 'expense', amount: 1_000_000, fromAccountId: dompet, fromPocket: 'personal' })
    // Nabung — transfer dalam kantong yang sama, tidak muncul di Masuk maupun Keluar.
    await insertTx(user.id, { type: 'transfer', amount: 2_000_000, fromAccountId: dompet, fromPocket: 'personal', toAccountId: tabungan!.id, toPocket: 'personal' })
    // Ngutangin — sama, transfer dalam kantong.
    await insertTx(user.id, { type: 'transfer', amount: 500_000, counterparty: 'Budi', fromAccountId: dompet, fromPocket: 'personal', toAccountId: piutang, toPocket: 'personal' })
    // Prive — lintas kantong, ini yang menambah Masuk personal.
    await insertTx(user.id, { type: 'transfer', amount: 3_000_000, fromAccountId: dompet, fromPocket: 'business', toAccountId: dompet, toPocket: 'personal' })

    const s = await monthlySummary(user.id, '2026-08', 'personal')
    expect(s.masuk).toBe(12_000_000)
    expect(s.keluar).toBe(1_000_000)
    expect(s.tersimpan).toBe(11_000_000)
  })

  it('prive adalah Keluar dari sisi kantong bisnis', async () => {
    const user = await createTestUser('agg6@example.com')
    await ensureFinanceSeed(user.id)
    const dompet = await accountIdByName(user.id, 'Dompet')

    await insertTx(user.id, { type: 'income', amount: 5_000_000, toAccountId: dompet, toPocket: 'business' })
    await insertTx(user.id, { type: 'transfer', amount: 3_000_000, fromAccountId: dompet, fromPocket: 'business', toAccountId: dompet, toPocket: 'personal' })

    const s = await monthlySummary(user.id, '2026-08', 'business')
    expect(s.masuk).toBe(5_000_000)
    expect(s.keluar).toBe(3_000_000)
  })

  it('ringkasan disaring per akun untuk memisahkan dua bisnis (§4.4)', async () => {
    const user = await createTestUser('agg7@example.com')
    await ensureFinanceSeed(user.id)
    const [a] = await db.insert(financeAccount).values({ id: uuidv7(), userId: user.id, name: 'Bisnis A', kind: 'bank', pocket: 'business' }).returning()
    const [b] = await db.insert(financeAccount).values({ id: uuidv7(), userId: user.id, name: 'Bisnis B', kind: 'bank', pocket: 'business' }).returning()

    await insertTx(user.id, { type: 'income', amount: 5_000_000, toAccountId: a!.id, toPocket: 'business' })
    await insertTx(user.id, { type: 'income', amount: 2_000_000, toAccountId: b!.id, toPocket: 'business' })

    expect((await monthlySummary(user.id, '2026-08', 'business', a!.id)).masuk).toBe(5_000_000)
    expect((await monthlySummary(user.id, '2026-08', 'business')).masuk).toBe(7_000_000)
  })

  it('bulan lain tidak ikut terhitung (§11.5)', async () => {
    const user = await createTestUser('agg8@example.com')
    await ensureFinanceSeed(user.id)
    const dompet = await accountIdByName(user.id, 'Dompet')

    await insertTx(user.id, { date: '2026-07-31', type: 'expense', amount: 111_000, fromAccountId: dompet, fromPocket: 'personal' })
    await insertTx(user.id, { date: '2026-08-01', type: 'expense', amount: 222_000, fromAccountId: dompet, fromPocket: 'personal' })
    await insertTx(user.id, { date: '2026-09-01', type: 'expense', amount: 333_000, fromAccountId: dompet, fromPocket: 'personal' })

    expect((await monthlySummary(user.id, '2026-08', 'personal')).keluar).toBe(222_000)
  })

  it('piutang lunas hilang dari daftar tanpa kolom status (§9.6)', async () => {
    const user = await createTestUser('agg9@example.com')
    const { receivableAccountId } = await ensureFinanceSeed(user.id)
    const dompet = await accountIdByName(user.id, 'Dompet')

    const lend = (n: string, amount: number) => insertTx(user.id, {
      type: 'transfer', amount, counterparty: n,
      fromAccountId: dompet, fromPocket: 'personal', toAccountId: receivableAccountId, toPocket: 'personal',
    })
    const repay = (n: string, amount: number) => insertTx(user.id, {
      type: 'transfer', amount, counterparty: n,
      fromAccountId: receivableAccountId, fromPocket: 'personal', toAccountId: dompet, toPocket: 'personal',
    })

    await lend('Budi', 500_000)
    await repay('Budi', 500_000) // lunas → hilang
    await lend('Cici', 300_000)
    await repay('Cici', 100_000) // sisa 200rb

    expect(await receivables(user.id, receivableAccountId)).toEqual([{ counterparty: 'Cici', sisa: 200_000 }])
  })
})
```

Tambahkan `and` ke impor `drizzle-orm` di bagian atas file tes.

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `npm test -w @better/api -- finance`
Expected: FAIL — `Failed to resolve import '../src/modules/finance/queries.ts'`

- [ ] **Step 3: Implementasi query agregasi**

Create `apps/api/src/modules/finance/queries.ts`:

```ts
// Semua saldo derived — docs/feature/30.finance/spec.md §9. Tidak ada satu
// pun kolom saldo yang dibaca di file ini, dan tidak boleh pernah ada
// (prinsip 2): itu yang membuat edit, hapus, dan backdate tidak butuh
// rekalkulasi apa pun.
import { sql } from 'drizzle-orm'
import { firstOfNextMonth } from '@better/core/date'
import type { Pocket } from '@better/core/finance-validate'
import { db } from '../../db/client.ts'

export interface AccountBalance {
  id: string
  name: string
  kind: string
  pocket: string
  isSpendable: boolean
  isSystem: boolean
  isArchived: boolean
  sortOrder: number
  balance: number
  pockets: { personal: number; business: number }
}

export interface Summary {
  month: string
  masuk: number
  keluar: number
  tersimpan: number
}

export interface Receivable {
  counterparty: string
  sisa: number
}

/**
 * Tiap transaksi dipecah jadi entri bertanda: +amount masuk ke akun tujuan,
 * −amount keluar dari akun asal. Semua rumus di §9 adalah SUM atas bentuk
 * ini, jadi tidak ada percabangan per `type` di mana pun.
 */
function entries(userId: string) {
  return sql`
    SELECT to_account_id AS account_id, to_pocket AS pocket, amount AS delta
    FROM finance_transaction
    WHERE user_id = ${userId} AND deleted_at IS NULL AND to_account_id IS NOT NULL
    UNION ALL
    SELECT from_account_id AS account_id, from_pocket AS pocket, -amount AS delta
    FROM finance_transaction
    WHERE user_id = ${userId} AND deleted_at IS NULL AND from_account_id IS NOT NULL
  `
}

// postgres-js mengembalikan SUM atas bigint sebagai string. Rupiah bulat jauh
// di bawah 2^53, jadi Number() aman — dan tipe frontend memang meminta number.
const num = (v: unknown): number => Number(v ?? 0)

/** §9.1 + §9.3 — saldo tiap akun, sekaligus pecahannya per kantong. */
export async function accountBalances(userId: string): Promise<AccountBalance[]> {
  const rows = await db.execute(sql`
    SELECT a.id, a.name, a.kind, a.pocket, a.is_spendable, a.is_system, a.is_archived, a.sort_order,
           COALESCE(SUM(e.delta), 0) AS balance,
           COALESCE(SUM(e.delta) FILTER (WHERE e.pocket = 'personal'), 0) AS personal,
           COALESCE(SUM(e.delta) FILTER (WHERE e.pocket = 'business'), 0) AS business
    FROM finance_account a
    LEFT JOIN (${entries(userId)}) e ON e.account_id = a.id
    WHERE a.user_id = ${userId}
    GROUP BY a.id
    ORDER BY a.sort_order, a.name
  `)
  return [...rows].map((r) => ({
    id: r.id as string,
    name: r.name as string,
    kind: r.kind as string,
    pocket: r.pocket as string,
    isSpendable: r.is_spendable as boolean,
    isSystem: r.is_system as boolean,
    isArchived: r.is_archived as boolean,
    sortOrder: num(r.sort_order),
    balance: num(r.balance),
    pockets: { personal: num(r.personal), business: num(r.business) },
  }))
}

/** §9.4 — angka besar di beranda: uang personal yang aman dipakai hari ini. */
export async function spendablePersonal(userId: string): Promise<number> {
  const rows = await db.execute(sql`
    SELECT COALESCE(SUM(e.delta), 0) AS total
    FROM (${entries(userId)}) e
    JOIN finance_account a ON a.id = e.account_id
    WHERE e.pocket = 'personal' AND a.is_spendable
  `)
  return num([...rows][0]?.total)
}

/** §9.7 — termasuk tabungan dan piutang. Halaman terpisah, bukan beranda. */
export async function netWorth(userId: string): Promise<number> {
  const rows = await db.execute(sql`SELECT COALESCE(SUM(e.delta), 0) AS total FROM (${entries(userId)}) e`)
  return num([...rows][0]?.total)
}

/**
 * §9.5 — `month` berbentuk YYYY-MM. Transfer dalam kantong yang sama (nabung,
 * ngutangin) sengaja tidak muncul di Masuk maupun Keluar; hanya transfer
 * lintas kantong — prive — yang menggeser angka.
 */
export async function monthlySummary(
  userId: string,
  month: string,
  pocket: Pocket,
  accountId?: string | null,
): Promise<Summary> {
  const start = `${month}-01`
  const end = firstOfNextMonth(start)
  const acc = accountId ?? null
  const rows = await db.execute(sql`
    SELECT
      COALESCE(SUM(amount) FILTER (
        WHERE to_pocket = ${pocket}
          AND (type = 'income' OR (type = 'transfer' AND from_pocket <> ${pocket}))
          AND (${acc}::text IS NULL OR to_account_id = ${acc})
      ), 0) AS masuk,
      COALESCE(SUM(amount) FILTER (
        WHERE from_pocket = ${pocket}
          AND (type = 'expense' OR (type = 'transfer' AND to_pocket <> ${pocket}))
          AND (${acc}::text IS NULL OR from_account_id = ${acc})
      ), 0) AS keluar
    FROM finance_transaction
    WHERE user_id = ${userId} AND deleted_at IS NULL
      AND date >= ${start} AND date < ${end}
  `)
  const r = [...rows][0]
  const masuk = num(r?.masuk)
  const keluar = num(r?.keluar)
  return { month, masuk, keluar, tersimpan: masuk - keluar }
}

/**
 * §9.6 — tidak ada kolom status lunas. `sisa = 0` berarti lunas, dan barisnya
 * hilang sendiri lewat HAVING. Satu sumber kebenaran, tidak ada state yang
 * bisa desinkron.
 */
export async function receivables(userId: string, receivableAccountId: string): Promise<Receivable[]> {
  const rows = await db.execute(sql`
    SELECT counterparty,
           SUM(CASE WHEN to_account_id = ${receivableAccountId} THEN amount ELSE -amount END) AS sisa
    FROM finance_transaction
    WHERE user_id = ${userId} AND deleted_at IS NULL
      AND ${receivableAccountId} IN (from_account_id, to_account_id)
    GROUP BY counterparty
    HAVING SUM(CASE WHEN to_account_id = ${receivableAccountId} THEN amount ELSE -amount END) <> 0
    ORDER BY counterparty
  `)
  return [...rows].map((r) => ({ counterparty: r.counterparty as string, sisa: num(r.sisa) }))
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `npm test -w @better/api -- finance`
Expected: PASS — 3 tes seed + 9 tes agregasi.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/finance/queries.ts apps/api/test/finance.test.ts
git commit -m "feat(finance): query agregasi §9 — saldo, ringkasan, piutang, kekayaan bersih"
```

---

## Task D: Endpoint baca

**Files:**
- Create: `apps/api/src/modules/finance/dto.ts`
- Create: `apps/api/src/modules/finance/routes.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/finance.test.ts`

**Interfaces:**
- Consumes: `ensureFinanceSeed` (A), seluruh isi `queries.ts` (C).
- Produces: `financeRoutes` (Hono) yang menyajikan
  `/finance/overview`, `/summary`, `/accounts`, `/receivables`, `/networth`,
  `/transactions`, `/categories`; `toTransactionDto(row)` dari `dto.ts`.

- [ ] **Step 1: Tulis tes endpoint yang gagal**

Modify `apps/api/test/finance.test.ts` — tambahkan di akhir:

```ts
import { createApp } from '../src/app.ts'
import { extractSessionCookie, readJson } from './helpers.ts'
import { appUser } from '../src/db/schema/user.ts'

const app = createApp()

async function loginCookie(email: string, password = 'testpassword123'): Promise<string> {
  const res = await app.request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return extractSessionCookie(res)
}

describe('endpoint baca §8', () => {
  it('GET /finance/accounts men-seed saat pertama diakses', async () => {
    await createTestUser('read1@example.com')
    const cookie = await loginCookie('read1@example.com')

    const res = await app.request('/api/finance/accounts', { headers: { cookie } })
    expect(res.status).toBe(200)
    const body = await readJson(res)
    expect(body.accounts.map((a: { name: string }) => a.name).sort()).toEqual(['Dompet', 'Piutang'])
    expect(body.accounts[0]).toHaveProperty('isSpendable') // camelCase, bukan is_spendable
  })

  it('GET /finance/overview mengirim headline, ringkasan, dan chip', async () => {
    const user = await createTestUser('read2@example.com')
    const cookie = await loginCookie('read2@example.com')
    const { receivableAccountId } = await ensureFinanceSeed(user.id)
    const dompet = await accountIdByName(user.id, 'Dompet')
    const today = new Date().toISOString().slice(0, 10)

    await insertTx(user.id, { date: today, type: 'income', amount: 5_000_000, toAccountId: dompet, toPocket: 'personal' })
    await insertTx(user.id, {
      date: today, type: 'transfer', amount: 500_000, counterparty: 'Budi',
      fromAccountId: dompet, fromPocket: 'personal', toAccountId: receivableAccountId, toPocket: 'personal',
    })

    const body = await readJson(await app.request('/api/finance/overview', { headers: { cookie } }))
    expect(body.spendablePersonal).toBe(4_500_000)
    expect(body.summary.masuk).toBe(5_000_000)
    expect(body.chips.piutangTotal).toBe(500_000)
    expect(body.chips).not.toHaveProperty('businessTotal') // chip nol tidak dikirim
  })

  it('progress target percent dihitung dari Masuk bulan berjalan (§5.5)', async () => {
    const user = await createTestUser('read3@example.com')
    const cookie = await loginCookie('read3@example.com')
    await db.update(appUser)
      .set({ financeSavingsTargetMode: 'percent', financeSavingsTargetValue: 20 })
      .where(eq(appUser.id, user.id))
    await ensureFinanceSeed(user.id)
    const dompet = await accountIdByName(user.id, 'Dompet')
    const today = new Date().toISOString().slice(0, 10)

    await insertTx(user.id, { date: today, type: 'income', amount: 10_000_000, toAccountId: dompet, toPocket: 'personal' })
    await insertTx(user.id, { date: today, type: 'expense', amount: 9_000_000, fromAccountId: dompet, fromPocket: 'personal' })

    const body = await readJson(await app.request('/api/finance/overview', { headers: { cookie } }))
    expect(body.target).toEqual({ mode: 'percent', value: 20, targetAmount: 2_000_000, saved: 1_000_000 })
  })

  it('data user lain tidak pernah bocor', async () => {
    const owner = await createTestUser('read4@example.com')
    await createTestUser('other@example.com')
    await ensureFinanceSeed(owner.id)
    const dompet = await accountIdByName(owner.id, 'Dompet')
    await insertTx(owner.id, { type: 'income', amount: 7_000_000, toAccountId: dompet, toPocket: 'personal' })

    const cookie = await loginCookie('other@example.com')
    const body = await readJson(await app.request('/api/finance/overview', { headers: { cookie } }))
    expect(body.spendablePersonal).toBe(0)
  })

  it('menolak tanpa sesi', async () => {
    const res = await app.request('/api/finance/overview')
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `npm test -w @better/api -- finance`
Expected: FAIL — 404 pada `/api/finance/accounts` (rute belum ada).

- [ ] **Step 3: Tulis pemetaan DTO**

Create `apps/api/src/modules/finance/dto.ts`:

```ts
// Bentuk respons mengikuti tipe frontend, bukan kolom DB — CLAUDE.md:
// "frontend types adalah kontrak". Satu tempat pemetaan supaya tidak ada
// rute yang diam-diam membocorkan snake_case atau kolom backend-only.
import type { financeTransaction } from '../../db/schema/finance.ts'

type TransactionRow = typeof financeTransaction.$inferSelect

export function toTransactionDto(row: TransactionRow) {
  return {
    id: row.id,
    date: row.date,
    type: row.type,
    amount: row.amount,
    categoryId: row.categoryId,
    fromAccountId: row.fromAccountId,
    fromPocket: row.fromPocket,
    toAccountId: row.toAccountId,
    toPocket: row.toPocket,
    counterparty: row.counterparty,
    note: row.note,
  }
}
```

`userId`, `idempotencyKey`, `deletedAt`, `createdAt`, dan `updatedAt` sengaja
tidak diikutkan — UI tidak membutuhkannya.

- [ ] **Step 4: Implementasi rute baca**

Create `apps/api/src/modules/finance/routes.ts`:

```ts
// Endpoint Finance — docs/feature/30.finance/spec.md §8.
import { Hono } from 'hono'
import { z } from 'zod'
import { and, desc, eq, isNull, lt, gte } from 'drizzle-orm'
import { todayInTimezone, firstOfNextMonth } from '@better/core/date'
import { AppError } from '../../http/errors.ts'
import { db } from '../../db/client.ts'
import { appUser } from '../../db/schema/user.ts'
import { financeAccount, financeCategory, financeTransaction } from '../../db/schema/finance.ts'
import { ensureFinanceSeed } from './seed.ts'
import { accountBalances, monthlySummary, netWorth, receivables, spendablePersonal } from './queries.ts'
import { toTransactionDto } from './dto.ts'

export const financeRoutes = new Hono()

// Seed lazy di depan tiap request — user lama tidak butuh backfill (§8).
// Hasilnya tidak disimpan di context: ensureFinanceSeed pulang lewat satu
// SELECT setelah seed pertama, jadi rute yang butuh id Piutang cukup
// memanggilnya lagi ketimbang menambah tipe variabel context.
financeRoutes.use('/finance/*', async (c, next) => {
  await ensureFinanceSeed(c.get('userId'))
  await next()
})

async function currentUser(userId: string) {
  const [user] = await db.select().from(appUser).where(eq(appUser.id, userId))
  if (!user) throw new AppError('UNAUTHORIZED', 401, 'Session refers to a user that no longer exists')
  return user
}

const monthPattern = /^\d{4}-\d{2}$/
const summaryQuery = z.object({
  month: z.string().regex(monthPattern).optional(),
  pocket: z.enum(['personal', 'business']).default('personal'),
  account_id: z.string().optional(),
})

financeRoutes.get('/finance/accounts', async (c) => {
  const accounts = await accountBalances(c.get('userId'))
  return c.json({ accounts })
})

financeRoutes.get('/finance/networth', async (c) => {
  return c.json({ total: await netWorth(c.get('userId')) })
})

financeRoutes.get('/finance/categories', async (c) => {
  const rows = await db.select().from(financeCategory).where(eq(financeCategory.userId, c.get('userId')))
  return c.json({
    categories: rows
      .map((r) => ({ id: r.id, name: r.name, type: r.type, icon: r.icon, isArchived: r.isArchived, sortOrder: r.sortOrder }))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
  })
})

financeRoutes.get('/finance/receivables', async (c) => {
  const userId = c.get('userId')
  const { receivableAccountId } = await ensureFinanceSeed(userId)
  return c.json({ receivables: await receivables(userId, receivableAccountId) })
})

financeRoutes.get('/finance/summary', async (c) => {
  const userId = c.get('userId')
  const q = summaryQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams))
  if (!q.success) throw new AppError('VALIDATION_ERROR', 422, 'Invalid query', q.error.flatten())
  const user = await currentUser(userId)
  const month = q.data.month ?? todayInTimezone(user.timezone).slice(0, 7)
  return c.json(await monthlySummary(userId, month, q.data.pocket, q.data.account_id ?? null))
})

const listQuery = summaryQuery.extend({ cursor: z.string().optional() })
const PAGE_SIZE = 50

financeRoutes.get('/finance/transactions', async (c) => {
  const userId = c.get('userId')
  const q = listQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams))
  if (!q.success) throw new AppError('VALIDATION_ERROR', 422, 'Invalid query', q.error.flatten())

  const filters = [eq(financeTransaction.userId, userId), isNull(financeTransaction.deletedAt)]
  if (q.data.month) {
    filters.push(gte(financeTransaction.date, `${q.data.month}-01`))
    filters.push(lt(financeTransaction.date, firstOfNextMonth(`${q.data.month}-01`)))
  }
  // Cursor adalah id transaksi terakhir halaman sebelumnya. UUIDv7 monoton,
  // jadi "id < cursor" berarti "lebih lama" tanpa kolom tambahan.
  if (q.data.cursor) filters.push(lt(financeTransaction.id, q.data.cursor))

  const rows = await db.select().from(financeTransaction)
    .where(and(...filters))
    .orderBy(desc(financeTransaction.date), desc(financeTransaction.id))
    .limit(PAGE_SIZE + 1)

  const page = rows.slice(0, PAGE_SIZE)
  return c.json({
    transactions: page.map(toTransactionDto),
    nextCursor: rows.length > PAGE_SIZE ? page[page.length - 1]!.id : null,
  })
})

financeRoutes.get('/finance/overview', async (c) => {
  const userId = c.get('userId')
  const user = await currentUser(userId)
  const { receivableAccountId } = await ensureFinanceSeed(userId)
  const month = todayInTimezone(user.timezone).slice(0, 7)

  const [spendable, summary, accounts] = await Promise.all([
    spendablePersonal(userId),
    monthlySummary(userId, month, 'personal'),
    accountBalances(userId),
  ])

  const piutangTotal = accounts.find((a) => a.id === receivableAccountId)?.balance ?? 0
  const businessTotal = accounts.reduce((sum, a) => sum + a.pockets.business, 0)

  // Chip hanya dikirim kalau nilainya ≠ 0 (§8) — beranda user tanpa piutang
  // dan tanpa bisnis tidak menampilkan baris kosong.
  const chips: { piutangTotal?: number; businessTotal?: number } = {}
  if (piutangTotal !== 0) chips.piutangTotal = piutangTotal
  if (businessTotal !== 0) chips.businessTotal = businessTotal

  const mode = user.financeSavingsTargetMode
  const value = user.financeSavingsTargetValue
  const target = mode && value !== null
    // percent dihitung ulang dari Masuk bulan berjalan, jadi targetnya ikut
    // turun di bulan sepi dan progress bar tidak selalu merah (§5.5).
    ? {
        mode,
        value,
        targetAmount: mode === 'percent' ? Math.round((summary.masuk * value) / 100) : value,
        saved: summary.tersimpan,
      }
    : null

  return c.json({
    spendablePersonal: spendable,
    summary,
    target,
    chips,
    businessEnabled: user.financeBusinessEnabled,
  })
})
```

- [ ] **Step 5: Pasang rute di app**

Modify `apps/api/src/app.ts`:

```ts
import { financeRoutes } from './modules/finance/routes.ts'
```

dan tambahkan satu baris tepat setelah `app.route('/api', storageRoutes)`:

```ts
  app.route('/api', financeRoutes)
```

- [ ] **Step 6: Jalankan tes, pastikan lulus**

Run: `npm test -w @better/api -- finance`
Expected: PASS — 17 tes.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/finance/dto.ts apps/api/src/modules/finance/routes.ts \
  apps/api/src/app.ts apps/api/test/finance.test.ts
git commit -m "feat(finance): endpoint baca — overview, summary, accounts, receivables, networth"
```

---

## Task E: Endpoint tulis

**Files:**
- Create: `apps/api/src/modules/finance/service.ts`
- Modify: `apps/api/src/modules/finance/routes.ts`
- Modify: `apps/api/src/modules/user/routes.ts`
- Test: `apps/api/test/finance.test.ts`

**Interfaces:**
- Consumes: `validateTransaction` (`@better/core/finance-validate`),
  `ensureFinanceSeed` (A), `toTransactionDto` (D).
- Produces:
  - `createTransaction(userId, draft, idempotencyKey): Promise<TransactionRow>`
  - `updateTransaction(userId, id, patch): Promise<TransactionRow>`
  - `deleteTransaction(userId, id, cascade): Promise<{ deleted: number }>`
  - `class ConfirmRequired extends AppError` — 409 dengan detail §11.2

- [ ] **Step 1: Tulis tes tulis yang gagal**

Modify `apps/api/test/finance.test.ts` — tambahkan di akhir:

```ts
describe('endpoint tulis §8', () => {
  async function post(cookie: string, body: unknown, key?: string) {
    const res = await app.request('/api/finance/transactions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, ...(key ? { 'idempotency-key': key } : {}) },
      body: JSON.stringify(body),
    })
    return { status: res.status, body: await readJson(res) }
  }

  async function expenseBody(userId: string, amount: number) {
    const dompet = await accountIdByName(userId, 'Dompet')
    const [cat] = await db.select().from(financeCategory)
      .where(and(eq(financeCategory.userId, userId), eq(financeCategory.name, 'Makan')))
    return {
      date: new Date().toISOString().slice(0, 10),
      type: 'expense', amount, categoryId: cat!.id,
      fromAccountId: dompet, fromPocket: 'personal',
      toAccountId: null, toPocket: null, counterparty: null, note: null,
    }
  }

  it('POST membuat transaksi dan menggeser saldo', async () => {
    const user = await createTestUser('w1@example.com')
    const cookie = await loginCookie('w1@example.com')
    await ensureFinanceSeed(user.id)

    const { status, body } = await post(cookie, await expenseBody(user.id, 25_000))
    expect(status).toBe(201)
    expect(body.transaction.amount).toBe(25_000)
    expect(body.transaction).not.toHaveProperty('userId')

    const dompet = await accountIdByName(user.id, 'Dompet')
    expect((await accountBalances(user.id)).find((a) => a.id === dompet)!.balance).toBe(-25_000)
  })

  it('POST dua kali dengan Idempotency-Key sama menghasilkan satu baris', async () => {
    const user = await createTestUser('w2@example.com')
    const cookie = await loginCookie('w2@example.com')
    await ensureFinanceSeed(user.id)
    const payload = await expenseBody(user.id, 40_000)

    const first = await post(cookie, payload, 'key-abc')
    const second = await post(cookie, payload, 'key-abc')

    expect(first.status).toBe(201)
    expect(second.status).toBe(200)
    expect(second.body.transaction.id).toBe(first.body.transaction.id)

    const rows = await db.select().from(financeTransaction).where(eq(financeTransaction.userId, user.id))
    expect(rows).toHaveLength(1)
  })

  it('POST menolak bentuk yang melanggar §6 dengan 422 dan daftar pelanggaran', async () => {
    const user = await createTestUser('w3@example.com')
    const cookie = await loginCookie('w3@example.com')
    await ensureFinanceSeed(user.id)
    const payload = { ...(await expenseBody(user.id, 25_000)), categoryId: null }

    const { status, body } = await post(cookie, payload)
    expect(status).toBe(422)
    expect(body.error.details.violations).toContainEqual({ field: 'categoryId', code: 'CATEGORY_REQUIRED' })
  })

  it('PATCH mengedit transaksi tanpa langkah rekalkulasi apa pun (prinsip 2)', async () => {
    const user = await createTestUser('w4@example.com')
    const cookie = await loginCookie('w4@example.com')
    await ensureFinanceSeed(user.id)
    const dompet = await accountIdByName(user.id, 'Dompet')
    const created = await post(cookie, await expenseBody(user.id, 25_000))

    const res = await app.request(`/api/finance/transactions/${created.body.transaction.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ amount: 75_000 }),
    })
    expect(res.status).toBe(200)
    expect((await accountBalances(user.id)).find((a) => a.id === dompet)!.balance).toBe(-75_000)

    const del = await app.request(`/api/finance/transactions/${created.body.transaction.id}`, { method: 'DELETE', headers: { cookie } })
    expect(del.status).toBe(200)
    expect((await accountBalances(user.id)).find((a) => a.id === dompet)!.balance).toBe(0)
  })

  it('DELETE pinjaman yang sudah dibayar sebagian meminta konfirmasi dulu (§11.2)', async () => {
    const user = await createTestUser('w5@example.com')
    const cookie = await loginCookie('w5@example.com')
    const { receivableAccountId } = await ensureFinanceSeed(user.id)
    const dompet = await accountIdByName(user.id, 'Dompet')

    const [lend] = await db.insert(financeTransaction).values({
      id: uuidv7(), userId: user.id, date: '2026-08-01', type: 'transfer', amount: 500_000, counterparty: 'Budi',
      fromAccountId: dompet, fromPocket: 'personal', toAccountId: receivableAccountId, toPocket: 'personal',
    }).returning()
    await db.insert(financeTransaction).values({
      id: uuidv7(), userId: user.id, date: '2026-08-05', type: 'transfer', amount: 200_000, counterparty: 'Budi',
      fromAccountId: receivableAccountId, fromPocket: 'personal', toAccountId: dompet, toPocket: 'personal',
    })

    const blocked = await app.request(`/api/finance/transactions/${lend!.id}`, { method: 'DELETE', headers: { cookie } })
    expect(blocked.status).toBe(409)
    const body = await readJson(blocked)
    expect(body.error.code).toBe('CONFLICT')
    expect(body.error.details).toMatchObject({ counterparty: 'Budi', otherCount: 1, otherTotal: 200_000 })

    const one = await app.request(`/api/finance/transactions/${lend!.id}?cascade=one`, { method: 'DELETE', headers: { cookie } })
    expect(one.status).toBe(200)
    // Sisa jadi negatif — ditampilkan merah, tidak diblokir (§11.4).
    expect(await receivables(user.id, receivableAccountId)).toEqual([{ counterparty: 'Budi', sisa: -200_000 }])
  })

  it('DELETE cascade=all menghapus seluruh catatan counterparty itu', async () => {
    const user = await createTestUser('w6@example.com')
    const cookie = await loginCookie('w6@example.com')
    const { receivableAccountId } = await ensureFinanceSeed(user.id)
    const dompet = await accountIdByName(user.id, 'Dompet')

    const [lend] = await db.insert(financeTransaction).values({
      id: uuidv7(), userId: user.id, date: '2026-08-01', type: 'transfer', amount: 500_000, counterparty: 'Budi',
      fromAccountId: dompet, fromPocket: 'personal', toAccountId: receivableAccountId, toPocket: 'personal',
    }).returning()
    await db.insert(financeTransaction).values({
      id: uuidv7(), userId: user.id, date: '2026-08-05', type: 'transfer', amount: 200_000, counterparty: 'Budi',
      fromAccountId: receivableAccountId, fromPocket: 'personal', toAccountId: dompet, toPocket: 'personal',
    })

    const res = await app.request(`/api/finance/transactions/${lend!.id}?cascade=all`, { method: 'DELETE', headers: { cookie } })
    expect(res.status).toBe(200)
    expect(await receivables(user.id, receivableAccountId)).toEqual([])
  })

  it('akun sistem tidak bisa di-rename maupun diarsipkan (§11.6)', async () => {
    const user = await createTestUser('w7@example.com')
    const cookie = await loginCookie('w7@example.com')
    const { receivableAccountId } = await ensureFinanceSeed(user.id)

    const rename = await app.request(`/api/finance/accounts/${receivableAccountId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: 'Bukan Piutang' }),
    })
    expect(rename.status).toBe(409)

    const archive = await app.request(`/api/finance/accounts/${receivableAccountId}`, { method: 'DELETE', headers: { cookie } })
    expect(archive.status).toBe(409)
  })

  it('DELETE akun biasa mengarsipkan, tidak menghapus (§11.6)', async () => {
    const user = await createTestUser('w8@example.com')
    const cookie = await loginCookie('w8@example.com')
    await ensureFinanceSeed(user.id)

    const created = await readJson(await app.request('/api/finance/accounts', {
      method: 'POST', headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: 'Tabungan', kind: 'bank', pocket: 'personal', isSpendable: false }),
    }))
    const res = await app.request(`/api/finance/accounts/${created.account.id}`, { method: 'DELETE', headers: { cookie } })
    expect(res.status).toBe(200)

    const [row] = await db.select().from(financeAccount).where(eq(financeAccount.id, created.account.id))
    expect(row!.isArchived).toBe(true)
  })

  it('PATCH /api/me menyimpan setting finance (§5.5)', async () => {
    await createTestUser('w9@example.com')
    const cookie = await loginCookie('w9@example.com')

    const res = await app.request('/api/me', {
      method: 'PATCH', headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ financeBusinessEnabled: true, financeSavingsTargetMode: 'amount', financeSavingsTargetValue: 2_000_000 }),
    })
    expect(res.status).toBe(200)
    const body = await readJson(res)
    expect(body.user.financeBusinessEnabled).toBe(true)
    expect(body.user.financeSavingsTargetValue).toBe(2_000_000)
  })
})
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `npm test -w @better/api -- finance`
Expected: FAIL — 404 pada `POST /api/finance/transactions`.

- [ ] **Step 3: Implementasi service tulis**

Create `apps/api/src/modules/finance/service.ts`:

```ts
// CRUD transaksi — docs/feature/30.finance/spec.md §8, §11.2, §11.6.
// Validasi bentuk data tidak ditulis ulang di sini: ia hidup di
// @better/core/finance-validate dan dipakai client juga (§4.2).
import { and, eq, isNull, ne, or } from 'drizzle-orm'
import { uuidv7 } from '@better/core/id'
import { todayInTimezone } from '@better/core/date'
import { validateTransaction, type TransactionDraft } from '@better/core/finance-validate'
import { db } from '../../db/client.ts'
import { appUser } from '../../db/schema/user.ts'
import { financeAccount, financeCategory, financeTransaction } from '../../db/schema/finance.ts'
import { AppError } from '../../http/errors.ts'
import { ensureFinanceSeed } from './seed.ts'

type TransactionRow = typeof financeTransaction.$inferSelect

/**
 * Menyusun ctx untuk validateTransaction. `exempt` berisi id yang sudah
 * dipakai transaksi ini sebelumnya — dikecualikan dari cek arsip supaya
 * mengedit catatan lama yang akunnya sudah diarsipkan tidak mustahil (§11.6).
 */
async function validateContext(userId: string, draft: TransactionDraft, exempt: (string | null)[] = []) {
  const [user] = await db.select().from(appUser).where(eq(appUser.id, userId))
  if (!user) throw new AppError('UNAUTHORIZED', 401, 'Session refers to a user that no longer exists')
  const { receivableAccountId } = await ensureFinanceSeed(userId)

  let categoryType: 'income' | 'expense' | null = null
  if (draft.categoryId) {
    const [cat] = await db.select().from(financeCategory)
      .where(and(eq(financeCategory.userId, userId), eq(financeCategory.id, draft.categoryId)))
    if (!cat) throw new AppError('VALIDATION_ERROR', 422, 'Unknown category')
    categoryType = cat.type as 'income' | 'expense'
  }

  const archivedAccounts = await db.select({ id: financeAccount.id }).from(financeAccount)
    .where(and(eq(financeAccount.userId, userId), eq(financeAccount.isArchived, true)))
  const archivedCategories = await db.select({ id: financeCategory.id }).from(financeCategory)
    .where(and(eq(financeCategory.userId, userId), eq(financeCategory.isArchived, true)))

  const keep = new Set(exempt.filter((v): v is string => v !== null))
  return {
    today: todayInTimezone(user.timezone),
    receivableAccountId,
    categoryType,
    archivedIds: [...archivedAccounts, ...archivedCategories].map((r) => r.id).filter((id) => !keep.has(id)),
  }
}

function assertValid(violations: ReturnType<typeof validateTransaction>) {
  if (violations.length > 0) {
    throw new AppError('VALIDATION_ERROR', 422, 'Transaction violates §6', { violations })
  }
}

/** Akun yang dirujuk harus milik user ini — tanpa cek ini, id tebakan bisa menyentuh akun orang lain. */
async function assertOwnedAccounts(userId: string, ids: (string | null)[]) {
  for (const id of ids) {
    if (!id) continue
    const [row] = await db.select({ id: financeAccount.id }).from(financeAccount)
      .where(and(eq(financeAccount.userId, userId), eq(financeAccount.id, id)))
    if (!row) throw new AppError('VALIDATION_ERROR', 422, 'Unknown account')
  }
}

export async function createTransaction(
  userId: string,
  draft: TransactionDraft,
  idempotencyKey: string | null,
): Promise<{ row: TransactionRow; created: boolean }> {
  if (idempotencyKey) {
    const [existing] = await db.select().from(financeTransaction)
      .where(and(eq(financeTransaction.userId, userId), eq(financeTransaction.idempotencyKey, idempotencyKey)))
    // Kirim ulang di koneksi jelek mengembalikan baris yang sama, bukan
    // duplikat diam — kegagalan yang paling sulit disadari user (§8).
    if (existing) return { row: existing, created: false }
  }

  await assertOwnedAccounts(userId, [draft.fromAccountId, draft.toAccountId])
  assertValid(validateTransaction(draft, await validateContext(userId, draft)))

  const [row] = await db.insert(financeTransaction).values({
    id: uuidv7(), userId, ...draft, idempotencyKey,
  }).returning()
  return { row: row!, created: true }
}

export async function updateTransaction(
  userId: string,
  id: string,
  patch: Partial<TransactionDraft>,
): Promise<TransactionRow> {
  const [current] = await db.select().from(financeTransaction)
    .where(and(eq(financeTransaction.userId, userId), eq(financeTransaction.id, id), isNull(financeTransaction.deletedAt)))
  if (!current) throw new AppError('NOT_FOUND', 404, 'Transaction not found')

  const draft: TransactionDraft = {
    date: current.date, type: current.type as TransactionDraft['type'], amount: current.amount,
    categoryId: current.categoryId, fromAccountId: current.fromAccountId,
    fromPocket: current.fromPocket as TransactionDraft['fromPocket'],
    toAccountId: current.toAccountId, toPocket: current.toPocket as TransactionDraft['toPocket'],
    counterparty: current.counterparty, note: current.note,
    ...patch,
  }

  await assertOwnedAccounts(userId, [draft.fromAccountId, draft.toAccountId])
  const exempt = [current.fromAccountId, current.toAccountId, current.categoryId]
  assertValid(validateTransaction(draft, await validateContext(userId, draft, exempt)))

  const [row] = await db.update(financeTransaction)
    .set({ ...draft, updatedAt: new Date() })
    .where(and(eq(financeTransaction.userId, userId), eq(financeTransaction.id, id)))
    .returning()
  return row!
}

export type Cascade = 'one' | 'all' | null

/**
 * §11.2 — server tidak pernah menebak. Kalau menghapus baris ini membuat sisa
 * piutang seseorang jadi negatif, ia menolak dengan 409 berisi angka yang
 * dibutuhkan dialog konfirmasi, lalu client mengulang dengan ?cascade=.
 */
export async function deleteTransaction(userId: string, id: string, cascade: Cascade): Promise<{ deleted: number }> {
  const [row] = await db.select().from(financeTransaction)
    .where(and(eq(financeTransaction.userId, userId), eq(financeTransaction.id, id), isNull(financeTransaction.deletedAt)))
  if (!row) throw new AppError('NOT_FOUND', 404, 'Transaction not found')

  const { receivableAccountId } = await ensureFinanceSeed(userId)
  const touchesReceivable = row.fromAccountId === receivableAccountId || row.toAccountId === receivableAccountId

  if (touchesReceivable && row.counterparty && cascade === null) {
    const others = await db.select().from(financeTransaction).where(and(
      eq(financeTransaction.userId, userId),
      eq(financeTransaction.counterparty, row.counterparty),
      isNull(financeTransaction.deletedAt),
      ne(financeTransaction.id, id),
      or(eq(financeTransaction.fromAccountId, receivableAccountId), eq(financeTransaction.toAccountId, receivableAccountId)),
    ))
    if (others.length > 0) {
      throw new AppError('CONFLICT', 409, 'Counterparty has other records', {
        counterparty: row.counterparty,
        otherCount: others.length,
        otherTotal: others.reduce((sum, o) => sum + o.amount, 0),
      })
    }
  }

  const now = new Date()
  if (cascade === 'all' && touchesReceivable && row.counterparty) {
    const deleted = await db.update(financeTransaction)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(
        eq(financeTransaction.userId, userId),
        eq(financeTransaction.counterparty, row.counterparty),
        isNull(financeTransaction.deletedAt),
        or(eq(financeTransaction.fromAccountId, receivableAccountId), eq(financeTransaction.toAccountId, receivableAccountId)),
      ))
      .returning({ id: financeTransaction.id })
    return { deleted: deleted.length }
  }

  await db.update(financeTransaction)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(financeTransaction.userId, userId), eq(financeTransaction.id, id)))
  return { deleted: 1 }
}
```

- [ ] **Step 4: Tambahkan rute tulis**

Modify `apps/api/src/modules/finance/routes.ts` — tambahkan impor
`createTransaction, updateTransaction, deleteTransaction` dari `./service.ts`,
lalu tambahkan di akhir file:

```ts
const pocketEnum = z.enum(['personal', 'business'])

const draftSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.number().int(),
  categoryId: z.string().nullable().default(null),
  fromAccountId: z.string().nullable().default(null),
  fromPocket: pocketEnum.nullable().default(null),
  toAccountId: z.string().nullable().default(null),
  toPocket: pocketEnum.nullable().default(null),
  counterparty: z.string().trim().min(1).nullable().default(null),
  note: z.string().nullable().default(null),
})

financeRoutes.post('/finance/transactions', async (c) => {
  const parsed = draftSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 422, 'Invalid body', parsed.error.flatten())

  const key = c.req.header('idempotency-key') ?? null
  const { row, created } = await createTransaction(c.get('userId'), parsed.data, key)
  return c.json({ transaction: toTransactionDto(row) }, created ? 201 : 200)
})

financeRoutes.patch('/finance/transactions/:id', async (c) => {
  const parsed = draftSchema.partial().safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 422, 'Invalid body', parsed.error.flatten())

  const row = await updateTransaction(c.get('userId'), c.req.param('id'), parsed.data)
  return c.json({ transaction: toTransactionDto(row) })
})

financeRoutes.delete('/finance/transactions/:id', async (c) => {
  const cascade = new URL(c.req.url).searchParams.get('cascade')
  if (cascade !== null && cascade !== 'one' && cascade !== 'all') {
    throw new AppError('VALIDATION_ERROR', 422, 'cascade must be "one" or "all"')
  }
  return c.json(await deleteTransaction(c.get('userId'), c.req.param('id'), cascade))
})

const accountInput = z.object({
  name: z.string().trim().min(1).max(60),
  // 'receivable' tidak ada di sini: akun Piutang hanya lahir dari seed.
  kind: z.enum(['cash', 'bank']),
  pocket: pocketEnum.default('personal'),
  isSpendable: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

financeRoutes.post('/finance/accounts', async (c) => {
  const parsed = accountInput.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 422, 'Invalid body', parsed.error.flatten())

  const [row] = await db.insert(financeAccount)
    .values({ id: uuidv7(), userId: c.get('userId'), ...parsed.data })
    .returning()
  return c.json({ account: row }, 201)
})

/** Akun sistem (Piutang) kebal rename dan arsip — spec §5.1. */
async function ownedAccount(userId: string, id: string) {
  const [row] = await db.select().from(financeAccount)
    .where(and(eq(financeAccount.userId, userId), eq(financeAccount.id, id)))
  if (!row) throw new AppError('NOT_FOUND', 404, 'Account not found')
  if (row.isSystem) throw new AppError('CONFLICT', 409, 'System account cannot be modified')
  return row
}

financeRoutes.patch('/finance/accounts/:id', async (c) => {
  const parsed = accountInput.partial().safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 422, 'Invalid body', parsed.error.flatten())

  await ownedAccount(c.get('userId'), c.req.param('id'))
  const [row] = await db.update(financeAccount).set(parsed.data)
    .where(eq(financeAccount.id, c.req.param('id'))).returning()
  return c.json({ account: row })
})

financeRoutes.delete('/finance/accounts/:id', async (c) => {
  await ownedAccount(c.get('userId'), c.req.param('id'))
  await db.update(financeAccount).set({ isArchived: true }).where(eq(financeAccount.id, c.req.param('id')))
  return c.json({ ok: true })
})

const categoryInput = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(['income', 'expense']),
  icon: z.string().nullable().default(null),
  sortOrder: z.number().int().default(0),
})

financeRoutes.post('/finance/categories', async (c) => {
  const parsed = categoryInput.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 422, 'Invalid body', parsed.error.flatten())

  const [row] = await db.insert(financeCategory)
    .values({ id: uuidv7(), userId: c.get('userId'), ...parsed.data })
    .returning()
  return c.json({ category: row }, 201)
})

financeRoutes.patch('/finance/categories/:id', async (c) => {
  const parsed = categoryInput.partial().safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 422, 'Invalid body', parsed.error.flatten())

  const [row] = await db.update(financeCategory).set(parsed.data)
    .where(and(eq(financeCategory.userId, c.get('userId')), eq(financeCategory.id, c.req.param('id'))))
    .returning()
  if (!row) throw new AppError('NOT_FOUND', 404, 'Category not found')
  return c.json({ category: row })
})

financeRoutes.delete('/finance/categories/:id', async (c) => {
  const [row] = await db.update(financeCategory).set({ isArchived: true })
    .where(and(eq(financeCategory.userId, c.get('userId')), eq(financeCategory.id, c.req.param('id'))))
    .returning()
  if (!row) throw new AppError('NOT_FOUND', 404, 'Category not found')
  return c.json({ ok: true })
})
```

Tambahkan `uuidv7` dari `@better/core/id` ke impor file ini.

- [ ] **Step 5: Terima setting finance di `PATCH /me`**

Modify `apps/api/src/modules/user/routes.ts` — tambahkan ke `prefsSchema`:

```ts
  // Finance — spec 30.finance §5.5. Menempel di app_user, jadi Finance tidak
  // butuh endpoint setting sendiri.
  financeBusinessEnabled: z.boolean().optional(),
  financeSavingsTargetMode: z.enum(['amount', 'percent']).nullable().optional(),
  financeSavingsTargetValue: z.number().int().nonnegative().nullable().optional(),
```

lalu tambahkan ketiganya ke objek `user` di `c.json(...)` pada akhir handler:

```ts
  return c.json({
    user: {
      id: user.id, email: user.email, name: user.name, timezone: user.timezone,
      financeBusinessEnabled: user.financeBusinessEnabled,
      financeSavingsTargetMode: user.financeSavingsTargetMode,
      financeSavingsTargetValue: user.financeSavingsTargetValue,
    },
  })
```

- [ ] **Step 6: Jalankan tes, pastikan lulus**

Run: `npm test -w @better/api -- finance`
Expected: PASS — 26 tes.

- [ ] **Step 7: Verifikasi seluruh repo**

Run: `npm run verify`
Expected: typecheck, lint, test, build semuanya hijau.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/finance/service.ts apps/api/src/modules/finance/routes.ts \
  apps/api/src/modules/user/routes.ts apps/api/test/finance.test.ts
git commit -m "feat(finance): CRUD transaksi, idempotency, cascade §11.2, CRUD akun & kategori"
```

---

## Task F: Shell web — tipe, route, sidebar, klien API

**Files:**
- Modify: `apps/web/src/types/index.ts`
- Modify: `apps/web/src/routes.ts`
- Modify: `apps/web/src/components/Sidebar.tsx`
- Modify: `apps/web/src/App.tsx`
- Create: `apps/web/src/store/finance-api.ts`
- Create: `apps/web/src/components/finance/FinanceView.tsx`
- Create: `apps/web/src/components/finance/Finance.css`

**Interfaces:**
- Consumes: endpoint Task D & E.
- Produces:
  - Tipe `FinancePocket`, `FinanceAccount`, `FinanceCategory`,
    `FinanceTransaction`, `FinanceSummary`, `FinanceOverview`,
    `FinanceReceivable` di `types/index.ts`
  - `deriveViewFromPathname(pathname): { view, projectId, sub }`
  - `pathForView(view, projectId?, sub?)`
  - `finance-api.ts`: `getOverview`, `getAccounts`, `getCategories`,
    `getReceivables`, `getTransactions`, `getNetWorth`, `postTransaction`,
    `patchTransaction`, `deleteTransaction`, `postAccount`, `patchAccount`,
    `archiveAccount`, `patchSettings`, `class FinanceApiError`
  - `<FinanceView sub={string | null} onSubChange={(sub) => void} />`

- [ ] **Step 1: Tambahkan tipe Finance**

Modify `apps/web/src/types/index.ts` — ubah baris 1 menjadi:

```ts
export type ViewType = 'inbox' | 'today' | 'upcoming' | 'anytime' | 'someday' | 'logbook' | 'project' | 'outline' | 'mail' | 'storage' | 'finance' | 'agent' | 'search' | 'tags' | 'settings'
```

dan tambahkan di akhir file:

```ts
/* Finance — docs/feature/30.finance/spec.md. Ini kontraknya: API dibentuk
   mengikuti tipe di bawah, bukan sebaliknya. */
export type FinancePocket = 'personal' | 'business'
export type FinanceAccountKind = 'cash' | 'bank' | 'receivable'
export type FinanceTransactionType = 'income' | 'expense' | 'transfer'

export interface FinanceAccount {
  id: string
  name: string
  kind: FinanceAccountKind
  pocket: FinancePocket
  isSpendable: boolean
  isSystem: boolean
  isArchived: boolean
  sortOrder: number
  /** Derived, tidak pernah disimpan (spec prinsip 2) */
  balance: number
  pockets: { personal: number; business: number }
}

export interface FinanceCategory {
  id: string
  name: string
  type: 'income' | 'expense'
  icon: string | null
  isArchived: boolean
}

export interface FinanceTransaction {
  id: string
  date: string
  type: FinanceTransactionType
  amount: number
  categoryId: string | null
  fromAccountId: string | null
  fromPocket: FinancePocket | null
  toAccountId: string | null
  toPocket: FinancePocket | null
  counterparty: string | null
  note: string | null
}

export interface FinanceSummary {
  month: string
  masuk: number
  keluar: number
  tersimpan: number
}

export interface FinanceTarget {
  mode: 'amount' | 'percent'
  value: number
  targetAmount: number
  saved: number
}

export interface FinanceOverview {
  spendablePersonal: number
  summary: FinanceSummary
  target: FinanceTarget | null
  chips: { piutangTotal?: number; businessTotal?: number }
  businessEnabled: boolean
}

export interface FinanceReceivable {
  counterparty: string
  sisa: number
}
```

- [ ] **Step 2: Beri tab alamat sungguhan**

Modify `apps/web/src/routes.ts` — ganti seluruh isi kedua fungsi:

```ts
const PLAIN_VIEWS: ViewType[] = ['inbox', 'today', 'upcoming', 'anytime', 'someday', 'logbook', 'outline', 'mail', 'storage', 'finance', 'agent', 'search', 'tags', 'settings']

export function pathForView(view: ViewType, projectId?: string | null, sub?: string | null): string {
  if (view === 'project' && projectId) return `/project/${projectId}`
  // Tab Finance punya alamatnya sendiri (spec §10.1) — menyimpannya di
  // useState akan membuatnya satu-satunya layar yang tidak bisa di-bookmark.
  if (sub) return `/${view}/${sub}`
  return `/${view}`
}

export function deriveViewFromPathname(pathname: string): { view: ViewType; projectId: string | null; sub: string | null } {
  const [, first, second] = pathname.split('/')
  if (first === 'project' && second) return { view: 'project', projectId: second, sub: null }
  if (first && (PLAIN_VIEWS as string[]).includes(first)) {
    return { view: first as ViewType, projectId: null, sub: second ?? null }
  }
  return { view: 'today', projectId: null, sub: null }
}
```

- [ ] **Step 3: Jalankan typecheck untuk menemukan pemanggil yang perlu diperbarui**

Run: `npm run typecheck -w @better/web`
Expected: error di `App.tsx` pada destrukturisasi hasil `deriveViewFromPathname`.
Perbaiki dengan menyimpan `sub` ke state di sebelah `activeView`, mengikuti
persis cara `activeProjectId` sudah ditangani di file itu.

- [ ] **Step 4: Tulis klien API**

Create `apps/web/src/store/finance-api.ts`:

```ts
// Pembungkus fetch /api/finance/*. Finance server-backed (spec §4.1) — tidak
// lewat Dexie dan tidak lewat outbox, tidak seperti task dan tag.
import type {
  FinanceAccount, FinanceCategory, FinanceOverview, FinanceReceivable,
  FinanceSummary, FinanceTransaction, FinancePocket,
} from '../types'
import type { TransactionDraft } from '@better/core/finance-validate'

/** Membawa `code` dan `details` apa adanya supaya pemanggil bisa membedakan
 *  409 CONFIRM_REQUIRED (§11.2) dari 422 daftar pelanggaran (§6). */
export class FinanceApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'FinanceApiError'
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  })
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) {
    const err = body?.error ?? {}
    throw new FinanceApiError(res.status, err.code ?? 'INTERNAL', err.message ?? `${path} failed`, err.details)
  }
  return body as T
}

export const getOverview = () => request<FinanceOverview>('/finance/overview')
export const getAccounts = () => request<{ accounts: FinanceAccount[] }>('/finance/accounts').then((b) => b.accounts)
export const getCategories = () => request<{ categories: FinanceCategory[] }>('/finance/categories').then((b) => b.categories)
export const getReceivables = () => request<{ receivables: FinanceReceivable[] }>('/finance/receivables').then((b) => b.receivables)
export const getNetWorth = () => request<{ total: number }>('/finance/networth').then((b) => b.total)

export function getSummary(month: string, pocket: FinancePocket = 'personal', accountId?: string) {
  const q = new URLSearchParams({ month, pocket })
  if (accountId) q.set('account_id', accountId)
  return request<FinanceSummary>(`/finance/summary?${q}`)
}

export function getTransactions(params: { month?: string; pocket?: FinancePocket; accountId?: string; cursor?: string } = {}) {
  const q = new URLSearchParams()
  if (params.month) q.set('month', params.month)
  if (params.pocket) q.set('pocket', params.pocket)
  if (params.accountId) q.set('account_id', params.accountId)
  if (params.cursor) q.set('cursor', params.cursor)
  return request<{ transactions: FinanceTransaction[]; nextCursor: string | null }>(`/finance/transactions?${q}`)
}

export function postTransaction(draft: TransactionDraft, idempotencyKey: string) {
  return request<{ transaction: FinanceTransaction }>('/finance/transactions', {
    method: 'POST',
    headers: { 'idempotency-key': idempotencyKey },
    body: JSON.stringify(draft),
  }).then((b) => b.transaction)
}

export function patchTransaction(id: string, patch: Partial<TransactionDraft>) {
  return request<{ transaction: FinanceTransaction }>(`/finance/transactions/${id}`, {
    method: 'PATCH', body: JSON.stringify(patch),
  }).then((b) => b.transaction)
}

export function deleteTransaction(id: string, cascade?: 'one' | 'all') {
  const q = cascade ? `?cascade=${cascade}` : ''
  return request<{ deleted: number }>(`/finance/transactions/${id}${q}`, { method: 'DELETE' })
}

export function postAccount(input: { name: string; kind: 'cash' | 'bank'; pocket: FinancePocket; isSpendable: boolean }) {
  return request<{ account: FinanceAccount }>('/finance/accounts', { method: 'POST', body: JSON.stringify(input) })
    .then((b) => b.account)
}

export function patchAccount(id: string, patch: Partial<{ name: string; pocket: FinancePocket; isSpendable: boolean; sortOrder: number }>) {
  return request<{ account: FinanceAccount }>(`/finance/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    .then((b) => b.account)
}

export const archiveAccount = (id: string) => request<{ ok: true }>(`/finance/accounts/${id}`, { method: 'DELETE' })

export function patchSettings(patch: {
  financeBusinessEnabled?: boolean
  financeSavingsTargetMode?: 'amount' | 'percent' | null
  financeSavingsTargetValue?: number | null
}) {
  return request<{ user: unknown }>('/me', { method: 'PATCH', body: JSON.stringify(patch) })
}
```

- [ ] **Step 5: Tulis shell FinanceView**

Create `apps/web/src/components/finance/FinanceView.tsx`:

```tsx
// Shell modul Finance — spec §10.1. Empat tab, masing-masing punya alamat.
import { useEffect, useState } from 'react'
import type { FinanceAccount, FinanceCategory } from '../../types'
import { getAccounts, getCategories } from '../../store/finance-api'
import FinanceHome from './FinanceHome'
import TransactionList from './TransactionList'
import AccountsTab from './AccountsTab'
import ReceivablesTab from './ReceivablesTab'
import './Finance.css'

const TABS = [
  { id: null, label: 'Beranda' },
  { id: 'riwayat', label: 'Riwayat' },
  { id: 'akun', label: 'Akun' },
  { id: 'piutang', label: 'Piutang' },
] as const

export interface FinanceViewProps {
  sub: string | null
  onSubChange: (sub: string | null) => void
}

export default function FinanceView({ sub, onSubChange }: FinanceViewProps) {
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [error, setError] = useState<string | null>(null)
  // Dinaikkan tiap kali sebuah transaksi ditulis: satu nilai yang membuat
  // semua tab memuat ulang, tanpa store bersama untuk data yang toh
  // datangnya dari server (§4.1).
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([getAccounts(), getCategories()])
      .then(([a, c]) => {
        if (cancelled) return
        setAccounts(a)
        setCategories(c)
        setError(null)
      })
      .catch(() => { if (!cancelled) setError('Tidak bisa memuat data keuangan.') })
    return () => { cancelled = true }
  }, [revision])

  const reload = () => setRevision((n) => n + 1)

  return (
    <div className="finance">
      <header className="finance__header">
        <h1 className="finance__title">Finance</h1>
        <nav className="finance__tabs">
          {TABS.map((t) => (
            <button
              key={t.label}
              type="button"
              className={`finance__tab ${sub === t.id ? 'finance__tab--active' : ''}`}
              onClick={() => onSubChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Finance butuh koneksi (§10.5) — katakan apa adanya, jangan spinner menggantung. */}
      {error && (
        <div className="finance__error" role="alert">
          {error} <button type="button" onClick={reload}>Coba lagi</button>
        </div>
      )}

      {sub === null && <FinanceHome accounts={accounts} categories={categories} revision={revision} onChanged={reload} />}
      {sub === 'riwayat' && <TransactionList accounts={accounts} categories={categories} revision={revision} onChanged={reload} />}
      {sub === 'akun' && <AccountsTab accounts={accounts} onChanged={reload} />}
      {sub === 'piutang' && <ReceivablesTab accounts={accounts} categories={categories} revision={revision} onChanged={reload} />}
    </div>
  )
}
```

- [ ] **Step 6: Tulis gaya modul**

Create `apps/web/src/components/finance/Finance.css`:

```css
/* Modul Finance — mengikuti token warna yang sudah dipakai komponen lain. */
.finance { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.finance__header { padding: 20px 24px 0; }
.finance__title { font-size: 24px; font-weight: 700; margin: 0 0 12px; }
.finance__tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border, #e5e5e5); }
.finance__tab {
  appearance: none; background: none; border: none; cursor: pointer;
  padding: 8px 12px; font-size: 14px; color: var(--text-secondary, #666);
  border-bottom: 2px solid transparent;
}
.finance__tab--active { color: var(--text-primary, #111); border-bottom-color: currentColor; font-weight: 600; }
.finance__error {
  margin: 12px 24px; padding: 10px 12px; border-radius: 8px;
  background: var(--danger-bg, #fdecea); color: var(--danger, #b3261e); font-size: 14px;
}
.finance__body { flex: 1; overflow-y: auto; padding: 16px 24px 96px; }

/* Saldo negatif merah, tidak pernah diblokir (§11.4) */
.finance-amount--negative { color: var(--danger, #b3261e); }

.finance-fab {
  position: absolute; right: 24px; bottom: 24px;
  width: 52px; height: 52px; border-radius: 50%; border: none; cursor: pointer;
  background: var(--accent, #2f6bff); color: #fff; font-size: 26px; line-height: 1;
  box-shadow: 0 6px 18px rgb(0 0 0 / 18%);
}
```

- [ ] **Step 7: Tambahkan item sidebar**

Modify `apps/web/src/components/Sidebar.tsx` — tambahkan `WalletIcon` ke impor
`@phosphor-icons/react`, lalu sisipkan blok `<li>` **tepat setelah** `<li>`
Storage (sekitar baris 375):

```tsx
          <li>
            <button
              className={`sidebar__nav-item ${activeView === 'finance' ? 'sidebar__nav-item--active' : ''}`}
              onClick={() => onViewChange('finance')}
              type="button"
            >
              <span className="sidebar__nav-icon"><WalletIcon size={18} /></span>
              <span className="sidebar__nav-label">Finance</span>
            </button>
          </li>
```

- [ ] **Step 8: Render view di App**

Modify `apps/web/src/App.tsx` — tambahkan impor
`import FinanceView from './components/finance/FinanceView'`, lalu tambahkan
cabang tepat setelah cabang `activeView === 'storage'`:

```tsx
        ) : activeView === 'finance' ? (
          <FinanceView sub={activeSub} onSubChange={(sub) => navigate(pathForView('finance', null, sub))} />
```

`activeSub` adalah state yang ditambahkan di Step 3; `navigate` adalah fungsi
navigasi yang sudah dipakai cabang lain di file itu.

- [ ] **Step 9: Verifikasi**

Run: `npm run typecheck -w @better/web && npm run lint`
Expected: hijau. `FinanceHome`, `TransactionList`, `AccountsTab`, dan
`ReceivablesTab` belum ada — buat keempatnya sebagai stub sementara yang
mengembalikan `<div className="finance__body" />` supaya typecheck lulus, lalu
isi di Task G–I.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/types/index.ts apps/web/src/routes.ts apps/web/src/App.tsx \
  apps/web/src/components/Sidebar.tsx apps/web/src/store/finance-api.ts \
  apps/web/src/components/finance/
git commit -m "feat(finance): shell web — tipe, route bertab, item sidebar, klien API"
```

---

## Task G: Beranda

**Files:**
- Create (ganti stub): `apps/web/src/components/finance/FinanceHome.tsx`
- Create: `apps/web/src/components/finance/format.ts`
- Modify: `apps/web/src/components/finance/Finance.css`

**Interfaces:**
- Consumes: `getOverview`, `getTransactions` (Task F).
- Produces: `formatRupiah(n: number): string`,
  `<FinanceHome accounts categories revision onChanged />`

- [ ] **Step 1: Tulis helper format + tesnya**

Create `apps/web/src/components/finance/format.ts`:

```ts
/** Rupiah bulat, tanpa desimal (spec §10.3). Negatif tetap ditampilkan. */
export function formatRupiah(amount: number): string {
  const sign = amount < 0 ? '−' : ''
  return `${sign}Rp ${Math.abs(amount).toLocaleString('id-ID')}`
}

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

/** '2026-08' → 'Agustus 2026' */
export function formatMonth(month: string): string {
  const [year, m] = month.split('-')
  return `${MONTHS[Number(m) - 1]} ${year}`
}
```

Create `apps/web/src/components/finance/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatMonth, formatRupiah } from './format.ts'

describe('formatRupiah', () => {
  it('memakai pemisah ribuan id-ID tanpa desimal', () => {
    expect(formatRupiah(4_250_000)).toBe('Rp 4.250.000')
    expect(formatRupiah(0)).toBe('Rp 0')
  })

  it('menampilkan negatif dengan tanda minus di depan', () => {
    expect(formatRupiah(-200_000)).toBe('−Rp 200.000')
  })
})

describe('formatMonth', () => {
  it('menerjemahkan YYYY-MM ke nama bulan Indonesia', () => {
    expect(formatMonth('2026-08')).toBe('Agustus 2026')
  })
})
```

- [ ] **Step 2: Jalankan tes, pastikan gagal lalu lulus**

Run: `npm test -w @better/web -- format`
Expected: FAIL dulu (`format.ts` belum ada saat tes ditulis lebih dulu), lalu
PASS setelah Step 1 lengkap — 3 tes.

- [ ] **Step 3: Tulis beranda**

Create `apps/web/src/components/finance/FinanceHome.tsx`:

```tsx
// Beranda Finance — spec §9.4 (headline), §9.5 (ringkasan), target, chip.
// Satu round-trip lewat /finance/overview.
import { useEffect, useState } from 'react'
import type { FinanceAccount, FinanceCategory, FinanceOverview, FinanceTransaction } from '../../types'
import { getOverview, getTransactions } from '../../store/finance-api'
import { formatMonth, formatRupiah } from './format'
import ActionPicker from './ActionPicker'

interface Props {
  accounts: FinanceAccount[]
  categories: FinanceCategory[]
  revision: number
  onChanged: () => void
}

export default function FinanceHome({ accounts, categories, revision, onChanged }: Props) {
  const [overview, setOverview] = useState<FinanceOverview | null>(null)
  const [recent, setRecent] = useState<FinanceTransaction[]>([])
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([getOverview(), getTransactions()])
      .then(([o, t]) => {
        if (cancelled) return
        setOverview(o)
        setRecent(t.transactions.slice(0, 5))
      })
      .catch(() => { /* pesan error dimunculkan shell (§10.5) */ })
    return () => { cancelled = true }
  }, [revision])

  if (!overview) return <div className="finance__body" />

  const { summary, target, chips } = overview
  const progress = target && target.targetAmount > 0
    ? Math.min(100, Math.round((target.saved / target.targetAmount) * 100))
    : null

  return (
    <div className="finance__body">
      <section className="finance-headline">
        <p className="finance-headline__label">Uang kamu</p>
        <p className={`finance-headline__value ${overview.spendablePersonal < 0 ? 'finance-amount--negative' : ''}`}>
          {formatRupiah(overview.spendablePersonal)}
        </p>
        {/* Sengaja mengecualikan tabungan dan piutang (§9.4) */}
        <p className="finance-headline__hint">Yang aman dipakai hari ini</p>
      </section>

      <section className="finance-summary">
        <h2 className="finance-section__title">{formatMonth(summary.month)}</h2>
        <dl className="finance-summary__grid">
          <div><dt>Masuk</dt><dd>{formatRupiah(summary.masuk)}</dd></div>
          <div><dt>Keluar</dt><dd>{formatRupiah(summary.keluar)}</dd></div>
          <div><dt>Tersimpan</dt><dd className={summary.tersimpan < 0 ? 'finance-amount--negative' : ''}>{formatRupiah(summary.tersimpan)}</dd></div>
        </dl>
      </section>

      {target && progress !== null && (
        <section className="finance-target">
          <p className="finance-target__label">
            Target nabung {formatRupiah(target.targetAmount)}
            {target.mode === 'percent' && ` (${target.value}% dari Masuk)`}
          </p>
          <div className="finance-target__bar"><div className="finance-target__fill" style={{ width: `${progress}%` }} /></div>
          <p className="finance-target__hint">{formatRupiah(target.saved)} tersimpan · {progress}%</p>
        </section>
      )}

      {(chips.piutangTotal !== undefined || chips.businessTotal !== undefined) && (
        <section className="finance-chips">
          {chips.piutangTotal !== undefined && <span className="finance-chip">Piutang {formatRupiah(chips.piutangTotal)}</span>}
          {chips.businessTotal !== undefined && <span className="finance-chip">Bisnis {formatRupiah(chips.businessTotal)}</span>}
        </section>
      )}

      <section className="finance-recent">
        <h2 className="finance-section__title">Transaksi terakhir</h2>
        {recent.length === 0 && <p className="finance-empty">Belum ada transaksi bulan ini.</p>}
        <ul className="finance-tx-list">
          {recent.map((t) => (
            <li key={t.id} className="finance-tx">
              <span className="finance-tx__label">
                {t.counterparty ?? categories.find((c) => c.id === t.categoryId)?.name ?? 'Transfer'}
              </span>
              <span className={`finance-tx__amount ${t.type === 'expense' ? 'finance-amount--negative' : ''}`}>
                {formatRupiah(t.amount)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <button className="finance-fab" type="button" aria-label="Catat transaksi" onClick={() => setPicking(true)}>+</button>
      {picking && (
        <ActionPicker
          accounts={accounts}
          categories={categories}
          businessEnabled={overview.businessEnabled}
          onClose={() => setPicking(false)}
          onSaved={() => { setPicking(false); onChanged() }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Tambahkan gaya beranda**

Modify `apps/web/src/components/finance/Finance.css` — tambahkan di akhir:

```css
.finance-headline { margin-bottom: 24px; }
.finance-headline__label { font-size: 13px; color: var(--text-secondary, #666); margin: 0; }
.finance-headline__value { font-size: 34px; font-weight: 700; margin: 4px 0; }
.finance-headline__hint { font-size: 12px; color: var(--text-secondary, #666); margin: 0; }
.finance-section__title { font-size: 13px; font-weight: 600; color: var(--text-secondary, #666); margin: 0 0 8px; }
.finance-summary { margin-bottom: 24px; }
.finance-summary__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 0; }
.finance-summary__grid dt { font-size: 12px; color: var(--text-secondary, #666); }
.finance-summary__grid dd { font-size: 16px; font-weight: 600; margin: 2px 0 0; }
.finance-target { margin-bottom: 24px; }
.finance-target__label, .finance-target__hint { font-size: 12px; color: var(--text-secondary, #666); margin: 0; }
.finance-target__bar { height: 6px; border-radius: 3px; background: var(--border, #e5e5e5); margin: 6px 0; overflow: hidden; }
.finance-target__fill { height: 100%; background: var(--accent, #2f6bff); }
.finance-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; }
.finance-chip { font-size: 12px; padding: 4px 10px; border-radius: 999px; background: var(--surface-2, #f2f2f2); }
.finance-tx-list { list-style: none; margin: 0; padding: 0; }
.finance-tx { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border, #e5e5e5); font-size: 14px; }
.finance-empty { font-size: 13px; color: var(--text-secondary, #666); }
```

- [ ] **Step 5: Verifikasi**

Run: `npm run typecheck -w @better/web && npm test -w @better/web`
Expected: hijau (`ActionPicker` masih stub sampai Task H — buat file stub
sementara yang menerima props dan mengembalikan `null`).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/finance/FinanceHome.tsx \
  apps/web/src/components/finance/format.ts apps/web/src/components/finance/format.test.ts \
  apps/web/src/components/finance/Finance.css
git commit -m "feat(finance): beranda — headline, ringkasan bulan, progress target, chip"
```

---

## Task H: Input — daftar situasi dan form

**Files:**
- Create (ganti stub): `apps/web/src/components/finance/ActionPicker.tsx`
- Create: `apps/web/src/components/finance/TransactionForm.tsx`
- Create: `apps/web/src/components/finance/action-catalog.ts`
- Create: `apps/web/src/components/finance/action-catalog.test.ts`
- Modify: `apps/web/src/components/finance/Finance.css`

**Interfaces:**
- Consumes: `buildTransaction` (`@better/core/finance-action`),
  `validateTransaction` (`@better/core/finance-validate`), `postTransaction`.
- Produces:
  - `ACTIONS: ActionSpec[]` dan
    `availableActions(accounts, businessEnabled): ActionSpec[]`
  - `interface ActionSpec { id: FinanceActionId; emoji: string; label: string; fields: FieldId[] }`
  - `<ActionPicker accounts categories businessEnabled onClose onSaved />`

- [ ] **Step 1: Tulis tes katalog aksi yang gagal**

Create `apps/web/src/components/finance/action-catalog.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { FinanceAccount } from '../../types'
import { availableActions } from './action-catalog.ts'

function account(overrides: Partial<FinanceAccount>): FinanceAccount {
  return {
    id: 'a', name: 'Dompet', kind: 'cash', pocket: 'personal',
    isSpendable: true, isSystem: false, isArchived: false, sortOrder: 0,
    balance: 0, pockets: { personal: 0, business: 0 },
    ...overrides,
  }
}

const dompet = account({ id: 'dompet' })
const piutang = account({ id: 'piutang', name: 'Piutang', kind: 'receivable', isSpendable: false, isSystem: true })
const tabungan = account({ id: 'tabungan', name: 'Tabungan', kind: 'bank', isSpendable: false })

describe('availableActions (spec §7)', () => {
  it('menyembunyikan tiga aksi bisnis saat business_enabled mati', () => {
    const ids = availableActions([dompet, piutang], false).map((a) => a.id)
    expect(ids).not.toContain('project-income')
    expect(ids).not.toContain('drawing')
    expect(ids).not.toContain('business-expense')
  })

  it('menampilkan aksi bisnis saat business_enabled hidup', () => {
    const ids = availableActions([dompet, piutang], true).map((a) => a.id)
    expect(ids).toEqual(expect.arrayContaining(['project-income', 'drawing', 'business-expense']))
  })

  it('menyembunyikan Nabung selama belum ada akun non-spendable non-sistem (§4.3)', () => {
    expect(availableActions([dompet, piutang], false).map((a) => a.id)).not.toContain('save')
    expect(availableActions([dompet, piutang, tabungan], false).map((a) => a.id)).toContain('save')
  })

  it('Pengeluaran, Gajian, Ngutangin, dan Utang dibayar selalu tersedia', () => {
    const ids = availableActions([dompet, piutang], false).map((a) => a.id)
    expect(ids).toEqual(expect.arrayContaining(['expense', 'salary', 'lend', 'repaid']))
  })

  it('akun terarsip tidak membuat Nabung muncul', () => {
    const arsip = account({ id: 'arsip', isSpendable: false, isArchived: true })
    expect(availableActions([dompet, piutang, arsip], false).map((a) => a.id)).not.toContain('save')
  })
})
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `npm test -w @better/web -- action-catalog`
Expected: FAIL — `Failed to resolve import './action-catalog.ts'`

- [ ] **Step 3: Implementasi katalog**

Create `apps/web/src/components/finance/action-catalog.ts`:

```ts
// Daftar situasi yang dilihat user — spec §7. Aksi yang tidak berlaku tidak
// ditampilkan sama sekali (bukan disabled): pilihan yang tidak bisa dipilih
// cuma menambah pertanyaan di kepala user.
import type { FinanceActionId } from '@better/core/finance-action'
import type { FinanceAccount } from '../../types'

export type FieldId = 'amount' | 'category' | 'account' | 'toAccount' | 'counterparty' | 'date' | 'note'

export interface ActionSpec {
  id: FinanceActionId
  emoji: string
  label: string
  /** Label untuk pemilih akun utama — artinya berbeda tiap aksi. */
  accountLabel: string
  fields: FieldId[]
  requiresBusiness: boolean
  requiresSavingsAccount: boolean
}

export const ACTIONS: ActionSpec[] = [
  { id: 'expense', emoji: '🛒', label: 'Pengeluaran', accountLabel: 'Dari', fields: ['amount', 'category', 'account', 'date', 'note'], requiresBusiness: false, requiresSavingsAccount: false },
  { id: 'salary', emoji: '💰', label: 'Gajian', accountLabel: 'Masuk ke', fields: ['amount', 'account', 'date', 'note'], requiresBusiness: false, requiresSavingsAccount: false },
  { id: 'save', emoji: '🏦', label: 'Nabung', accountLabel: 'Dari', fields: ['amount', 'account', 'toAccount', 'date', 'note'], requiresBusiness: false, requiresSavingsAccount: true },
  { id: 'lend', emoji: '🤝', label: 'Ngutangin', accountLabel: 'Dari', fields: ['amount', 'counterparty', 'account', 'date', 'note'], requiresBusiness: false, requiresSavingsAccount: false },
  { id: 'repaid', emoji: '✅', label: 'Utang dibayar', accountLabel: 'Masuk ke', fields: ['amount', 'counterparty', 'account', 'date', 'note'], requiresBusiness: false, requiresSavingsAccount: false },
  { id: 'project-income', emoji: '📦', label: 'Project cair', accountLabel: 'Masuk ke', fields: ['amount', 'counterparty', 'account', 'date', 'note'], requiresBusiness: true, requiresSavingsAccount: false },
  { id: 'drawing', emoji: '🔁', label: 'Ambil dari bisnis', accountLabel: 'Dari', fields: ['amount', 'account', 'toAccount', 'date', 'note'], requiresBusiness: true, requiresSavingsAccount: false },
  { id: 'business-expense', emoji: '💸', label: 'Biaya bisnis', accountLabel: 'Dari', fields: ['amount', 'category', 'account', 'date', 'note'], requiresBusiness: true, requiresSavingsAccount: false },
]

/** Akun tujuan Nabung: bukan untuk dipakai sehari-hari, dan bukan Piutang. */
export function savingsAccounts(accounts: FinanceAccount[]): FinanceAccount[] {
  return accounts.filter((a) => !a.isSpendable && !a.isSystem && !a.isArchived)
}

export function availableActions(accounts: FinanceAccount[], businessEnabled: boolean): ActionSpec[] {
  const hasSavings = savingsAccounts(accounts).length > 0
  return ACTIONS.filter((a) => {
    if (a.requiresBusiness && !businessEnabled) return false
    if (a.requiresSavingsAccount && !hasSavings) return false
    return true
  })
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `npm test -w @better/web -- action-catalog`
Expected: PASS — 5 tes.

- [ ] **Step 5: Tulis ActionPicker**

Create `apps/web/src/components/finance/ActionPicker.tsx`:

```tsx
// Dua langkah: pilih situasi, lalu isi form yang field-nya sudah pas (§10.2).
import { useState } from 'react'
import type { FinanceAccount, FinanceCategory } from '../../types'
import { availableActions, type ActionSpec } from './action-catalog'
import TransactionForm from './TransactionForm'

interface Props {
  accounts: FinanceAccount[]
  categories: FinanceCategory[]
  businessEnabled: boolean
  onClose: () => void
  onSaved: () => void
}

export default function ActionPicker({ accounts, categories, businessEnabled, onClose, onSaved }: Props) {
  const [chosen, setChosen] = useState<ActionSpec | null>(null)
  const actions = availableActions(accounts, businessEnabled)

  return (
    <div className="finance-sheet" role="dialog" aria-modal="true" aria-label={chosen?.label ?? 'Mau catat apa?'}>
      <div className="finance-sheet__panel">
        {chosen === null ? (
          <>
            <h2 className="finance-sheet__title">Mau catat apa?</h2>
            <ul className="finance-actions">
              {actions.map((a) => (
                <li key={a.id}>
                  <button type="button" className="finance-action" onClick={() => setChosen(a)}>
                    <span aria-hidden="true">{a.emoji}</span> {a.label}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="finance-sheet__close" onClick={onClose}>Batal</button>
          </>
        ) : (
          <TransactionForm
            action={chosen}
            accounts={accounts}
            categories={categories}
            onBack={() => setChosen(null)}
            onSaved={onSaved}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Tulis TransactionForm**

Create `apps/web/src/components/finance/TransactionForm.tsx`:

```tsx
// Form per situasi. Bentuk datanya tidak disusun di sini — buildTransaction
// di @better/core yang melakukannya (§4.2), jadi client dan server memakai
// tabel §7 yang sama persis.
import { useMemo, useState } from 'react'
import { buildTransaction } from '@better/core/finance-action'
import { validateTransaction } from '@better/core/finance-validate'
import type { FinanceAccount, FinanceCategory } from '../../types'
import { postTransaction, FinanceApiError } from '../../store/finance-api'
import { savingsAccounts, type ActionSpec } from './action-catalog'

interface Props {
  action: ActionSpec
  accounts: FinanceAccount[]
  categories: FinanceCategory[]
  onBack: () => void
  onSaved: () => void
}

const MESSAGES: Record<string, string> = {
  AMOUNT_NOT_POSITIVE: 'Jumlah harus lebih dari nol.',
  DATE_TOO_FAR_FUTURE: 'Tanggal tidak boleh di masa depan.',
  CATEGORY_REQUIRED: 'Pilih kategori dulu.',
  COUNTERPARTY_REQUIRED: 'Isi namanya dulu.',
  SELF_TRANSFER: 'Akun asal dan tujuan tidak boleh sama.',
  FROM_REQUIRED: 'Pilih akun asal.',
  TO_REQUIRED: 'Pilih akun tujuan.',
  ARCHIVED: 'Akun atau kategori itu sudah diarsipkan.',
}

export default function TransactionForm({ action, accounts, categories, onBack, onSaved }: Props) {
  const usable = accounts.filter((a) => !a.isArchived && !a.isSystem)
  const receivable = accounts.find((a) => a.kind === 'receivable') ?? null
  const today = new Date().toISOString().slice(0, 10)

  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState(usable[0]?.id ?? '')
  const [toAccountId, setToAccountId] = useState(savingsAccounts(accounts)[0]?.id ?? usable[0]?.id ?? '')
  const [counterparty, setCounterparty] = useState('')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const has = (f: string) => action.fields.includes(f as never)
  const expenseCategories = categories.filter((c) => c.type === 'expense' && !c.isArchived)

  const draft = useMemo(() => buildTransaction(action.id, {
    amount: Number(amount.replace(/\D/g, '')) || 0,
    accountId: accountId || null,
    toAccountId: toAccountId || null,
    categoryId: categoryId || null,
    counterparty: counterparty.trim() || null,
    note: note.trim() || null,
    date,
  }, {
    today,
    lastUsedAccountId: usable[0]?.id ?? null,
    receivableAccountId: receivable?.id ?? null,
    salaryCategoryId: categories.find((c) => c.name === 'Gaji')?.id ?? null,
    projectCategoryId: categories.find((c) => c.name === 'Project')?.id ?? null,
  }), [action.id, amount, accountId, toAccountId, categoryId, counterparty, note, date, categories, receivable, usable, today])

  const violations = validateTransaction(draft, {
    today,
    receivableAccountId: receivable?.id ?? null,
    categoryType: categories.find((c) => c.id === draft.categoryId)?.type ?? null,
    archivedIds: [...accounts.filter((a) => a.isArchived), ...categories.filter((c) => c.isArchived)].map((x) => x.id),
  })

  async function save() {
    setSaving(true)
    setServerError(null)
    try {
      // Kunci di-generate sekali per percobaan simpan: kirim ulang karena
      // koneksi jelek mengembalikan baris yang sama, bukan duplikat (§8).
      await postTransaction(draft, crypto.randomUUID())
      onSaved()
    } catch (e) {
      setServerError(e instanceof FinanceApiError ? e.message : 'Gagal menyimpan. Coba lagi.')
      setSaving(false)
    }
  }

  return (
    <form className="finance-form" onSubmit={(e) => { e.preventDefault(); if (violations.length === 0) void save() }}>
      <h2 className="finance-sheet__title">{action.emoji} {action.label}</h2>

      <label className="finance-field">
        <span>Jumlah</span>
        <input inputMode="numeric" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
      </label>

      {has('category') && (
        <label className="finance-field">
          <span>Kategori</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Pilih kategori</option>
            {expenseCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      )}

      {has('counterparty') && (
        <label className="finance-field">
          <span>{action.id === 'project-income' ? 'Nama project' : 'Nama'}</span>
          <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
        </label>
      )}

      {has('account') && (
        <label className="finance-field">
          <span>{action.accountLabel}</span>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {usable.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
      )}

      {has('toAccount') && (
        <label className="finance-field">
          <span>Ke</span>
          <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
            {(action.id === 'save' ? savingsAccounts(accounts) : usable).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
      )}

      <label className="finance-field">
        <span>Tanggal</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      <label className="finance-field">
        <span>Catatan</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      {/* Pelanggaran ditampilkan sebelum request, dari validator yang sama
          persis dengan yang dipakai server (§4.2). */}
      {amount !== '' && violations.length > 0 && (
        <p className="finance-form__error">{MESSAGES[violations[0]!.code] ?? 'Ada isian yang belum benar.'}</p>
      )}
      {serverError && <p className="finance-form__error">{serverError}</p>}

      <div className="finance-form__actions">
        <button type="button" onClick={onBack}>Kembali</button>
        <button type="submit" disabled={saving || violations.length > 0}>Simpan</button>
      </div>
    </form>
  )
}
```

- [ ] **Step 7: Tambahkan gaya sheet dan form**

Modify `apps/web/src/components/finance/Finance.css` — tambahkan di akhir:

```css
.finance-sheet { position: fixed; inset: 0; background: rgb(0 0 0 / 35%); display: flex; align-items: flex-end; justify-content: center; z-index: 50; }
.finance-sheet__panel { background: var(--surface, #fff); width: min(460px, 100%); border-radius: 16px 16px 0 0; padding: 20px; max-height: 88vh; overflow-y: auto; }
.finance-sheet__title { font-size: 17px; font-weight: 600; margin: 0 0 12px; }
.finance-sheet__close { width: 100%; padding: 10px; margin-top: 8px; }
.finance-actions { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.finance-action { width: 100%; text-align: left; padding: 12px; font-size: 15px; background: none; border: none; border-radius: 8px; cursor: pointer; }
.finance-action:hover { background: var(--surface-2, #f2f2f2); }
.finance-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; font-size: 13px; }
.finance-field input, .finance-field select { padding: 9px 10px; font-size: 15px; border: 1px solid var(--border, #e5e5e5); border-radius: 8px; }
.finance-form__error { font-size: 13px; color: var(--danger, #b3261e); margin: 0 0 8px; }
.finance-form__actions { display: flex; gap: 8px; justify-content: flex-end; }
.finance-form__actions button { padding: 9px 16px; border-radius: 8px; cursor: pointer; }
```

- [ ] **Step 8: Verifikasi**

Run: `npm run typecheck -w @better/web && npm test -w @better/web && npm run lint`
Expected: hijau.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/finance/ActionPicker.tsx \
  apps/web/src/components/finance/TransactionForm.tsx \
  apps/web/src/components/finance/action-catalog.ts \
  apps/web/src/components/finance/action-catalog.test.ts \
  apps/web/src/components/finance/Finance.css
git commit -m "feat(finance): daftar situasi §7 dan form per aksi"
```

---

## Task I: Tab Riwayat, Akun, dan Piutang

**Files:**
- Create (ganti stub): `apps/web/src/components/finance/TransactionList.tsx`
- Create (ganti stub): `apps/web/src/components/finance/AccountsTab.tsx`
- Create (ganti stub): `apps/web/src/components/finance/ReceivablesTab.tsx`
- Modify: `apps/web/src/components/finance/Finance.css`

**Interfaces:**
- Consumes: `getTransactions`, `getReceivables`, `getNetWorth`, `postAccount`,
  `archiveAccount`, `deleteTransaction`, `postTransaction`, `FinanceApiError`.
- Produces: tiga komponen tab, masing-masing menerima
  `{ accounts, categories?, revision, onChanged }`.

- [ ] **Step 1: Tulis tab Riwayat**

Create `apps/web/src/components/finance/TransactionList.tsx`:

```tsx
// Tab Riwayat — daftar per bulan, halaman berikutnya lewat cursor (§8).
import { useEffect, useState } from 'react'
import type { FinanceAccount, FinanceCategory, FinanceTransaction } from '../../types'
import { getTransactions } from '../../store/finance-api'
import { formatMonth, formatRupiah } from './format'

interface Props {
  accounts: FinanceAccount[]
  categories: FinanceCategory[]
  revision: number
  onChanged: () => void
}

export default function TransactionList({ accounts, categories, revision }: Props) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [items, setItems] = useState<FinanceTransaction[]>([])
  const [cursor, setCursor] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getTransactions({ month }).then((r) => {
      if (cancelled) return
      setItems(r.transactions)
      setCursor(r.nextCursor)
    }).catch(() => { /* shell yang menampilkan error */ })
    return () => { cancelled = true }
  }, [month, revision])

  const loadMore = async () => {
    if (!cursor) return
    const r = await getTransactions({ month, cursor })
    setItems((prev) => [...prev, ...r.transactions])
    setCursor(r.nextCursor)
  }

  const label = (t: FinanceTransaction) => {
    if (t.type === 'transfer') {
      const from = accounts.find((a) => a.id === t.fromAccountId)?.name ?? '?'
      const to = accounts.find((a) => a.id === t.toAccountId)?.name ?? '?'
      return t.counterparty ? `${t.counterparty} · ${from} → ${to}` : `${from} → ${to}`
    }
    return categories.find((c) => c.id === t.categoryId)?.name ?? 'Lain-lain'
  }

  return (
    <div className="finance__body">
      <label className="finance-field">
        <span>Bulan</span>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </label>
      <h2 className="finance-section__title">{formatMonth(month)}</h2>
      {items.length === 0 && <p className="finance-empty">Tidak ada transaksi bulan ini.</p>}
      <ul className="finance-tx-list">
        {items.map((t) => (
          <li key={t.id} className="finance-tx">
            <span className="finance-tx__label">
              <strong>{label(t)}</strong>
              <small>{t.date}{t.note ? ` · ${t.note}` : ''}</small>
            </span>
            <span className={`finance-tx__amount ${t.type === 'expense' ? 'finance-amount--negative' : ''}`}>
              {formatRupiah(t.amount)}
            </span>
          </li>
        ))}
      </ul>
      {cursor && <button type="button" onClick={() => void loadMore()}>Muat lebih banyak</button>}
    </div>
  )
}
```

- [ ] **Step 2: Tulis tab Akun**

Create `apps/web/src/components/finance/AccountsTab.tsx`:

```tsx
// Tab Akun — saldo tiap akun (§9.1), pecahannya per kantong (§9.3), dan
// kekayaan bersih (§9.7) yang sengaja tidak diletakkan di beranda.
import { useEffect, useState } from 'react'
import type { FinanceAccount, FinancePocket } from '../../types'
import { archiveAccount, getNetWorth, postAccount } from '../../store/finance-api'
import { formatRupiah } from './format'

interface Props {
  accounts: FinanceAccount[]
  onChanged: () => void
}

export default function AccountsTab({ accounts, onChanged }: Props) {
  const [netWorth, setNetWorth] = useState<number | null>(null)
  const [showNetWorth, setShowNetWorth] = useState(false)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'cash' | 'bank'>('bank')
  const [pocket, setPocket] = useState<FinancePocket>('personal')
  const [isSavings, setIsSavings] = useState(false)

  useEffect(() => {
    if (!showNetWorth) return
    getNetWorth().then(setNetWorth).catch(() => setNetWorth(null))
  }, [showNetWorth, accounts])

  async function add() {
    // Satu akun = satu tempat yang benar-benar terpisah secara fisik (§4.3).
    await postAccount({ name: name.trim(), kind, pocket, isSpendable: !isSavings })
    setAdding(false)
    setName('')
    onChanged()
  }

  return (
    <div className="finance__body">
      <ul className="finance-account-list">
        {accounts.filter((a) => !a.isArchived).map((a) => (
          <li key={a.id} className="finance-account">
            <div>
              <strong>{a.name}</strong>
              {!a.isSpendable && <small> · tidak dihitung sebagai uang yang bisa dipakai</small>}
              {a.pockets.business !== 0 && a.pockets.personal !== 0 && (
                <small> · personal {formatRupiah(a.pockets.personal)}, bisnis {formatRupiah(a.pockets.business)}</small>
              )}
            </div>
            <span className={`finance-account__balance ${a.balance < 0 ? 'finance-amount--negative' : ''}`}>
              {formatRupiah(a.balance)}
            </span>
            {/* Akun yang punya transaksi tidak dihapus, hanya diarsipkan (§11.6) */}
            {!a.isSystem && (
              <button type="button" onClick={() => void archiveAccount(a.id).then(onChanged)}>Arsipkan</button>
            )}
          </li>
        ))}
      </ul>

      {adding ? (
        <form className="finance-form" onSubmit={(e) => { e.preventDefault(); void add() }}>
          <label className="finance-field"><span>Nama</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="finance-field">
            <span>Jenis</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as 'cash' | 'bank')}>
              <option value="bank">Rekening bank</option>
              <option value="cash">Tunai</option>
            </select>
          </label>
          <label className="finance-field">
            <span>Kantong bawaan</span>
            <select value={pocket} onChange={(e) => setPocket(e.target.value as FinancePocket)}>
              <option value="personal">Personal</option>
              <option value="business">Bisnis</option>
            </select>
          </label>
          <label className="finance-check">
            <input type="checkbox" checked={isSavings} onChange={(e) => setIsSavings(e.target.checked)} />
            Ini tabungan — jangan hitung sebagai uang yang bisa dipakai
          </label>
          <div className="finance-form__actions">
            <button type="button" onClick={() => setAdding(false)}>Batal</button>
            <button type="submit" disabled={name.trim() === ''}>Simpan</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)}>Tambah akun</button>
      )}

      <section className="finance-networth">
        <button type="button" onClick={() => setShowNetWorth((v) => !v)}>
          {showNetWorth ? 'Sembunyikan' : 'Lihat'} kekayaan bersih
        </button>
        {showNetWorth && netWorth !== null && (
          <p className="finance-networth__value">{formatRupiah(netWorth)}<small> termasuk tabungan dan piutang</small></p>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Tulis tab Piutang, termasuk dialog §11.2 dan tombol Ikhlaskan**

Create `apps/web/src/components/finance/ReceivablesTab.tsx`:

```tsx
// Tab Piutang — daftar sisa (§9.6), hapus dengan konfirmasi (§11.2), dan
// "Ikhlaskan" yang cuma pintasan membuat expense dari akun Piutang (§11.3).
import { useEffect, useState } from 'react'
import { buildTransaction } from '@better/core/finance-action'
import type { FinanceAccount, FinanceCategory, FinanceReceivable } from '../../types'
import { getReceivables, getTransactions, deleteTransaction, postTransaction, FinanceApiError } from '../../store/finance-api'
import { formatRupiah } from './format'

interface Props {
  accounts: FinanceAccount[]
  categories: FinanceCategory[]
  revision: number
  onChanged: () => void
}

interface Confirm {
  transactionId: string
  counterparty: string
  otherCount: number
  otherTotal: number
}

export default function ReceivablesTab({ accounts, categories, revision, onChanged }: Props) {
  const [items, setItems] = useState<FinanceReceivable[]>([])
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const receivable = accounts.find((a) => a.kind === 'receivable') ?? null

  useEffect(() => {
    let cancelled = false
    getReceivables().then((r) => { if (!cancelled) setItems(r) }).catch(() => { /* shell */ })
    return () => { cancelled = true }
  }, [revision])

  /** Menghapus catatan pinjaman terakhir orang ini; server yang memutuskan
   *  apakah konfirmasi dibutuhkan (§11.2) — client tidak menebak. */
  async function removeLatest(counterparty: string) {
    const { transactions } = await getTransactions()
    const target = transactions.find((t) => t.counterparty === counterparty && t.toAccountId === receivable?.id)
    if (!target) return
    try {
      await deleteTransaction(target.id)
      onChanged()
    } catch (e) {
      if (e instanceof FinanceApiError && e.status === 409) {
        const d = e.details as { counterparty: string; otherCount: number; otherTotal: number }
        setConfirm({ transactionId: target.id, ...d })
        return
      }
      throw e
    }
  }

  async function forgive(counterparty: string, sisa: number) {
    const relasi = categories.find((c) => c.name === 'Relasi' && c.type === 'expense')
    if (!relasi || !receivable) return
    // Transaksi aslinya TIDAK dihapus — angkanya memang masuk Keluar bulan
    // ini, dan itu benar secara akuntansi (§11.3).
    const draft = buildTransaction('expense', {
      amount: sisa, accountId: receivable.id, categoryId: relasi.id, counterparty,
    }, {
      today: new Date().toISOString().slice(0, 10),
      lastUsedAccountId: receivable.id,
      receivableAccountId: receivable.id,
      salaryCategoryId: null,
      projectCategoryId: null,
    })
    await postTransaction(draft, crypto.randomUUID())
    onChanged()
  }

  return (
    <div className="finance__body">
      {items.length === 0 && <p className="finance-empty">Tidak ada piutang berjalan.</p>}
      <ul className="finance-tx-list">
        {items.map((r) => (
          <li key={r.counterparty} className="finance-tx">
            <span className="finance-tx__label">{r.counterparty}</span>
            {/* Sisa negatif tetap ditampilkan merah — sinyal salah input (§11.4) */}
            <span className={`finance-tx__amount ${r.sisa < 0 ? 'finance-amount--negative' : ''}`}>{formatRupiah(r.sisa)}</span>
            <button type="button" onClick={() => void removeLatest(r.counterparty)}>Hapus</button>
            {r.sisa > 0 && <button type="button" onClick={() => void forgive(r.counterparty, r.sisa)}>Ikhlaskan</button>}
          </li>
        ))}
      </ul>

      {confirm && (
        <div className="finance-sheet" role="dialog" aria-modal="true">
          <div className="finance-sheet__panel">
            <h2 className="finance-sheet__title">Hapus catatan {confirm.counterparty}?</h2>
            <p>
              {confirm.counterparty} masih punya {confirm.otherCount} catatan lain senilai{' '}
              {formatRupiah(confirm.otherTotal)}. Hapus juga?
            </p>
            <div className="finance-form__actions">
              <button type="button" onClick={() => setConfirm(null)}>Batal</button>
              <button type="button" onClick={() => void deleteTransaction(confirm.transactionId, 'one').then(() => { setConfirm(null); onChanged() })}>
                Hapus satu saja
              </button>
              <button type="button" onClick={() => void deleteTransaction(confirm.transactionId, 'all').then(() => { setConfirm(null); onChanged() })}>
                Hapus semua
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Tambahkan gaya tiga tab**

Modify `apps/web/src/components/finance/Finance.css` — tambahkan di akhir:

```css
.finance-tx__label { display: flex; flex-direction: column; }
.finance-tx__label small { font-size: 11px; color: var(--text-secondary, #666); }
.finance-account-list { list-style: none; margin: 0 0 16px; padding: 0; }
.finance-account { display: flex; align-items: center; gap: 12px; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border, #e5e5e5); font-size: 14px; }
.finance-account small { color: var(--text-secondary, #666); font-size: 11px; }
.finance-account__balance { font-weight: 600; margin-left: auto; }
.finance-check { display: flex; gap: 8px; align-items: flex-start; font-size: 13px; margin-bottom: 12px; }
.finance-networth { margin-top: 24px; }
.finance-networth__value { font-size: 20px; font-weight: 700; margin: 8px 0 0; }
.finance-networth__value small { display: block; font-size: 11px; font-weight: 400; color: var(--text-secondary, #666); }
```

- [ ] **Step 5: Verifikasi**

Run: `npm run verify`
Expected: hijau seluruhnya.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/finance/TransactionList.tsx \
  apps/web/src/components/finance/AccountsTab.tsx \
  apps/web/src/components/finance/ReceivablesTab.tsx \
  apps/web/src/components/finance/Finance.css
git commit -m "feat(finance): tab Riwayat, Akun (+kekayaan bersih), dan Piutang"
```

---

## Task J: Setup awal dan toggle bisnis

**Files:**
- Create: `apps/web/src/components/finance/FinanceSetup.tsx`
- Modify: `apps/web/src/components/finance/FinanceView.tsx`
- Modify: `apps/web/src/components/finance/AccountsTab.tsx`
- Modify: `apps/web/src/components/finance/Finance.css`

**Interfaces:**
- Consumes: `postAccount`, `patchSettings`, `getOverview` (Task F).
- Produces: `<FinanceSetup accounts onDone />`; `AccountsTab` bertambah prop
  `businessEnabled: boolean`.

- [ ] **Step 1: Tulis wizard tiga pertanyaan**

Create `apps/web/src/components/finance/FinanceSetup.tsx`:

```tsx
// Setup awal — spec §10.4. Tiga pertanyaan, sisanya default; target < 1 menit.
import { useState } from 'react'
import type { FinancePocket } from '../../types'
import { patchSettings, postAccount } from '../../store/finance-api'

interface DraftAccount {
  name: string
  kind: 'cash' | 'bank'
  pocket: FinancePocket
  isSavings: boolean
}

export default function FinanceSetup({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(1)
  const [drafts, setDrafts] = useState<DraftAccount[]>([])
  const [name, setName] = useState('')
  const [isSavings, setIsSavings] = useState(false)
  const [pocket, setPocket] = useState<FinancePocket>('personal')
  const [businessEnabled, setBusinessEnabled] = useState(false)
  const [targetMode, setTargetMode] = useState<'amount' | 'percent' | ''>('')
  const [targetValue, setTargetValue] = useState('')
  const [saving, setSaving] = useState(false)

  function addDraft() {
    if (name.trim() === '') return
    setDrafts((prev) => [...prev, { name: name.trim(), kind: 'bank', pocket, isSavings }])
    setName('')
    setIsSavings(false)
    setPocket('personal')
  }

  async function finish() {
    setSaving(true)
    for (const d of drafts) {
      await postAccount({ name: d.name, kind: d.kind, pocket: d.pocket, isSpendable: !d.isSavings })
    }
    await patchSettings({
      financeBusinessEnabled: businessEnabled,
      financeSavingsTargetMode: targetMode === '' ? null : targetMode,
      financeSavingsTargetValue: targetMode === '' ? null : Number(targetValue.replace(/\D/g, '')) || null,
    })
    // Ditandai per perangkat: kalau user memang hanya punya Dompet, tanpa
    // penanda ini wizard-nya muncul terus. Perangkat lain akan melihat akun
    // yang sudah dibuat, jadi kondisinya toh sudah tidak terpenuhi.
    localStorage.setItem('finance.setupDone', '1')
    onDone()
  }

  return (
    <div className="finance__body finance-setup">
      {step === 1 && (
        <section>
          <h2 className="finance-section__title">Punya rekening apa?</h2>
          <p className="finance-empty">Dompet tunai sudah dibuatkan. Tambahkan rekening lain kalau ada.</p>
          <ul className="finance-tx-list">
            {drafts.map((d) => <li key={d.name} className="finance-tx">{d.name}{d.isSavings ? ' · tabungan' : ''}</li>)}
          </ul>
          <label className="finance-field"><span>Nama rekening</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="finance-check">
            <input type="checkbox" checked={isSavings} onChange={(e) => setIsSavings(e.target.checked)} />
            Ini tabungan — jangan hitung sebagai uang yang bisa dipakai
          </label>
          <label className="finance-field">
            <span>Kantong bawaan</span>
            <select value={pocket} onChange={(e) => setPocket(e.target.value as FinancePocket)}>
              <option value="personal">Personal</option>
              <option value="business">Bisnis</option>
            </select>
          </label>
          <div className="finance-form__actions">
            <button type="button" onClick={addDraft}>Tambah</button>
            <button type="button" onClick={() => setStep(2)}>Lanjut</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section>
          <h2 className="finance-section__title">Punya usaha atau project sampingan?</h2>
          <p className="finance-empty">Kalau ya, uang bisnis dipisah dari uang pribadi dan omzet tidak mengotori ringkasan personal.</p>
          <div className="finance-form__actions">
            <button type="button" onClick={() => { setBusinessEnabled(false); setStep(3) }}>Tidak</button>
            <button type="button" onClick={() => { setBusinessEnabled(true); setStep(3) }}>Ya</button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section>
          <h2 className="finance-section__title">Target nabung per bulan?</h2>
          <label className="finance-field">
            <span>Mode</span>
            <select value={targetMode} onChange={(e) => setTargetMode(e.target.value as typeof targetMode)}>
              <option value="">Lewati</option>
              <option value="percent">Persen dari pemasukan</option>
              <option value="amount">Jumlah tetap</option>
            </select>
          </label>
          {targetMode !== '' && (
            <label className="finance-field">
              <span>{targetMode === 'percent' ? 'Persen' : 'Rupiah'}</span>
              <input inputMode="numeric" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
            </label>
          )}
          <div className="finance-form__actions">
            <button type="button" disabled={saving} onClick={() => void finish()}>Selesai</button>
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Munculkan wizard saat memang perlu**

Modify `apps/web/src/components/finance/FinanceView.tsx` — tambahkan impor
`FinanceSetup`, lalu di atas `return`:

```tsx
  // Belum punya akun selain hasil seed (Dompet + Piutang) dan belum pernah
  // menyelesaikan wizard — spec §10.4.
  const needsSetup =
    accounts.length > 0 && accounts.length <= 2 && localStorage.getItem('finance.setupDone') !== '1'
```

dan tepat sebelum baris `{sub === null && <FinanceHome ... />}`:

```tsx
      {needsSetup && <FinanceSetup onDone={reload} />}
      {!needsSetup && (
```

Tutup kurungnya setelah baris `ReceivablesTab`, sehingga keempat tab hanya
dirender saat setup tidak dibutuhkan.

- [ ] **Step 3: Pindahkan toggle bisnis ke tab Akun**

Modify `apps/web/src/components/finance/AccountsTab.tsx` — tambahkan prop
`businessEnabled: boolean` ke `interface Props`, impor `patchSettings`, dan
tambahkan section di akhir `return`, sebelum `</div>` penutup:

```tsx
      <section className="finance-settings">
        <label className="finance-check">
          <input
            type="checkbox"
            checked={businessEnabled}
            onChange={(e) => void patchSettings({ financeBusinessEnabled: e.target.checked }).then(onChanged)}
          />
          Saya punya usaha atau project sampingan
        </label>
        <p className="finance-empty">
          Mematikannya menyembunyikan aksi bisnis. Datanya tidak hilang — tidak ada migrasi apa pun kalau nanti dinyalakan lagi.
        </p>
      </section>
```

Toggle ini ditaruh di tab Akun, bukan di halaman Settings app: ia setting
Finance, dan meletakkannya di modulnya sendiri membuat blok ini tidak
menyentuh file di luar `components/finance/`.

`FinanceView` meneruskan nilainya dari `/finance/overview`
(`businessEnabled`), yang sudah dikirim endpoint itu sejak Task D. Ambil
sekali di `FinanceView` lewat `getOverview()` dan simpan di state di sebelah
`accounts`.

- [ ] **Step 4: Tambahkan gaya**

Modify `apps/web/src/components/finance/Finance.css`:

```css
.finance-setup section { max-width: 420px; }
.finance-settings { margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--border, #e5e5e5); }
```

- [ ] **Step 5: Verifikasi**

Run: `npm run verify`
Expected: hijau.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/finance/FinanceSetup.tsx \
  apps/web/src/components/finance/FinanceView.tsx \
  apps/web/src/components/finance/AccountsTab.tsx \
  apps/web/src/components/finance/Finance.css
git commit -m "feat(finance): setup awal tiga pertanyaan dan toggle bisnis"
```

---

## Task K: E2E alur 90%

**Files:**
- Create: `e2e/finance.spec.ts`

**Interfaces:**
- Consumes: fixture `test`/`expect` dari `e2e/fixtures.ts` (membuat user dan
  login lewat UI).

- [ ] **Step 1: Tulis tes e2e**

Create `e2e/finance.spec.ts`:

```ts
import { test, expect } from './fixtures.ts'

// Bukan menguji ulang perhitungan §9 — itu sudah dikunci tes integrasi.
// Yang dibuktikan di sini: rantai UI → @better/core → API → agregasi
// benar-benar tersambung (spec §12).
test('catat pengeluaran lewat daftar situasi, angka beranda ikut berubah', async ({ page, userEmail: _userEmail }) => {
  await page.goto('/finance')

  // Lewati setup: user baru hanya punya Dompet + Piutang hasil seed.
  await page.getByRole('button', { name: 'Lanjut' }).click()
  await page.getByRole('button', { name: 'Tidak' }).click()
  await page.getByRole('button', { name: 'Selesai' }).click()

  // Headline dipilih lewat kelasnya, bukan lewat teks: "Rp 25.000" muncul di
  // dua tempat sekaligus (headline dan daftar transaksi terakhir), dan
  // getByText yang ambigu akan gagal karena strict mode Playwright.
  const headline = page.locator('.finance-headline__value')
  await expect(page.getByText('Uang kamu')).toBeVisible()
  await expect(headline).toHaveText('Rp 0')

  await page.getByRole('button', { name: 'Catat transaksi' }).click()
  await page.getByRole('button', { name: /Pengeluaran/ }).click()
  await page.getByLabel('Jumlah').fill('25000')
  await page.getByLabel('Kategori').selectOption({ label: 'Makan' })
  await page.getByRole('button', { name: 'Simpan' }).click()

  // Headline turun jadi negatif — Dompet mulai dari nol (§11.4: negatif
  // ditampilkan, tidak diblokir) — dan transaksinya muncul di daftar terakhir.
  await expect(headline).toHaveText('−Rp 25.000')
  await expect(page.getByText('Makan')).toBeVisible()

  // Reload membuktikan ia benar-benar sampai ke Postgres, bukan cuma state React.
  await page.reload()
  await expect(headline).toHaveText('−Rp 25.000')
})

test('tab punya alamat sendiri dan bertahan setelah reload', async ({ page, userEmail: _userEmail }) => {
  await page.goto('/finance/akun')
  await expect(page.getByText('Dompet')).toBeVisible()
  await expect(page.getByText('Piutang')).toBeVisible()

  await page.reload()
  await expect(page).toHaveURL(/\/finance\/akun$/)
  await expect(page.getByText('Dompet')).toBeVisible()
})
```

- [ ] **Step 2: Jalankan e2e**

Run: `npm run test:e2e -- finance`
Expected: PASS — 2 tes. Kalau gagal karena wizard tidak muncul (user e2e
dipakai ulang antar run dan `localStorage`-nya bersih tapi akunnya sudah ada),
sesuaikan langkah "Lewati setup" jadi kondisional:
`if (await page.getByRole('button', { name: 'Lanjut' }).isVisible()) { ... }`

- [ ] **Step 3: Verifikasi penuh**

Run: `npm run verify && npm run test:e2e`
Expected: semuanya hijau.

- [ ] **Step 4: Commit**

```bash
git add e2e/finance.spec.ts
git commit -m "test(finance): e2e alur 90% dan alamat tab"
```

---

## Setelah semua task selesai

Kartu epic pindah **Ongoing → Review**, bukan langsung Done. Sesuai
`docs/policy/2-workflow.md` §2, Done mensyaratkan verifikasi **benar-benar
dijalankan** — untuk fitur ini artinya: buka `/finance` di browser sungguhan,
jalankan setup, catat satu transaksi tiap situasi yang tersedia, dan cocokkan
saldo akun dengan angka yang kamu harapkan. `npm run verify` hijau saja tidak
memindahkan kartu ke Done.
