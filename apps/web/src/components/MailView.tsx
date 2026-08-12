import { useCallback, useEffect, useState } from 'react'
import {
  ArchiveIcon, ArrowBendUpLeftIcon, ArrowBendUpRightIcon, ArrowLeftIcon, EnvelopeSimpleIcon,
  EnvelopeSimpleOpenIcon, FlagIcon, GearIcon, MagnifyingGlassIcon, NotePencilIcon,
  PaperclipIcon, PaperPlaneTiltIcon, TrashIcon, WarningCircleIcon,
} from '@phosphor-icons/react'
import type { MailFolder, MailMessage, MailView as MailFolderView } from '../types'
import {
  fetchMessages,
  fetchMessage,
  patchMessage,
  deleteMessage as apiDeleteMessage,
  sendMessage as apiSendMessage,
} from '../api/mail'
import { buildReplyHeaders } from '@better/core/mail-threading'
import MailComposeForm from './MailComposeForm'
import type { ComposeDraft } from './MailComposeForm'
import './MailView.css'

const FOLDERS: { id: MailFolderView; name: string; icon: typeof EnvelopeSimpleIcon }[] = [
  { id: 'inbox', name: 'Inbox', icon: EnvelopeSimpleIcon },
  { id: 'sent', name: 'Sent', icon: PaperPlaneTiltIcon },
  { id: 'drafts', name: 'Drafts', icon: NotePencilIcon },
  { id: 'junk', name: 'Junk', icon: WarningCircleIcon },
  { id: 'trash', name: 'Trash', icon: TrashIcon },
  { id: 'flagged', name: 'Flagged', icon: FlagIcon },
]

type MailError = 'MAIL_NOT_CONFIGURED' | 'MAIL_AUTH_FAILED' | 'MAIL_UNAVAILABLE' | null

function formatDate(iso: string): string {
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (iso === today) return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (iso === yesterday) return 'Yesterday'
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

function classifyError(err: unknown): MailError {
  if (!(err instanceof Error)) return 'MAIL_UNAVAILABLE'
  const code = (err as Error & { code?: string }).code
  if (code === 'MAIL_NOT_CONFIGURED') return 'MAIL_NOT_CONFIGURED'
  if (code === 'MAIL_AUTH_FAILED') return 'MAIL_AUTH_FAILED'
  return 'MAIL_UNAVAILABLE'
}

export default function MailView({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const [messages, setMessages] = useState<MailMessage[]>([])
  const [activeFolder, setActiveFolder] = useState<MailFolderView>('inbox')
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [composing, setComposing] = useState<ComposeDraft & { inReplyTo?: string; references?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<MailError>(null)
  const [showImages, setShowImages] = useState(false)

  const loadFolder = useCallback(async (folder: MailFolderView) => {
    setLoading(true)
    setError(null)
    setMessages([])
    try {
      const msgs = await fetchMessages(folder)
      setMessages(msgs)
    } catch (err) {
      setError(classifyError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadFolder(activeFolder)
  }, [activeFolder, loadFolder])

  const inFolder = activeFolder === 'flagged'
    ? messages.filter(m => m.isFlagged)
    : messages.filter(m => m.folder === activeFolder)

  const q = query.trim().toLowerCase()
  const visible = q
    ? inFolder.filter(m =>
        m.subject.toLowerCase().includes(q) ||
        m.sender.toLowerCase().includes(q) ||
        m.body.toLowerCase().includes(q))
    : inFolder

  const activeMessage = messages.find(m => m.id === activeMessageId) ?? null

  /* G2: count unread per folder for sidebar badges */
  const unreadByFolder = (folderId: string): number =>
    folderId === 'flagged'
      ? messages.filter(m => m.isFlagged && !m.isRead).length
      : messages.filter(m => m.folder === folderId && !m.isRead).length

  const openMessage = async (id: string) => {
    setActiveMessageId(id)
    setShowImages(false)
    // Optimistically mark as read in list
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isRead: true } : m))
    try {
      const full = await fetchMessage(id)
      setMessages(prev => prev.map(m => m.id === id ? full : m))
      // Fire-and-forget patch — mark read on server
      void patchMessage(id, { isRead: true }).catch(() => undefined)
    } catch {
      // keep the optimistic update; full body unavailable but basic view still works
    }
  }

  const toggleFlag = async (id: string) => {
    const original = messages.find(m => m.id === id)
    if (!original) return
    const next = !original.isFlagged
    // Optimistic update
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isFlagged: next } : m))
    try {
      await patchMessage(id, { isFlagged: next })
    } catch {
      // Revert on failure
      setMessages(prev => prev.map(m => m.id === id ? { ...m, isFlagged: !next } : m))
    }
  }

  const toggleRead = async (id: string) => {
    const original = messages.find(m => m.id === id)
    if (!original) return
    const next = !original.isRead
    // Optimistic update
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isRead: next } : m))
    try {
      await patchMessage(id, { isRead: next })
    } catch {
      // Revert on failure
      setMessages(prev => prev.map(m => m.id === id ? { ...m, isRead: !next } : m))
    }
  }

  /* Archive moves to trash (no dedicated archive folder in this app) */
  const archiveMessage = async (id: string) => {
    setMessages(prev => prev.map(m =>
      m.id === id ? { ...m, folder: 'trash' as MailFolder } : m
    ))
    setActiveMessageId(null)
    try {
      await patchMessage(id, {})
    } catch {
      // best-effort
    }
  }

  /* Deleting from Trash removes it for good; anywhere else it just moves there */
  const deleteMessage = async (id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id))
    setActiveMessageId(null)
    try {
      await apiDeleteMessage(id)
    } catch {
      // best-effort — server handles trash logic
    }
  }

  const send = async (draft: ComposeDraft & { inReplyTo?: string; references?: string }) => {
    setComposing(null)
    try {
      await apiSendMessage({
        to: draft.to,
        subject: draft.subject,
        text: draft.body,
        ...(draft.inReplyTo ? { inReplyTo: draft.inReplyTo } : {}),
        ...(draft.references ? { references: draft.references } : {}),
      })
      // Refresh sent folder if we're viewing it
      if (activeFolder === 'sent') {
        void loadFolder('sent')
      }
    } catch {
      // best-effort — message may still have sent
    }
  }

  const replyTo = (m: MailMessage) => {
    const headers = buildReplyHeaders({ messageId: m.id, subject: m.subject }, 'reply')
    setComposing({
      to: m.senderEmail,
      subject: headers.subject,
      body: `\n\n---\nOn ${m.receivedAt}, ${m.sender} wrote:\n${m.body}`,
      inReplyTo: headers.inReplyTo,
      references: headers.references,
    })
  }

  const forward = (m: MailMessage) => {
    const headers = buildReplyHeaders({ messageId: m.id, subject: m.subject }, 'forward')
    setComposing({
      to: '',
      subject: headers.subject,
      body: `\n\n--- Forwarded message ---\nFrom: ${m.sender} <${m.senderEmail}>\nSubject: ${m.subject}\n\n${m.body}`,
      inReplyTo: headers.inReplyTo,
      references: headers.references,
    })
  }

  /*
   * On a phone the three panes become a two-level drill-down: the list, then
   * whatever the reading pane is showing. Which of the two is on screen is
   * fully determined by whether anything is open, so it needs no state of its
   * own — just a class the stylesheet can key off.
   */
  const isReading = Boolean(composing || activeMessage)

  return (
    <main className={`mail-view ${isReading ? 'mail-view--reading' : ''}`}>
      {/* Folders */}
      <aside className="mail-view__folders">
        <button
          className="mail-view__compose-btn"
          onClick={() => setComposing({ to: '', subject: '', body: '' })}
        >
          <span className="mail-view__compose-icon">
            <NotePencilIcon size={13} weight="bold" />
          </span>
          <span>New Message</span>
        </button>
        <ul className="mail-view__folder-list">
          {FOLDERS.map(f => {
            const Icon = f.icon
            return (
              <li key={f.id}>
                <button
                  className={`mail-view__folder ${activeFolder === f.id ? 'mail-view__folder--active' : ''}`}
                  onClick={() => { setActiveFolder(f.id); setActiveMessageId(null) }}
                >
                  <Icon size={17} />
                  <span>{f.name}</span>
                  {(() => { const n = unreadByFolder(f.id); return n > 0 ? <span className="mail-view__folder-count">{n}</span> : null })()}
                </button>
              </li>
            )
          })}
        </ul>
        <button
          className="mail-view__settings-btn"
          onClick={() => onOpenSettings?.()}
          aria-label="Mail settings"
          type="button"
        >
          <GearIcon size={17} />
        </button>
      </aside>

      {/* Message list */}
      <section className="mail-view__list-col">
        <div className="mail-view__list-header">
          <h1 className="mail-view__title">{FOLDERS.find(f => f.id === activeFolder)?.name}</h1>
          {!loading && !error && (
            <p className="mail-view__subtitle">
              {visible.length} {visible.length === 1 ? 'message' : 'messages'}
            </p>
          )}
          <div className="mail-view__search">
            <MagnifyingGlassIcon size={15} />
            <input
              placeholder="Search"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="mail-view__status">
            <p>Loading…</p>
          </div>
        ) : error === 'MAIL_NOT_CONFIGURED' ? (
          <div className="mail-view__status mail-view__status--error">
            <EnvelopeSimpleIcon size={36} weight="thin" />
            <p>No mail account configured.</p>
            <button
              className="mail-view__status-cta"
              onClick={() => onOpenSettings?.()}
              type="button"
            >
              Configure mail account
            </button>
          </div>
        ) : error === 'MAIL_AUTH_FAILED' ? (
          <div className="mail-view__status mail-view__status--error">
            <WarningCircleIcon size={36} weight="thin" />
            <p>Authentication failed.</p>
            <button
              className="mail-view__status-cta"
              onClick={() => setSettingsOpen(true)}
              type="button"
            >
              Update credentials in Settings
            </button>
          </div>
        ) : error === 'MAIL_UNAVAILABLE' ? (
          <div className="mail-view__status mail-view__status--error">
            <WarningCircleIcon size={36} weight="thin" />
            <p>Mail server unavailable.</p>
            <button
              className="mail-view__status-cta"
              onClick={() => void loadFolder(activeFolder)}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="mail-view__empty-list">
            <EnvelopeSimpleIcon size={36} weight="thin" />
            <p>No messages</p>
          </div>
        ) : (
          <ul className="mail-view__list">
            {visible.map(m => (
              <li key={m.id}>
                <button
                  className={`mail-view__item ${activeMessageId === m.id ? 'mail-view__item--active' : ''} ${!m.isRead ? 'mail-view__item--unread' : ''}`}
                  onClick={() => void openMessage(m.id)}
                >
                  <span className="mail-view__item-sender">{m.sender}</span>
                  <span className="mail-view__item-date">{formatDate(m.receivedAt)}</span>
                  <span className="mail-view__item-subject">{m.subject}</span>
                  <span className="mail-view__item-preview">{m.body.slice(0, 80)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Reading pane / Compose pane */}
      <section className="mail-view__reading-pane">
        {composing ? (
          <MailComposeForm
            draft={composing}
            onSend={(d) => void send({ ...d, inReplyTo: composing?.inReplyTo, references: composing?.references })}
            onCancel={() => setComposing(null)}
          />
        ) : activeMessage ? (
          <>
            <div className="mail-view__reading-toolbar">
              <button
                className="mail-view__reading-back"
                onClick={() => setActiveMessageId(null)}
                aria-label="Back to list"
              >
                <ArrowLeftIcon size={17} />
              </button>
              <button aria-label="Reply" onClick={() => replyTo(activeMessage)}>
                <ArrowBendUpLeftIcon size={17} />
              </button>
              <button aria-label="Forward" onClick={() => forward(activeMessage)}>
                <ArrowBendUpRightIcon size={17} />
              </button>
              <button
                aria-label={activeMessage.isRead ? 'Mark unread' : 'Mark read'}
                onClick={() => void toggleRead(activeMessage.id)}
              >
                {activeMessage.isRead
                  ? <EnvelopeSimpleIcon size={17} />
                  : <EnvelopeSimpleOpenIcon size={17} />}
              </button>
              <button
                aria-label={activeMessage.isFlagged ? 'Unflag' : 'Flag'}
                onClick={() => void toggleFlag(activeMessage.id)}
                className={activeMessage.isFlagged ? 'mail-view__btn--flagged' : ''}
              >
                <FlagIcon size={17} weight={activeMessage.isFlagged ? 'fill' : 'regular'} />
              </button>
              <button aria-label="Archive" onClick={() => void archiveMessage(activeMessage.id)}>
                <ArchiveIcon size={17} />
              </button>
              <button aria-label="Delete" onClick={() => void deleteMessage(activeMessage.id)}>
                <TrashIcon size={17} />
              </button>
            </div>

            <div className="mail-view__message">
              <h2 className="mail-view__message-subject">{activeMessage.subject}</h2>
              <div className="mail-view__message-meta">
                <span className="mail-view__message-sender">{activeMessage.sender}</span>
                <span className="mail-view__message-email">&lt;{activeMessage.senderEmail}&gt;</span>
                <span className="mail-view__message-date">{formatDate(activeMessage.receivedAt)}</span>
              </div>

              {activeMessage.bodyHtml ? (
                <>
                  <iframe
                    sandbox=""
                    srcDoc={
                      showImages
                        ? activeMessage.bodyHtml.replace(/data-blocked-src=/g, 'src=')
                        : activeMessage.bodyHtml
                    }
                    title="Mail content"
                    className="mail-view__message-iframe"
                    style={{ width: '100%', height: '400px', border: 'none' }}
                  />
                  {!showImages && (
                    <button
                      className="mail-view__show-images"
                      onClick={() => setShowImages(true)}
                      type="button"
                    >
                      Show images
                    </button>
                  )}
                </>
              ) : (
                <div className="mail-view__message-body">{activeMessage.body}</div>
              )}

              {activeMessage.attachments && activeMessage.attachments.length > 0 && (
                <div className="mail-view__attachments">
                  {activeMessage.attachments.map(name => (
                    <span key={name} className="mail-view__attachment-chip">
                      <PaperclipIcon size={13} />
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="mail-view__empty">
            <EnvelopeSimpleIcon size={40} weight="thin" />
            <p>No message selected</p>
          </div>
        )}
      </section>

      {settingsOpen && (
        <MailSettingsModal onClose={() => setSettingsOpen(false)} />
      )}
    </main>
  )
}
