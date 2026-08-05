import React, { useState, useRef, useEffect } from 'react'
import {
  CalendarBlankIcon, FlagIcon, PaperclipIcon, PaperPlaneTiltIcon, PlusIcon, XIcon,
} from '@phosphor-icons/react'
import type { Task, Priority } from '../types'
import { projects } from '../data/mockData'
import './AddTaskForm.css'

interface AddTaskFormProps {
  defaultProjectId: string
  defaultDueDate?: string
  defaultSectionId?: string
  onAdd: (task: Omit<Task, 'id' | 'createdAt' | 'order'>) => void
  onCancel: () => void
}

const priorities: { value: Priority; label: string; color: string }[] = [
  { value: 1, label: 'Priority 1', color: 'var(--priority-p1)' },
  { value: 2, label: 'Priority 2', color: 'var(--priority-p2)' },
  { value: 3, label: 'Priority 3', color: 'var(--priority-p3)' },
  { value: 4, label: 'Priority 4', color: 'var(--text-tertiary)' },
]

export default function AddTaskForm({ defaultProjectId, defaultDueDate, defaultSectionId, onAdd, onCancel }: AddTaskFormProps) {
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
      sectionId: defaultSectionId,
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
            <PlusIcon size={16} weight="bold" />
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
            <CalendarBlankIcon size={15} />
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
                <XIcon size={12} weight="bold" />
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
              <FlagIcon size={15} weight={priority < 4 ? 'fill' : 'regular'} />
              <span>{priority < 4 ? `P${priority}` : 'Priority'}</span>
            </button>
            <div className="add-task-form__priority-dropdown">
              {priorities.map(p => (
                <button
                  key={p.value}
                  className={`add-task-form__priority-item ${priority === p.value ? 'add-task-form__priority-item--active' : ''}`}
                  onClick={() => setPriority(p.value)}
                >
                  <FlagIcon size={14} weight="fill" color={p.color} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Present for layout fidelity; attachments aren't part of this clone */}
          <button className="add-task-form__chip" type="button" disabled title="Not implemented">
            <PaperclipIcon size={15} />
            <span>Attachment</span>
          </button>
        </div>

        <div className="add-task-form__actions">
          <button className="add-task-form__cancel-btn" onClick={onCancel} aria-label="Cancel" type="button">
            <XIcon size={14} weight="bold" />
          </button>
          <button
            className="add-task-form__submit-btn"
            onClick={handleSubmit}
            disabled={!content.trim()}
            aria-label="Add task"
            type="button"
          >
            <PaperPlaneTiltIcon size={16} weight="fill" />
          </button>
        </div>
      </div>
    </div>
  )
}
