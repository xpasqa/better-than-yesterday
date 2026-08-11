// Dua langkah: pilih situasi, lalu isi form yang field-nya sudah pas (§10.2).
import { useState } from 'react'
import type { FinanceAccount, FinanceCategory } from '../../types'
import { availableActions, type ActionSpec } from './action-catalog'
import TransactionForm from './TransactionForm'

interface Props {
  accounts: FinanceAccount[]
  categories: FinanceCategory[]
  businessEnabled: boolean
  onClose: () => void
  onSaved: () => void
}

export default function ActionPicker({ accounts, categories, businessEnabled, onClose, onSaved }: Props) {
  const [chosen, setChosen] = useState<ActionSpec | null>(null)
  const actions = availableActions(accounts, businessEnabled)

  return (
    <div className="finance-sheet" role="dialog" aria-modal="true" aria-label={chosen?.label ?? 'Mau catat apa?'}>
      <div className="finance-sheet__panel">
        {chosen === null ? (
          <>
            <h2 className="finance-sheet__title">Mau catat apa?</h2>
            <ul className="finance-actions">
              {actions.map((a) => (
                <li key={a.id}>
                  <button type="button" className="finance-action" onClick={() => setChosen(a)}>
                    <span aria-hidden="true">{a.emoji}</span> {a.label}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="finance-sheet__close" onClick={onClose}>Batal</button>
          </>
        ) : (
          <TransactionForm
            action={chosen}
            accounts={accounts}
            categories={categories}
            onBack={() => setChosen(null)}
            onSaved={onSaved}
          />
        )}
      </div>
    </div>
  )
}
