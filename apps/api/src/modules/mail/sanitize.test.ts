import { describe, it, expect } from 'vitest'
import { sanitizeMailHtml } from './sanitize.js'

describe('sanitizeMailHtml', () => {
  it('removes <script> tags', () => {
    const input = '<p>Hello</p><script>alert(1)</script>'
    const result = sanitizeMailHtml(input)
    expect(result).toContain('<p>Hello</p>')
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('alert(1)')
  })

  it('removes on* event handlers', () => {
    const input = '<img onload="evil()">'
    const result = sanitizeMailHtml(input)
    expect(result).toContain('<img')
    expect(result).not.toContain('onload')
    expect(result).not.toContain('evil()')
  })

  it('blocks remote images by moving src to data-blocked-src', () => {
    const input = '<img src="https://tracker.example.com/pixel.gif">'
    const result = sanitizeMailHtml(input)
    expect(result).toContain('data-blocked-src="https://tracker.example.com/pixel.gif"')
    expect(result).not.toMatch(/\ssrc=/)
  })

  it('neutralizes javascript: href', () => {
    const input = '<a href="javascript:void(0)">click</a>'
    const result = sanitizeMailHtml(input)
    // DOMPurify removes javascript: hrefs entirely
    expect(result).not.toContain('javascript:')
  })

  it('preserves normal formatting and safe links', () => {
    const input = '<b>bold</b> <a href="https://example.com">link</a>'
    const result = sanitizeMailHtml(input)
    expect(result).toContain('<b>bold</b>')
    expect(result).toContain('href="https://example.com"')
    expect(result).toContain('>link</a>')
  })

  it('returns empty string for empty input', () => {
    expect(sanitizeMailHtml('')).toBe('')
  })
})
