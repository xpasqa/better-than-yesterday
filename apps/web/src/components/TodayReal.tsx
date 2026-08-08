import { useState } from 'react'
import { todayInTimezone } from '@better/core/date'
import { today as computeToday } from '@better/core/views'
import { CheckCircleIcon, EyeIcon, EyeSlashIcon, PlusIcon } from '@phosphor-icons/react'
import { useAllTags, useAllNodes } from '../store/use-nodes'
import type { AuthUser } from '../store/auth-api'
import { useShowCompleted } from '../hooks/useShowCompleted'
import TaskRow from './TaskRow'
import AddTaskFormReal from './AddTaskFormReal'
import SyncStatusBadge from './SyncStatusBadge'
import './RealView.css'

interface TodayRealProps {
  user: AuthUser
  onOpenNode?: (id: string) => void
}

function TodayReal({ user, onOpenNode }: TodayRealProps) {
  const nodes = useAllNodes()
  const tags = useAllTags()
  const tagsById = new Map(tags.map((t) => [t.id, t]))
  const [addingTask, setAddingTask] = useState(false)
  const [showCompleted, toggleShowCompleted] = useShowCompleted()

  const timezone = user.timezone ?? 'Asia/Jakarta'
  const todayStr = todayInTimezone(timezone)
  const { overdue, today: dueToday } = computeToday(nodes, todayStr, showCompleted)
  const openCount = overdue.length + dueToday.length

  const now = new Date()
  const dayLabel = `${now.getDate()} ${now.toLocaleDateString('en-US', { month: 'short' })} ‧ Today ‧ ${now.toLocaleDateString('en-US', { weekday: 'long' })}`

  return (
    <main className="real-view">
      <div className="real-view__inner">
        <div className="real-view__header">
          <h1>{dayLabel}</h1>
          <p className="real-view__subtitle">
            <CheckCircleIcon size={14} />
            {openCount} {openCount === 1 ? 'task' : 'tasks'}
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

        {overdue.length > 0 && (
          <section aria-labelledby="today-real-overdue">
            <h2 id="today-real-overdue" className="real-view__group-label">
              Overdue · {overdue.length}
            </h2>
            <ul className="real-view__list">
              {overdue.map((n) => (
                <TaskRow key={n.id} node={n} tagsById={tagsById} allNodes={nodes} onOpenNode={onOpenNode ? (n) => onOpenNode(n.id) : undefined} timezone={timezone} />
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="today-real-today">
          <h2 id="today-real-today" className="real-view__group-label">
            Today · {dueToday.length}
          </h2>
          {dueToday.length > 0 && (
            <ul className="real-view__list">
              {dueToday.map((n) => (
                <TaskRow key={n.id} node={n} tagsById={tagsById} allNodes={nodes} onOpenNode={onOpenNode ? (n) => onOpenNode(n.id) : undefined} timezone={timezone} />
              ))}
            </ul>
          )}
        </section>

        {addingTask ? (
          <AddTaskFormReal
            timezone={timezone}
            defaultDueDate={todayStr}
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

export default TodayReal
