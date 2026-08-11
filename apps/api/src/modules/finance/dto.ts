// Bentuk respons mengikuti tipe frontend, bukan kolom DB — CLAUDE.md:
// "frontend types adalah kontrak". Satu tempat pemetaan supaya tidak ada
// rute yang diam-diam membocorkan snake_case atau kolom backend-only.
import type { financeAccount, financeCategory, financeTransaction } from '../../db/schema/finance.ts'

type TransactionRow = typeof financeTransaction.$inferSelect
type AccountRow = typeof financeAccount.$inferSelect
type CategoryRow = typeof financeCategory.$inferSelect

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

// userId, idempotencyKey, deletedAt, createdAt, dan updatedAt sengaja
// tidak diikutkan — UI tidak membutuhkannya.

// Dipakai POST/PATCH akun — beda dari accountBalances() (queries.ts), yang
// menambahkan balance/pockets hasil agregasi untuk GET /finance/accounts.
// isSystem sengaja tidak diikutkan: rute ini tidak pernah membuat atau
// mengubah akun sistem (POST menolak kind 'receivable', PATCH/DELETE akun
// sistem ditolak 409 duluan oleh ownedAccount()).
export function toAccountDto(row: AccountRow) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    pocket: row.pocket,
    isSpendable: row.isSpendable,
    isArchived: row.isArchived,
    sortOrder: row.sortOrder,
  }
}

// Bentuk yang sama dipakai GET /finance/categories — satu tempat supaya
// list, create, dan update kategori tidak pernah diam-diam berbeda bentuk.
export function toCategoryDto(row: CategoryRow) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    icon: row.icon,
    isArchived: row.isArchived,
    sortOrder: row.sortOrder,
  }
}
