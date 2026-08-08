import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { XIcon } from '@phosphor-icons/react'
import { createTagFromUI } from '../store/tag-actions'
import './CreateTagModal.css'

interface CreateTagModalProps {
  onClose: () => void
  onCreated: (id: string) => void
}

const COLOR_SWATCHES = [
  { label: 'Red', value: '#dc4c3e' },
  { label: 'Orange', value: '#eb8909' },
  { label: 'Yellow', value: '#f0c10c' },
  { label: 'Green', value: '#058527' },
  { label: 'Blue', value: '#246fe0' },
  { label: 'Purple', value: '#692ec2' },
  { label: 'Pink', value: '#e05d9a' },
  { label: 'Grey', value: '#808080' },
]

export default function CreateTagModal({ onClose, onCreated }: CreateTagModalProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLOR_SWATCHES[0].value)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    try {
      const tag = await createTagFromUI(trimmed, color)
      onCreated(tag.id)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="create-tag-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Create tag"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="create-tag-modal">
        <div className="create-tag-modal__header">
          <span className="create-tag-modal__title">Add tag</span>
          <button className="create-tag-modal__close" onClick={onClose} aria-label="Close" type="button">
            <XIcon size={18} />
          </button>
        </div>

        <div className="create-tag-modal__body">
          <label className="create-tag-modal__label" htmlFor="tag-name-input">Name</label>
          <input
            id="tag-name-input"
            ref={inputRef}
            className="create-tag-modal__input"
            placeholder="tag-name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleSubmit() }}
          />
          <div className="create-tag-modal__swatches">
            {COLOR_SWATCHES.map(s => (
              <button
                key={s.value}
                type="button"
                className={`create-tag-modal__swatch${color === s.value ? ' create-tag-modal__swatch--active' : ''}`}
                style={{ background: s.value }}
                aria-label={s.label}
                onClick={() => setColor(s.value)}
              />
            ))}
          </div>
        </div>

        <div className="create-tag-modal__footer">
          <button className="create-tag-modal__btn create-tag-modal__btn--cancel" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="create-tag-modal__btn create-tag-modal__btn--submit"
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
