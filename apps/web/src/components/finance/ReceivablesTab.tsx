// Stub — konten sungguhan menyusul di Task I (docs/feature/30.finance/spec.md).
import type { FinanceAccount, FinanceCategory } from '../../types'

export interface ReceivablesTabProps {
  accounts: FinanceAccount[]
  categories: FinanceCategory[]
  revision: number
  onChanged: () => void
}

export default function ReceivablesTab(_props: ReceivablesTabProps) {
  return <div className="finance__body" />
}
