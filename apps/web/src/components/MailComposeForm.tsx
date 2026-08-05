import { useState } from 'react'
import { PaperPlaneTiltIcon, XIcon } from '@phosphor-icons/react'
import './MailComposeForm.css'

export interface ComposeDraft {
  to: string
  subject: string
  body: string
}

interface MailComposeFormProps {
  draft: ComposeDraft
  onSend: (draft: ComposeDraft) => void
  onCancel: () => void
}

export default function MailComposeForm({ draft, onSend, onCancel }: MailComposeFormProps) {
  const [to, setTo] = useState(draft.to)
  const [subject, setSubject] = useState(draft.subject)
  const [body, setBody] = useState(draft.body)

  return (
    <div className="mail-compose">
      <div className="mail-compose__header">
        <span className="mail-compose__title">New Message</span>
        <button className="mail-compose__close" onClick={onCancel} aria-label="Cancel">
          <XIcon size={16} weight="bold" />
        </button>
      </div>

      <label className="mail-compose__field">
        <span>To</span>
        <input value={to} onChange={e => setTo(e.target.value)} placeholder="name@example.com" autoFocus />
      </label>
      <label className="mail-compose__field">
        <span>Subject</span>
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" />
      </label>

      <textarea
        className="mail-compose__body"
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Write your message…"
      />

      <div className="mail-compose__actions">
        <button className="mail-compose__cancel" onClick={onCancel}>Cancel</button>
        <button
          className="mail-compose__send"
          onClick={() => onSend({ to, subject, body })}
          disabled={!to.trim() && !subject.trim() && !body.trim()}
        >
          <PaperPlaneTiltIcon size={15} weight="fill" />
          Send
        </button>
      </div>
    </div>
  )
}
