import { useEffect, useRef, useState } from 'react'
import type { AuthUser } from '../store/auth-api'
import { updateMe } from '../store/auth-api'
import {
  getMailAccount,
  saveMailAccount,
  testMailAccount,
  deleteMailAccount,
  type MailAccountConfig,
  type MailSaveParams,
} from '../api/mail'
import './SettingsView.css'

type TabId = 'profile' | 'agent' | 'mail'

interface SettingsViewProps {
  user: AuthUser
  onUserChange: (user: AuthUser) => void
  initialTab?: TabId
}

// ─── Profile Tab ────────────────────────────────────────────────────────────

const ALL_TIMEZONES = Intl.supportedValuesOf('timeZone')

function ProfileTab({ user, onUserChange }: { user: AuthUser; onUserChange: (u: AuthUser) => void }) {
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
    <>
      <h2 className="settings__section-title">Profile</h2>
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
    </>
  )
}

// ─── Agent AI Tab ────────────────────────────────────────────────────────────

interface AgentSettingsState {
  baseUrl: string
  model: string
  apiKey: string
  hasApiKey: boolean
}

const DEFAULT_BASE_URL = 'https://aimurah.my.id/api/v1'
const DEFAULT_MODEL = 'claude-sonnet-4.5'

function AgentTab() {
  const [settings, setSettings] = useState<AgentSettingsState>({
    baseUrl: DEFAULT_BASE_URL,
    model: DEFAULT_MODEL,
    apiKey: '',
    hasApiKey: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/agent/settings', { credentials: 'include' })
      .then(r => r.json())
      .then((body: { settings: { baseUrl: string; model: string; hasApiKey: boolean } }) => {
        setSettings(s => ({
          ...s,
          baseUrl: body.settings.baseUrl,
          model: body.settings.model,
          hasApiKey: body.settings.hasApiKey,
        }))
      })
      .catch(() => { /* keep defaults */ })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (saving) return
    setError(null)
    setSaving(true)
    try {
      const body: Record<string, string> = {
        baseUrl: settings.baseUrl.trim(),
        model: settings.model.trim(),
      }
      if (settings.apiKey.trim()) {
        body.apiKey = settings.apiKey.trim()
      }
      const res = await fetch('/api/agent/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const canSave = settings.baseUrl.trim().length > 0 && settings.model.trim().length > 0

  if (loading) return <div className="settings__loading">Loading…</div>

  return (
    <>
      <h2 className="settings__section-title">Agent AI</h2>
      <div className="settings__field">
        <label htmlFor="agent-base-url">Base URL</label>
        <input
          id="agent-base-url"
          type="url"
          placeholder={DEFAULT_BASE_URL}
          value={settings.baseUrl}
          onChange={(e) => setSettings(s => ({ ...s, baseUrl: e.target.value }))}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="settings__field">
        <label htmlFor="agent-model">Model</label>
        <input
          id="agent-model"
          type="text"
          placeholder={DEFAULT_MODEL}
          value={settings.model}
          onChange={(e) => setSettings(s => ({ ...s, model: e.target.value }))}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="settings__field">
        <label htmlFor="agent-api-key">
          API Key
          {settings.hasApiKey && (
            <span className="settings__key-hint"> — leave blank to keep current</span>
          )}
        </label>
        <input
          id="agent-api-key"
          type="password"
          placeholder={settings.hasApiKey ? '••••••••' : 'sk-…'}
          value={settings.apiKey}
          onChange={(e) => setSettings(s => ({ ...s, apiKey: e.target.value }))}
          autoComplete="new-password"
        />
      </div>

      {error && <p className="settings__error">{error}</p>}

      <div className="settings__actions">
        <button
          onClick={() => void handleSave()}
          disabled={!canSave || saving || saved}
          type="button"
        >
          {saved ? 'Saved' : saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </>
  )
}

// ─── Mail Account Tab ────────────────────────────────────────────────────────

interface MailFormState {
  email: string
  password: string
  imapHost: string
  imapPort: string
  smtpHost: string
  smtpPort: string
  hasPassword: boolean
}

const EMPTY_MAIL_FORM: MailFormState = {
  email: '',
  password: '',
  imapHost: '',
  imapPort: '993',
  smtpHost: '',
  smtpPort: '587',
  hasPassword: false,
}

function mailErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return 'Unknown error'
  const code = (err as Error & { code?: string }).code
  if (code === 'MAIL_AUTH_FAILED') return 'Authentication failed. Check email and password.'
  if (code === 'MAIL_UNAVAILABLE') return 'Mail server unavailable. Check host and port.'
  if (code === 'MAIL_FOLDERS_UNRESOLVED') return 'Connected but could not detect folders. Check server config.'
  return err.message
}

function MailTab() {
  const [form, setForm] = useState<MailFormState>(EMPTY_MAIL_FORM)
  const [existing, setExisting] = useState<MailAccountConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getMailAccount()
      .then((account) => {
        setExisting(account)
        if (account) {
          setForm({
            email: account.email,
            password: '',
            imapHost: account.imapHost,
            imapPort: String(account.imapPort),
            smtpHost: account.smtpHost,
            smtpPort: String(account.smtpPort),
            hasPassword: account.hasPassword,
          })
        }
      })
      .catch(() => { /* keep empty form */ })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!loading) firstInputRef.current?.focus()
  }, [loading])

  const buildParams = (): MailSaveParams => ({
    email: form.email.trim(),
    imapHost: form.imapHost.trim(),
    imapPort: parseInt(form.imapPort, 10) || 993,
    smtpHost: form.smtpHost.trim(),
    smtpPort: parseInt(form.smtpPort, 10) || 587,
    ...(form.password.trim() ? { password: form.password.trim() } : {}),
  })

  const handleTest = async () => {
    if (testing) return
    setError(null)
    setTestResult(null)
    setTesting(true)
    try {
      const result = await testMailAccount(buildParams())
      setTestResult({ ok: result.ok, message: result.ok ? 'Connection successful.' : 'Connection failed.' })
    } catch (err) {
      setTestResult({ ok: false, message: mailErrorMessage(err) })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (saving) return
    setError(null)
    setSaving(true)
    try {
      await saveMailAccount(buildParams())
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(mailErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    if (removing) return
    setError(null)
    setRemoving(true)
    try {
      await deleteMailAccount()
      setExisting(null)
      setForm(EMPTY_MAIL_FORM)
    } catch (err) {
      setError(mailErrorMessage(err))
      setRemoving(false)
    }
  }

  const set = (field: keyof MailFormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const canSave =
    form.email.trim().length > 0 &&
    form.imapHost.trim().length > 0 &&
    form.smtpHost.trim().length > 0

  if (loading) return <div className="settings__loading">Loading…</div>

  return (
    <>
      <h2 className="settings__section-title">Mail Account</h2>

      <div className="settings__field">
        <label htmlFor="mail-email">Email address</label>
        <input
          id="mail-email"
          ref={firstInputRef}
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={set('email')}
          autoComplete="email"
          spellCheck={false}
        />
      </div>

      <div className="settings__field">
        <label htmlFor="mail-password">
          Password
          {form.hasPassword && (
            <span className="settings__key-hint"> — leave blank to keep current</span>
          )}
        </label>
        <input
          id="mail-password"
          type="password"
          placeholder={form.hasPassword ? '••••••••' : 'App password or account password'}
          value={form.password}
          onChange={set('password')}
          autoComplete="new-password"
        />
      </div>

      <div className="settings__row">
        <div className="settings__field settings__field--grow">
          <label htmlFor="mail-imap-host">IMAP host</label>
          <input
            id="mail-imap-host"
            type="text"
            placeholder="imap.example.com"
            value={form.imapHost}
            onChange={set('imapHost')}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="settings__field settings__field--port">
          <label htmlFor="mail-imap-port">Port</label>
          <input
            id="mail-imap-port"
            type="number"
            min={1}
            max={65535}
            value={form.imapPort}
            onChange={set('imapPort')}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="settings__row">
        <div className="settings__field settings__field--grow">
          <label htmlFor="mail-smtp-host">SMTP host</label>
          <input
            id="mail-smtp-host"
            type="text"
            placeholder="smtp.example.com"
            value={form.smtpHost}
            onChange={set('smtpHost')}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="settings__field settings__field--port">
          <label htmlFor="mail-smtp-port">Port</label>
          <input
            id="mail-smtp-port"
            type="number"
            min={1}
            max={65535}
            value={form.smtpPort}
            onChange={set('smtpPort')}
            autoComplete="off"
          />
        </div>
      </div>

      {testResult && (
        <p className={testResult.ok ? 'settings__test-ok' : 'settings__error'}>
          {testResult.message}
        </p>
      )}
      {error && <p className="settings__error">{error}</p>}

      <div className="settings__actions">
        {existing && (
          <button
            className="settings__btn--danger"
            onClick={() => void handleRemove()}
            disabled={removing}
            type="button"
          >
            {removing ? 'Removing…' : 'Remove account'}
          </button>
        )}
        <div className="settings__actions-right">
          <button
            onClick={() => void handleTest()}
            disabled={testing || !canSave}
            type="button"
          >
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={!canSave || saving || saved}
            type="button"
          >
            {saved ? 'Saved' : saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Main SettingsView ───────────────────────────────────────────────────────

export default function SettingsView({ user, onUserChange, initialTab = 'profile' }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)

  return (
    <main className="settings">
      <h1 className="settings__title">Settings</h1>
      <div className="settings__layout">
        <nav className="settings__nav">
          <button
            className={`settings__nav-item${activeTab === 'profile' ? ' settings__nav-item--active' : ''}`}
            onClick={() => setActiveTab('profile')}
            type="button"
          >
            Profile
          </button>
          <button
            className={`settings__nav-item${activeTab === 'agent' ? ' settings__nav-item--active' : ''}`}
            onClick={() => setActiveTab('agent')}
            type="button"
          >
            Agent AI
          </button>
          <button
            className={`settings__nav-item${activeTab === 'mail' ? ' settings__nav-item--active' : ''}`}
            onClick={() => setActiveTab('mail')}
            type="button"
          >
            Mail Account
          </button>
        </nav>
        <div className="settings__content">
          {activeTab === 'profile' && <ProfileTab user={user} onUserChange={onUserChange} />}
          {activeTab === 'agent' && <AgentTab />}
          {activeTab === 'mail' && <MailTab />}
        </div>
      </div>
    </main>
  )
}
