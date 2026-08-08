import { useState } from 'react'
import { logbook as computeLogbook } from '@better/core/logbook'
import { CheckCircleIcon } from '@phosphor-icons/react'
import { useAllNodes, useAllCompletions } from '../store/use-nodes'
import SyncStatusBadge from './SyncStatusBadge'
import './RealView.css'

const PAGE_SIZE = 50

function formatDateLabel(dateStr: string): string {
  // dateStr is 'YYYY-MM-DD'
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function entryDateKey(completedAt: string, occurredOn: string | null): string {
  // Occurrences use occurredOn; regular tasks derive date from completedAt ISO timestamp
  if (occurredOn) return occurredOn
  return completedAt.slice(0, 10) // 'YYYY-MM-DD'
}

function LogbookView() {
  const nodes = useAllNodes()
  const completions = useAllCompletions()
  const [limit, setLimit] = useState(PAGE_SIZE)

  const entries = computeLogbook(nodes, completions)
  const visible = entries.slice(0, limit)
  const hasMore = entries.length > limit

  // Group visible entries by date (most recent first — already sorted)
  const groups: { dateKey: string; items: typeof visible }[] = []
  for (const entry of visible) {
    const key = entryDateKey(entry.completedAt, entry.occurredOn)
    const last = groups[groups.length - 1]
    if (last && last.dateKey === key) {
      last.items.push(entry)
    } else {
      groups.push({ dateKey: key, items: [entry] })
    }
  }

  return (
    <main className="real-view">
      <div className="real-view__inner">
        <div className="real-view__header">
          <h1>Logbook</h1>
          <p className="real-view__subtitle">
            <CheckCircleIcon size={14} />
            {entries.length} {entries.length === 1 ? 'entri' : 'entri'}
            <SyncStatusBadge />
          </p>
        </div>

        {entries.length === 0 ? (
          <section className="real-view__empty" aria-label="Logbook kosong">
            <p>Belum ada yang selesai.</p>
            <p>Tugas yang kamu selesaikan — termasuk kebiasaan harian — akan tersimpan di sini selamanya.</p>
          </section>
        ) : (
          <>
            {groups.map(({ dateKey, items }) => (
              <section key={dateKey} aria-labelledby={`logbook-date-${dateKey}`}>
                <h2 id={`logbook-date-${dateKey}`} className="real-view__group-label">
                  {formatDateLabel(dateKey)}
                </h2>
                <ul className="real-view__list">
                  {items.map((entry, i) => (
                    <li
                      key={`${entry.node.id}-${entry.completedAt}-${i}`}
                      className="real-view__list-item real-view__list-item--completed"
                    >
                      <span className="real-view__check-icon">
                        <CheckCircleIcon size={16} weight="fill" />
                      </span>
                      <span className="real-view__task-title">{entry.node.content}</span>
                      {entry.occurredOn && (
                        <span className="real-view__occurrence-badge">berulang</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            {hasMore && (
              <button
                className="real-view__load-more"
                onClick={() => setLimit((l) => l + PAGE_SIZE)}
                type="button"
              >
                Muat lebih banyak
              </button>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default LogbookView
