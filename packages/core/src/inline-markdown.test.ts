import { describe, expect, it } from 'vitest'
import { parseInlineMarkdown } from './inline-markdown.ts'

describe('parseInlineMarkdown', () => {
  it('returns a single text segment for plain text', () => {
    expect(parseInlineMarkdown('hello world')).toEqual([{ type: 'text', text: 'hello world' }])
  })

  it('parses bold', () => {
    expect(parseInlineMarkdown('a **bold** word')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'bold', text: 'bold' },
      { type: 'text', text: ' word' },
    ])
  })

  it('parses italic without matching bold markers', () => {
    expect(parseInlineMarkdown('a *italic* word')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'italic', text: 'italic' },
      { type: 'text', text: ' word' },
    ])
  })

  it('parses inline code', () => {
    expect(parseInlineMarkdown('run `npm test` now')).toEqual([
      { type: 'text', text: 'run ' },
      { type: 'code', text: 'npm test' },
      { type: 'text', text: ' now' },
    ])
  })

  it('parses strikethrough', () => {
    expect(parseInlineMarkdown('~~done~~ pending')).toEqual([
      { type: 'strike', text: 'done' },
      { type: 'text', text: ' pending' },
    ])
  })

  it('parses a markdown link', () => {
    expect(parseInlineMarkdown('see [the doc](https://example.com/x)')).toEqual([
      { type: 'text', text: 'see ' },
      { type: 'link', text: 'the doc', url: 'https://example.com/x' },
    ])
  })

  it('parses multiple patterns in one line, in order', () => {
    expect(parseInlineMarkdown('**bold** and *italic* and `code`')).toEqual([
      { type: 'bold', text: 'bold' },
      { type: 'text', text: ' and ' },
      { type: 'italic', text: 'italic' },
      { type: 'text', text: ' and ' },
      { type: 'code', text: 'code' },
    ])
  })

  it('leaves an unclosed marker as literal text', () => {
    expect(parseInlineMarkdown('a **bold with no close')).toEqual([
      { type: 'text', text: 'a **bold with no close' },
    ])
  })

  it('leaves a lone asterisk as literal text', () => {
    expect(parseInlineMarkdown('5 * 3 = 15')).toEqual([{ type: 'text', text: '5 * 3 = 15' }])
  })

  it('returns no segments for an empty string', () => {
    expect(parseInlineMarkdown('')).toEqual([])
  })

  it('does not let bold content re-match as italic', () => {
    expect(parseInlineMarkdown('**bold**')).toEqual([{ type: 'bold', text: 'bold' }])
  })
})
