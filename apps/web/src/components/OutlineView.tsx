import { useEffect, useRef, useState, useCallback, type KeyboardEvent } from 'react'
import { CaretDownIcon } from '@phosphor-icons/react'
import type { Node } from '@better/core/node'
import { useAllNodes } from '../store/use-nodes'
import { toggleTaskComplete, deleteTask } from '../store/node-actions'
import { patchNode, createSiblingNode, createRootNode, indentNode, outdentNode } from '../store/outline-actions'
import './OutlineView.css'

/*
 * Wired to the same node tree Todo reads (2.outline/spec.md §12: no new
 * table, no migration — parentId/rank/content/collapsed/completedAt already
 * exist). This covers section B of that spec's todo: store-backed tree,
 * the five existing keyboard ops mapped onto core/tree.ts, and debounced
 * save. Mention chips, progress, backlinks, zoom routing, and the iPad
 * toolbar (sections C–I) are intentionally not built yet — this proves the
 * structural half of "one tree" first.
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

interface RowProps {
  node: Node
  allNodes: Node[]
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
  const { node, allNodes, focusedId, onFocus, onDelete, onEnter, onIndent, onOutdent, onArrowUp, onArrowDown } = props
  const kids = childrenOf(allNodes, node.id)
  const hasChildren = kids.length > 0
  const isFocused = focusedId === node.id
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(node.content)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Pick up remote/other-tab edits, but never clobber what's being typed right now.
  useEffect(() => {
    if (!isFocused) setText(node.content)
  }, [node.content, isFocused])

  useEffect(() => {
    if (isFocused) inputRef.current?.focus()
  }, [isFocused])

  const flush = useCallback(
    (value: string) => {
      clearTimeout(debounceRef.current)
      if (value !== node.content) void patchNode(node, { content: value })
    },
    [node],
  )

  const handleChange = (value: string) => {
    setText(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => flush(value), 500)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      flush(text)
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
      flush(text)
      onArrowUp(node.id)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      flush(text)
      onArrowDown(node.id)
    }
  }

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
          onClick={() => void toggleTaskComplete(node)}
          tabIndex={-1}
          aria-label="Toggle complete"
        >
          <span className="outline-node__bullet-dot" />
        </button>

        <input
          ref={inputRef}
          className="outline-node__input"
          value={text}
          placeholder="Type something…"
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => flush(text)}
          onKeyDown={handleKeyDown}
          onFocus={() => onFocus(node.id)}
        />

        {node.collapsed && hasChildren && <span className="outline-node__child-count">{kids.length}</span>}
      </div>

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

export default function OutlineView() {
  const nodes = useAllNodes()
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
