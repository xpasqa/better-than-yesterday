import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CalendarBlankIcon, FlagIcon, HashIcon, PlusIcon, TagIcon, TrashIcon, XIcon,
} from '@phosphor-icons/react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import type { Task, Priority, SubTask } from '../types'
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

type OpenField = 'project' | 'date' | 'priority' | 'labels' | null

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

/* Parsed/formatted as local-time parts so a stored "2026-08-04" never shifts
   a day when it round-trips through a JS Date in a negative-UTC timezone. */
function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function TaskDetailModal({ task, onClose, onToggleComplete, onUpdateTask }: TaskDetailModalProps) {
  const [openField, setOpenField] = useState<OpenField>(null)
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [newSubtaskText, setNewSubtaskText] = useState('')
  const subtaskInputRef = useRef<HTMLInputElement>(null)
  const dateFieldRef = useRef<HTMLButtonElement>(null)
  const calendarRef = useRef<HTMLDivElement>(null)
  const [calendarPos, setCalendarPos] = useState<{ top: number; left: number } | null>(null)

  const openDateField = () => {
    const rect = dateFieldRef.current?.getBoundingClientRect()
    if (rect) setCalendarPos({ top: rect.bottom + 4, left: rect.left })
    setOpenField(f => f === 'date' ? null : 'date')
  }

  /*
   * The calendar is portaled straight to <body> to escape the properties
   * panel's overflow-y:auto (and the modal's own overflow:hidden) — a
   * day-grid is much taller than the little list dropdowns, so it was
   * getting clipped mid-month. Portaled content can't rely on the panel's
   * onMouseLeave to close, so it gets its own outside-click/Escape handling.
   */
  useEffect(() => {
    if (openField !== 'date') return
    const handlePointer = (e: MouseEvent) => {
      const target = e.target as Node
      if (calendarRef.current?.contains(target) || dateFieldRef.current?.contains(target)) return
      setOpenField(null)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenField(null)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [openField])

  const project = projects.find(p => p.id === task.projectId)
  const priority = priorities.find(p => p.value === task.priority)
  const taskLabels = labels.filter(l => task.labelIds.includes(l.id))
  const subTasks = task.subTasks ?? []

  const toggleLabel = (labelId: string) => {
    const next = task.labelIds.includes(labelId)
      ? task.labelIds.filter(l => l !== labelId)
      : [...task.labelIds, labelId]
    onUpdateTask(task.id, { labelIds: next })
  }

  const updateSubTasks = (next: SubTask[]) => onUpdateTask(task.id, { subTasks: next })

  const toggleSubtask = (id: string) =>
    updateSubTasks(subTasks.map(s => s.id === id ? { ...s, isCompleted: !s.isCompleted } : s))

  const renameSubtask = (id: string, content: string) =>
    updateSubTasks(subTasks.map(s => s.id === id ? { ...s, content } : s))

  const deleteSubtask = (id: string) =>
    updateSubTasks(subTasks.filter(s => s.id !== id))

  const commitNewSubtask = () => {
    const trimmed = newSubtaskText.trim()
    if (trimmed) updateSubTasks([...subTasks, { id: generateId(), content: trimmed, isCompleted: false }])
    setNewSubtaskText('')
    setAddingSubtask(false)
  }

  const startAddingSubtask = () => {
    setAddingSubtask(true)
    requestAnimationFrame(() => subtaskInputRef.current?.focus())
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

            <textarea
              className="task-modal__description-input"
              placeholder="Description"
              value={task.description ?? ''}
              onChange={e => onUpdateTask(task.id, { description: e.target.value })}
              rows={2}
            />

            <div className="task-modal__subtasks-section">
              {subTasks.length > 0 && (
                <ul className="task-modal__subtasks">
                  {subTasks.map(sub => (
                    <li key={sub.id} className="task-modal__subtask">
                      <button
                        className={`task-modal__subtask-checkbox ${sub.isCompleted ? 'task-modal__subtask-checkbox--done' : ''}`}
                        onClick={() => toggleSubtask(sub.id)}
                        aria-label={sub.isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
                        type="button"
                      />
                      <input
                        className={`task-modal__subtask-input ${sub.isCompleted ? 'task-modal__subtask-input--done' : ''}`}
                        value={sub.content}
                        onChange={e => renameSubtask(sub.id, e.target.value)}
                      />
                      <button
                        className="task-modal__subtask-delete"
                        onClick={() => deleteSubtask(sub.id)}
                        aria-label="Delete sub-task"
                        type="button"
                      >
                        <TrashIcon size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {addingSubtask ? (
                <input
                  ref={subtaskInputRef}
                  className="task-modal__subtask-new-input"
                  placeholder="Sub-task name"
                  value={newSubtaskText}
                  onChange={e => setNewSubtaskText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); commitNewSubtask() }
                    if (e.key === 'Escape') { e.preventDefault(); setAddingSubtask(false); setNewSubtaskText('') }
                  }}
                  onBlur={commitNewSubtask}
                />
              ) : (
                <button className="task-modal__add-subtask" onClick={startAddingSubtask} type="button">
                  <PlusIcon size={14} weight="bold" />
                  Add sub-task
                </button>
              )}
            </div>
          </div>

          <div
            className="task-modal__properties"
            onMouseLeave={() => setOpenField(f => f === 'date' ? f : null)}
          >
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
              <button
                ref={dateFieldRef}
                className="task-modal__field-value"
                onClick={openDateField}
                type="button"
              >
                <CalendarBlankIcon size={14} />
                {task.dueDate
                  ? new Date(task.dueDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                  : 'Add date'}
              </button>
              {openField === 'date' && calendarPos && createPortal(
                <div
                  ref={calendarRef}
                  className="task-modal__dropdown task-modal__dropdown--calendar"
                  style={{ position: 'fixed', top: calendarPos.top, left: calendarPos.left }}
                >
                  <DayPicker
                    mode="single"
                    selected={task.dueDate ? parseISODate(task.dueDate) : undefined}
                    onSelect={(date) => {
                      onUpdateTask(task.id, { dueDate: date ? formatISODate(date) : undefined })
                      setOpenField(null)
                    }}
                    autoFocus
                  />
                  {task.dueDate && (
                    <button
                      className="task-modal__dropdown-item task-modal__dropdown-item--danger task-modal__clear-date"
                      onClick={() => { onUpdateTask(task.id, { dueDate: undefined }); setOpenField(null) }}
                      type="button"
                    >
                      <XIcon size={14} />
                      Clear date
                    </button>
                  )}
                </div>,
                document.body
              )}
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
                      className={`task-modal__dropdown-item ${task.labelIds.includes(l.id) ? 'task-modal__dropdown-item--active' : ''}`}
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
