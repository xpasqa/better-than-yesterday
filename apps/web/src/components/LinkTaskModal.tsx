// The popup that opens when a #project is picked from an Outline row's
// autocomplete (32.outline-task-decoupling/spec.md §4). Reuses ProjectModal's
// CSS shell — same overlay/header/body/footer pattern, second use of it.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { XIcon, FlagIcon } from '@phosphor-icons/react'
import type { Node } from '@better/core/node'
import { linkOutlineRowToNewTask } from '../store/outline-actions'
import './ProjectModal.css'
import './LinkTaskModal.css'

interface LinkTaskModalProps {
  /** The Outline row that will receive `linkedTaskId`. */
  row: Node
  allNodes: Node[]
  /** The project picked from the row's `#` autocomplete. */
  projectId: string
  /** Row content with the `#ProjectName` span already stripped. */
  initialTitle: string
  onClose: () => void
  onLinked: (task: Node) => void
}

const PRIORITIES = [
  { value: 1 as const, label: 'P1', color: 'var(--priority-p1)' },
  { value: 2 as const, label: 'P2', color: 'var(--priority-p2)' },
  { value: 3 as const, label: 'P3', color: 'var(--priority-p3)' },
  { value: null, label: 'No priority', color: 'var(--text-tertiary)' },
]

export default function LinkTaskModal({
  row, allNodes, projectId, initialTitle, onClose, onLinked,
}: LinkTaskModalProps) {
  const [title, setTitle] = useState(initialTitle)
  const [parentId, setParentId] = useState(projectId)
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<1 | 2 | 3 | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const projects = allNodes.filter((n) => n.kind === 'project' && n.deletedAt === null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = async () => {
    const trimmed = title.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    try {
      const task = await linkOutlineRowToNewTask(row, allNodes, {
        parentId,
        content: trimmed,
        dueDate: dueDate || null,
        priority,
      })
      onLinked(task)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); void handleSubmit() }
    if (e.key === 'Escape') onClose()
  }

  return createPortal(
    <div
      className="project-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Link task"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="project-modal">
        <div className="project-modal__header">
          <span className="project-modal__title">New task</span>
          <button className="project-modal__close" onClick={onClose} aria-label="Close" type="button">
            <XIcon size={18} />
          </button>
        </div>

        <div className="project-modal__body">
          <label className="project-modal__label" htmlFor="ltm-title-input">Title</label>
          <input
            id="ltm-title-input"
            ref={inputRef}
            className="project-modal__input"
            type="text"
            placeholder="Task name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={2000}
            autoComplete="off"
          />

          <label className="project-modal__label" htmlFor="ltm-project-select">Project</label>
          <select
            id="ltm-project-select"
            className="project-modal__select"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.content}</option>
            ))}
          </select>

          <label className="project-modal__label" htmlFor="ltm-date-input">Date</label>
          <input
            id="ltm-date-input"
            className="project-modal__input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />

          <label className="project-modal__label">Priority</label>
          <div className="link-task-modal__priorities">
            {PRIORITIES.map((p) => (
              <button
                key={String(p.value)}
                type="button"
                className={`link-task-modal__priority ${priority === p.value ? 'link-task-modal__priority--active' : ''}`}
                onClick={() => setPriority(p.value)}
              >
                <FlagIcon size={14} weight="fill" color={p.color} />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="project-modal__footer">
          <button className="project-modal__btn project-modal__btn--cancel" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="project-modal__btn project-modal__btn--submit"
            onClick={() => void handleSubmit()}
            disabled={!title.trim() || submitting}
            type="button"
          >
            Add
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
