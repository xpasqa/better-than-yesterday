import { useEffect, useState } from 'react'
import { CloudArrowUpIcon, WifiSlashIcon } from '@phosphor-icons/react'
import { getSyncStatus, onSyncStatusChange, type SyncStatus } from '../store/sync-client'

/** The "Up to date / Syncing… / Offline" indicator shared by every real view. */
function SyncStatusBadge() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus())
  useEffect(() => onSyncStatusChange(setStatus), [])

  return (
    <span className="real-view__status" aria-live="polite">
      {status === 'offline' ? (
        <>
          <WifiSlashIcon size={14} /> Offline — changes saved locally
        </>
      ) : status === 'syncing' ? (
        <>
          <CloudArrowUpIcon size={14} /> Syncing…
        </>
      ) : (
        'Up to date'
      )}
    </span>
  )
}

export default SyncStatusBadge
