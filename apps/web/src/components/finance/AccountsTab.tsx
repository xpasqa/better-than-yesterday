// Tab Akun — saldo tiap akun (§9.1), pecahannya per kantong (§9.3), dan
// kekayaan bersih (§9.7) yang sengaja tidak diletakkan di beranda.
import { useEffect, useState, type ReactNode } from 'react'
import { ArchiveIcon, ArrowCounterClockwiseIcon, CaretDownIcon, CaretUpIcon, PlusIcon } from '@phosphor-icons/react'
import type { FinanceAccount, FinancePocket } from '../../types'
import { archiveAccount, getNetWorth, patchAccount, patchSettings, postAccount, FinanceApiError } from '../../store/finance-api'
import { formatRupiah } from './format'

interface Props {
  accounts: FinanceAccount[]
  businessEnabled: boolean
  onChanged: () => void
}

export default function AccountsTab({ accounts, businessEnabled, onChanged }: Props) {
  const [netWorth, setNetWorth] = useState<number | null>(null)
  const [showNetWorth, setShowNetWorth] = useState(false)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'cash' | 'bank'>('bank')
  const [pocket, setPocket] = useState<FinancePocket>('personal')
  const [isSavings, setIsSavings] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Satu penanda untuk semua tulisan di tab ini: tombolnya mati selama satu
  // request jalan, jadi dobel-tap tidak jadi dua akun / dua arsip.
  const [busy, setBusy] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => {
    if (!showNetWorth) return
    getNetWorth().then(setNetWorth).catch(() => setNetWorth(null))
  }, [showNetWorth, accounts])

  function message(e: unknown): string {
    return e instanceof FinanceApiError ? e.message : 'Gagal memproses. Coba lagi.'
  }

  async function add() {
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      // Satu akun = satu tempat yang benar-benar terpisah secara fisik (§4.3).
      // Kantong bisnis hanya bisa dipilih kalau mode bisnis menyala — kalau
      // tidak, semuanya personal (prinsip 4).
      await postAccount({
        name: name.trim(),
        kind,
        pocket: businessEnabled ? pocket : 'personal',
        isSpendable: !isSavings,
      })
      setAdding(false)
      setName('')
      onChanged()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }

  async function archive(id: string) {
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      await archiveAccount(id)
      onChanged()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }

  /** Kebalikan Arsipkan — tanpa ini akun yang terlanjur diarsipkan hilang
   *  selamanya beserta saldonya, padahal saldonya masih ikut kekayaan bersih. */
  async function reactivate(id: string) {
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      await patchAccount(id, { isArchived: false })
      onChanged()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }

  async function toggleBusiness(enabled: boolean) {
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      await patchSettings({ financeBusinessEnabled: enabled })
      onChanged()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }

  const row = (a: FinanceAccount, action: ReactNode) => (
    <li key={a.id} className="finance-account">
      <div>
        <strong>{a.name}</strong>
        {!a.isSpendable && <small> · tidak dihitung sebagai uang yang bisa dipakai</small>}
        {a.pockets.business !== 0 && a.pockets.personal !== 0 && (
          <small> · personal {formatRupiah(a.pockets.personal)}, bisnis {formatRupiah(a.pockets.business)}</small>
        )}
      </div>
      <span className={`finance-account__balance ${a.balance < 0 ? 'finance-amount--negative' : ''}`}>
        {formatRupiah(a.balance)}
      </span>
      {action}
    </li>
  )

  const archived = accounts.filter((a) => a.isArchived)

  return (
    <div className="finance__body">
      {error && <p className="finance-form__error">{error}</p>}
      <ul className="finance-account-list">
        {accounts.filter((a) => !a.isArchived).map((a) => row(
          a,
          // Akun yang punya transaksi tidak dihapus, hanya diarsipkan (§11.6)
          a.isSystem ? null : (
            <button type="button" className="finance-btn finance-btn--ghost finance-btn--small" disabled={busy} onClick={() => void archive(a.id)}>
              <ArchiveIcon size={14} /> Arsipkan
            </button>
          ),
        ))}
      </ul>

      {adding ? (
        <form className="finance-form" onSubmit={(e) => { e.preventDefault(); void add() }}>
          <label className="finance-field"><span>Nama</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="finance-field">
            <span>Jenis</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as 'cash' | 'bank')}>
              <option value="bank">Rekening bank</option>
              <option value="cash">Tunai</option>
            </select>
          </label>
          {/* Kantong hanya ada artinya kalau user memang punya usaha —
              pilihan yang tidak bisa dipakai tidak ditampilkan (prinsip 4). */}
          {businessEnabled && (
            <label className="finance-field">
              <span>Kantong bawaan</span>
              <select value={pocket} onChange={(e) => setPocket(e.target.value as FinancePocket)}>
                <option value="personal">Personal</option>
                <option value="business">Bisnis</option>
              </select>
            </label>
          )}
          <label className="finance-check">
            <input type="checkbox" checked={isSavings} onChange={(e) => setIsSavings(e.target.checked)} />
            Ini tabungan — jangan hitung sebagai uang yang bisa dipakai
          </label>
          <div className="finance-form__actions">
            <button type="button" className="finance-btn finance-btn--secondary" onClick={() => setAdding(false)}>Batal</button>
            <button type="submit" className="finance-btn finance-btn--primary" disabled={busy || name.trim() === ''}>Simpan</button>
          </div>
        </form>
      ) : (
        <button type="button" className="finance-btn finance-btn--primary" onClick={() => setAdding(true)}>
          <PlusIcon size={14} weight="bold" /> Tambah akun
        </button>
      )}

      {archived.length > 0 && (
        <section className="finance-archived">
          <button type="button" className="finance-btn finance-btn--ghost" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? <CaretUpIcon size={14} /> : <CaretDownIcon size={14} />}
            {showArchived ? 'Sembunyikan' : 'Lihat'} akun yang diarsipkan ({archived.length})
          </button>
          {showArchived && (
            <ul className="finance-account-list">
              {archived.map((a) => row(
                a,
                <button type="button" className="finance-btn finance-btn--ghost finance-btn--small" disabled={busy} onClick={() => void reactivate(a.id)}>
                  <ArrowCounterClockwiseIcon size={14} /> Aktifkan lagi
                </button>,
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="finance-networth">
        <button type="button" className="finance-btn finance-btn--ghost" onClick={() => setShowNetWorth((v) => !v)}>
          {showNetWorth ? <CaretUpIcon size={14} /> : <CaretDownIcon size={14} />}
          {showNetWorth ? 'Sembunyikan' : 'Lihat'} kekayaan bersih
        </button>
        {showNetWorth && netWorth !== null && (
          <p className="finance-networth__value">{formatRupiah(netWorth)}<small> termasuk tabungan dan piutang</small></p>
        )}
      </section>

      <section className="finance-settings">
        <label className="finance-check">
          <input
            type="checkbox"
            checked={businessEnabled}
            disabled={busy}
            onChange={(e) => void toggleBusiness(e.target.checked)}
          />
          Saya punya usaha atau project sampingan
        </label>
        <p className="finance-empty">
          Mematikannya menyembunyikan aksi bisnis. Datanya tidak hilang — tidak ada migrasi apa pun kalau nanti dinyalakan lagi.
        </p>
      </section>
    </div>
  )
}
