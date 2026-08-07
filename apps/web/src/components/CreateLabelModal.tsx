import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { XIcon } from '@phosphor-icons/react'
import { createLabelFromUI } from '../store/label-actions'
import './CreateLabelModal.css'

interface CreateLabelModalProps {
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

export default function CreateLabelModal({ onClose, onCreated }: CreateLabelModalProps) {
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
      const label = await createLabelFromUI(trimmed, color)
      onCreated(label.id)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="create-label-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Create label"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="create-label-modal">
        <div className="create-label-modal__header">
          <span className="create-label-modal__title">Add label</span>
          <button className="create-label-modal__close" onClick={onClose} aria-label="Close" type="button">
            <XIcon size={18} />
          </button>
        </div>

        <div className="create-label-modal__body">
          <label className="create-label-modal__label" htmlFor="label-name-input">Name</label>
          <input
            id="label-name-input"
            ref={inputRef}
            className="create-label-modal__input"
            type="text"
            placeholder="Label name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit() }}
            maxLength={100}
            autoComplete="off"
          />

          <span className="create-label-modal__label">Color</span>
          <div className="create-label-modal__swatches">
            {COLOR_SWATCHES.map(s => (
              <button
                key={s.value}
                type="button"
                className={`create-label-modal__swatch${color === s.value ? ' create-label-modal__swatch--active' : ''}`}
                style={{ background: s.value }}
                aria-label={s.label}
                onClick={() => setColor(s.value)}
              />
            ))}
          </div>
        </div>

        <div className="create-label-modal__footer">
          <button className="create-label-modal__btn create-label-modal__btn--cancel" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="create-label-modal__btn create-label-modal__btn--submit"
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
