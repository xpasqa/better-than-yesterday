// Tab Piutang — daftar sisa (§9.6), hapus dengan konfirmasi (§11.2), dan
// "Ikhlaskan" yang cuma pintasan membuat expense dari akun Piutang (§11.3).
import { useEffect, useState } from 'react'
import { buildTransaction } from '@better/core/finance-action'
import type { FinanceAccount, FinanceCategory, FinanceReceivable } from '../../types'
import { getReceivables, getTransactions, deleteTransaction, postTransaction, FinanceApiError } from '../../store/finance-api'
import { formatRupiah } from './format'

interface Props {
  accounts: FinanceAccount[]
  categories: FinanceCategory[]
  revision: number
  onChanged: () => void
}

interface Confirm {
  transactionId: string
  counterparty: string
  otherCount: number
  otherTotal: number
}

// Batas aman murni jaga-jaga terhadap loop tak berkesudahan — bukan angka
// yang diharapkan tercapai (§11.2 fix: cari lintas halaman, bukan cuma 50
// transaksi terbaru lintas semua akun).
const MAX_SEARCH_PAGES = 20

export default function ReceivablesTab({ accounts, categories, revision, onChanged }: Props) {
  const [items, setItems] = useState<FinanceReceivable[]>([])
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [error, setError] = useState<string | null>(null)
  const receivable = accounts.find((a) => a.kind === 'receivable') ?? null

  useEffect(() => {
    let cancelled = false
    getReceivables().then((r) => { if (!cancelled) setItems(r) }).catch(() => { /* shell */ })
    return () => { cancelled = true }
  }, [revision])

  function message(e: unknown): string {
    return e instanceof FinanceApiError ? e.message : 'Gagal memproses. Coba lagi.'
  }

  /** Menghapus catatan pinjaman terakhir orang ini; server yang memutuskan
   *  apakah konfirmasi dibutuhkan (§11.2) — client tidak menebak.
   *  Dicari lewat account_id=Piutang, disaring server (bukan 50 transaksi
   *  terbaru lintas semua akun), dan dijalan-jalani per halaman lewat cursor
   *  kalau catatannya belum juga muncul di halaman pertama. */
  async function removeLatest(counterparty: string) {
    setError(null)
    if (!receivable) return
    let cursor: string | null | undefined
    for (let page = 0; page < MAX_SEARCH_PAGES; page++) {
      const r = await getTransactions({ accountId: receivable.id, cursor: cursor ?? undefined })
      const target = r.transactions.find((t) => t.counterparty === counterparty && t.toAccountId === receivable.id)
      if (target) {
        try {
          await deleteTransaction(target.id)
          onChanged()
        } catch (e) {
          if (e instanceof FinanceApiError && e.status === 409) {
            const d = e.details as { counterparty: string; otherCount: number; otherTotal: number }
            setConfirm({ transactionId: target.id, ...d })
            return
          }
          setError(message(e))
        }
        return
      }
      if (!r.nextCursor) break
      cursor = r.nextCursor
    }
    setError('Transaksi tidak ditemukan.')
  }

  async function forgive(counterparty: string, sisa: number) {
    setError(null)
    const relasi = categories.find((c) => c.name === 'Relasi' && c.type === 'expense')
    if (!relasi || !receivable) return
    // Transaksi aslinya TIDAK dihapus — angkanya memang masuk Keluar bulan
    // ini, dan itu benar secara akuntansi (§11.3).
    const draft = buildTransaction('expense', {
      amount: sisa, accountId: receivable.id, categoryId: relasi.id, counterparty,
    }, {
      today: new Date().toISOString().slice(0, 10),
      lastUsedAccountId: receivable.id,
      receivableAccountId: receivable.id,
      salaryCategoryId: null,
      projectCategoryId: null,
    })
    try {
      await postTransaction(draft, crypto.randomUUID())
      onChanged()
    } catch (e) {
      setError(message(e))
    }
  }

  async function resolveConfirm(cascade: 'one' | 'all') {
    if (!confirm) return
    setError(null)
    try {
      await deleteTransaction(confirm.transactionId, cascade)
      setConfirm(null)
      onChanged()
    } catch (e) {
      setError(message(e))
    }
  }

  return (
    <div className="finance__body">
      {error && <p className="finance-form__error">{error}</p>}
      {items.length === 0 && <p className="finance-empty">Tidak ada piutang berjalan.</p>}
      <ul className="finance-tx-list">
        {items.map((r) => (
          <li key={r.counterparty} className="finance-tx">
            <span className="finance-tx__label">{r.counterparty}</span>
            {/* Sisa negatif tetap ditampilkan merah — sinyal salah input (§11.4) */}
            <span className={`finance-tx__amount ${r.sisa < 0 ? 'finance-amount--negative' : ''}`}>{formatRupiah(r.sisa)}</span>
            <button type="button" onClick={() => void removeLatest(r.counterparty)}>Hapus</button>
            {r.sisa > 0 && <button type="button" onClick={() => void forgive(r.counterparty, r.sisa)}>Ikhlaskan</button>}
          </li>
        ))}
      </ul>

      {confirm && (
        <div className="finance-sheet" role="dialog" aria-modal="true">
          <div className="finance-sheet__panel">
            <h2 className="finance-sheet__title">Hapus catatan {confirm.counterparty}?</h2>
            <p>
              {confirm.counterparty} masih punya {confirm.otherCount} catatan lain senilai{' '}
              {formatRupiah(confirm.otherTotal)}. Hapus juga?
            </p>
            <div className="finance-form__actions">
              <button type="button" onClick={() => setConfirm(null)}>Batal</button>
              <button type="button" onClick={() => void resolveConfirm('one')}>Hapus satu saja</button>
              <button type="button" onClick={() => void resolveConfirm('all')}>Hapus semua</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
