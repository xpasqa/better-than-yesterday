// The sidebar's "+ Add task" button used to do nothing — no onClick was
// ever wired to it. This is the fix: a centered modal wrapping the same
// AddTaskFormReal used inline elsewhere, reachable from any view.
import { createPortal } from 'react-dom'
import AddTaskFormReal from './AddTaskFormReal'
import './QuickAddModal.css'

interface QuickAddModalProps {
  timezone: string
  onClose: () => void
}

export default function QuickAddModal({ timezone, onClose }: QuickAddModalProps) {
  return createPortal(
    <div
      className="quick-add-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Add task"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="quick-add-modal">
        <AddTaskFormReal timezone={timezone} onCancel={onClose} onAdded={onClose} />
      </div>
    </div>,
    document.body,
  )
}
