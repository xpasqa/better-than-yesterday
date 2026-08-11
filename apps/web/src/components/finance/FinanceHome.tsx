// Stub — konten sungguhan menyusul di Task G (docs/feature/30.finance/spec.md).
import type { FinanceAccount, FinanceCategory } from '../../types'

export interface FinanceHomeProps {
  accounts: FinanceAccount[]
  categories: FinanceCategory[]
  revision: number
  onChanged: () => void
}

export default function FinanceHome(_props: FinanceHomeProps) {
  return <div className="finance__body" />
}
