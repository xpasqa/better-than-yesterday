/*
 * 'section-grouped' containers (a named section, or the "No Section" bucket)
 * accept cross-container drops and translate them into a sectionId change.
 * 'reorder-only' containers (Overdue, the Today bucket, a flat view, a Board
 * Date-mode column) only accept reordering within themselves — dropping a
 * task from one into another has no defined meaning (it would imply
 * changing the task's due date) and is rejected.
 */
export type TaskContainerKind = 'section-grouped' | 'reorder-only'

export type DragItemData =
  | { type: 'section' }
  | { type: 'task'; containerId: string; kind: TaskContainerKind }
  | { type: 'container'; containerId: string; kind: TaskContainerKind }
