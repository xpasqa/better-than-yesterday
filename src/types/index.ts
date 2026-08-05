export type Priority = 1 | 2 | 3 | 4

export type ViewType = 'inbox' | 'today' | 'upcoming' | 'filters' | 'project' | 'outline' | 'mail' | 'storage' | 'agent'

export interface OutlineNode {
  id: string
  content: string
  children: OutlineNode[]
  isCollapsed: boolean
  isCompleted: boolean
  note?: string
}

export interface Label {
  id: string
  name: string
  color: string
}

export interface Project {
  id: string
  name: string
  color: string
  isFavorite?: boolean
}

export interface SubTask {
  id: string
  content: string
  isCompleted: boolean
}

export interface Task {
  id: string
  content: string
  description?: string
  projectId: string
  sectionId?: string
  priority: Priority
  dueDate?: string
  labelIds: string[]
  isCompleted: boolean
  subTasks?: SubTask[]
  createdAt: string
}

export interface Section {
  id: string
  name: string
  projectId: string
}

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
