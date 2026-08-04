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

export default function AddTaskForm({ defaultProjectId, defaultDueDate, onAdd, onCancel }: AddTaskFormProps) {
  const [content, setContent] = useState('')
  const [description, setDescription] = useState('')
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
        <input
          className="add-task-form__desc-input"
          placeholder="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* Toolbar */}
      <div className="add-task-form__toolbar">
        <div className="add-task-form__toolbar-left">
          {/* Due date */}
          <label className="add-task-form__tool-btn" title="Due date">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3h-1V1h-2v2H8V1H6v2H5C3.9 3 3 3.9 3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/>
            </svg>
            <span>{dueDate || 'Due date'}</span>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="add-task-form__date-input"
            />
          </label>

          {/* Priority */}
          <div className="add-task-form__priority-wrapper">
            <button
              className="add-task-form__tool-btn"
              title="Priority"
              style={{ color: priority < 4 ? priorities.find(p => p.value === priority)?.color : undefined }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/>
              </svg>
              <span>P{priority}</span>
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

          {/* Project */}
          <div className="add-task-form__project-wrapper">
            <button className="add-task-form__tool-btn" title="Project">
              <span
                className="add-task-form__project-dot"
                style={{ background: selectedProject?.color }}
              />
              <span>{selectedProject?.name ?? 'Inbox'}</span>
            </button>
            <div className="add-task-form__project-dropdown">
              {projects.map(p => (
                <button
                  key={p.id}
                  className={`add-task-form__priority-item ${projectId === p.id ? 'add-task-form__priority-item--active' : ''}`}
                  onClick={() => setProjectId(p.id)}
                >
                  <span className="add-task-form__project-dot" style={{ background: p.color }} />
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="add-task-form__actions">
        <button
          className="add-task-form__submit-btn"
          onClick={handleSubmit}
          disabled={!content.trim()}
        >
          Add task
        </button>
        <button className="add-task-form__cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
