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
