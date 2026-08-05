import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircleIcon, CircleIcon, CloudArrowUpIcon, WifiSlashIcon } from '@phosphor-icons/react'
import { todayInTimezone } from '@better/core/date'
import { today as computeToday } from '@better/core/views'
import type { Node } from '@better/core/node'
import { useAllNodes } from '../store/use-nodes'
import { createTaskFromQuickAdd, toggleTaskComplete } from '../store/node-actions'
import { getSyncStatus, onSyncStatusChange, type SyncStatus } from '../store/sync-client'
import type { AuthUser } from '../store/auth-api'
import './TodayReal.css'

interface TodayRealProps {
  user: AuthUser
}

function TaskRow({ node }: { node: Node }) {
  const done = node.completedAt !== null
  return (
    <li className={`today-real__row${done ? ' today-real__row--done' : ''}`}>
      <button
        type="button"
        className="today-real__check"
        aria-label={done ? `Mark "${node.content}" not done` : `Mark "${node.content}" done`}
        onClick={() => void toggleTaskComplete(node)}
      >
        {done ? <CheckCircleIcon size={20} weight="fill" /> : <CircleIcon size={20} />}
      </button>
      <span className="today-real__content">{node.content}</span>
      {node.dueTime && <span className="today-real__time">{node.dueTime}</span>}
      {node.priority && <span className={`today-real__priority today-real__priority--${node.priority}`} />}
    </li>
  )
}

function TodayReal({ user }: TodayRealProps) {
  const nodes = useAllNodes()
  const [quickAdd, setQuickAdd] = useState('')
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus())

  useEffect(() => onSyncStatusChange(setSyncStatus), [])

  const timezone = user.timezone ?? 'Asia/Jakarta'
  const todayStr = todayInTimezone(timezone)
  const { overdue, today: dueToday } = computeToday(nodes, todayStr)

  const handleQuickAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const text = quickAdd.trim()
    if (!text) return
    setQuickAdd('')
    await createTaskFromQuickAdd(text, { timezone, language: 'id' })
  }

  return (
    <div className="today-real">
      <header className="today-real__header">
        <h1>Today</h1>
        <span className="today-real__status" aria-live="polite">
          {syncStatus === 'offline' ? (
            <>
              <WifiSlashIcon size={14} /> Offline — changes saved locally
            </>
          ) : syncStatus === 'syncing' ? (
            <>
              <CloudArrowUpIcon size={14} /> Syncing…
            </>
          ) : (
            'Up to date'
          )}
        </span>
      </header>

      <form className="today-real__quick-add" onSubmit={(e) => void handleQuickAdd(e)}>
        <input
          value={quickAdd}
          onChange={(e) => setQuickAdd(e.target.value)}
          placeholder="beli tiket pesawat besok jam 9 #Travel $penting !1"
          aria-label="Quick add a task"
        />
        <button type="submit">Add</button>
      </form>

      {overdue.length > 0 && (
        <section aria-labelledby="today-real-overdue">
          <h2 id="today-real-overdue" className="today-real__group-label">
            Overdue · {overdue.length}
          </h2>
          <ul className="today-real__list">
            {overdue.map((n) => (
              <TaskRow key={n.id} node={n} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="today-real-today">
        <h2 id="today-real-today" className="today-real__group-label">
          Today · {dueToday.length}
        </h2>
        {dueToday.length === 0 ? (
          <p className="today-real__empty">Nothing due today. Quick-add something above.</p>
        ) : (
          <ul className="today-real__list">
            {dueToday.map((n) => (
              <TaskRow key={n.id} node={n} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default TodayReal
