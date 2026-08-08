import { useState } from 'react'
import { todayInTimezone } from '@better/core/date'
import { upcoming as computeUpcoming } from '@better/core/views'
import { CheckCircleIcon, PlusIcon } from '@phosphor-icons/react'
import { useAllLabels, useAllNodes } from '../store/use-nodes'
import type { AuthUser } from '../store/auth-api'
import TaskRow from './TaskRow'
import AddTaskFormReal from './AddTaskFormReal'
import SyncStatusBadge from './SyncStatusBadge'
import './RealView.css'

interface UpcomingRealProps {
  user: AuthUser
  onOpenNode?: (id: string) => void
}

function UpcomingReal({ user, onOpenNode }: UpcomingRealProps) {
  const nodes = useAllNodes()
  const labels = useAllLabels()
  const labelsById = new Map(labels.map((l) => [l.id, l]))
  const [addingTask, setAddingTask] = useState(false)
  const timezone = user.timezone ?? 'Asia/Jakarta'
  const groups = computeUpcoming(nodes, todayInTimezone(timezone))
  const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0)

  return (
    <main className="real-view">
      <div className="real-view__inner">
        <div className="real-view__header">
          <h1>Upcoming</h1>
          <p className="real-view__subtitle">
            <CheckCircleIcon size={14} />
            {totalCount} {totalCount === 1 ? 'task' : 'tasks'}
            <SyncStatusBadge />
          </p>
        </div>

        {groups.length === 0 ? (
          <p className="real-view__empty">Nothing scheduled after today.</p>
        ) : (
          groups.map((group) => (
            <section key={group.date} aria-labelledby={`upcoming-${group.date}`}>
              <h2 id={`upcoming-${group.date}`} className="real-view__group-label">
                {group.date}
              </h2>
              <ul className="real-view__list">
                {group.items.map((n) => (
                  <TaskRow key={n.id} node={n} labelsById={labelsById} allNodes={nodes} onOpenNode={onOpenNode ? (n) => onOpenNode(n.id) : undefined} timezone={timezone} />
                ))}
              </ul>
            </section>
          ))
        )}

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

export default UpcomingReal
