import type { ReactNode } from 'react'

/**
 * Escape any regex metacharacters in a string so it can be used safely
 * as a literal pattern inside `new RegExp(...)`.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Split `text` into an array of strings and `<mark>` elements, wrapping
 * every occurrence of each token (case-insensitive) in a `<mark>`.
 *
 * Safe against regex injection: each token is escaped before use.
 * Returns plain React nodes — no `dangerouslySetInnerHTML`.
 *
 * If `tokens` is empty the original text is returned as-is (a single-element
 * array containing the full string).
 */
export function highlightTokens(text: string, tokens: string[]): ReactNode[] {
  if (tokens.length === 0) return [text]

  // Build a single alternation pattern from all escaped tokens.
  const pattern = tokens.map(escapeRegex).join('|')
  const regex = new RegExp(`(${pattern})`, 'gi')

  const parts = text.split(regex)
  return parts.map((part, i) => {
    // Every odd-indexed part is a match captured by the group.
    if (i % 2 === 1) {
      return <mark key={i}>{part}</mark>
    }
    return part
  })
}
