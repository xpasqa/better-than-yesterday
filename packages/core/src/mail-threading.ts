// mail-threading.ts — Builds threading headers for reply/forward messages.

export interface MailThreadingSource {
  /** <unique@host> — optional, may be absent */
  messageId?: string
  /** Existing References header, space-separated */
  references?: string
  subject: string
}

export interface ReplyHeaders {
  /** Only present if source has a messageId */
  inReplyTo?: string
  /** Chain of old references + source messageId */
  references?: string
  /** Subject with correct prefix applied */
  subject: string
}

/**
 * Builds the RFC 2822 threading headers for a reply or forward.
 *
 * Subject prefix rules:
 * - reply: prepend "Re: " if not already present (case-insensitive check)
 * - forward: prepend "Fwd: " if not already present (case-insensitive check)
 * - Prefixes never stack: "Re: Re: Foo" stays "Re: Foo"
 *
 * References rules:
 * - If source has messageId: references = (source.references + ' ' + source.messageId).trim()
 * - If source has no messageId: no inReplyTo, references unchanged (omitted)
 */
export function buildReplyHeaders(
  source: MailThreadingSource,
  mode: 'reply' | 'forward',
): ReplyHeaders {
  const subject = buildSubject(source.subject, mode)

  if (!source.messageId) {
    // No messageId — no threading headers, just the subject
    return { subject }
  }

  const inReplyTo = source.messageId

  const references = source.references
    ? `${source.references} ${source.messageId}`
    : source.messageId

  return { inReplyTo, references, subject }
}

function stripPrefix(subject: string, pattern: RegExp): string {
  // Strip the prefix repeatedly until no more leading prefixes remain
  let s = subject
  while (pattern.test(s)) {
    s = s.replace(pattern, '')
  }
  return s
}

function buildSubject(subject: string, mode: 'reply' | 'forward'): string {
  if (mode === 'reply') {
    const bare = stripPrefix(subject, /^re:\s*/i)
    return `Re: ${bare}`
  } else {
    const bare = stripPrefix(subject, /^fwd:\s*/i)
    return `Fwd: ${bare}`
  }
}
