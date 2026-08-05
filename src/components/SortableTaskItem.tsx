import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '../types'
import type { TaskContainerKind } from '../dnd/types'
import TaskItem from './TaskItem'

interface SortableTaskItemProps {
  task: Task
  containerId: string
  kind: TaskContainerKind
  onToggleComplete: (id: string) => void
  onDeleteTask: (id: string) => void
  onOpenTask: (id: string) => void
}

export default function SortableTaskItem({ task, containerId, kind, ...handlers }: SortableTaskItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: task.id,
    data: { type: 'task', containerId, kind },
  })

  return (
    <TaskItem
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
