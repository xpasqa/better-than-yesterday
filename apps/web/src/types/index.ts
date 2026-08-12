export type ViewType = 'inbox' | 'today' | 'upcoming' | 'anytime' | 'someday' | 'logbook' | 'project' | 'outline' | 'mail' | 'storage' | 'finance' | 'agent' | 'search' | 'tags' | 'settings'

/* 'flagged' is not a folder a message lives in — it's a cross-folder filter over isFlagged */
export type MailFolder = 'inbox' | 'sent' | 'drafts' | 'junk' | 'trash'

export type MailView = MailFolder | 'flagged'

export interface MailMessage {
  id: string
  folder: MailFolder
  sender: string
  senderEmail: string
  subject: string
  body: string
  receivedAt: string
  isRead: boolean
  isFlagged: boolean
  /** Decorative only — filenames shown as disabled chips in the reading pane */
  attachments?: string[]
  /** Sanitized HTML from server, for reading pane iframe */
  bodyHtml?: string
}

export type StorageFileType = 'pdf' | 'image' | 'doc' | 'sheet' | 'zip' | 'other'

export interface StorageFolder {
  id: string
  name: string
  parentId: string | null
}

export interface StorageFile {
  id: string
  name: string
  parentId: string | null
  type: StorageFileType
  sizeBytes: number
  modifiedAt: string
}

/* Finance — docs/feature/30.finance/spec.md. Ini kontraknya: API dibentuk
   mengikuti tipe di bawah, bukan sebaliknya. */
export type FinancePocket = 'personal' | 'business'
export type FinanceAccountKind = 'cash' | 'bank' | 'receivable'
export type FinanceTransactionType = 'income' | 'expense' | 'transfer'

export interface FinanceAccount {
  id: string
  name: string
  kind: FinanceAccountKind
  pocket: FinancePocket
  isSpendable: boolean
  isSystem: boolean
  isArchived: boolean
  sortOrder: number
  /** Derived, tidak pernah disimpan (spec prinsip 2) */
  balance: number
  pockets: { personal: number; business: number }
}

/** Bentuk yang benar-benar dikembalikan POST/PATCH /finance/accounts (Task E)
 *  — lebih sempit dari FinanceAccount: tidak ada isSystem/balance/pockets,
 *  karena field itu hanya muncul dari GET /finance/accounts (query berbeda). */
export interface FinanceAccountWrite {
  id: string
  name: string
  kind: FinanceAccountKind
  pocket: FinancePocket
  isSpendable: boolean
  isArchived: boolean
  sortOrder: number
}

export interface FinanceCategory {
  id: string
  name: string
  type: 'income' | 'expense'
  icon: string | null
  isArchived: boolean
}

export interface FinanceTransaction {
  id: string
  date: string
  type: FinanceTransactionType
  amount: number
  categoryId: string | null
  fromAccountId: string | null
  fromPocket: FinancePocket | null
  toAccountId: string | null
  toPocket: FinancePocket | null
  counterparty: string | null
  note: string | null
}

export interface FinanceSummary {
  month: string
  masuk: number
  keluar: number
  tersimpan: number
}

export interface FinanceTarget {
  mode: 'amount' | 'percent'
  value: number
  targetAmount: number
  saved: number
}

export interface FinanceOverview {
  spendablePersonal: number
  summary: FinanceSummary
  target: FinanceTarget | null
  chips: { piutangTotal?: number; businessTotal?: number }
  businessEnabled: boolean
}

export interface FinanceReceivable {
  counterparty: string
  sisa: number
}
