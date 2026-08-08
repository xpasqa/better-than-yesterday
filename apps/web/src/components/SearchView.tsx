import { useRef, useState } from 'react'
import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import { search, tokenize } from '@better/core/search'
import { useAllTags, useAllNodes } from '../store/use-nodes'
import type { AuthUser } from '../store/auth-api'
import TaskRow from './TaskRow'
import SyncStatusBadge from './SyncStatusBadge'
import './RealView.css'

interface SearchViewProps {
  user: AuthUser
  onOpenNode?: (id: string) => void
}

function SearchView({ user, onOpenNode }: SearchViewProps) {
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
              {results.map((n) => (
                <TaskRow
                  key={n.id}
                  node={n}
                  tagsById={tagsById}
                  allNodes={nodes}
                  timezone={timezone}
                  tokens={tokens}
                  onOpenNode={onOpenNode ? (n) => onOpenNode(n.id) : undefined}
                />
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  )
}

export default SearchView
