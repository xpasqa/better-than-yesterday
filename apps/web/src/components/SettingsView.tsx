import { useState } from 'react'
import type { AuthUser } from '../store/auth-api'
import { updateMe } from '../store/auth-api'
import './SettingsView.css'

interface SettingsViewProps {
  user: AuthUser
  onUserChange: (user: AuthUser) => void
}

const ALL_TIMEZONES = Intl.supportedValuesOf('timeZone')

export default function SettingsView({ user, onUserChange }: SettingsViewProps) {
  const [timezone, setTimezone] = useState(user.timezone ?? 'UTC')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const updated = await updateMe({ timezone })
      onUserChange(updated)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="settings">
      <h1 className="settings__title">Settings</h1>
      <form onSubmit={handleSave}>
        <div className="settings__field">
          <label htmlFor="timezone">Timezone</label>
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => { setTimezone(e.target.value); setSaved(false) }}
          >
            {ALL_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
          <small>Used to determine which tasks appear in Today.</small>
        </div>
        {error && <p className="settings__error">{error}</p>}
        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </button>
      </form>
      <div className="settings__readonly">
        <p>Email: {user.email}</p>
        <p>Name: {user.name}</p>
      </div>
    </main>
  )
}
