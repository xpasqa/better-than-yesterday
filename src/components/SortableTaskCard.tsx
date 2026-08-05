import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '../types'
import type { TaskContainerKind } from '../dnd/types'
import TaskCard from './TaskCard'

interface SortableTaskCardProps {
  task: Task
  containerId: string
  kind: TaskContainerKind
  onToggleComplete: (id: string) => void
  onOpenTask: (id: string) => void
}

export default function SortableTaskCard({ task, containerId, kind, ...handlers }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: task.id,
    data: { type: 'task', containerId, kind },
  })

  return (
    <TaskCard
      task={task}
      {...handlers}
      sortableRef={setNodeRef}
      sortableStyle={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      dragAttributes={attributes}
      dragListeners={listeners}
      isDropTarget={isOver && !isDragging}
    />
  )
}
