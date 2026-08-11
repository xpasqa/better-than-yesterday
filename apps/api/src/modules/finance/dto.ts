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

// userId, idempotencyKey, deletedAt, createdAt, dan updatedAt sengaja
// tidak diikutkan — UI tidak membutuhkannya.
