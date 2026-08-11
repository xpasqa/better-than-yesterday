// Session-only, one-slot undo (issue #76 — docs/feature/29.undo/spec.md).
// Not a history stack: a new undoable action always replaces the pending
// one. State lives in memory only — a reload silently discards it (spec §2).
export interface UndoAction {
  type: 'delete' | 'complete'
  nodeId: string
  label: string
}

type Listener = (action: UndoAction | null) => void
const listeners = new Set<Listener>()
let pending: UndoAction | null = null
let dismissTimer: ReturnType<typeof setTimeout> | undefined

const TOAST_DURATION_MS = 5000

function notify(): void {
  for (const listener of listeners) listener(pending)
}

/** Records a new undoable action, replacing whatever was pending, and (re)starts the 5s auto-dismiss timer. */
export function recordUndo(action: UndoAction): void {
  pending = action
  notify()
  if (dismissTimer) clearTimeout(dismissTimer)
  dismissTimer = setTimeout(() => {
    pending = null
    notify()
  }, TOAST_DURATION_MS)
}

/** Clears the pending action without performing it — called once the user has undone it, so the toast disappears immediately instead of waiting out the timer. */
export function clearUndo(): void {
  if (dismissTimer) clearTimeout(dismissTimer)
  pending = null
  notify()
}

export function getPendingUndo(): UndoAction | null {
  return pending
}

export function onUndoChange(listener: Listener): () => void {
  listeners.add(listener)
  listener(pending)
  return () => listeners.delete(listener)
}
