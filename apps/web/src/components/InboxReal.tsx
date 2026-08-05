import { inbox as computeInbox } from '@better/core/views'
import { findInbox } from '@better/core/node'
import { useAllLabels, useAllNodes } from '../store/use-nodes'
import type { AuthUser } from '../store/auth-api'
import TaskRow from './TaskRow'
import QuickAddBar from './QuickAddBar'
import SyncStatusBadge from './SyncStatusBadge'
import './RealView.css'

interface InboxRealProps {
  user: AuthUser
}

function InboxReal({ user }: InboxRealProps) {
  const nodes = useAllNodes()
  const labels = useAllLabels()
  const labelsById = new Map(labels.map((l) => [l.id, l]))
  const items = computeInbox(nodes)
  const inboxId = findInbox(nodes)?.id ?? null

  return (
    <div className="real-view">
      <header className="real-view__header">
        <h1>Inbox</h1>
        <SyncStatusBadge />
      </header>

      <QuickAddBar timezone={user.timezone ?? 'Asia/Jakarta'} defaultParentId={inboxId} />

      {items.length === 0 ? (
        <p className="real-view__empty">Inbox is empty. Anything without a #project lands here.</p>
      ) : (
        <ul className="real-view__list">
          {items.map((n) => (
            <TaskRow key={n.id} node={n} labelsById={labelsById} />
          ))}
        </ul>
      )}
    </div>
  )
}

export default InboxReal
