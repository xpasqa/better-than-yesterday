import { todayInTimezone } from '@better/core/date'
import { today as computeToday } from '@better/core/views'
import { useAllLabels, useAllNodes } from '../store/use-nodes'
import type { AuthUser } from '../store/auth-api'
import TaskRow from './TaskRow'
import QuickAddBar from './QuickAddBar'
import SyncStatusBadge from './SyncStatusBadge'
import './RealView.css'

interface TodayRealProps {
  user: AuthUser
}

function TodayReal({ user }: TodayRealProps) {
  const nodes = useAllNodes()
  const labels = useAllLabels()
  const labelsById = new Map(labels.map((l) => [l.id, l]))

  const timezone = user.timezone ?? 'Asia/Jakarta'
  const todayStr = todayInTimezone(timezone)
  const { overdue, today: dueToday } = computeToday(nodes, todayStr)

  return (
    <div className="real-view">
      <header className="real-view__header">
        <h1>Today</h1>
        <SyncStatusBadge />
      </header>

      <QuickAddBar timezone={timezone} />

      {overdue.length > 0 && (
        <section aria-labelledby="today-real-overdue">
          <h2 id="today-real-overdue" className="real-view__group-label">
            Overdue · {overdue.length}
          </h2>
          <ul className="real-view__list">
            {overdue.map((n) => (
              <TaskRow key={n.id} node={n} labelsById={labelsById} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="today-real-today">
        <h2 id="today-real-today" className="real-view__group-label">
          Today · {dueToday.length}
        </h2>
        {dueToday.length === 0 ? (
          <p className="real-view__empty">Nothing due today. Quick-add something above.</p>
        ) : (
          <ul className="real-view__list">
            {dueToday.map((n) => (
              <TaskRow key={n.id} node={n} labelsById={labelsById} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default TodayReal
