import { useEffect, useState } from 'react'
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react'
import { onUndoChange, clearUndo, type UndoAction } from '../store/undo-store'
import { updateNode } from '../store/node-actions'
import './UndoToast.css'

const MESSAGES: Record<UndoAction['type'], (label: string) => string> = {
  delete: (label) => `"${label}" deleted`,
  complete: (label) => `"${label}" completed`,
}

/** Global toast for the one pending undoable action (issue #76) — mounted once in App.tsx, renders nothing when there's nothing to undo. */
function UndoToast() {
  const [action, setAction] = useState<UndoAction | null>(null)
  useEffect(() => onUndoChange(setAction), [])

  if (!action) return null

  async function handleUndo() {
    if (!action) return
    // Cleared first, synchronously, so the toast disappears immediately on
    // click rather than lingering until the write below resolves.
    clearUndo()
    if (action.type === 'delete') {
      await updateNode(action.nodeId, { deletedAt: null })
    } else {
      await updateNode(action.nodeId, { completedAt: null })
    }
  }

  return (
    <div className="undo-toast" role="status">
      <span className="undo-toast__message">{MESSAGES[action.type](action.label)}</span>
      <button className="undo-toast__button" type="button" onClick={() => void handleUndo()}>
        <ArrowCounterClockwiseIcon size={14} />
        Undo
      </button>
    </div>
  )
}

export default UndoToast
