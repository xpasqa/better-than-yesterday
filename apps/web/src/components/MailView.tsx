import { useState } from 'react'
import {
  ArchiveIcon, ArrowBendUpLeftIcon, ArrowBendUpRightIcon, ArrowLeftIcon, EnvelopeSimpleIcon,
  EnvelopeSimpleOpenIcon, FlagIcon, MagnifyingGlassIcon, NotePencilIcon,
  PaperclipIcon, PaperPlaneTiltIcon, TrashIcon, WarningCircleIcon,
} from '@phosphor-icons/react'
import type { MailFolder, MailMessage, MailView as MailFolderView } from '../types'
import { mailMessages as initialMessages } from '../data/mockData'
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

function formatDate(iso: string): string {
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (iso === today) return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (iso === yesterday) return 'Yesterday'
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

export default function MailView() {
  const [messages, setMessages] = useState<MailMessage[]>(initialMessages)
  const [activeFolder, setActiveFolder] = useState<MailFolderView>('inbox')
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [composing, setComposing] = useState<ComposeDraft | null>(null)

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

  const activeMessage = visible.find(m => m.id === activeMessageId) ?? null
  /* G2: count unread per folder for sidebar badges */
  const unreadByFolder = (folderId: string): number =>
    folderId === 'flagged'
      ? messages.filter(m => m.isFlagged && !m.isRead).length
      : messages.filter(m => m.folder === folderId && !m.isRead).length

  const openMessage = (id: string) => {
    setActiveMessageId(id)
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isRead: true } : m))
  }

  const toggleFlag = (id: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isFlagged: !m.isFlagged } : m))
  }

  const toggleRead = (id: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isRead: !m.isRead } : m))
  }

  /* Archive moves to trash (no dedicated archive folder in this app) */
  const archiveMessage = (id: string) => {
    setMessages(prev => prev.map(m =>
      m.id === id ? { ...m, folder: 'trash' as MailFolder } : m
    ))
    setActiveMessageId(null)
  }

  /* Deleting from Trash removes it for good; anywhere else it just moves there */
  const deleteMessage = (id: string) => {
    setMessages(prev => {
      const msg = prev.find(m => m.id === id)
      if (!msg) return prev
      return msg.folder === 'trash'
        ? prev.filter(m => m.id !== id)
        : prev.map(m => m.id === id ? { ...m, folder: 'trash' as MailFolder } : m)
    })
    setActiveMessageId(null)
  }

  const send = (draft: { to: string; subject: string; body: string }) => {
    const sent: MailMessage = {
      id: Date.now().toString(),
      folder: 'sent',
      sender: 'Me',
      senderEmail: draft.to || 'me@example.com',
      subject: draft.subject || '(no subject)',
      body: draft.body,
      receivedAt: new Date().toISOString().split('T')[0],
      isRead: true,
      isFlagged: false,
    }
    setMessages(prev => [sent, ...prev])
    setComposing(null)
    setActiveFolder('sent')
    setActiveMessageId(sent.id)
  }

  const replyTo = (m: MailMessage) => setComposing({
    to: m.senderEmail,
    subject: m.subject.startsWith('Re:') ? m.subject : `Re: ${m.subject}`,
    body: `\n\n---\nOn ${m.receivedAt}, ${m.sender} wrote:\n${m.body}`,
  })

  const forward = (m: MailMessage) => setComposing({
    to: '',
    subject: m.subject.startsWith('Fwd:') ? m.subject : `Fwd: ${m.subject}`,
    body: `\n\n--- Forwarded message ---\nFrom: ${m.sender} <${m.senderEmail}>\nSubject: ${m.subject}\n\n${m.body}`,
  })

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
      </aside>

      {/* Message list */}
      <section className="mail-view__list-col">
        <div className="mail-view__list-header">
          <h1 className="mail-view__title">{FOLDERS.find(f => f.id === activeFolder)?.name}</h1>
          <p className="mail-view__subtitle">
            {visible.length} {visible.length === 1 ? 'message' : 'messages'}
          </p>
          <div className="mail-view__search">
            <MagnifyingGlassIcon size={15} />
            <input
              placeholder="Search"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>

        <ul className="mail-view__list">
          {visible.map(m => (
            <li
              key={m.id}
              className={`mail-item ${activeMessageId === m.id ? 'mail-item--active' : ''} ${m.isRead ? '' : 'mail-item--unread'}`}
              onClick={() => openMessage(m.id)}
            >
              <span className="mail-item__dot" />
              <div className="mail-item__body">
                <div className="mail-item__top">
                  <span className="mail-item__sender">{m.sender}</span>
                  <span className="mail-item__time">{formatDate(m.receivedAt)}</span>
                </div>
                <p className="mail-item__subject">{m.subject}</p>
                <p className="mail-item__preview">{m.body.replace(/\n+/g, ' ')}</p>
              </div>
              {m.isFlagged && <FlagIcon size={13} weight="fill" className="mail-item__flag" />}
            </li>
          ))}
          {visible.length === 0 && (
            <li className="mail-view__empty-list">No messages</li>
          )}
        </ul>
      </section>

      {/* Reading pane */}
      <section className="mail-view__reading">
        {composing ? (
          <MailComposeForm
            draft={composing}
            onSend={send}
            onCancel={() => setComposing(null)}
          />
        ) : activeMessage ? (
          <>
            <div className="mail-view__toolbar">
              {/* Phone-only — the list is off screen while a message is open */}
              <button
                className="mail-view__back"
                onClick={() => setActiveMessageId(null)}
                aria-label="Back to list"
              >
                <ArrowLeftIcon size={18} />
              </button>
              <button onClick={() => replyTo(activeMessage)} title="Reply">
                <ArrowBendUpLeftIcon size={17} />
              </button>
              <button onClick={() => forward(activeMessage)} title="Forward">
                <ArrowBendUpRightIcon size={17} />
              </button>
              <button
                className={activeMessage.isFlagged ? 'mail-view__toolbar-btn--on' : ''}
                onClick={() => toggleFlag(activeMessage.id)}
                title="Flag"
              >
                <FlagIcon size={17} weight={activeMessage.isFlagged ? 'fill' : 'regular'} />
              </button>
              <button onClick={() => toggleRead(activeMessage.id)} title="Mark as unread">
                {activeMessage.isRead ? <EnvelopeSimpleIcon size={17} /> : <EnvelopeSimpleOpenIcon size={17} />}
              </button>
              <button onClick={() => archiveMessage(activeMessage.id)} title="Archive">
                <ArchiveIcon size={17} />
              </button>
              <button onClick={() => deleteMessage(activeMessage.id)} title="Delete">
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
              <div className="mail-view__message-body">{activeMessage.body}</div>
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
    </main>
  )
}
