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
