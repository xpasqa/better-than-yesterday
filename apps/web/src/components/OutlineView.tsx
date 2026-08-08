import { useEffect, useRef, useState, useCallback, Fragment, type KeyboardEvent } from 'react'
import { CaretDownIcon } from '@phosphor-icons/react'
import { todayInTimezone } from '@better/core/date'
import { parseInlineMarkdown } from '@better/core/inline-markdown'
import type { Node } from '@better/core/node'
import { useAllNodes } from '../store/use-nodes'
import { toggleTaskComplete, deleteTask } from '../store/node-actions'
import {
  patchNode,
  createSiblingNode,
  createRootNode,
  indentNode,
  outdentNode,
  swapWithSibling,
} from '../store/outline-actions'
import type { AuthUser } from '../store/auth-api'
import './OutlineView.css'

/*
 * Wired to the same node tree Todo reads (2.outline/spec.md §12: no new
 * table, no migration). Covers spec sections B and C: store-backed tree,
 * the full §7 keyboard table mapped onto core/tree.ts, debounced save, a
 * per-row note field, and inline markdown rendering with exactly one
 * <input> in the DOM at a time. Mention chips, progress, backlinks, zoom
 * routing, and the iPad toolbar (sections D–I) remain — see
 * docs/feature/2.backend/2.outline/todo.md.
 */

function byRank(a: Node, b: Node): number {
  return a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0
}

function childrenOf(nodes: Node[], parentId: string | null): Node[] {
  return nodes.filter((n) => n.parentId === parentId).sort(byRank)
}

function flattenVisible(nodes: Node[], parentId: string | null = null, depth = 0): { node: Node; depth: number }[] {
  const result: { node: Node; depth: number }[] = []
  for (const n of childrenOf(nodes, parentId)) {
    result.push({ node: n, depth })
    if (!n.collapsed) result.push(...flattenVisible(nodes, n.id, depth + 1))
  }
  return result
}

/** Renders the five supported inline patterns as real React nodes — never dangerouslySetInnerHTML (§6). */
function InlineMarkdown({ text }: { text: string }) {
  const segments = parseInlineMarkdown(text)
  return (
    <>
      {segments.map((seg, i) => {
        switch (seg.type) {
          case 'bold':
            return <strong key={i}>{seg.text}</strong>
          case 'italic':
            return <em key={i}>{seg.text}</em>
          case 'code':
            return <code key={i}>{seg.text}</code>
          case 'strike':
            return <s key={i}>{seg.text}</s>
          case 'link':
            return (
              <a key={i} href={seg.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                {seg.text}
              </a>
            )
          default:
            return <Fragment key={i}>{seg.text}</Fragment>
        }
      })}
    </>
  )
}

interface RowProps {
  node: Node
  allNodes: Node[]
  timezone: string
  focusedId: string | null
  onFocus: (id: string) => void
  onDelete: (node: Node) => void
  onEnter: (node: Node) => void
  onIndent: (node: Node) => void
  onOutdent: (node: Node) => void
  onArrowUp: (id: string) => void
  onArrowDown: (id: string) => void
}

/** One node = one row (§6). Content edits debounce 500ms and flush on blur so closing a tab never loses the last sentence. */
function OutlineNodeRow(props: RowProps) {
  const {
    node, allNodes, timezone, focusedId, onFocus, onDelete, onEnter, onIndent, onOutdent, onArrowUp, onArrowDown,
  } = props
  const kids = childrenOf(allNodes, node.id)
  const hasChildren = kids.length > 0
  const isFocused = focusedId === node.id
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(node.content)
  const [noteOpen, setNoteOpen] = useState(!!node.note)
  const [note, setNote] = useState(node.note ?? '')
  const contentDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const noteDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Pick up remote/other-tab edits, but never clobber what's being typed right now.
  useEffect(() => {
    if (!isFocused) {
      setText(node.content)
      setNote(node.note ?? '')
    }
  }, [node.content, node.note, isFocused])

  useEffect(() => {
    if (isFocused) inputRef.current?.focus()
  }, [isFocused])

  const flushContent = useCallback(
    (value: string) => {
      clearTimeout(contentDebounce.current)
      if (value !== node.content) void patchNode(node, { content: value })
    },
    [node],
  )

  const flushNote = useCallback(
    (value: string) => {
      clearTimeout(noteDebounce.current)
      const normalized = value === '' ? null : value
      if (normalized !== node.note) void patchNode(node, { note: normalized })
    },
    [node],
  )

  const handleChange = (value: string) => {
    setText(value)
    clearTimeout(contentDebounce.current)
    contentDebounce.current = setTimeout(() => flushContent(value), 500)
  }

  const handleNoteChange = (value: string) => {
    setNote(value)
    clearTimeout(noteDebounce.current)
    noteDebounce.current = setTimeout(() => flushNote(value), 500)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const mod = e.metaKey || e.ctrlKey

    if (mod && e.key === 'Enter') {
      e.preventDefault()
      void toggleTaskComplete(node, timezone)
    } else if (mod && e.key === '.') {
      e.preventDefault()
      if (hasChildren) void patchNode(node, { collapsed: !node.collapsed })
    } else if (mod && (e.key === 't' || e.key === 'T')) {
      e.preventDefault()
      void patchNode(node, { dueDate: todayInTimezone(timezone) })
    } else if (mod && e.key === 'ArrowUp') {
      e.preventDefault()
      void swapWithSibling(node, allNodes, 'up')
    } else if (mod && e.key === 'ArrowDown') {
      e.preventDefault()
      void swapWithSibling(node, allNodes, 'down')
    } else if (e.shiftKey && e.key === 'Enter') {
      e.preventDefault()
      setNoteOpen((o) => !o)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      flushContent(text)
      onEnter(node)
    } else if (e.key === 'Backspace' && text === '' && !hasChildren) {
      e.preventDefault()
      onDelete(node)
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      onIndent(node)
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      onOutdent(node)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      flushContent(text)
      onArrowUp(node.id)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      flushContent(text)
      onArrowDown(node.id)
    }
  }

  const isOverdue = node.dueDate !== null && node.dueDate < todayInTimezone(timezone)

  return (
    <div>
      <div className={`outline-node ${node.completedAt ? 'outline-node--completed' : ''}`}>
        <button
          className={`outline-node__collapse ${hasChildren ? 'outline-node__collapse--visible' : ''}`}
          onClick={() => hasChildren && void patchNode(node, { collapsed: !node.collapsed })}
          tabIndex={-1}
          aria-label={node.collapsed ? 'Expand' : 'Collapse'}
        >
          <CaretDownIcon
            size={13}
            weight="bold"
            style={{ transform: node.collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
          />
        </button>

        <button
          className="outline-node__bullet"
          onClick={() => void toggleTaskComplete(node, timezone)}
          tabIndex={-1}
          aria-label="Toggle complete"
        >
          <span className="outline-node__bullet-dot" />
        </button>

        {isFocused ? (
          <input
            ref={inputRef}
            className="outline-node__input"
            value={text}
            placeholder="Type something…"
            onChange={(e) => handleChange(e.target.value)}
            onBlur={() => flushContent(text)}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <div
            className="outline-node__text"
            onClick={() => onFocus(node.id)}
            role="textbox"
            tabIndex={0}
            onFocus={() => onFocus(node.id)}
          >
            {node.content ? (
              <InlineMarkdown text={node.content} />
            ) : (
              <span className="outline-node__placeholder">Type something…</span>
            )}
          </div>
        )}

        {node.dueDate && (
          <span className={`outline-node__date ${isOverdue ? 'outline-node__date--overdue' : ''}`}>
            {node.dueDate}
          </span>
        )}

        {node.collapsed && hasChildren && <span className="outline-node__child-count">{kids.length}</span>}
      </div>

      {noteOpen && (
        <textarea
          className="outline-node__note"
          value={note}
          placeholder="Add a note…"
          onChange={(e) => handleNoteChange(e.target.value)}
          onBlur={() => flushNote(note)}
        />
      )}

      {hasChildren && !node.collapsed && (
        <div className="outline-node__children">
          {kids.map((child) => (
            <OutlineNodeRow key={child.id} {...props} node={child} />
          ))}
        </div>
      )}
    </div>
  )
}

interface OutlineViewProps {
  user: AuthUser
}

export default function OutlineView({ user }: OutlineViewProps) {
  const allNodes = useAllNodes()
  // Outline uses all non-deleted nodes — it shares the same node tree as Todo.
  // Projects and inbox appear as root containers; their children are shown under them.
  const nodes = allNodes.filter(n => n.deletedAt === null)
  const timezone = user.timezone ?? 'Asia/Jakarta'
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const roots = childrenOf(nodes, null)
  const flat = flattenVisible(nodes)

  const handleEnter = useCallback(
    (node: Node) => {
      void createSiblingNode(node, nodes).then((created) => setFocusedId(created.id))
    },
    [nodes],
  )

  const handleDelete = useCallback(
    (node: Node) => {
      const idx = flat.findIndex((f) => f.node.id === node.id)
      const prevId = idx > 0 ? flat[idx - 1]!.node.id : null
      void deleteTask(node)
      if (prevId) setFocusedId(prevId)
    },
    [flat],
  )

  const handleIndent = useCallback(
    (node: Node) => {
      void indentNode(node, nodes).then(() => setFocusedId(node.id))
    },
    [nodes],
  )

  const handleOutdent = useCallback(
    (node: Node) => {
      void outdentNode(node, nodes).then(() => setFocusedId(node.id))
    },
    [nodes],
  )

  const handleArrowUp = useCallback(
    (id: string) => {
      const idx = flat.findIndex((f) => f.node.id === id)
      if (idx > 0) setFocusedId(flat[idx - 1]!.node.id)
    },
    [flat],
  )

  const handleArrowDown = useCallback(
    (id: string) => {
      const idx = flat.findIndex((f) => f.node.id === id)
      if (idx >= 0 && idx < flat.length - 1) setFocusedId(flat[idx + 1]!.node.id)
    },
    [flat],
  )

  return (
    <main className="outline-view">
      <div className="outline-view__inner">
        <div className="outline-view__header">
          <h1 className="outline-view__title">Outline</h1>
          <p className="outline-view__subtitle">Nested notes — press Enter to add, Tab to indent, Shift+Tab to outdent</p>
        </div>

        <div className="outline-view__body">
          {roots.map((node) => (
            <OutlineNodeRow
              key={node.id}
              node={node}
              allNodes={nodes}
              timezone={timezone}
              focusedId={focusedId}
              onFocus={setFocusedId}
              onDelete={handleDelete}
              onEnter={handleEnter}
              onIndent={handleIndent}
              onOutdent={handleOutdent}
              onArrowUp={handleArrowUp}
              onArrowDown={handleArrowDown}
            />
          ))}

          <button
            className="outline-view__add-root"
            onClick={() => void createRootNode(nodes).then((created) => setFocusedId(created.id))}
          >
            <span className="outline-view__add-icon">+</span>
            Add item
          </button>
        </div>
      </div>
    </main>
  )
}
