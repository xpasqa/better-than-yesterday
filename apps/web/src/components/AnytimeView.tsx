import { useState } from 'react'
import { todayInTimezone } from '@better/core/date'
import { anytime as computeAnytime } from '@better/core/views'
import { CheckCircleIcon, EyeIcon, EyeSlashIcon, PlusIcon } from '@phosphor-icons/react'
import { useAllTags, useAllNodes } from '../store/use-nodes'
import type { AuthUser } from '../store/auth-api'
import { useShowCompleted } from '../hooks/useShowCompleted'
import TaskRow from './TaskRow'
import AddTaskFormReal from './AddTaskFormReal'
import SyncStatusBadge from './SyncStatusBadge'
import './RealView.css'

interface AnytimeViewProps {
  user: AuthUser
  onOpenNode?: (id: string) => void
}

function AnytimeView({ user, onOpenNode }: AnytimeViewProps) {
  const nodes = useAllNodes()
  const tags = useAllTags()
  const tagsById = new Map(tags.map((t) => [t.id, t]))
  const [addingTask, setAddingTask] = useState(false)
  const [showCompleted, toggleShowCompleted] = useShowCompleted()

  const timezone = user.timezone ?? 'Asia/Jakarta'
  const todayStr = todayInTimezone(timezone)
  const items = computeAnytime(nodes, todayStr, showCompleted)

  return (
    <main className="real-view">
      <div className="real-view__inner">
        <div className="real-view__header">
          <h1>Anytime</h1>
          <p className="real-view__subtitle">
            <CheckCircleIcon size={14} />
            {items.length} {items.length === 1 ? 'task' : 'tasks'}
            <SyncStatusBadge />
            <button
              className="real-view__toggle-completed"
              onClick={toggleShowCompleted}
              type="button"
              aria-pressed={showCompleted}
              title={showCompleted ? 'Hide completed tasks' : 'Show completed tasks'}
            >
              {showCompleted ? <EyeSlashIcon size={14} /> : <EyeIcon size={14} />}
              {showCompleted ? 'Hide completed' : 'Show completed'}
            </button>
          </p>
        </div>

        <section aria-labelledby="anytime-tasks">
          <h2 id="anytime-tasks" className="real-view__group-label">
            Anytime · {items.length}
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

export default AnytimeView
