import { describe, it, expect } from 'vitest'
import { buildReplyHeaders } from './mail-threading.ts'

describe('buildReplyHeaders', () => {
  it('reply with full messageId — inReplyTo set, references chained, subject gets Re:', () => {
    const result = buildReplyHeaders(
      {
        messageId: '<abc@host>',
        references: '<prev@host>',
        subject: 'Foo',
      },
      'reply',
    )
    expect(result.inReplyTo).toBe('<abc@host>')
    expect(result.references).toBe('<prev@host> <abc@host>')
    expect(result.subject).toBe('Re: Foo')
  })

  it('forward — prefix Fwd:, no inReplyTo', () => {
    const result = buildReplyHeaders(
      {
        messageId: '<abc@host>',
        references: '<prev@host>',
        subject: 'Foo',
      },
      'forward',
    )
    expect(result.inReplyTo).toBe('<abc@host>')
    expect(result.references).toBe('<prev@host> <abc@host>')
    expect(result.subject).toBe('Fwd: Foo')
  })

  it('source without messageId — no inReplyTo, no references, subject still gets prefix', () => {
    const result = buildReplyHeaders(
      {
        subject: 'Foo',
      },
      'reply',
    )
    expect(result.inReplyTo).toBeUndefined()
    expect(result.references).toBeUndefined()
    expect(result.subject).toBe('Re: Foo')
  })

  it('prefixes do not stack — Re: Re: Foo becomes Re: Foo', () => {
    const result = buildReplyHeaders(
      {
        subject: 'Re: Re: Foo',
      },
      'reply',
    )
    expect(result.subject).toBe('Re: Foo')
  })

  it('case-insensitive prefix check — RE: Foo does not get another prefix', () => {
    const result = buildReplyHeaders(
      {
        subject: 'RE: Foo',
      },
      'reply',
    )
    expect(result.subject).toBe('Re: Foo')
  })

  it('case-insensitive Fwd prefix check — FWD: Foo does not get another prefix', () => {
    const result = buildReplyHeaders(
      {
        subject: 'FWD: Foo',
      },
      'forward',
    )
    expect(result.subject).toBe('Fwd: Foo')
  })

  it('reply with messageId but no existing references — references is just messageId', () => {
    const result = buildReplyHeaders(
      {
        messageId: '<abc@host>',
        subject: 'Bar',
      },
      'reply',
    )
    expect(result.inReplyTo).toBe('<abc@host>')
    expect(result.references).toBe('<abc@host>')
  })
})
