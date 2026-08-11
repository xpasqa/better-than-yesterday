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

    const noFrom = draft({
      type: 'transfer', categoryId: null,
      fromAccountId: null, fromPocket: null,
      toAccountId: 'acc-tabungan', toPocket: 'personal',
    })
    expect(codes(noFrom, ctx)).toContain('FROM_REQUIRED')

    const noTo = draft({ type: 'transfer', categoryId: null })
    expect(codes(noTo, ctx)).toContain('TO_REQUIRED')
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

describe('akun dan kantong berpasangan (celah dari review Task C)', () => {
  it('fromAccountId terisi tanpa fromPocket ditolak', () => {
    expect(codes(draft({ fromAccountId: 'acc-bca', fromPocket: null }), ctx)).toContain('FROM_POCKET_MISMATCH')
  })

  // Arah ini sebenarnya tak terjangkau lewat form UI normal (fromPocket
  // butuh fromAccountId untuk dipilih dulu), tapi draft datang lewat body
  // request mentah — client nakal atau bug bisa mengirim fromPocket sendirian.
  // FROM_REQUIRED/FROM_FORBIDDEN tidak menyentuh kombinasi ini sama sekali,
  // jadi tanpa cek ini draft begini akan lolos validasi.
  it('fromPocket terisi tanpa fromAccountId ditolak', () => {
    const d = draft({ type: 'income', fromAccountId: null, fromPocket: 'personal', toAccountId: 'acc-tabungan', toPocket: 'personal' })
    expect(codes(d, { ...ctx, categoryType: 'income' })).toContain('FROM_POCKET_MISMATCH')
  })

  it('toAccountId terisi tanpa toPocket ditolak', () => {
    const d = draft({ type: 'income', fromAccountId: null, fromPocket: null, toAccountId: 'acc-tabungan', toPocket: null })
    expect(codes(d, { ...ctx, categoryType: 'income' })).toContain('TO_POCKET_MISMATCH')
  })

  it('toPocket terisi tanpa toAccountId ditolak', () => {
    expect(codes(draft({ toAccountId: null, toPocket: 'business' }), ctx)).toContain('TO_POCKET_MISMATCH')
  })

  it('draft yang sudah valid — akun dan kantong berpasangan — tidak memicu kode baru ini', () => {
    expect(validateTransaction(draft(), ctx)).toEqual([])
    const transfer = draft({
      type: 'transfer', categoryId: null, fromPocket: 'business',
      toAccountId: 'acc-bca', toPocket: 'personal',
    })
    expect(validateTransaction(transfer, ctx)).toEqual([])
  })
})
