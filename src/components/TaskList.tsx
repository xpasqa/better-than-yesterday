import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Task } from '../types'
import type { TaskContainerKind } from '../dnd/types'
import TaskItem from './TaskItem'
import SortableTaskItem from './SortableTaskItem'
import './TaskList.css'

interface TaskListProps {
  tasks: Task[]
  onToggleComplete: (id: string) => void
  onDeleteTask: (id: string) => void
  onOpenTask: (id: string) => void
  /* Omit both to render a plain, non-draggable list (used for Completed) */
  containerId?: string
  kind?: TaskContainerKind
}

export default function TaskList({ tasks, onToggleComplete, onDeleteTask, onOpenTask, containerId, kind }: TaskListProps) {
  const sortable = containerId !== undefined && kind !== undefined

  const { setNodeRef } = useDroppable({
    id: `container:${containerId ?? 'noop'}`,
    data: sortable ? { type: 'container', containerId, kind } : undefined,
    disabled: !sortable,
  })

  if (!sortable) {
    if (tasks.length === 0) return null
    return (
      <ul className="task-list">
        {tasks.map(task => (
          <TaskItem
            key={task.id}
            task={task}
            onToggleComplete={onToggleComplete}
            onDeleteTask={onDeleteTask}
            onOpenTask={onOpenTask}
          />
        ))}
      </ul>
    )
  }

  return (
    <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
      <ul className="task-list" ref={setNodeRef}>
        {tasks.map(task => (
          <SortableTaskItem
            key={task.id}
            task={task}
            containerId={containerId!}
            kind={kind!}
            onToggleComplete={onToggleComplete}
            onDeleteTask={onDeleteTask}
            onOpenTask={onOpenTask}
          />
        ))}
      </ul>
    </SortableContext>
  )
}
