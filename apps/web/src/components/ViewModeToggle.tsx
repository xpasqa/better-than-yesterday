import { ListBulletsIcon, KanbanIcon } from '@phosphor-icons/react'
import './ViewModeToggle.css'

interface ViewModeToggleProps {
  mode: 'list' | 'board'
  onChange: (mode: 'list' | 'board') => void
}

export default function ViewModeToggle({ mode, onChange }: ViewModeToggleProps) {
  return (
    <div className="view-mode-toggle">
      <button
        className={`view-mode-toggle__btn ${mode === 'list' ? 'view-mode-toggle__btn--active' : ''}`}
        onClick={() => onChange('list')}
      >
        <ListBulletsIcon size={15} weight="bold" />
        <span>List</span>
      </button>
      <button
        className={`view-mode-toggle__btn ${mode === 'board' ? 'view-mode-toggle__btn--active' : ''}`}
        onClick={() => onChange('board')}
      >
        <KanbanIcon size={15} weight="bold" />
        <span>Board</span>
      </button>
    </div>
  )
}
