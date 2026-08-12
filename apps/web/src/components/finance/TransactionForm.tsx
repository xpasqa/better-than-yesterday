// Form per situasi. Bentuk datanya tidak disusun di sini — buildTransaction
// di @better/core yang melakukannya (§4.2), jadi client dan server memakai
// tabel §7 yang sama persis.
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { buildTransaction } from '@better/core/finance-action'
import { validateTransaction } from '@better/core/finance-validate'
import { todayInTimezone } from '@better/core/date'
import type { FinanceAccount, FinanceCategory } from '../../types'
import { getReceivables, postTransaction, FinanceApiError } from '../../store/finance-api'
import { savingsAccounts, type ActionSpec } from './action-catalog'

interface Props {
  action: ActionSpec
  accounts: FinanceAccount[]
  categories: FinanceCategory[]
  timezone: string
  onBack: () => void
  onSaved: () => void
}

/** Preferensi tampilan, bukan data keuangan — cukup di localStorage (§7, §10.2). */
export const LAST_ACCOUNT_KEY = 'finance.lastAccountId'

const MESSAGES: Record<string, string> = {
  AMOUNT_NOT_POSITIVE: 'Jumlah harus lebih dari nol.',
  DATE_TOO_FAR_FUTURE: 'Tanggal tidak boleh di masa depan.',
  CATEGORY_REQUIRED: 'Pilih kategori dulu.',
  COUNTERPARTY_REQUIRED: 'Isi namanya dulu.',
  SELF_TRANSFER: 'Akun asal dan tujuan tidak boleh sama.',
  FROM_REQUIRED: 'Pilih akun asal.',
  TO_REQUIRED: 'Pilih akun tujuan.',
  ARCHIVED: 'Akun atau kategori itu sudah diarsipkan.',
}

export default function TransactionForm({ action, accounts, categories, timezone, onBack, onSaved }: Props) {
  const usable = accounts.filter((a) => !a.isArchived && !a.isSystem)
  const receivable = accounts.find((a) => a.kind === 'receivable') ?? null
  // Hari ini menurut zona waktu user, bukan UTC: transaksi jam 1 pagi WIB
  // tercatat di tanggal yang benar (§11.7).
  const today = todayInTimezone(timezone)
  // Default akun = yang terakhir dipakai (§7, §10.2), bukan yang pertama
  // menurut urutan nama. Kalau akunnya sudah tidak ada (diarsipkan/dihapus di
  // perangkat lain), jatuh kembali ke akun pertama.
  const storedLastAccountId = localStorage.getItem(LAST_ACCOUNT_KEY)
  const defaultAccountId =
    (storedLastAccountId && usable.some((a) => a.id === storedLastAccountId)
      ? storedLastAccountId
      : usable[0]?.id) ?? ''
  // Satu key per instance form, bukan per percobaan simpan: harus sama
  // persis di retry supaya server bisa dedupe (§8). Form ini di-mount ulang
  // tiap kali sheet dibuka (FinanceHome merender <ActionPicker> secara
  // kondisional), jadi percobaan yang benar-benar baru otomatis dapat key
  // baru — tidak perlu logika reset manual.
  const idempotencyKey = useRef(crypto.randomUUID()).current

  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState(defaultAccountId)
  const [toAccountId, setToAccountId] = useState(savingsAccounts(accounts)[0]?.id ?? usable[0]?.id ?? '')
  const [counterparty, setCounterparty] = useState('')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const has = (f: string) => action.fields.includes(f as never)
  const expenseCategories = categories.filter((c) => c.type === 'expense' && !c.isArchived)

  // Nama orang dicocokkan persis (§9.6, §11.2), jadi "Budi" dan "budi" jadi
  // dua piutang terpisah tanpa tanda apa pun. Datalist bawaan browser: cukup
  // untuk menyodorkan ejaan yang sudah ada, tanpa komponen combobox baru.
  const suggestsCounterparty = action.fields.includes('counterparty') && action.id !== 'project-income'
  const [knownCounterparties, setKnownCounterparties] = useState<string[]>([])
  const counterpartyListId = useId()

  useEffect(() => {
    if (!suggestsCounterparty) return
    let cancelled = false
    getReceivables()
      .then((r) => { if (!cancelled) setKnownCounterparties(r.map((x) => x.counterparty)) })
      .catch(() => { /* saran opsional — form tetap jalan tanpa ini */ })
    return () => { cancelled = true }
  }, [suggestsCounterparty])

  const draft = useMemo(() => buildTransaction(action.id, {
    amount: Number(amount.replace(/\D/g, '')) || 0,
    accountId: accountId || null,
    toAccountId: toAccountId || null,
    categoryId: categoryId || null,
    counterparty: counterparty.trim() || null,
    note: note.trim() || null,
    date,
  }, {
    today,
    lastUsedAccountId: defaultAccountId || null,
    receivableAccountId: receivable?.id ?? null,
    salaryCategoryId: categories.find((c) => c.name === 'Gaji')?.id ?? null,
    projectCategoryId: categories.find((c) => c.name === 'Project')?.id ?? null,
  }), [action.id, amount, accountId, toAccountId, categoryId, counterparty, note, date, categories, receivable, defaultAccountId, today])

  const violations = validateTransaction(draft, {
    today,
    receivableAccountId: receivable?.id ?? null,
    categoryType: categories.find((c) => c.id === draft.categoryId)?.type ?? null,
    archivedIds: [...accounts.filter((a) => a.isArchived), ...categories.filter((c) => c.isArchived)].map((x) => x.id),
  })

  async function save() {
    setSaving(true)
    setServerError(null)
    try {
      // Key stabil (lihat idempotencyKey di atas): kirim ulang karena
      // koneksi jelek mengembalikan baris yang sama, bukan duplikat (§8).
      await postTransaction(draft, idempotencyKey)
      // Baru dicatat setelah server menerimanya: default akun berikutnya
      // mengikuti transaksi yang benar-benar jadi, bukan yang gagal.
      if (accountId) localStorage.setItem(LAST_ACCOUNT_KEY, accountId)
      onSaved()
    } catch (e) {
      setServerError(e instanceof FinanceApiError ? e.message : 'Gagal menyimpan. Coba lagi.')
      setSaving(false)
    }
  }

  return (
    <form className="finance-form" onSubmit={(e) => { e.preventDefault(); if (violations.length === 0) void save() }}>
      <h2 className="finance-sheet__title">{action.emoji} {action.label}</h2>

      <label className="finance-field">
        <span>Jumlah</span>
        <input inputMode="numeric" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
      </label>

      {has('category') && (
        <label className="finance-field">
          <span>Kategori</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Pilih kategori</option>
            {expenseCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      )}

      {has('counterparty') && (
        <label className="finance-field">
          <span>{action.id === 'project-income' ? 'Nama project' : 'Nama'}</span>
          <input
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            list={suggestsCounterparty ? counterpartyListId : undefined}
          />
          {suggestsCounterparty && knownCounterparties.length > 0 && (
            <datalist id={counterpartyListId}>
              {knownCounterparties.map((c) => <option key={c} value={c} />)}
            </datalist>
          )}
        </label>
      )}

      {has('account') && (
        <label className="finance-field">
          <span>{action.accountLabel}</span>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {usable.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
      )}

      {has('toAccount') && (
        <label className="finance-field">
          <span>Ke</span>
          <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
            {(action.id === 'save' ? savingsAccounts(accounts) : usable).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
      )}

      <label className="finance-field">
        <span>Tanggal</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      <label className="finance-field">
        <span>Catatan</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      {/* Pelanggaran ditampilkan sebelum request, dari validator yang sama
          persis dengan yang dipakai server (§4.2). */}
      {amount !== '' && violations.length > 0 && (
        <p className="finance-form__error">{MESSAGES[violations[0]!.code] ?? 'Ada isian yang belum benar.'}</p>
      )}
      {serverError && <p className="finance-form__error">{serverError}</p>}

      <div className="finance-form__actions">
        <button type="button" className="finance-btn finance-btn--secondary" onClick={onBack}>Kembali</button>
        <button type="submit" className="finance-btn finance-btn--primary" disabled={saving || violations.length > 0}>
          Simpan
        </button>
      </div>
    </form>
  )
}
