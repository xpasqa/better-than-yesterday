// Pure search module — tokenisation, matching, and ranking by relevance then
// date. No I/O; no dependency on the tree or view layers.
//
// Intentional design note: `search()` includes completed tasks (completedAt is
// NOT filtered). This is deliberate — users frequently look up tasks they have
// already done. The distinction is visual (TaskRow renders them struck-through),
// not structural. Do NOT add a `completedAt === null` guard here; see spec
// docs/feature/12.search/spec.md §4.1 for the full rationale.
import type { Node } from './node.ts'

/**
 * Split a free-text query into lowercase tokens, discarding empty strings.
 * An empty or whitespace-only query returns `[]`, which `search()` treats as
 * "show nothing" rather than "show everything".
 */
export function tokenize(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter((t) => t.length > 0)
}

/**
 * Return true when every token appears somewhere in the node's title OR note.
 * The haystack is built and lowercased once per call. `note: null` is safe —
 * it collapses to an empty string before the substring check.
 *
 * Exported so callers (e.g. future highlight helpers) can reuse the matcher
 * without pulling in the ranking logic.
 */
export function matches(node: Node, tokens: string[]): boolean {
  if (tokens.length === 0) return false
  const haystack = (node.content + '\n' + (node.note ?? '')).toLowerCase()
  return tokens.every((t) => haystack.includes(t))
}

/**
 * Return all items that match `query`, sorted by relevance then due date.
 *
 * Candidates: `kind === 'item'` && `deletedAt === null`.
 * `completedAt` is intentionally NOT part of the filter — see the module-level
 * comment above.
 *
 * Scoring (lower = more relevant):
 *   0 — all tokens present in the title
 *   1 — some tokens in title, rest only in note
 *   2 — no tokens in title (all matched via note)
 *
 * Tiebreak: `dueDate` ascending, with sentinel `'9999-99-99'` for null
 * (same pattern as `'99:99'` used for `dueTime` in views.ts), then `rank`.
 */
export function search(nodes: Node[], query: string): Node[] {
  const tokens = tokenize(query)
  if (tokens.length === 0) return []

  const candidates = nodes.filter((n) => n.kind === 'item' && n.deletedAt === null)

  const scored = candidates
    .filter((n) => matches(n, tokens))
    .map((n) => {
      const titleLower = n.content.toLowerCase()
      const inTitle = tokens.filter((t) => titleLower.includes(t))
      let score: number
      if (inTitle.length === tokens.length) {
        score = 0 // all tokens in title
      } else if (inTitle.length > 0) {
        score = 1 // some tokens in title
      } else {
        score = 2 // no tokens in title
      }
      return { node: n, score }
    })

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score
    const dateA = a.node.dueDate ?? '9999-99-99'
    const dateB = b.node.dueDate ?? '9999-99-99'
    if (dateA !== dateB) return dateA < dateB ? -1 : 1
    return a.node.rank < b.node.rank ? -1 : a.node.rank > b.node.rank ? 1 : 0
  })

  return scored.map((s) => s.node)
}
