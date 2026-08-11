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
