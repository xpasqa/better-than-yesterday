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
  | 'FROM_POCKET_MISMATCH'
  | 'TO_POCKET_MISMATCH'

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

  // 7. Akun dan kantongnya harus jalan berpasangan — satu terisi tanpa yang
  // lain akan lolos ke DB lalu hilang diam-diam dari pemecahan saldo per
  // kantong (§9.3). Berlaku dua arah: id tanpa kantong, atau kantong tanpa id.
  if ((draft.fromAccountId === null) !== (draft.fromPocket === null)) {
    v.push({ field: 'fromAccountId', code: 'FROM_POCKET_MISMATCH' })
  }
  if ((draft.toAccountId === null) !== (draft.toPocket === null)) {
    v.push({ field: 'toAccountId', code: 'TO_POCKET_MISMATCH' })
  }

  return v
}
