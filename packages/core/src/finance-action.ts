// Pemetaan situasi UI → bentuk data — docs/feature/30.finance/spec.md §7.
// User memilih situasi ("Ngutangin"); file ini yang menerjemahkannya ke
// type + pocket + account. Istilah di kolom kanan tabel §7 tidak pernah
// muncul di layar.
import type { Pocket, TransactionDraft } from './finance-validate.ts'

export type FinanceActionId =
  | 'expense'
  | 'salary'
  | 'save'
  | 'lend'
  | 'repaid'
  | 'project-income'
  | 'drawing'
  | 'business-expense'

export interface ActionInput {
  amount: number
  /** Akun yang dipilih user. Artinya tergantung aksi — sumber atau tujuan. */
  accountId?: string | null
  /** Akun tujuan, hanya untuk 'save' dan 'drawing' yang punya dua sisi. */
  toAccountId?: string | null
  categoryId?: string | null
  counterparty?: string | null
  note?: string | null
  /** Default hari ini; diisi hanya untuk transaksi backdate. */
  date?: string
}

export interface ActionContext {
  today: string
  lastUsedAccountId: string | null
  receivableAccountId: string | null
  salaryCategoryId: string | null
  projectCategoryId: string | null
}

/** Kantong tiap sisi ditentukan aksinya, bukan hasil lookup akun (§7). */
const POCKETS: Record<FinanceActionId, { from: Pocket | null; to: Pocket | null }> = {
  'expense': { from: 'personal', to: null },
  'salary': { from: null, to: 'personal' },
  'save': { from: 'personal', to: 'personal' },
  'lend': { from: 'personal', to: 'personal' },
  'repaid': { from: 'personal', to: 'personal' },
  'project-income': { from: null, to: 'business' },
  'drawing': { from: 'business', to: 'personal' },
  'business-expense': { from: 'business', to: null },
}

export function buildTransaction(
  action: FinanceActionId,
  input: ActionInput,
  ctx: ActionContext,
): TransactionDraft {
  const picked = input.accountId ?? ctx.lastUsedAccountId
  const pockets = POCKETS[action]

  let type: TransactionDraft['type']
  let fromAccountId: string | null
  let toAccountId: string | null
  let categoryId: string | null

  switch (action) {
    case 'expense':
      type = 'expense'; fromAccountId = picked; toAccountId = null; categoryId = input.categoryId ?? null
      break
    case 'business-expense':
      type = 'expense'; fromAccountId = picked; toAccountId = null; categoryId = input.categoryId ?? null
      break
    case 'salary':
      type = 'income'; fromAccountId = null; toAccountId = picked; categoryId = ctx.salaryCategoryId
      break
    case 'project-income':
      type = 'income'; fromAccountId = null; toAccountId = picked; categoryId = ctx.projectCategoryId
      break
    case 'save':
    case 'drawing':
      type = 'transfer'; fromAccountId = picked; toAccountId = input.toAccountId ?? null; categoryId = null
      break
    case 'lend':
      type = 'transfer'; fromAccountId = picked; toAccountId = ctx.receivableAccountId; categoryId = null
      break
    case 'repaid':
      type = 'transfer'; fromAccountId = ctx.receivableAccountId; toAccountId = picked; categoryId = null
      break
  }

  return {
    date: input.date ?? ctx.today,
    type,
    amount: input.amount,
    categoryId,
    fromAccountId,
    fromPocket: fromAccountId === null ? null : pockets.from,
    toAccountId,
    toPocket: toAccountId === null ? null : pockets.to,
    counterparty: input.counterparty ?? null,
    note: input.note ?? null,
  }
}
