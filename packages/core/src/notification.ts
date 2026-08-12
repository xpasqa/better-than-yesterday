// Notification type — spec induk §3.5. Server-created only; client never
// writes this. Only action from client: PATCH to mark readAt.
// No userId here — that's server-only (added from session on sync).
export interface Notification {
  id: string
  kind: 'reminder' | 'digest' | 'overdue'
  nodeId: string | null
  title: string
  body: string
  createdAt: string   // ISO datetime
  readAt: string | null  // ISO datetime, null = unread
}
