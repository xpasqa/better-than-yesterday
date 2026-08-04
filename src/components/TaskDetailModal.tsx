import { useState } from 'react'
import {
  CalendarBlankIcon, FlagIcon, HashIcon, TagIcon, XIcon,
} from '@phosphor-icons/react'
import type { Task, Priority } from '../types'
import { projects, labels } from '../data/mockData'
import './TaskDetailModal.css'

interface TaskDetailModalProps {
  task: Task
  onClose: () => void
  onToggleComplete: (id: string) => void
  onUpdateTask: (id: string, patch: Partial<Task>) => void
}

const priorities: { value: Priority; label: string; color: string }[] = [
  { value: 1, label: 'Priority 1', color: 'var(--priority-p1)' },
  { value: 2, label: 'Priority 2', color: 'var(--priority-p2)' },
  { value: 3, label: 'Priority 3', color: 'var(--priority-p3)' },
  { value: 4, label: 'Priority 4', color: 'var(--text-tertiary)' },
]

type OpenField = 'project' | 'priority' | 'labels' | null

export default function TaskDetailModal({ task, onClose, onToggleComplete, onUpdateTask }: TaskDetailModalProps) {
  const [editingDescription, setEditingDescription] = useState(false)
  const [openField, setOpenField] = useState<OpenField>(null)

  const project = projects.find(p => p.id === task.projectId)
  const priority = priorities.find(p => p.value === task.priority)
  const taskLabels = labels.filter(l => task.labels.includes(l.id))

  const toggleLabel = (labelId: string) => {
    const next = task.labels.includes(labelId)
      ? task.labels.filter(l => l !== labelId)
      : [...task.labels, labelId]
    onUpdateTask(task.id, { labels: next })
  }

  return (
    <div className="task-modal-overlay" onClick={onClose}>
      <div className="task-modal" onClick={e => e.stopPropagation()}>
        <div className="task-modal__header">
          <span className="task-modal__breadcrumb">
            <HashIcon size={13} weight="bold" style={{ color: project?.color }} />
            {project?.name ?? 'Inbox'}
          </span>
          <button className="task-modal__close" onClick={onClose} aria-label="Close" type="button">
            <XIcon size={18} />
          </button>
        </div>

        <div className="task-modal__body">
          <div className="task-modal__main">
            <div className="task-modal__title-row">
              <button
                className={`task-modal__checkbox task-modal__checkbox--p${task.priority}`}
                onClick={() => onToggleComplete(task.id)}
                aria-label={task.isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
              />
              <input
                className="task-modal__title-input"
                value={task.content}
                onChange={e => onUpdateTask(task.id, { content: e.target.value })}
              />
            </div>

            {editingDescription || task.description ? (
              <textarea
                className="task-modal__description-input"
                placeholder="Description"
                value={task.description ?? ''}
                autoFocus={editingDescription && !task.description}
                onChange={e => onUpdateTask(task.id, { description: e.target.value })}
                onBlur={() => setEditingDescription(false)}
              />
            ) : (
              <button
                className="task-modal__description-placeholder"
                onClick={() => setEditingDescription(true)}
                type="button"
              >
                Description
              </button>
            )}
          </div>

          <div className="task-modal__properties" onMouseLeave={() => setOpenField(null)}>
            <div className="task-modal__field">
              <span className="task-modal__field-label">Project</span>
              <button
                className="task-modal__field-value"
                onClick={() => setOpenField(f => f === 'project' ? null : 'project')}
                type="button"
              >
                <HashIcon size={14} style={{ color: project?.color }} />
                {project?.name ?? 'Inbox'}
              </button>
              {openField === 'project' && (
                <div className="task-modal__dropdown">
                  {projects.map(p => (
                    <button
                      key={p.id}
                      className="task-modal__dropdown-item"
                      onClick={() => { onUpdateTask(task.id, { projectId: p.id }); setOpenField(null) }}
                      type="button"
                    >
                      <HashIcon size={14} style={{ color: p.color }} />
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="task-modal__field">
              <span className="task-modal__field-label">Date</span>
              <label className="task-modal__field-value">
                <CalendarBlankIcon size={14} />
                {task.dueDate
                  ? new Date(task.dueDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                  : 'Add date'}
                <input
                  type="date"
                  value={task.dueDate ?? ''}
                  onChange={e => onUpdateTask(task.id, { dueDate: e.target.value || undefined })}
                />
              </label>
            </div>

            <div className="task-modal__field">
              <span className="task-modal__field-label">Priority</span>
              <button
                className="task-modal__field-value"
                onClick={() => setOpenField(f => f === 'priority' ? null : 'priority')}
                type="button"
                style={{ color: task.priority < 4 ? priority?.color : undefined }}
              >
                <FlagIcon size={14} weight={task.priority < 4 ? 'fill' : 'regular'} />
                P{task.priority}
              </button>
              {openField === 'priority' && (
                <div className="task-modal__dropdown">
                  {priorities.map(p => (
                    <button
                      key={p.value}
                      className="task-modal__dropdown-item"
                      onClick={() => { onUpdateTask(task.id, { priority: p.value }); setOpenField(null) }}
                      type="button"
                    >
                      <FlagIcon size={14} weight="fill" color={p.color} />
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="task-modal__field">
              <span className="task-modal__field-label">Labels</span>
              <button
                className="task-modal__field-value"
                onClick={() => setOpenField(f => f === 'labels' ? null : 'labels')}
                type="button"
              >
                <TagIcon size={14} />
                {taskLabels.length > 0 ? taskLabels.map(l => `@${l.name}`).join(' ') : 'Add labels'}
              </button>
              {openField === 'labels' && (
                <div className="task-modal__dropdown">
                  {labels.map(l => (
                    <button
                      key={l.id}
                      className={`task-modal__dropdown-item ${task.labels.includes(l.id) ? 'task-modal__dropdown-item--active' : ''}`}
                      onClick={() => toggleLabel(l.id)}
                      type="button"
                    >
                      <TagIcon size={14} color={l.color} />
                      {l.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
