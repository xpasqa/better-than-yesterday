// Tab Riwayat — daftar per bulan, halaman berikutnya lewat cursor (§8).
import { useEffect, useState } from 'react'
import { todayInTimezone } from '@better/core/date'
import type { FinanceAccount, FinanceCategory, FinanceTransaction } from '../../types'
import { getTransactions } from '../../store/finance-api'
import { formatMonth, formatRupiah } from './format'

interface Props {
  accounts: FinanceAccount[]
  categories: FinanceCategory[]
  timezone: string
  revision: number
  onChanged: () => void
}

export default function TransactionList({ accounts, categories, timezone, revision }: Props) {
  // Bulan berjalan menurut zona waktu user: tanggal 1 jam 1 pagi WIB masih
  // bulan sebelumnya kalau dihitung UTC (§11.7).
  const [month, setMonth] = useState(todayInTimezone(timezone).slice(0, 7))
  const [items, setItems] = useState<FinanceTransaction[]>([])
  const [cursor, setCursor] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getTransactions({ month }).then((r) => {
      if (cancelled) return
      setItems(r.transactions)
      setCursor(r.nextCursor)
    }).catch(() => { /* shell yang menampilkan error */ })
    return () => { cancelled = true }
  }, [month, revision])

  const loadMore = async () => {
    if (!cursor) return
    const r = await getTransactions({ month, cursor })
    setItems((prev) => [...prev, ...r.transactions])
    setCursor(r.nextCursor)
  }

  const label = (t: FinanceTransaction) => {
    if (t.type === 'transfer') {
      const from = accounts.find((a) => a.id === t.fromAccountId)?.name ?? '?'
      const to = accounts.find((a) => a.id === t.toAccountId)?.name ?? '?'
      return t.counterparty ? `${t.counterparty} · ${from} → ${to}` : `${from} → ${to}`
    }
    return categories.find((c) => c.id === t.categoryId)?.name ?? 'Lain-lain'
  }

  return (
    <div className="finance__body">
      <label className="finance-field">
        <span>Bulan</span>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </label>
      <h2 className="finance-section__title">{formatMonth(month)}</h2>
      {items.length === 0 && <p className="finance-empty">Tidak ada transaksi bulan ini.</p>}
      <ul className="finance-tx-list">
        {items.map((t) => (
          <li key={t.id} className="finance-tx">
            <span className="finance-tx__label">
              <strong>{label(t)}</strong>
              <small>{t.date}{t.note ? ` · ${t.note}` : ''}</small>
            </span>
            <span className={`finance-tx__amount ${t.type === 'expense' ? 'finance-amount--negative' : ''}`}>
              {formatRupiah(t.amount)}
            </span>
          </li>
        ))}
      </ul>
      {cursor && <button type="button" onClick={() => void loadMore()}>Muat lebih banyak</button>}
    </div>
  )
}
