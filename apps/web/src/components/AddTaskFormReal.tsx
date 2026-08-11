import React, { useState, useRef, useEffect } from 'react'
import {
  CalendarBlankIcon, FlagIcon, PaperPlaneTiltIcon, PlusIcon, XIcon,
} from '@phosphor-icons/react'
import type { Node } from '@better/core/node'
import { parse } from '@better/core/parse'
import { describeRecurrence } from '@better/core/recurrence'
import { createTaskFromQuickAdd } from '../store/node-actions'
import { useAllNodes } from '../store/use-nodes'
import './AddTaskForm.css'

/** Formats a YYYY-MM-DD string as "Hari ini", "Besok", or "10 Agu". */
function formatPreviewDate(date: string): string {
  const today = new Date().toISOString().split('T')[0]
  const tomorrowDate = new Date()
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrow = tomorrowDate.toISOString().split('T')[0]
  if (date === today) return 'Hari ini'
  if (date === tomorrow) return 'Besok'
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

interface AddTaskFormRealProps {
  defaultParentId?: string | null
  defaultDueDate?: string
  timezone: string
  onCancel: () => void
  onAdded?: (node: Node) => void
}

const PRIORITIES = [
  { value: 1 as const, label: 'Priority 1', color: 'var(--priority-p1)' },
  { value: 2 as const, label: 'Priority 2', color: 'var(--priority-p2)' },
  { value: 3 as const, label: 'Priority 3', color: 'var(--priority-p3)' },
  { value: null, label: 'No priority', color: 'var(--text-tertiary)' },
]

/**
 * Visually identical to AddTaskForm but backed by the real Node store and
 * createTaskFromQuickAdd's NLP parser — the title input accepts the same
 * quick-add syntax as the rest of the app (dates, $tags, #project, !priority).
 */
export default function AddTaskFormReal({
  defaultParentId, defaultDueDate, timezone, onCancel, onAdded,
}: AddTaskFormRealProps) {
  const allNodes = useAllNodes()
  const [content, setContent] = useState('')
  const [description, setDescription] = useState('')
  const [showDescription, setShowDescription] = useState(false)
  const [priority, setPriority] = useState<1 | 2 | 3 | null>(null)
  const [dueDate, setDueDate] = useState(defaultDueDate ?? '')
  const [parentId, setParentId] = useState(defaultParentId ?? null)
  const [showPriority, setShowPriority] = useState(false)
  const [showProject, setShowProject] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const projects = allNodes.filter(n => n.kind === 'project' && n.deletedAt === null)
  const selectedProject = allNodes.find(n => n.id === parentId)
  const today = new Date().toISOString().split('T')[0]

  const dueLabel = !dueDate
    ? 'Date'
    : dueDate === today
      ? 'Today'
      : new Date(dueDate + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short' })

  // Preview of what the NLP parser recognises in `content` so far — only
  // shown once at least one field is recognised. parse() is pure and fast,
  // so calling it on every render is intentional (issue #77 block B; this
  // used to live in QuickAddBar.tsx, a component that was never actually
  // mounted anywhere in the app).
  const parsePreview = (() => {
    const trimmed = content.trim()
    if (!trimmed) return null
    const parsed = parse(trimmed, { now: new Date(), timezone, language: 'id' })
    const parts: string[] = []
    if (parsed.dueDate) parts.push(formatPreviewDate(parsed.dueDate))
    if (parsed.priority) parts.push(`P${parsed.priority}`)
    const recLabel = describeRecurrence(parsed.recurrence)
    if (recLabel) parts.push(recLabel)
    return parts.length > 0 ? parts.join(' · ') : null
  })()

  const handleSubmit = async () => {
    const trimmed = content.trim()
    if (!trimmed) return

    // Build quick-add string with explicit tokens
    let input = trimmed
    if (description.trim()) input += `\n${description.trim()}`

    const node = await createTaskFromQuickAdd(input, {
      timezone,
      language: 'id',
      defaultParentId: parentId,
    })

    // Patch priority and due date from the chips — but only the due date
    // chip if it actually reflects a choice. `dueDate` starts pre-filled
    // from `defaultDueDate` (Today view defaults it to today's date so a
    // plain task with no date phrase still lands there), so comparing
    // straight against its truthiness silently overwrote a date the NLP
    // parser correctly found ("besok", "jumat depan", ...) with that
    // untouched default on every submit. Only override when the chip was
    // actually touched (differs from the pre-fill) or the parser found no
    // date of its own to fall back on.
    const dueDateChanged = dueDate !== (defaultDueDate ?? '')
    const shouldPatchDate = dueDateChanged || node.dueDate === null
    if (priority !== null || shouldPatchDate) {
      const { updateNode } = await import('../store/node-actions')
      const patch: Partial<Node> = {}
      if (priority !== null) patch.priority = priority
      if (shouldPatchDate) patch.dueDate = dueDate || null
      await updateNode(node.id, patch)
    }

    onAdded?.(node)
    setContent('')
    setDescription('')
    setPriority(null)
    setDueDate('')
    onCancel()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSubmit() }
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div className="add-task-form">
      <div className="add-task-form__inputs">
        <input
          ref={inputRef}
          className="add-task-form__title-input"
          placeholder="Task name"
          aria-label="Quick add a task"
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {parsePreview && (
          <p className="real-view__quick-add-preview" aria-hidden="true">
            {parsePreview}
          </p>
        )}
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
          {/* Toggle description */}
          <button
            className="add-task-form__expand-btn"
            onClick={() => setShowDescription(s => !s)}
            title="Add description"
            type="button"
          >
            <PlusIcon size={16} weight="bold" />
          </button>

          {/* Project chip */}
          <div className="add-task-form__project-wrapper">
            <button
              className="add-task-form__chip"
              type="button"
              onClick={() => setShowProject(s => !s)}
            >
              <span className="add-task-form__project-hash" style={{ color: selectedProject?.color ?? undefined }}>#</span>
              <span>{selectedProject?.content ?? 'Inbox'}</span>
            </button>
            {showProject && (
              <div className="add-task-form__project-dropdown" style={{ display: 'block' }}>
                {projects.map(p => (
                  <button
                    key={p.id}
                    className={`add-task-form__priority-item ${parentId === p.id ? 'add-task-form__priority-item--active' : ''}`}
                    onClick={() => { setParentId(p.id); setShowProject(false) }}
                    type="button"
                  >
                    <span className="add-task-form__project-hash" style={{ color: p.color ?? undefined }}>#</span>
                    {p.content}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date chip */}
          <label
            className={`add-task-form__chip ${dueDate ? 'add-task-form__chip--set' : ''}`}
            style={dueDate ? { color: 'var(--color-positive)', borderColor: 'var(--color-positive)' } : undefined}
          >
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

          {/* Priority chip */}
          <div className="add-task-form__priority-wrapper">
            <button
              className="add-task-form__chip"
              type="button"
              style={{ color: priority !== null ? PRIORITIES.find(p => p.value === priority)?.color : undefined }}
              onClick={() => setShowPriority(s => !s)}
            >
              <FlagIcon size={15} weight={priority !== null ? 'fill' : 'regular'} />
              <span>{priority !== null ? `P${priority}` : 'Priority'}</span>
            </button>
            {showPriority && (
              <div className="add-task-form__priority-dropdown" style={{ display: 'block' }}>
                {PRIORITIES.map(p => (
                  <button
                    key={String(p.value)}
                    className={`add-task-form__priority-item ${priority === p.value ? 'add-task-form__priority-item--active' : ''}`}
                    onClick={() => { setPriority(p.value); setShowPriority(false) }}
                    type="button"
                  >
                    <FlagIcon size={14} weight="fill" color={p.color} />
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="add-task-form__actions">
          <button className="add-task-form__cancel-btn" onClick={onCancel} aria-label="Cancel" type="button">
            <XIcon size={14} weight="bold" />
          </button>
          <button
            className="add-task-form__submit-btn"
            onClick={() => void handleSubmit()}
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
