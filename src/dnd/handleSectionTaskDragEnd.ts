import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { Section } from '../types'
import type { DragItemData } from './types'

interface DragEndContext {
  projectSections: Section[]
  defaultProjectId: string
  onReorderSections: (projectId: string, orderedSectionIds: string[]) => void
  onMoveTask: (taskId: string, beforeTaskId?: string, sectionId?: string | null) => void
}

/* Shared onDragEnd for both List and Board — each mounts its own DndContext, but never at the same time */
export function handleSectionTaskDragEnd(event: DragEndEvent, ctx: DragEndContext) {
  const { active, over } = event
  if (!over || active.id === over.id) return

  const activeData = active.data.current as DragItemData | undefined
  const overData = over.data.current as DragItemData | undefined
  if (!activeData) return

  if (activeData.type === 'section') {
    if (overData?.type !== 'section') return
    const ids = ctx.projectSections.map(s => s.id)
    const oldIndex = ids.indexOf(active.id as string)
    const newIndex = ids.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return
    ctx.onReorderSections(ctx.defaultProjectId, arrayMove(ids, oldIndex, newIndex))
    return
  }

  if (activeData.type === 'task') {
    if (!overData || overData.type === 'section') return
    const targetContainerId = overData.containerId
    if (activeData.kind === 'reorder-only' && targetContainerId !== activeData.containerId) return

    const beforeTaskId = overData.type === 'task' ? (over.id as string) : undefined
    const sectionId = activeData.kind === 'section-grouped'
      ? (targetContainerId === 'none' ? null : targetContainerId)
      : undefined

    ctx.onMoveTask(active.id as string, beforeTaskId, sectionId)
  }
}
