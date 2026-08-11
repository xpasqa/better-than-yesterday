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
