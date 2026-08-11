// Stub — konten sungguhan menyusul di Task H (docs/feature/30.finance/spec.md).
import type { FinanceAccount, FinanceCategory } from '../../types'

export interface ActionPickerProps {
  accounts: FinanceAccount[]
  categories: FinanceCategory[]
  businessEnabled: boolean
  onClose: () => void
  onSaved: () => void
}

export default function ActionPicker(_props: ActionPickerProps) {
  return null
}
