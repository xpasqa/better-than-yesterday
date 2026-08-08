export type ViewType = 'inbox' | 'today' | 'upcoming' | 'anytime' | 'someday' | 'logbook' | 'project' | 'outline' | 'mail' | 'storage' | 'agent' | 'search'

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
