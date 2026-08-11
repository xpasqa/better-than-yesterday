// Shell modul Finance — spec §10.1. Empat tab, masing-masing punya alamat.
import { useEffect, useState } from 'react'
import type { FinanceAccount, FinanceCategory } from '../../types'
import { getAccounts, getCategories } from '../../store/finance-api'
import FinanceHome from './FinanceHome'
import TransactionList from './TransactionList'
import AccountsTab from './AccountsTab'
import ReceivablesTab from './ReceivablesTab'
import './Finance.css'

const TABS = [
  { id: null, label: 'Beranda' },
  { id: 'riwayat', label: 'Riwayat' },
  { id: 'akun', label: 'Akun' },
  { id: 'piutang', label: 'Piutang' },
] as const

export interface FinanceViewProps {
  sub: string | null
  onSubChange: (sub: string | null) => void
}

export default function FinanceView({ sub, onSubChange }: FinanceViewProps) {
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [error, setError] = useState<string | null>(null)
  // Dinaikkan tiap kali sebuah transaksi ditulis: satu nilai yang membuat
  // semua tab memuat ulang, tanpa store bersama untuk data yang toh
  // datangnya dari server (§4.1).
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([getAccounts(), getCategories()])
      .then(([a, c]) => {
        if (cancelled) return
        setAccounts(a)
        setCategories(c)
        setError(null)
      })
      .catch(() => { if (!cancelled) setError('Tidak bisa memuat data keuangan.') })
    return () => { cancelled = true }
  }, [revision])

  const reload = () => setRevision((n) => n + 1)

  return (
    <div className="finance">
      <header className="finance__header">
        <h1 className="finance__title">Finance</h1>
        <nav className="finance__tabs">
          {TABS.map((t) => (
            <button
              key={t.label}
              type="button"
              className={`finance__tab ${sub === t.id ? 'finance__tab--active' : ''}`}
              onClick={() => onSubChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Finance butuh koneksi (§10.5) — katakan apa adanya, jangan spinner menggantung. */}
      {error && (
        <div className="finance__error" role="alert">
          {error} <button type="button" onClick={reload}>Coba lagi</button>
        </div>
      )}

      {sub === null && <FinanceHome accounts={accounts} categories={categories} revision={revision} onChanged={reload} />}
      {sub === 'riwayat' && <TransactionList accounts={accounts} categories={categories} revision={revision} onChanged={reload} />}
      {sub === 'akun' && <AccountsTab accounts={accounts} onChanged={reload} />}
      {sub === 'piutang' && <ReceivablesTab accounts={accounts} categories={categories} revision={revision} onChanged={reload} />}
    </div>
  )
}
