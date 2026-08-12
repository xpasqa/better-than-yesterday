import { useRef, useState } from 'react'
import { MagnifyingGlassIcon, NoteIcon } from '@phosphor-icons/react'
import { search, tokenize } from '@better/core/search'
import type { Node } from '@better/core/node'
import { useAllTags, useAllNodes } from '../store/use-nodes'
import type { AuthUser } from '../store/auth-api'
import TaskRow from './TaskRow'
import SyncStatusBadge from './SyncStatusBadge'
import { highlightTokens } from './highlightTokens'
import './RealView.css'

interface SearchViewProps {
  user: AuthUser
  onOpenNode?: (id: string) => void
  /** kind='note' results open Outline instead of the task detail modal (32.outline-task-decoupling/spec.md §6.3). */
  onOpenNote?: () => void
}

/**
 * A search hit that's a plain Outline row, not a task — rendered without
 * TaskRow's checkbox and due-date chrome so it can't be mistaken for one.
 * Clicking hands off to Outline; there is no per-node zoom route yet, so
 * this only switches views (spec §9 lists zoom routing as out of scope
 * for this feature).
 */
function SearchNoteRow({ node, tokens, onOpen }: { node: Node; tokens: string[]; onOpen?: () => void }) {
  return (
    <li className="real-view__list-item">
      <button type="button" className="search-note-row" onClick={onOpen}>
        <NoteIcon size={16} className="search-note-row__icon" />
        <span className="search-note-row__content">
          {highlightTokens(node.content || '(kosong)', tokens)}
        </span>
      </button>
    </li>
  )
}

function SearchView({ user, onOpenNode, onOpenNote }: SearchViewProps) {
  const nodes = useAllNodes()
  const tags = useAllTags()
  const tagsById = new Map(tags.map((t) => [t.id, t]))
  const [query, setQuery] = useState('')
  // Exposed for keyboard shortcut '/' (epic #79) to programmatically focus the input
  const inputRef = useRef<HTMLInputElement>(null)

  const timezone = user.timezone ?? 'Asia/Jakarta'

  // Synchronous, no debounce — matching runs in-memory over already-loaded data
  const results = search(nodes, query)
  const tokens = tokenize(query)

  return (
    <main className="real-view">
      <div className="real-view__inner">
        <div className="real-view__header">
          <h1>Search</h1>
          <p className="real-view__subtitle">
            <MagnifyingGlassIcon size={14} />
            {query ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'Search tasks'}
            <SyncStatusBadge />
          </p>
        </div>

        <div className="real-view__search-bar">
          <input
            ref={inputRef}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            type="search"
            className="real-view__search-input"
            placeholder="Type to search tasks…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search tasks"
          />
        </div>

        {!query && (
          <p className="real-view__empty">Ketik untuk mencari task</p>
        )}

        {query && results.length === 0 && (
          <p className="real-view__empty">
            Tidak ada task yang cocok dengan &ldquo;{query}&rdquo;
          </p>
        )}

        {query && results.length > 0 && (
          <section aria-label="Search results">
            <h2 className="real-view__group-label">{results.length} hasil</h2>
            <ul className="real-view__list">
              {results.map((n) =>
                n.kind === 'note' ? (
                  <SearchNoteRow key={n.id} node={n} tokens={tokens} onOpen={onOpenNote} />
                ) : (
                  <TaskRow
                    key={n.id}
                    node={n}
                    tagsById={tagsById}
                    allNodes={nodes}
                    timezone={timezone}
                    tokens={tokens}
                    onOpenNode={onOpenNode ? (n) => onOpenNode(n.id) : undefined}
                  />
                ),
              )}
            </ul>
          </section>
        )}
      </div>
    </main>
  )
}

export default SearchView
