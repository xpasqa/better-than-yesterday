// Tab Akun — saldo tiap akun (§9.1), pecahannya per kantong (§9.3), dan
// kekayaan bersih (§9.7) yang sengaja tidak diletakkan di beranda.
import { useEffect, useState } from 'react'
import type { FinanceAccount, FinancePocket } from '../../types'
import { archiveAccount, getNetWorth, postAccount } from '../../store/finance-api'
import { formatRupiah } from './format'

interface Props {
  accounts: FinanceAccount[]
  onChanged: () => void
}

export default function AccountsTab({ accounts, onChanged }: Props) {
  const [netWorth, setNetWorth] = useState<number | null>(null)
  const [showNetWorth, setShowNetWorth] = useState(false)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'cash' | 'bank'>('bank')
  const [pocket, setPocket] = useState<FinancePocket>('personal')
  const [isSavings, setIsSavings] = useState(false)

  useEffect(() => {
    if (!showNetWorth) return
    getNetWorth().then(setNetWorth).catch(() => setNetWorth(null))
  }, [showNetWorth, accounts])

  async function add() {
    // Satu akun = satu tempat yang benar-benar terpisah secara fisik (§4.3).
    await postAccount({ name: name.trim(), kind, pocket, isSpendable: !isSavings })
    setAdding(false)
    setName('')
    onChanged()
  }

  return (
    <div className="finance__body">
      <ul className="finance-account-list">
        {accounts.filter((a) => !a.isArchived).map((a) => (
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
            {/* Akun yang punya transaksi tidak dihapus, hanya diarsipkan (§11.6) */}
            {!a.isSystem && (
              <button type="button" onClick={() => void archiveAccount(a.id).then(onChanged)}>Arsipkan</button>
            )}
          </li>
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
          <label className="finance-field">
            <span>Kantong bawaan</span>
            <select value={pocket} onChange={(e) => setPocket(e.target.value as FinancePocket)}>
              <option value="personal">Personal</option>
              <option value="business">Bisnis</option>
            </select>
          </label>
          <label className="finance-check">
            <input type="checkbox" checked={isSavings} onChange={(e) => setIsSavings(e.target.checked)} />
            Ini tabungan — jangan hitung sebagai uang yang bisa dipakai
          </label>
          <div className="finance-form__actions">
            <button type="button" onClick={() => setAdding(false)}>Batal</button>
            <button type="submit" disabled={name.trim() === ''}>Simpan</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)}>Tambah akun</button>
      )}

      <section className="finance-networth">
        <button type="button" onClick={() => setShowNetWorth((v) => !v)}>
          {showNetWorth ? 'Sembunyikan' : 'Lihat'} kekayaan bersih
        </button>
        {showNetWorth && netWorth !== null && (
          <p className="finance-networth__value">{formatRupiah(netWorth)}<small> termasuk tabungan dan piutang</small></p>
        )}
      </section>
    </div>
  )
}
