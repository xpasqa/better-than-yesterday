import { useState } from 'react'
import { inbox as computeInbox } from '@better/core/views'
import { findInbox } from '@better/core/node'
import { CheckCircleIcon, PlusIcon } from '@phosphor-icons/react'
import { useAllLabels, useAllNodes } from '../store/use-nodes'
import type { AuthUser } from '../store/auth-api'
import TaskRow from './TaskRow'
import AddTaskFormReal from './AddTaskFormReal'
import SyncStatusBadge from './SyncStatusBadge'
import './RealView.css'

interface InboxRealProps {
  user: AuthUser
  onOpenNode?: (id: string) => void
}

function InboxReal({ user, onOpenNode }: InboxRealProps) {
  const nodes = useAllNodes()
  const labels = useAllLabels()
  const labelsById = new Map(labels.map((l) => [l.id, l]))
  const [addingTask, setAddingTask] = useState(false)

  const items = computeInbox(nodes)
  const inboxId = findInbox(nodes)?.id ?? null

  return (
    <main className="real-view">
      <div className="real-view__inner">
        <div className="real-view__header">
          <h1>Inbox</h1>
          <p className="real-view__subtitle">
            <CheckCircleIcon size={14} />
            {items.length} {items.length === 1 ? 'task' : 'tasks'}
            <SyncStatusBadge />
          </p>
        </div>

        {items.length > 0 && (
          <ul className="real-view__list">
            {items.map((n) => (
              <TaskRow key={n.id} node={n} labelsById={labelsById} allNodes={nodes} onOpenNode={onOpenNode ? (n) => onOpenNode(n.id) : undefined} timezone={user.timezone ?? 'Asia/Jakarta'} />
            ))}
          </ul>
        )}

        {addingTask ? (
          <AddTaskFormReal
            timezone={user.timezone ?? 'Asia/Jakarta'}
            defaultParentId={inboxId}
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

export default InboxReal
