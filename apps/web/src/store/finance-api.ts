// Pembungkus fetch /api/finance/*. Finance server-backed (spec §4.1) — tidak
// lewat Dexie dan tidak lewat outbox, tidak seperti task dan tag.
import type {
  FinanceAccount, FinanceAccountWrite, FinanceCategory, FinanceOverview, FinanceReceivable,
  FinanceSummary, FinanceTransaction, FinancePocket,
} from '../types'
import type { TransactionDraft } from '@better/core/finance-validate'

/** Membawa `code` dan `details` apa adanya supaya pemanggil bisa membedakan
 *  409 CONFIRM_REQUIRED (§11.2) dari 422 daftar pelanggaran (§6). */
export class FinanceApiError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'FinanceApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  })
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) {
    const err = body?.error ?? {}
    throw new FinanceApiError(res.status, err.code ?? 'INTERNAL', err.message ?? `${path} failed`, err.details)
  }
  return body as T
}

export const getOverview = () => request<FinanceOverview>('/finance/overview')
export const getAccounts = () => request<{ accounts: FinanceAccount[] }>('/finance/accounts').then((b) => b.accounts)
export const getCategories = () => request<{ categories: FinanceCategory[] }>('/finance/categories').then((b) => b.categories)
export const getReceivables = () => request<{ receivables: FinanceReceivable[] }>('/finance/receivables').then((b) => b.receivables)
export const getNetWorth = () => request<{ total: number }>('/finance/networth').then((b) => b.total)

export function getSummary(month: string, pocket: FinancePocket = 'personal', accountId?: string) {
  const q = new URLSearchParams({ month, pocket })
  if (accountId) q.set('account_id', accountId)
  return request<FinanceSummary>(`/finance/summary?${q}`)
}

export function getTransactions(params: { month?: string; pocket?: FinancePocket; accountId?: string; cursor?: string } = {}) {
  const q = new URLSearchParams()
  if (params.month) q.set('month', params.month)
  if (params.pocket) q.set('pocket', params.pocket)
  if (params.accountId) q.set('account_id', params.accountId)
  if (params.cursor) q.set('cursor', params.cursor)
  return request<{ transactions: FinanceTransaction[]; nextCursor: string | null }>(`/finance/transactions?${q}`)
}

export function postTransaction(draft: TransactionDraft, idempotencyKey: string) {
  return request<{ transaction: FinanceTransaction }>('/finance/transactions', {
    method: 'POST',
    headers: { 'idempotency-key': idempotencyKey },
    body: JSON.stringify(draft),
  }).then((b) => b.transaction)
}

export function patchTransaction(id: string, patch: Partial<TransactionDraft>) {
  return request<{ transaction: FinanceTransaction }>(`/finance/transactions/${id}`, {
    method: 'PATCH', body: JSON.stringify(patch),
  }).then((b) => b.transaction)
}

export function deleteTransaction(id: string, cascade?: 'one' | 'all') {
  const q = cascade ? `?cascade=${cascade}` : ''
  return request<{ deleted: number }>(`/finance/transactions/${id}${q}`, { method: 'DELETE' })
}

// POST/PATCH /finance/accounts return a narrower shape than GET (no
// isSystem/balance/pockets — those come from GET's richer query, see
// FinanceAccountWrite in types/index.ts).
export function postAccount(input: { name: string; kind: 'cash' | 'bank'; pocket: FinancePocket; isSpendable: boolean }) {
  return request<{ account: FinanceAccountWrite }>('/finance/accounts', { method: 'POST', body: JSON.stringify(input) })
    .then((b) => b.account)
}

export function patchAccount(id: string, patch: Partial<{ name: string; pocket: FinancePocket; isSpendable: boolean; sortOrder: number }>) {
  return request<{ account: FinanceAccountWrite }>(`/finance/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    .then((b) => b.account)
}

export const archiveAccount = (id: string) => request<{ ok: true }>(`/finance/accounts/${id}`, { method: 'DELETE' })

export function patchSettings(patch: {
  financeBusinessEnabled?: boolean
  financeSavingsTargetMode?: 'amount' | 'percent' | null
  financeSavingsTargetValue?: number | null
}) {
  return request<{ user: unknown }>('/me', { method: 'PATCH', body: JSON.stringify(patch) })
}
