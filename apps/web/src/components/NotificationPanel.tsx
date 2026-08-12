// NotificationPanel — dropdown anchored to the bell button in Sidebar.tsx.
// Reads from db.notifications (Dexie); marks individual notifications read via
// PATCH /api/notifications/:id/read. No server state — all reads come from
// the local Dexie table, same as every other entity in this app.
import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BellIcon, XIcon } from '@phosphor-icons/react'
import { db } from '../store/db'
import type { Notification } from '@better/core/notification'
import './NotificationPanel.css'

interface NotificationPanelProps {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  onClose: () => void
}

async function markRead(id: string): Promise<void> {
  await fetch(`/api/notifications/${id}/read`, {
    method: 'PATCH',
    credentials: 'include',
  })
  // Optimistically update local Dexie row so the dot disappears instantly.
  const existing = await db.notifications.get(id)
  if (existing) {
    await db.notifications.put({ ...existing, readAt: new Date().toISOString() })
  }
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function NotificationPanel({ anchorRef, onClose }: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})

  const notifications = useLiveQuery(
    () => db.notifications.orderBy('createdAt').reverse().limit(50).toArray(),
    [],
    [] as Notification[],
  )

  // Position the panel below the anchor button.
  useEffect(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    setPanelStyle({
      top: rect.bottom + 8,
      left: Math.max(8, rect.left - 280 + rect.width),
    })
  }, [anchorRef])

  // Close on outside click.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [anchorRef, onClose])

  // Close on Escape.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const isEmpty = !notifications || notifications.length === 0

  return (
    <div
      ref={panelRef}
      className="notif-panel"
      role="dialog"
      aria-label="Notifications"
      style={panelStyle}
    >
      <div className="notif-panel__header">
        <span className="notif-panel__title">Notifications</span>
        <button
          className="notif-panel__close"
          onClick={onClose}
          aria-label="Close notifications"
          type="button"
        >
          <XIcon size={16} />
        </button>
      </div>

      <ul className="notif-panel__list" role="list">
        {isEmpty ? (
          <li className="notif-panel__empty">
            <BellIcon size={24} weight="light" />
            <span>No notifications</span>
          </li>
        ) : (
          notifications!.map((n) => (
            <li key={n.id} className={`notif-panel__item${n.readAt ? '' : ' notif-panel__item--unread'}`}>
              <button
                className="notif-panel__item-btn"
                type="button"
                onClick={() => {
                  if (!n.readAt) void markRead(n.id)
                }}
              >
                <div className="notif-panel__item-body">
                  <span className="notif-panel__item-title">{n.title}</span>
                  {n.body && <span className="notif-panel__item-text">{n.body}</span>}
                </div>
                <span className="notif-panel__item-time">{timeAgo(n.createdAt)}</span>
                {!n.readAt && <span className="notif-panel__unread-dot" aria-hidden="true" />}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
