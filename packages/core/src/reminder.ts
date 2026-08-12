// Reminder type — spec induk §3.4. fireAt is computed client-side from
// dueDate/dueTime/offsetMin in the user's timezone (see reminder-actions.ts).
// No userId here — that's server-only (added from session on sync).
export interface Reminder {
  id: string
  nodeId: string
  kind: 'absolute' | 'relative'
  remindAt: string | null   // ISO datetime, kind='absolute'
  offsetMin: number | null  // minutes before due, kind='relative'
  fireAt: string            // ISO datetime — computed client-side
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}
