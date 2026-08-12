import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { XIcon } from '@phosphor-icons/react'
import {
  getMailAccount,
  saveMailAccount,
  testMailAccount,
  deleteMailAccount,
  type MailAccountConfig,
  type MailSaveParams,
} from '../api/mail'
import './MailSettingsModal.css'

interface MailSettingsModalProps {
  onClose: () => void
}

interface FormState {
  email: string
  password: string
  imapHost: string
  imapPort: string
  smtpHost: string
  smtpPort: string
  hasPassword: boolean
}

const EMPTY_FORM: FormState = {
  email: '',
  password: '',
  imapHost: '',
  imapPort: '993',
  smtpHost: '',
  smtpPort: '587',
  hasPassword: false,
}

function errorMessage(err: unknown): string {
  if (!(err instanceof Error)) return 'Unknown error'
  const code = (err as Error & { code?: string }).code
  if (code === 'MAIL_AUTH_FAILED') return 'Authentication failed. Check email and password.'
  if (code === 'MAIL_UNAVAILABLE') return 'Mail server unavailable. Check host and port.'
  if (code === 'MAIL_FOLDERS_UNRESOLVED') return 'Connected but could not detect folders. Check server config.'
  return err.message
}

export default function MailSettingsModal({ onClose }: MailSettingsModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

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
      setTestResult({ ok: false, message: errorMessage(err) })
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
      setTimeout(() => { setSaved(false); onClose() }, 800)
    } catch (err) {
      setError(errorMessage(err))
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
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setRemoving(false)
    }
  }

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const canSave =
    form.email.trim().length > 0 &&
    form.imapHost.trim().length > 0 &&
    form.smtpHost.trim().length > 0 &&
    (form.hasPassword || form.password.trim().length > 0 || existing === null ? true : true)

  return createPortal(
    <div
      className="mail-settings-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Mail settings"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="mail-settings-modal">
        <div className="mail-settings-modal__header">
          <span className="mail-settings-modal__title">Mail account</span>
          <button
            className="mail-settings-modal__close"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            <XIcon size={18} />
          </button>
        </div>

        {loading ? (
          <div className="mail-settings-modal__loading">Loading…</div>
        ) : (
          <>
            <div className="mail-settings-modal__body">
              <div className="mail-settings-modal__field">
                <label className="mail-settings-modal__label" htmlFor="mail-email">
                  Email address
                </label>
                <input
                  id="mail-email"
                  ref={firstInputRef}
                  className="mail-settings-modal__input"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={set('email')}
                  autoComplete="email"
                  spellCheck={false}
                />
              </div>

              <div className="mail-settings-modal__field">
                <label className="mail-settings-modal__label" htmlFor="mail-password">
                  Password
                  {form.hasPassword && (
                    <span className="mail-settings-modal__key-hint"> — leave blank to keep current</span>
                  )}
                </label>
                <input
                  id="mail-password"
                  className="mail-settings-modal__input"
                  type="password"
                  placeholder={form.hasPassword ? '••••••••' : 'App password or account password'}
                  value={form.password}
                  onChange={set('password')}
                  autoComplete="new-password"
                />
              </div>

              <div className="mail-settings-modal__row">
                <div className="mail-settings-modal__field mail-settings-modal__field--grow">
                  <label className="mail-settings-modal__label" htmlFor="mail-imap-host">
                    IMAP host
                  </label>
                  <input
                    id="mail-imap-host"
                    className="mail-settings-modal__input"
                    type="text"
                    placeholder="imap.example.com"
                    value={form.imapHost}
                    onChange={set('imapHost')}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <div className="mail-settings-modal__field mail-settings-modal__field--port">
                  <label className="mail-settings-modal__label" htmlFor="mail-imap-port">
                    Port
                  </label>
                  <input
                    id="mail-imap-port"
                    className="mail-settings-modal__input"
                    type="number"
                    min={1}
                    max={65535}
                    value={form.imapPort}
                    onChange={set('imapPort')}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="mail-settings-modal__row">
                <div className="mail-settings-modal__field mail-settings-modal__field--grow">
                  <label className="mail-settings-modal__label" htmlFor="mail-smtp-host">
                    SMTP host
                  </label>
                  <input
                    id="mail-smtp-host"
                    className="mail-settings-modal__input"
                    type="text"
                    placeholder="smtp.example.com"
                    value={form.smtpHost}
                    onChange={set('smtpHost')}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <div className="mail-settings-modal__field mail-settings-modal__field--port">
                  <label className="mail-settings-modal__label" htmlFor="mail-smtp-port">
                    Port
                  </label>
                  <input
                    id="mail-smtp-port"
                    className="mail-settings-modal__input"
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
                <p className={`mail-settings-modal__test-result ${testResult.ok ? 'mail-settings-modal__test-result--ok' : 'mail-settings-modal__test-result--fail'}`}>
                  {testResult.message}
                </p>
              )}
              {error && <p className="mail-settings-modal__error">{error}</p>}
            </div>

            <div className="mail-settings-modal__footer">
              {existing && (
                <button
                  className="mail-settings-modal__btn mail-settings-modal__btn--remove"
                  onClick={() => void handleRemove()}
                  disabled={removing}
                  type="button"
                >
                  {removing ? 'Removing…' : 'Remove account'}
                </button>
              )}
              <div className="mail-settings-modal__footer-right">
                <button
                  className="mail-settings-modal__btn mail-settings-modal__btn--test"
                  onClick={() => void handleTest()}
                  disabled={testing || !canSave}
                  type="button"
                >
                  {testing ? 'Testing…' : 'Test connection'}
                </button>
                <button
                  className="mail-settings-modal__btn mail-settings-modal__btn--submit"
                  onClick={() => void handleSave()}
                  disabled={!canSave || saving || saved}
                  type="button"
                >
                  {saved ? 'Saved' : saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
