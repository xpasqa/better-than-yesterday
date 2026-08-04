
import type { Task } from '../types'
import TaskItem from './TaskItem'
import './TaskList.css'

interface TaskListProps {
  tasks: Task[]
  onToggleComplete: (id: string) => void
  onDeleteTask: (id: string) => void
  onOpenTask: (id: string) => void
}

export default function TaskList({ tasks, onToggleComplete, onDeleteTask, onOpenTask }: TaskListProps) {
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
