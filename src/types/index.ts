export type Priority = 1 | 2 | 3 | 4

export type ViewType = 'inbox' | 'today' | 'upcoming' | 'filters' | 'project' | 'outline' | 'storage'

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
  taskCount?: number
}

export interface Task {
  id: string
  content: string
  description?: string
  projectId: string
  priority: Priority
  dueDate?: string
  labels: string[]
  isCompleted: boolean
  subTasks?: Task[]
  createdAt: string
  order: number
}

export interface Section {
  id: string
  name: string
  projectId: string
  tasks: Task[]
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
  size: string
  modifiedAt: string
}
