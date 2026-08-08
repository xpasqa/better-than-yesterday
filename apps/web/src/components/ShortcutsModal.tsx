import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { XIcon } from '@phosphor-icons/react'
import './ShortcutsModal.css'

interface ShortcutsModalProps {
  onClose: () => void
}

/**
 * Single source of truth for all keyboard shortcuts displayed in the modal.
 * Must stay in sync with the handler in App.tsx.
 */
const SHORTCUTS = [
  { keys: ['q', 'a'], description: 'Focus quick add' },
  { keys: ['/'], description: 'Go to Search' },
  { keys: ['g', 'i'], description: 'Go to Inbox' },
  { keys: ['g', 't'], description: 'Go to Today' },
  { keys: ['g', 'u'], description: 'Go to Upcoming' },
  { keys: ['?'], description: 'Show keyboard shortcuts' },
  { keys: ['Esc'], description: 'Close modal / dialog' },
]

export default function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <div
      className="shortcuts-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="shortcuts-modal">
        <div className="shortcuts-modal__header">
          <span className="shortcuts-modal__title">Keyboard shortcuts</span>
          <button
            className="shortcuts-modal__close"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="shortcuts-modal__body">
          <table className="shortcuts-modal__table" role="table">
            <tbody>
              {SHORTCUTS.map((s) => (
                <tr key={s.keys.join('+')} className="shortcuts-modal__row">
                  <td className="shortcuts-modal__keys">
                    {s.keys.map((k, i) => (
                      <span key={k}>
                        <kbd className="shortcuts-modal__kbd">{k}</kbd>
                        {i < s.keys.length - 1 && (
                          <span className="shortcuts-modal__then">then</span>
                        )}
                      </span>
                    ))}
                  </td>
                  <td className="shortcuts-modal__desc">{s.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body,
  )
}
