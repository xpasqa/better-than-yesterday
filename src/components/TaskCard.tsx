import type { CSSProperties } from 'react'
import { CalendarBlankIcon } from '@phosphor-icons/react'
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'
import type { Task, Priority } from '../types'
import './TaskCard.css'

interface TaskCardProps {
  task: Task
  onToggleComplete: (id: string) => void
  onOpenTask: (id: string) => void
  dragAttributes?: DraggableAttributes
  dragListeners?: DraggableSyntheticListeners
  sortableRef?: (node: HTMLElement | null) => void
  sortableStyle?: CSSProperties
  isDropTarget?: boolean
}

function formatDueDate(date: string): { text: string; overdue: boolean; isToday: boolean } {
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  if (date === today) return { text: 'Today', overdue: false, isToday: true }
  if (date === tomorrow) return { text: 'Tomorrow', overdue: false, isToday: false }
  const d = new Date(date)
  return {
    text: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    overdue: date < today,
    isToday: false,
  }
}

export default function TaskCard({
  task, onToggleComplete, onOpenTask, dragAttributes, dragListeners, sortableRef, sortableStyle, isDropTarget,
}: TaskCardProps) {
  const dueInfo = task.dueDate ? formatDueDate(task.dueDate) : null
  const sortable = !!dragListeners

  return (
    <div
      ref={sortableRef}
      style={sortableStyle}
      className={[
        'task-card',
        task.isCompleted && 'task-card--completed',
        sortable && 'task-card--sortable',
        isDropTarget && 'task-card--drop-before',
      ].filter(Boolean).join(' ')}
      {...dragAttributes}
      {...dragListeners}
    >
      <button
        className={`task-card__checkbox task-card__checkbox--p${task.priority as Priority}`}
        onClick={() => onToggleComplete(task.id)}
        aria-label={task.isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {task.isCompleted && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
      <div className="task-card__body" onClick={() => onOpenTask(task.id)}>
        <p className="task-card__title">{task.content}</p>
        {task.description && (
          <p className="task-card__description">{task.description}</p>
        )}
        {dueInfo && (
          <span className={`task-card__due ${dueInfo.overdue ? 'task-card__due--overdue' : ''} ${dueInfo.isToday ? 'task-card__due--today' : ''}`}>
            <CalendarBlankIcon size={12} />
            {dueInfo.text}
          </span>
        )}
      </div>
    </div>
  )
}
