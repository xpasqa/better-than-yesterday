import { useState } from 'react'
import type { Task, Priority } from '../types'
import { projects, labels } from '../data/mockData'
import './TaskItem.css'

interface TaskItemProps {
  task: Task
  onToggleComplete: (id: string) => void
  onDeleteTask: (id: string) => void
}

const priorityColors: Record<Priority, string> = {
  1: 'var(--priority-p1)',
  2: 'var(--priority-p2)',
  3: 'var(--priority-p3)',
  4: 'var(--text-tertiary)',
}


function formatDueDate(date: string): { text: string; overdue: boolean; isToday: boolean } {
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const overdue = date < today

  if (date === today) return { text: 'Today', overdue: false, isToday: true }
  if (date === tomorrow) return { text: 'Tomorrow', overdue: false, isToday: false }
  if (overdue) {
    const d = new Date(date)
    return {
      text: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      overdue: true,
      isToday: false,
    }
  }
  const d = new Date(date)
  return {
    text: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    overdue: false,
    isToday: false,
  }
}

const FlagIcon = ({ priority }: { priority: Priority }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill={priorityColors[priority]}>
    <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/>
  </svg>
)

const CalendarIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 3h-1V1h-2v2H8V1H6v2H5C3.9 3 3 3.9 3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/>
  </svg>
)

const MoreIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
  </svg>
)

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/>
  </svg>
)

export default function TaskItem({ task, onToggleComplete, onDeleteTask }: TaskItemProps) {
  const [hovered, setHovered] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const project = projects.find(p => p.id === task.projectId)
  const taskLabels = labels.filter(l => task.labels.includes(l.id))
  const dueInfo = task.dueDate ? formatDueDate(task.dueDate) : null

  return (
    <li
      className={`task-item ${task.isCompleted ? 'task-item--completed' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowMenu(false) }}
    >
      {/* Checkbox */}
      <button
        className={`task-item__checkbox task-item__checkbox--p${task.priority}`}
        onClick={() => onToggleComplete(task.id)}
        aria-label={task.isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {task.isCompleted && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="task-item__content">
        <p className="task-item__title">{task.content}</p>
        {task.description && (
          <p className="task-item__description">{task.description}</p>
        )}

        {/* Meta row */}
        <div className="task-item__meta">
          {dueInfo && (
            <span className={`task-item__due ${dueInfo.overdue ? 'task-item__due--overdue' : ''} ${dueInfo.isToday ? 'task-item__due--today' : ''}`}>
              <CalendarIcon />
              {dueInfo.text}
            </span>
          )}
          {taskLabels.map(label => (
            <span key={label.id} className="task-item__label" style={{ color: label.color }}>
              @ {label.name}
            </span>
          ))}
          {project && task.projectId !== 'inbox' && (
            <span className="task-item__project">
              {project.name}
              <span className="task-item__project-hash" style={{ color: project.color }}>#</span>
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      {hovered && (
        <div className="task-item__actions">
          {task.priority > 1 && (
            <span className="task-item__priority-flag">
              <FlagIcon priority={task.priority} />
            </span>
          )}
          <div className="task-item__menu-wrapper">
            <button
              className="task-item__action-btn"
              onClick={() => setShowMenu(m => !m)}
              aria-label="More options"
            >
              <MoreIcon />
            </button>
            {showMenu && (
              <div className="task-item__dropdown">
                <button
                  className="task-item__dropdown-item task-item__dropdown-item--danger"
                  onClick={() => { onDeleteTask(task.id); setShowMenu(false) }}
                >
                  <TrashIcon />
                  Delete task
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  )
}
