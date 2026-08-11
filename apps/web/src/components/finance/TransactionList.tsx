// Stub — konten sungguhan menyusul di Task G (docs/feature/30.finance/spec.md).
import type { FinanceAccount, FinanceCategory } from '../../types'

export interface TransactionListProps {
  accounts: FinanceAccount[]
  categories: FinanceCategory[]
  revision: number
  onChanged: () => void
}

export default function TransactionList(_props: TransactionListProps) {
  return <div className="finance__body" />
}
