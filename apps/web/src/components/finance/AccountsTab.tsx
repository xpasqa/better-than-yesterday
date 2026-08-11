// Stub — konten sungguhan menyusul di Task I (docs/feature/30.finance/spec.md).
import type { FinanceAccount } from '../../types'

export interface AccountsTabProps {
  accounts: FinanceAccount[]
  onChanged: () => void
}

export default function AccountsTab(_props: AccountsTabProps) {
  return <div className="finance__body" />
}
