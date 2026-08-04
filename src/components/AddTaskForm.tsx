import React, { useState, useRef, useEffect } from 'react'
import type { Task, Priority } from '../types'
import { projects } from '../data/mockData'
import './AddTaskForm.css'

interface AddTaskFormProps {
  defaultProjectId: string
  defaultDueDate?: string
  onAdd: (task: Omit<Task, 'id' | 'createdAt' | 'order'>) => void
  onCancel: () => void
}

const priorities: { value: Priority; label: string; color: string }[] = [
  { value: 1, label: 'Priority 1', color: 'var(--priority-p1)' },
  { value: 2, label: 'Priority 2', color: 'var(--priority-p2)' },
  { value: 3, label: 'Priority 3', color: 'var(--priority-p3)' },
  { value: 4, label: 'Priority 4', color: 'var(--text-tertiary)' },
]

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
  </svg>
)

const CalendarIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 3h-1V1h-2v2H8V1H6v2H5C3.9 3 3 3.9 3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/>
  </svg>
)

const FlagIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
    <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/>
  </svg>
)

const PaperclipIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16.5 6v11.5a4 4 0 0 1-8 0V5a2.5 2.5 0 0 1 5 0v10.5a1 1 0 0 1-2 0V6H10v9.5a2.5 2.5 0 0 0 5 0V5a4 4 0 0 0-8 0v12.5a5.5 5.5 0 0 0 11 0V6h-1.5z"/>
  </svg>
)

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
  </svg>
)

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
  </svg>
)

export default function AddTaskForm({ defaultProjectId, defaultDueDate, onAdd, onCancel }: AddTaskFormProps) {
  const [content, setContent] = useState('')
  const [description, setDescription] = useState('')
  const [showDescription, setShowDescription] = useState(false)
  const [priority, setPriority] = useState<Priority>(4)
  const [dueDate, setDueDate] = useState(defaultDueDate ?? '')
  const [projectId, setProjectId] = useState(defaultProjectId)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = () => {
    if (!content.trim()) return
    onAdd({
      content: content.trim(),
      description: description.trim() || undefined,
      projectId,
      priority,
      dueDate: dueDate || undefined,
      labels: [],
      isCompleted: false,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      onCancel()
    }
  }

  const selectedProject = projects.find(p => p.id === projectId)
  const today = new Date().toISOString().split('T')[0]

  const dueLabel = !dueDate
    ? 'Date'
    : dueDate === today
      ? 'Today'
      : new Date(dueDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })

  return (
    <div className="add-task-form">
      <div className="add-task-form__inputs">
        <input
          ref={inputRef}
          className="add-task-form__title-input"
          placeholder="Task name"
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {showDescription && (
          <input
            className="add-task-form__desc-input"
            placeholder="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        )}
      </div>

      <div className="add-task-form__toolbar">
        <div className="add-task-form__toolbar-left">
          {/* Reveals the description field, which stays hidden until asked for */}
          <button
            className="add-task-form__expand-btn"
            onClick={() => setShowDescription(s => !s)}
            title="Add description"
            type="button"
          >
            <PlusIcon />
          </button>

          {/* Project */}
          <div className="add-task-form__project-wrapper">
            <button className="add-task-form__chip" type="button">
              <span
                className="add-task-form__project-hash"
                style={{ color: selectedProject?.color }}
              >
                #
              </span>
              <span>{selectedProject?.name ?? 'Inbox'}</span>
            </button>
            <div className="add-task-form__project-dropdown">
              {projects.map(p => (
                <button
                  key={p.id}
                  className={`add-task-form__priority-item ${projectId === p.id ? 'add-task-form__priority-item--active' : ''}`}
                  onClick={() => setProjectId(p.id)}
                >
                  <span className="add-task-form__project-hash" style={{ color: p.color }}>#</span>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Due date — turns green once it holds a value */}
          <label className={`add-task-form__chip ${dueDate ? 'add-task-form__chip--set' : ''}`}>
            <CalendarIcon />
            <span>{dueLabel}</span>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
            {dueDate && (
              <span
                className="add-task-form__chip-clear"
                onClick={e => { e.preventDefault(); setDueDate('') }}
                role="button"
                aria-label="Clear due date"
              >
                <CloseIcon />
              </span>
            )}
          </label>

          {/* Priority */}
          <div className="add-task-form__priority-wrapper">
            <button
              className="add-task-form__chip"
              type="button"
              style={{ color: priority < 4 ? priorities.find(p => p.value === priority)?.color : undefined }}
            >
              <FlagIcon />
              <span>{priority < 4 ? `P${priority}` : 'Priority'}</span>
            </button>
            <div className="add-task-form__priority-dropdown">
              {priorities.map(p => (
                <button
                  key={p.value}
                  className={`add-task-form__priority-item ${priority === p.value ? 'add-task-form__priority-item--active' : ''}`}
                  onClick={() => setPriority(p.value)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={p.color}>
                    <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/>
                  </svg>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Present for layout fidelity; attachments aren't part of this clone */}
          <button className="add-task-form__chip" type="button" disabled title="Not implemented">
            <PaperclipIcon />
            <span>Attachment</span>
          </button>
        </div>

        <div className="add-task-form__actions">
          <button className="add-task-form__cancel-btn" onClick={onCancel} aria-label="Cancel" type="button">
            <CloseIcon />
          </button>
          <button
            className="add-task-form__submit-btn"
            onClick={handleSubmit}
            disabled={!content.trim()}
            aria-label="Add task"
            type="button"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  )
}
