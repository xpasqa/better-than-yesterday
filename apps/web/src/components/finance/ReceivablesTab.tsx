// Tab Piutang — daftar sisa (§9.6), hapus dengan konfirmasi (§11.2), dan
// "Ikhlaskan" yang cuma pintasan membuat expense dari akun Piutang (§11.3).
import { useEffect, useRef, useState } from 'react'
import { buildTransaction } from '@better/core/finance-action'
import { todayInTimezone } from '@better/core/date'
import type { FinanceAccount, FinanceCategory, FinanceReceivable, FinanceTransaction } from '../../types'
import { getReceivables, getTransactions, deleteTransaction, postTransaction, FinanceApiError } from '../../store/finance-api'
import { formatRupiah } from './format'

interface Props {
  accounts: FinanceAccount[]
  categories: FinanceCategory[]
  timezone: string
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

export default function ReceivablesTab({ accounts, categories, timezone, revision, onChanged }: Props) {
  const [items, setItems] = useState<FinanceReceivable[]>([])
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Satu penanda untuk semua tulisan di tab ini: selama satu request jalan,
  // tidak ada tombol tulis lain yang bisa ditekan (dobel-tap = dobel catatan).
  const [busy, setBusy] = useState(false)
  const receivable = accounts.find((a) => a.kind === 'receivable') ?? null
  // Key idempotency per percobaan "Ikhlaskan", bukan per pemanggilan: klik
  // ulang setelah koneksi putus memakai key yang sama, jadi server dedupe
  // alih-alih membuat transaksi ikhlas kedua (§8).
  const forgiveKeys = useRef(new Map<string, string>())

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
    if (busy || !receivable) return
    setError(null)
    setBusy(true)
    // Pencariannya ikut di dalam try: gagal jaringan saat mencari harus muncul
    // sebagai pesan yang sama dengan gagal saat menghapus, bukan unhandled
    // rejection yang diam-diam.
    try {
      let target: FinanceTransaction | null = null
      // Baris cicilan (from_account_id = Piutang) dipakai kalau baris
      // pinjamannya sudah tidak ada — misalnya setelah "Hapus satu saja"
      // menyisakan cicilan yatim dengan sisa negatif (§11.2/§11.4). Tanpa ini
      // catatan itu tidak bisa dihapus dari mana pun.
      let fallback: FinanceTransaction | null = null
      let cursor: string | null | undefined
      for (let page = 0; page < MAX_SEARCH_PAGES; page++) {
        const r = await getTransactions({ accountId: receivable.id, cursor: cursor ?? undefined })
        const mine = r.transactions.filter((t) => t.counterparty === counterparty)
        target = mine.find((t) => t.toAccountId === receivable.id) ?? null
        if (target) break
        fallback ??= mine.find((t) => t.fromAccountId === receivable.id) ?? null
        if (!r.nextCursor) break
        cursor = r.nextCursor
      }
      const victim = target ?? fallback
      if (!victim) {
        setError('Transaksi tidak ditemukan.')
        return
      }
      try {
        await deleteTransaction(victim.id)
        onChanged()
      } catch (e) {
        if (e instanceof FinanceApiError && e.status === 409) {
          const d = e.details as { counterparty: string; otherCount: number; otherTotal: number }
          setConfirm({ transactionId: victim.id, ...d })
          return
        }
        throw e
      }
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }

  async function forgive(counterparty: string, sisa: number) {
    if (busy) return
    setError(null)
    const relasi = categories.find((c) => c.name === 'Relasi' && c.type === 'expense')
    if (!relasi || !receivable) return
    setBusy(true)
    // Transaksi aslinya TIDAK dihapus — angkanya memang masuk Keluar bulan
    // ini, dan itu benar secara akuntansi (§11.3).
    const draft = buildTransaction('expense', {
      amount: sisa, accountId: receivable.id, categoryId: relasi.id, counterparty,
    }, {
      today: todayInTimezone(timezone),
      lastUsedAccountId: receivable.id,
      receivableAccountId: receivable.id,
      salaryCategoryId: null,
      projectCategoryId: null,
    })
    // Key dipegang per (nama, sisa): percobaan yang sama memakai key yang sama
    // sampai berhasil, percobaan dengan angka berbeda dapat key baru.
    const slot = `${counterparty}:${sisa}`
    const key = forgiveKeys.current.get(slot) ?? crypto.randomUUID()
    forgiveKeys.current.set(slot, key)
    try {
      await postTransaction(draft, key)
      forgiveKeys.current.delete(slot)
      onChanged()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }

  async function resolveConfirm(cascade: 'one' | 'all') {
    if (!confirm || busy) return
    setError(null)
    setBusy(true)
    try {
      await deleteTransaction(confirm.transactionId, cascade)
      setConfirm(null)
      onChanged()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
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
            <button type="button" disabled={busy} onClick={() => void removeLatest(r.counterparty)}>Hapus</button>
            {r.sisa > 0 && (
              <button type="button" disabled={busy} onClick={() => void forgive(r.counterparty, r.sisa)}>Ikhlaskan</button>
            )}
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
              <button type="button" disabled={busy} onClick={() => setConfirm(null)}>Batal</button>
              <button type="button" disabled={busy} onClick={() => void resolveConfirm('one')}>Hapus satu saja</button>
              <button type="button" disabled={busy} onClick={() => void resolveConfirm('all')}>Hapus semua</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
