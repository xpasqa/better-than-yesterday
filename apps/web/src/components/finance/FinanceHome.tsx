// Beranda Finance — spec §9.4 (headline), §9.5 (ringkasan), target, chip.
// Satu round-trip lewat /finance/overview.
import { useEffect, useState } from 'react'
import type { FinanceAccount, FinanceCategory, FinanceOverview, FinanceTransaction } from '../../types'
import { getOverview, getTransactions } from '../../store/finance-api'
import { formatMonth, formatRupiah } from './format'
import ActionPicker from './ActionPicker'

interface Props {
  accounts: FinanceAccount[]
  categories: FinanceCategory[]
  timezone: string
  revision: number
  onChanged: () => void
}

export default function FinanceHome({ accounts, categories, timezone, revision, onChanged }: Props) {
  const [overview, setOverview] = useState<FinanceOverview | null>(null)
  const [recent, setRecent] = useState<FinanceTransaction[]>([])
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([getOverview(), getTransactions()])
      .then(([o, t]) => {
        if (cancelled) return
        setOverview(o)
        setRecent(t.transactions.slice(0, 5))
      })
      .catch(() => { /* pesan error dimunculkan shell (§10.5) */ })
    return () => { cancelled = true }
  }, [revision])

  if (!overview) return <div className="finance__body" />

  const { summary, target, chips } = overview
  const progress = target && target.targetAmount > 0
    ? Math.min(100, Math.round((target.saved / target.targetAmount) * 100))
    : null

  return (
    <div className="finance__body">
      <section className="finance-headline">
        <p className="finance-headline__label">Uang kamu</p>
        <p className={`finance-headline__value ${overview.spendablePersonal < 0 ? 'finance-amount--negative' : ''}`}>
          {formatRupiah(overview.spendablePersonal)}
        </p>
        {/* Sengaja mengecualikan tabungan dan piutang (§9.4) */}
        <p className="finance-headline__hint">Yang aman dipakai hari ini</p>
      </section>

      <section className="finance-summary">
        <h2 className="finance-section__title">{formatMonth(summary.month)}</h2>
        <dl className="finance-summary__grid">
          <div><dt>Masuk</dt><dd>{formatRupiah(summary.masuk)}</dd></div>
          <div><dt>Keluar</dt><dd>{formatRupiah(summary.keluar)}</dd></div>
          <div><dt>Tersimpan</dt><dd className={summary.tersimpan < 0 ? 'finance-amount--negative' : ''}>{formatRupiah(summary.tersimpan)}</dd></div>
        </dl>
      </section>

      {target && progress !== null && (
        <section className="finance-target">
          <p className="finance-target__label">
            Target nabung {formatRupiah(target.targetAmount)}
            {target.mode === 'percent' && ` (${target.value}% dari Masuk)`}
          </p>
          <div className="finance-target__bar"><div className="finance-target__fill" style={{ width: `${progress}%` }} /></div>
          <p className="finance-target__hint">{formatRupiah(target.saved)} tersimpan · {progress}%</p>
        </section>
      )}

      {(chips.piutangTotal !== undefined || chips.businessTotal !== undefined) && (
        <section className="finance-chips">
          {chips.piutangTotal !== undefined && <span className="finance-chip">Piutang {formatRupiah(chips.piutangTotal)}</span>}
          {chips.businessTotal !== undefined && <span className="finance-chip">Bisnis {formatRupiah(chips.businessTotal)}</span>}
        </section>
      )}

      <section className="finance-recent">
        <h2 className="finance-section__title">Transaksi terakhir</h2>
        {recent.length === 0 && <p className="finance-empty">Belum ada transaksi bulan ini.</p>}
        <ul className="finance-tx-list">
          {recent.map((t) => (
            <li key={t.id} className="finance-tx">
              <span className="finance-tx__label">
                {t.counterparty ?? categories.find((c) => c.id === t.categoryId)?.name ?? 'Transfer'}
              </span>
              <span className={`finance-tx__amount ${t.type === 'expense' ? 'finance-amount--negative' : ''}`}>
                {formatRupiah(t.amount)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <button className="finance-fab" type="button" aria-label="Catat transaksi" onClick={() => setPicking(true)}>+</button>
      {picking && (
        <ActionPicker
          accounts={accounts}
          categories={categories}
          timezone={timezone}
          businessEnabled={overview.businessEnabled}
          onClose={() => setPicking(false)}
          onSaved={() => { setPicking(false); onChanged() }}
        />
      )}
    </div>
  )
}
