import { useState } from 'react'
import { someday as computeSomeday } from '@better/core/views'
import { CheckCircleIcon, PlusIcon } from '@phosphor-icons/react'
import { useAllTags, useAllNodes } from '../store/use-nodes'
import type { AuthUser } from '../store/auth-api'
import TaskRow from './TaskRow'
import AddTaskFormReal from './AddTaskFormReal'
import SyncStatusBadge from './SyncStatusBadge'
import './RealView.css'

interface SomedayViewProps {
  user: AuthUser
  onOpenNode?: (id: string) => void
}

function SomedayView({ user, onOpenNode }: SomedayViewProps) {
  const nodes = useAllNodes()
  const tags = useAllTags()
  const tagsById = new Map(tags.map((t) => [t.id, t]))
  const [addingTask, setAddingTask] = useState(false)

  const timezone = user.timezone ?? 'Asia/Jakarta'
  const items = computeSomeday(nodes)

  return (
    <main className="real-view">
      <div className="real-view__inner">
        <div className="real-view__header">
          <h1>Someday</h1>
          <p className="real-view__subtitle">
            <CheckCircleIcon size={14} />
            {items.length} {items.length === 1 ? 'task' : 'tasks'}
            <SyncStatusBadge />
          </p>
        </div>

        <section aria-labelledby="someday-tasks">
          <h2 id="someday-tasks" className="real-view__group-label">
            Someday · {items.length}
          </h2>
          {items.length > 0 && (
            <ul className="real-view__list">
              {items.map((n) => (
                <TaskRow
                  key={n.id}
                  node={n}
                  tagsById={tagsById}
                  allNodes={nodes}
                  onOpenNode={onOpenNode ? (n) => onOpenNode(n.id) : undefined}
                  timezone={timezone}
                />
              ))}
            </ul>
          )}
        </section>

        {addingTask ? (
          <AddTaskFormReal
            timezone={timezone}
            onCancel={() => setAddingTask(false)}
            onAdded={() => setAddingTask(false)}
          />
        ) : (
          <button className="real-view__add-task-btn" onClick={() => setAddingTask(true)} type="button">
            <PlusIcon size={16} weight="bold" />
            Add task
          </button>
        )}
      </div>
    </main>
  )
}

export default SomedayView
