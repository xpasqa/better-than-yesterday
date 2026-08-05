import { todayInTimezone } from '@better/core/date'
import { upcoming as computeUpcoming } from '@better/core/views'
import { useAllLabels, useAllNodes } from '../store/use-nodes'
import type { AuthUser } from '../store/auth-api'
import TaskRow from './TaskRow'
import QuickAddBar from './QuickAddBar'
import SyncStatusBadge from './SyncStatusBadge'
import './RealView.css'

interface UpcomingRealProps {
  user: AuthUser
}

function UpcomingReal({ user }: UpcomingRealProps) {
  const nodes = useAllNodes()
  const labels = useAllLabels()
  const labelsById = new Map(labels.map((l) => [l.id, l]))
  const timezone = user.timezone ?? 'Asia/Jakarta'
  const groups = computeUpcoming(nodes, todayInTimezone(timezone))

  return (
    <div className="real-view">
      <header className="real-view__header">
        <h1>Upcoming</h1>
        <SyncStatusBadge />
      </header>

      <QuickAddBar timezone={timezone} />

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
                <TaskRow key={n.id} node={n} labelsById={labelsById} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}

export default UpcomingReal
