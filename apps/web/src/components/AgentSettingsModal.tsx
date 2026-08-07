import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { XIcon } from '@phosphor-icons/react'
import './AgentSettingsModal.css'

interface AgentSettingsModalProps {
  onClose: () => void
}

interface SettingsState {
  baseUrl: string
  model: string
  apiKey: string
  hasApiKey: boolean
}

const DEFAULT_BASE_URL = 'https://aimurah.my.id/api/v1'
const DEFAULT_MODEL = 'claude-sonnet-4.5'

export default function AgentSettingsModal({ onClose }: AgentSettingsModalProps) {
  const [settings, setSettings] = useState<SettingsState>({
    baseUrl: DEFAULT_BASE_URL,
    model: DEFAULT_MODEL,
    apiKey: '',
    hasApiKey: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)

  // Load existing settings on mount
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

  useEffect(() => {
    if (!loading) firstInputRef.current?.focus()
  }, [loading])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

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
        const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
        throw new Error(data.error?.message ?? `Save failed (${res.status})`)
      }
      setSaved(true)
      setSettings(s => ({ ...s, apiKey: '', hasApiKey: s.apiKey.trim() ? true : s.hasApiKey }))
      setTimeout(() => { setSaved(false); onClose() }, 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const canSave = settings.baseUrl.trim().length > 0 && settings.model.trim().length > 0

  return createPortal(
    <div
      className="agent-settings-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Agent settings"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="agent-settings-modal">
        <div className="agent-settings-modal__header">
          <span className="agent-settings-modal__title">Agent settings</span>
          <button
            className="agent-settings-modal__close"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            <XIcon size={18} />
          </button>
        </div>

        {loading ? (
          <div className="agent-settings-modal__loading">Loading…</div>
        ) : (
          <>
            <div className="agent-settings-modal__body">
              <div className="agent-settings-modal__field">
                <label className="agent-settings-modal__label" htmlFor="agent-base-url">
                  Base URL
                </label>
                <input
                  id="agent-base-url"
                  ref={firstInputRef}
                  className="agent-settings-modal__input"
                  type="url"
                  placeholder={DEFAULT_BASE_URL}
                  value={settings.baseUrl}
                  onChange={(e) => setSettings(s => ({ ...s, baseUrl: e.target.value }))}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="agent-settings-modal__field">
                <label className="agent-settings-modal__label" htmlFor="agent-model">
                  Model
                </label>
                <input
                  id="agent-model"
                  className="agent-settings-modal__input"
                  type="text"
                  placeholder={DEFAULT_MODEL}
                  value={settings.model}
                  onChange={(e) => setSettings(s => ({ ...s, model: e.target.value }))}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="agent-settings-modal__field">
                <label className="agent-settings-modal__label" htmlFor="agent-api-key">
                  API Key
                  {settings.hasApiKey && (
                    <span className="agent-settings-modal__key-hint"> — saved, leave blank to keep</span>
                  )}
                </label>
                <input
                  id="agent-api-key"
                  className="agent-settings-modal__input"
                  type="password"
                  placeholder={settings.hasApiKey ? '••••••••••••••••' : 'Enter API key'}
                  value={settings.apiKey}
                  onChange={(e) => setSettings(s => ({ ...s, apiKey: e.target.value }))}
                  autoComplete="new-password"
                />
              </div>

              {error && <p className="agent-settings-modal__error">{error}</p>}
            </div>

            <div className="agent-settings-modal__footer">
              <button
                className="agent-settings-modal__btn agent-settings-modal__btn--cancel"
                onClick={onClose}
                type="button"
              >
                Cancel
              </button>
              <button
                className="agent-settings-modal__btn agent-settings-modal__btn--submit"
                onClick={() => void handleSave()}
                disabled={!canSave || saving || saved}
                type="button"
              >
                {saved ? 'Saved' : saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
