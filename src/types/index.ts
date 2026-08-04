export type Priority = 1 | 2 | 3 | 4

export type ViewType = 'inbox' | 'today' | 'upcoming' | 'filters' | 'project'

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
