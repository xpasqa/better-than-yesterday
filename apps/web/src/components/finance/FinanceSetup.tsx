// Setup awal — spec §10.4. Tiga pertanyaan, sisanya default; target < 1 menit.
import { useState } from 'react'
import type { FinancePocket } from '../../types'
import { patchSettings, postAccount, FinanceApiError } from '../../store/finance-api'

interface DraftAccount {
  name: string
  kind: 'cash' | 'bank'
  pocket: FinancePocket
  isSavings: boolean
}

export default function FinanceSetup({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(1)
  const [drafts, setDrafts] = useState<DraftAccount[]>([])
  const [name, setName] = useState('')
  const [isSavings, setIsSavings] = useState(false)
  const [pocket, setPocket] = useState<FinancePocket>('personal')
  const [businessEnabled, setBusinessEnabled] = useState(false)
  const [targetMode, setTargetMode] = useState<'amount' | 'percent' | ''>('')
  const [targetValue, setTargetValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addDraft() {
    if (name.trim() === '') return
    setDrafts((prev) => [...prev, { name: name.trim(), kind: 'bank', pocket, isSavings }])
    setName('')
    setIsSavings(false)
    setPocket('personal')
  }

  async function finish() {
    setSaving(true)
    setError(null)
    try {
      for (const d of drafts) {
        await postAccount({ name: d.name, kind: d.kind, pocket: d.pocket, isSpendable: !d.isSavings })
      }
      await patchSettings({
        financeBusinessEnabled: businessEnabled,
        financeSavingsTargetMode: targetMode === '' ? null : targetMode,
        financeSavingsTargetValue: targetMode === '' ? null : Number(targetValue.replace(/\D/g, '')) || null,
      })
      // Ditandai per perangkat: kalau user memang hanya punya Dompet, tanpa
      // penanda ini wizard-nya muncul terus. Perangkat lain akan melihat akun
      // yang sudah dibuat, jadi kondisinya toh sudah tidak terpenuhi.
      localStorage.setItem('finance.setupDone', '1')
      onDone()
    } catch (e) {
      // Tanpa ini, kegagalan write mana pun (jaringan, 4xx/5xx) membuat
      // saving tersangkut true selamanya — Selesai disabled, tanpa pesan
      // apa pun (pola yang sama yang dibereskan Task I di AccountsTab/
      // ReceivablesTab; wizard ini luput karena ditulis sebelum itu).
      setError(e instanceof FinanceApiError ? e.message : 'Gagal menyimpan. Coba lagi.')
      setSaving(false)
    }
  }

  return (
    <div className="finance__body finance-setup">
      {step === 1 && (
        <section>
          <h2 className="finance-section__title">Punya rekening apa?</h2>
          <p className="finance-empty">Dompet tunai sudah dibuatkan. Tambahkan rekening lain kalau ada.</p>
          <ul className="finance-tx-list">
            {drafts.map((d) => <li key={d.name} className="finance-tx">{d.name}{d.isSavings ? ' · tabungan' : ''}</li>)}
          </ul>
          <label className="finance-field"><span>Nama rekening</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="finance-check">
            <input type="checkbox" checked={isSavings} onChange={(e) => setIsSavings(e.target.checked)} />
            Ini tabungan — jangan hitung sebagai uang yang bisa dipakai
          </label>
          <label className="finance-field">
            <span>Kantong bawaan</span>
            <select value={pocket} onChange={(e) => setPocket(e.target.value as FinancePocket)}>
              <option value="personal">Personal</option>
              <option value="business">Bisnis</option>
            </select>
          </label>
          <div className="finance-form__actions">
            <button type="button" onClick={addDraft}>Tambah</button>
            <button type="button" onClick={() => setStep(2)}>Lanjut</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section>
          <h2 className="finance-section__title">Punya usaha atau project sampingan?</h2>
          <p className="finance-empty">Kalau ya, uang bisnis dipisah dari uang pribadi dan omzet tidak mengotori ringkasan personal.</p>
          <div className="finance-form__actions">
            <button type="button" onClick={() => { setBusinessEnabled(false); setStep(3) }}>Tidak</button>
            <button type="button" onClick={() => { setBusinessEnabled(true); setStep(3) }}>Ya</button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section>
          <h2 className="finance-section__title">Target nabung per bulan?</h2>
          <label className="finance-field">
            <span>Mode</span>
            <select value={targetMode} onChange={(e) => setTargetMode(e.target.value as typeof targetMode)}>
              <option value="">Lewati</option>
              <option value="percent">Persen dari pemasukan</option>
              <option value="amount">Jumlah tetap</option>
            </select>
          </label>
          {targetMode !== '' && (
            <label className="finance-field">
              <span>{targetMode === 'percent' ? 'Persen' : 'Rupiah'}</span>
              <input inputMode="numeric" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
            </label>
          )}
          {error && <p className="finance-form__error">{error}</p>}
          <div className="finance-form__actions">
            <button type="button" disabled={saving} onClick={() => void finish()}>Selesai</button>
          </div>
        </section>
      )}
    </div>
  )
}
