import { useState } from 'react'
import type { CSSProperties } from 'react'
import { CalendarBlankIcon, DotsThreeIcon, FlagIcon as PhFlagIcon, TrashIcon } from '@phosphor-icons/react'
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'
import type { Task, Priority } from '../types'
import { projects, labels } from '../data/mockData'
import './TaskItem.css'

interface TaskItemProps {
  task: Task
  onToggleComplete: (id: string) => void
  onDeleteTask: (id: string) => void
  onOpenTask: (id: string) => void
  dragAttributes?: DraggableAttributes
  dragListeners?: DraggableSyntheticListeners
  sortableRef?: (node: HTMLElement | null) => void
  sortableStyle?: CSSProperties
  isDropTarget?: boolean
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
  <PhFlagIcon size={12} weight="fill" color={priorityColors[priority]} />
)

export default function TaskItem({
  task, onToggleComplete, onDeleteTask, onOpenTask,
  dragAttributes, dragListeners, sortableRef, sortableStyle, isDropTarget,
}: TaskItemProps) {
  const [hovered, setHovered] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const project = projects.find(p => p.id === task.projectId)
  const taskLabels = labels.filter(l => task.labelIds.includes(l.id))
  const dueInfo = task.dueDate ? formatDueDate(task.dueDate) : null
  const sortable = !!dragListeners

  return (
    <li
      ref={sortableRef}
      style={sortableStyle}
      className={[
        'task-item',
        task.isCompleted && 'task-item--completed',
        sortable && 'task-item--sortable',
        isDropTarget && 'task-item--drop-before',
      ].filter(Boolean).join(' ')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowMenu(false) }}
      {...dragAttributes}
      {...dragListeners}
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

      {/* Content — clicking here opens the detail modal; checkbox/actions have their own handlers */}
      <div className="task-item__content" onClick={() => onOpenTask(task.id)}>
        <p className="task-item__title">{task.content}</p>
        {task.description && (
          <p className="task-item__description">{task.description}</p>
        )}

        {/* Meta row */}
        <div className="task-item__meta">
          {dueInfo && (
            <span className={`task-item__due ${dueInfo.overdue ? 'task-item__due--overdue' : ''} ${dueInfo.isToday ? 'task-item__due--today' : ''}`}>
              <CalendarBlankIcon size={12} />
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
              <DotsThreeIcon size={18} weight="bold" />
            </button>
            {showMenu && (
              <div className="task-item__dropdown">
                <button
                  className="task-item__dropdown-item task-item__dropdown-item--danger"
                  onClick={() => { onDeleteTask(task.id); setShowMenu(false) }}
                >
                  <TrashIcon size={16} />
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
