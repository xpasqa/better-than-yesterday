import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CalendarBlankIcon, FlagIcon, HashIcon, TagIcon, XIcon,
} from '@phosphor-icons/react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import type { Node } from '@better/core/node'
import type { Tag } from '@better/core/tag'
import { toggleTaskComplete, updateNode, deleteTask } from '../store/node-actions'
import { useAllTags, useAllNodes } from '../store/use-nodes'
import CreateTagModal from './CreateTagModal'
import './NodeDetailModal.css'

interface NodeDetailModalProps {
  node: Node
  onClose: () => void
  /** User's timezone — needed to catch an overdue recurring task up to "today" on completion (issue #26). */
  timezone: string
}

const PRIORITIES = [
  { value: 1 as const, label: 'Priority 1', color: 'var(--priority-p1)' },
  { value: 2 as const, label: 'Priority 2', color: 'var(--priority-p2)' },
  { value: 3 as const, label: 'Priority 3', color: 'var(--priority-p3)' },
  { value: null, label: 'No priority', color: 'var(--text-tertiary)' },
]

type OpenField = 'date' | 'priority' | 'tags' | 'project' | null

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

export default function NodeDetailModal({ node, onClose, timezone }: NodeDetailModalProps) {
  const allNodes = useAllNodes()
  const allTags = useAllTags()
  const tagsById = new Map(allTags.map(t => [t.id, t]))

  // Local editable state — flushed to store on blur
  const [title, setTitle] = useState(node.content)
  const [note, setNote] = useState(node.note ?? '')
  const [openField, setOpenField] = useState<OpenField>(null)
  const [showCreateTag, setShowCreateTag] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const dateFieldRef = useRef<HTMLButtonElement>(null)
  const calendarRef = useRef<HTMLDivElement>(null)
  const [calendarPos, setCalendarPos] = useState<{ top: number; left: number } | null>(null)

  // Re-sync local state when node changes (e.g. reactive update from Dexie)
  useEffect(() => { setTitle(node.content) }, [node.content])
  useEffect(() => { setNote(node.note ?? '') }, [node.note])

  // Auto-focus title on open — skip on touch devices to avoid keyboard popping up
  useEffect(() => {
    if (window.matchMedia('(hover: hover)').matches) {
      titleRef.current?.focus()
    }
  }, [])

  // Close on Escape (but not when a field dropdown is open)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (openField) { setOpenField(null); return }
        onClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [openField, onClose])

  // Calendar outside-click handler
  useEffect(() => {
    if (openField !== 'date') return
    const handler = (e: MouseEvent) => {
      const t = e.target as globalThis.Node
      if (calendarRef.current?.contains(t) || dateFieldRef.current?.contains(t)) return
      setOpenField(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openField])

  const parentProject = allNodes.find(n => n.id === node.parentId && n.kind === 'project')
  const projects = allNodes.filter(n => n.kind === 'project' && n.deletedAt === null)
  const taskTags = node.tagIds.map(id => tagsById.get(id)).filter(Boolean) as Tag[]
  const done = node.completedAt !== null
  const priority = node.priority
  const priorityMeta = PRIORITIES.find(p => p.value === priority) ?? PRIORITIES[3]

  const patch = (fields: Parameters<typeof updateNode>[1]) => void updateNode(node.id, fields)

  const openDateField = () => {
    const rect = dateFieldRef.current?.getBoundingClientRect()
    if (rect) setCalendarPos({ top: rect.bottom + 4, left: rect.left })
    setOpenField(f => f === 'date' ? null : 'date')
  }

  const toggleTag = (tagId: string) => {
    const next = node.tagIds.includes(tagId)
      ? node.tagIds.filter(t => t !== tagId)
      : [...node.tagIds, tagId]
    patch({ tagIds: next })
  }

  return createPortal(
    <div
      className="node-modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="node-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="node-modal__header">
          <span className="node-modal__breadcrumb">
            <HashIcon size={13} weight="bold" style={{ color: parentProject?.color ?? undefined }} />
            {parentProject?.content ?? 'Inbox'}
          </span>
          <button className="node-modal__close" onClick={onClose} aria-label="Close" type="button">
            <XIcon size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="node-modal__body">

          {/* Main panel */}
          <div className="node-modal__main">
            <div className="node-modal__title-row">
              <button
                type="button"
                className={`node-modal__checkbox node-modal__checkbox--p${priority ?? 4}`}
                onClick={() => void toggleTaskComplete(node, timezone)}
                aria-label={done ? 'Mark as incomplete' : 'Mark as complete'}
              >
                {done && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <input
                ref={titleRef}
                className="node-modal__title-input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onBlur={() => { if (title.trim() && title !== node.content) patch({ content: title.trim() }) }}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
              />
            </div>

            <textarea
              className="node-modal__note-input"
              placeholder="Note"
              value={note}
              onChange={e => setNote(e.target.value)}
              onBlur={() => { if (note !== (node.note ?? '')) patch({ note: note || null }) }}
              rows={3}
            />
          </div>

          {/* Properties panel */}
          <div
            className="node-modal__properties"
            onMouseLeave={() => setOpenField(f => f === 'date' ? f : null)}
          >

            {/* Project */}
            <div className="node-modal__field">
              <span className="node-modal__field-label">Project</span>
              <button
                className="node-modal__field-value"
                onClick={() => setOpenField(f => f === 'project' ? null : 'project')}
                type="button"
              >
                <HashIcon size={14} style={{ color: parentProject?.color ?? undefined }} />
                {parentProject?.content ?? 'Inbox'}
              </button>
              {openField === 'project' && (
                <div className="node-modal__dropdown">
                  {projects.map(p => (
                    <button
                      key={p.id}
                      className={`node-modal__dropdown-item ${node.parentId === p.id ? 'node-modal__dropdown-item--active' : ''}`}
                      onClick={() => { patch({ parentId: p.id }); setOpenField(null) }}
                      type="button"
                    >
                      <HashIcon size={14} style={{ color: p.color ?? undefined }} />
                      {p.content}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Date */}
            <div className="node-modal__field">
              <span className="node-modal__field-label">Date</span>
              <button
                ref={dateFieldRef}
                className="node-modal__field-value"
                onClick={openDateField}
                type="button"
              >
                <CalendarBlankIcon size={14} />
                {node.dueDate
                  ? parseISODate(node.dueDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                  : 'Add date'}
              </button>
              {openField === 'date' && calendarPos && createPortal(
                <div
                  ref={calendarRef}
                  className="node-modal__dropdown node-modal__dropdown--calendar"
                  style={{ position: 'fixed', top: calendarPos.top, left: calendarPos.left }}
                >
                  <DayPicker
                    mode="single"
                    selected={node.dueDate ? parseISODate(node.dueDate) : undefined}
                    onSelect={date => {
                      patch({ dueDate: date ? formatISODate(date) : null })
                      setOpenField(null)
                    }}
                    autoFocus
                  />
                  {node.dueDate && (
                    <button
                      className="node-modal__dropdown-item node-modal__dropdown-item--danger node-modal__clear-date"
                      onClick={() => { patch({ dueDate: null }); setOpenField(null) }}
                      type="button"
                    >
                      <XIcon size={14} />
                      Clear date
                    </button>
                  )}
                </div>,
                document.body,
              )}
            </div>

            {/* Someday */}
            <div className="node-modal__field">
              <span className="node-modal__field-label">Someday</span>
              <button
                className={`node-modal__field-value${node.isSomeday ? ' node-modal__field-value--active' : ''}`}
                onClick={() => patch({ isSomeday: !node.isSomeday })}
                type="button"
                aria-pressed={node.isSomeday}
              >
                <HashIcon size={14} />
                {node.isSomeday ? 'Marked as Someday' : 'Mark as Someday'}
              </button>
            </div>

            {/* Priority */}
            <div className="node-modal__field">
              <span className="node-modal__field-label">Priority</span>
              <button
                className="node-modal__field-value"
                onClick={() => setOpenField(f => f === 'priority' ? null : 'priority')}
                type="button"
                style={{ color: priority ? priorityMeta.color : undefined }}
              >
                <FlagIcon size={14} weight={priority ? 'fill' : 'regular'} />
                {priority ? `P${priority}` : 'No priority'}
              </button>
              {openField === 'priority' && (
                <div className="node-modal__dropdown">
                  {PRIORITIES.map(p => (
                    <button
                      key={String(p.value)}
                      className={`node-modal__dropdown-item ${node.priority === p.value ? 'node-modal__dropdown-item--active' : ''}`}
                      onClick={() => { patch({ priority: p.value }); setOpenField(null) }}
                      type="button"
                    >
                      <FlagIcon size={14} weight="fill" color={p.color} />
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="node-modal__field">
              <span className="node-modal__field-label">Tags</span>
              <button
                className="node-modal__field-value"
                onClick={() => setOpenField(f => f === 'tags' ? null : 'tags')}
                type="button"
              >
                <TagIcon size={14} />
                {taskTags.length > 0 ? taskTags.map(t => `$${t.name}`).join(' ') : 'Add tags'}
              </button>
              {openField === 'tags' && (
                <div className="node-modal__dropdown">
                  {allTags.map(t => (
                    <button
                      key={t.id}
                      className={`node-modal__dropdown-item ${node.tagIds.includes(t.id) ? 'node-modal__dropdown-item--active' : ''}`}
                      onClick={() => toggleTag(t.id)}
                      type="button"
                    >
                      <TagIcon size={14} color={t.color} />
                      {t.name}
                    </button>
                  ))}
                  <button
                    className="node-modal__dropdown-item node-modal__dropdown-item--new"
                    onClick={() => { setOpenField(null); setShowCreateTag(true) }}
                    type="button"
                  >
                    + New tag
                  </button>
                </div>
              )}
              {showCreateTag && (
                <CreateTagModal
                  onClose={() => setShowCreateTag(false)}
                  onCreated={(id) => {
                    const next = [...node.tagIds, id]
                    patch({ tagIds: next })
                    setShowCreateTag(false)
                  }}
                />
              )}
            </div>

            {/* Delete */}
            <div className="node-modal__field node-modal__field--danger">
              <button
                className="node-modal__delete-btn"
                onClick={() => { void deleteTask(node); onClose() }}
                type="button"
              >
                Delete task
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
