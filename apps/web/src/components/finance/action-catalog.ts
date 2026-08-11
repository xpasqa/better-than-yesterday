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
