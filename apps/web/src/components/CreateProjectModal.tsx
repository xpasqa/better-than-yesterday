import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { XIcon } from '@phosphor-icons/react'
import { useAllNodes } from '../store/use-nodes'
import { createProject } from '../store/project-actions'
import './CreateProjectModal.css'

interface CreateProjectModalProps {
  onClose: () => void
  onCreated: (id: string) => void
}

export default function CreateProjectModal({ onClose, onCreated }: CreateProjectModalProps) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const nodes = useAllNodes()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    try {
      const id = await createProject(trimmed, null, null, [...nodes])
      if (id) { onCreated(id); onClose() }
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
      className="create-project-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Create project"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="create-project-modal">
        <div className="create-project-modal__header">
          <span className="create-project-modal__title">Add project</span>
          <button
            className="create-project-modal__close"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="create-project-modal__body">
          <label className="create-project-modal__label" htmlFor="project-name-input">
            Name
          </label>
          <input
            id="project-name-input"
            ref={inputRef}
            className="create-project-modal__input"
            type="text"
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={200}
            autoComplete="off"
          />
        </div>

        <div className="create-project-modal__footer">
          <button
            className="create-project-modal__btn create-project-modal__btn--cancel"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="create-project-modal__btn create-project-modal__btn--submit"
            onClick={() => void handleSubmit()}
            disabled={!name.trim() || submitting}
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
