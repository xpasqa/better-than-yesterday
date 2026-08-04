import { useState } from 'react'
import type { ViewType, Task } from '../types'
import { projects } from '../data/mockData'
import TaskList from './TaskList'
import AddTaskForm from './AddTaskForm'
import './MainContent.css'

interface MainContentProps {
  activeView: ViewType
  activeProjectId: string | null
  tasks: Task[]
  onToggleComplete: (id: string) => void
  onAddTask: (task: Omit<Task, 'id' | 'createdAt' | 'order'>) => void
  onDeleteTask: (id: string) => void
}

function getViewTitle(view: ViewType, projectId: string | null): string {
  if (view === 'project' && projectId) {
    return projects.find(p => p.id === projectId)?.name ?? 'Project'
  }
  switch (view) {
    case 'inbox': return 'Inbox'
    case 'today': return 'Today'
    case 'upcoming': return 'Upcoming'
    case 'filters': return 'Filters & Labels'
    default: return 'Today'
  }
}

/* Todoist renders this as "4 Aug ‧ Today ‧ Tuesday" — U+2027 separators, not "·" */
function getTodayLabel(): string {
  const now = new Date()
  const day = now.getDate()
  const month = now.toLocaleDateString('en-US', { month: 'short' })
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' })
  return `${day} ${month} ‧ Today ‧ ${weekday}`
}

const CheckCircleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function filterTasks(tasks: Task[], view: ViewType, projectId: string | null): Task[] {
  const today = new Date().toISOString().split('T')[0]
  switch (view) {
    case 'inbox':
      return tasks.filter(t => t.projectId === 'inbox')
    case 'today':
      return tasks.filter(t => t.dueDate && t.dueDate <= today)
    case 'upcoming':
      return tasks.filter(t => !t.dueDate || t.dueDate > today)
    case 'project':
      return tasks.filter(t => t.projectId === projectId)
    default:
      return tasks
  }
}

export default function MainContent({
  activeView, activeProjectId, tasks,
  onToggleComplete, onAddTask, onDeleteTask
}: MainContentProps) {
  const [showAddTask, setShowAddTask] = useState(false)

  const title = getViewTitle(activeView, activeProjectId)
  const today = new Date().toISOString().split('T')[0]
  const filteredTasks = filterTasks(tasks, activeView, activeProjectId)

  const overdueTasks = activeView === 'today'
    ? filteredTasks.filter(t => t.dueDate && t.dueDate < today && !t.isCompleted)
    : []
  const todayTasks = activeView === 'today'
    ? filteredTasks.filter(t => t.dueDate === today && !t.isCompleted)
    : filteredTasks.filter(t => !t.isCompleted)
  const completedTasks = filteredTasks.filter(t => t.isCompleted)
  const openTaskCount = overdueTasks.length + todayTasks.length

  const defaultProjectId = activeView === 'project' && activeProjectId
    ? activeProjectId
    : activeView === 'inbox' ? 'inbox' : 'personal'

  return (
    <main className="main-content">
      <div className="main-content__inner">
        {/* Header */}
        <div className="main-content__header">
          <h1 className="main-content__title">{title}</h1>
          <p className="main-content__subtitle">
            <CheckCircleIcon />
            {openTaskCount} {openTaskCount === 1 ? 'task' : 'tasks'}
          </p>
        </div>

        {/* Overdue section */}
        {overdueTasks.length > 0 && (
          <div className="main-content__section">
            <div className="main-content__section-header">
              <span>Overdue</span>
              <button className="main-content__reschedule-btn">Reschedule</button>
            </div>
            <TaskList
              tasks={overdueTasks}
              onToggleComplete={onToggleComplete}
              onDeleteTask={onDeleteTask}
            />
          </div>
        )}

        {/* Today / main tasks */}
        {activeView === 'today' && (
          <div className="main-content__section">
            <div className="main-content__section-header">
              <span>{getTodayLabel()}</span>
              <span className="main-content__section-count">{todayTasks.length}</span>
            </div>
            <TaskList
              tasks={todayTasks}
              onToggleComplete={onToggleComplete}
              onDeleteTask={onDeleteTask}
            />
          </div>
        )}

        {/* Non-today views */}
        {activeView !== 'today' && (
          <div className="main-content__section">
            <TaskList
              tasks={todayTasks}
              onToggleComplete={onToggleComplete}
              onDeleteTask={onDeleteTask}
            />
          </div>
        )}

        {/* Add task */}
        {showAddTask ? (
          <AddTaskForm
            defaultProjectId={defaultProjectId}
            defaultDueDate={activeView === 'today' ? today : undefined}
            onAdd={(task) => { onAddTask(task); setShowAddTask(false) }}
            onCancel={() => setShowAddTask(false)}
          />
        ) : (
          <button className="main-content__add-task-btn" onClick={() => setShowAddTask(true)}>
            <span className="main-content__add-task-icon">+</span>
            <span>Add task</span>
          </button>
        )}

        {/* Completed tasks */}
        {completedTasks.length > 0 && (
          <CompletedSection
            tasks={completedTasks}
            onToggleComplete={onToggleComplete}
            onDeleteTask={onDeleteTask}
          />
        )}
      </div>
    </main>
  )
}

function CompletedSection({ tasks, onToggleComplete, onDeleteTask }: {
  tasks: Task[]
  onToggleComplete: (id: string) => void
  onDeleteTask: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="main-content__completed">
      <button
        className="main-content__completed-toggle"
        onClick={() => setExpanded(e => !e)}
      >
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="currentColor"
          style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}
        >
          <path d="M7 10l5 5 5-5z"/>
        </svg>
        <span>Completed</span>
        <span className="main-content__section-count">{tasks.length}</span>
      </button>
      {expanded && (
        <TaskList
          tasks={tasks}
          onToggleComplete={onToggleComplete}
          onDeleteTask={onDeleteTask}
        />
      )}
    </div>
  )
}
