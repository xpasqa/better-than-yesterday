import { useState, useRef, useEffect, useCallback } from 'react'
import type { OutlineNode } from '../types'
import './OutlineView.css'

// --- Sample data ---
const createNode = (id: string, content: string, children: OutlineNode[] = []): OutlineNode => ({
  id, content, children, isCollapsed: false, isCompleted: false,
})

const initialOutline: OutlineNode[] = [
  createNode('1', 'Product roadmap Q3 2026', [
    createNode('1-1', 'Design system overhaul', [
      createNode('1-1-1', 'Audit existing components'),
      createNode('1-1-2', 'Define new token structure'),
      createNode('1-1-3', 'Migrate Sidebar and TaskItem'),
    ]),
    createNode('1-2', 'Outline feature', [
      createNode('1-2-1', 'Nested bullet editing'),
      createNode('1-2-2', 'Collapse / expand nodes'),
      createNode('1-2-3', 'Keyboard navigation'),
    ]),
    createNode('1-3', 'API integration'),
  ]),
  createNode('2', 'Meeting notes', [
    createNode('2-1', 'Weekly sync 4 Aug', [
      createNode('2-1-1', 'Review sprint progress'),
      createNode('2-1-2', 'Blockers: design handoff delayed'),
    ]),
    createNode('2-2', 'Design review 5 Aug'),
  ]),
  createNode('3', 'Reading list'),
  createNode('4', 'Ideas & scratch'),
]

// --- Helpers ---
function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

function findAndUpdate(
  nodes: OutlineNode[],
  id: string,
  updater: (node: OutlineNode) => OutlineNode,
): OutlineNode[] {
  return nodes.map(n => {
    if (n.id === id) return updater(n)
    return { ...n, children: findAndUpdate(n.children, id, updater) }
  })
}

function findAndDelete(nodes: OutlineNode[], id: string): OutlineNode[] {
  return nodes
    .filter(n => n.id !== id)
    .map(n => ({ ...n, children: findAndDelete(n.children, id) }))
}

function insertAfter(nodes: OutlineNode[], id: string, newNode: OutlineNode): OutlineNode[] {
  const result: OutlineNode[] = []
  for (const n of nodes) {
    result.push({ ...n, children: insertAfter(n.children, id, newNode) })
    if (n.id === id) result.push(newNode)
  }
  return result
}

function flattenVisible(nodes: OutlineNode[], depth = 0): { node: OutlineNode; depth: number }[] {
  const result: { node: OutlineNode; depth: number }[] = []
  for (const n of nodes) {
    result.push({ node: n, depth })
    if (!n.isCollapsed && n.children.length > 0) {
      result.push(...flattenVisible(n.children, depth + 1))
    }
  }
  return result
}

// --- Node component ---
interface OutlineNodeRowProps {
  node: OutlineNode
  depth: number
  isFocused: boolean
  onFocus: (id: string) => void
  onChange: (id: string, content: string) => void
  onToggleCollapse: (id: string) => void
  onToggleComplete: (id: string) => void
  onEnter: (id: string) => void
  onDelete: (id: string) => void
  onIndent: (id: string) => void
  onOutdent: (id: string) => void
  onArrowUp: (id: string) => void
  onArrowDown: (id: string) => void
  hasChildren: boolean
}

function OutlineNodeRow({
  node, depth, isFocused,
  onFocus, onChange, onToggleCollapse, onToggleComplete,
  onEnter, onDelete, onIndent, onOutdent, onArrowUp, onArrowDown,
  hasChildren,
}: OutlineNodeRowProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isFocused) inputRef.current?.focus()
  }, [isFocused])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); onEnter(node.id) }
    else if (e.key === 'Backspace' && node.content === '') { e.preventDefault(); onDelete(node.id) }
    else if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); onIndent(node.id) }
    else if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); onOutdent(node.id) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); onArrowUp(node.id) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); onArrowDown(node.id) }
  }

  return (
    <div
      className={`outline-node ${node.isCompleted ? 'outline-node--completed' : ''}`}
      style={{ paddingLeft: `${depth * 20 + 4}px` }}
    >
      {/* Collapse toggle — only visible when node has children */}
      <button
        className={`outline-node__collapse ${hasChildren ? 'outline-node__collapse--visible' : ''}`}
        onClick={() => hasChildren && onToggleCollapse(node.id)}
        tabIndex={-1}
        aria-label={node.isCollapsed ? 'Expand' : 'Collapse'}
      >
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
          style={{ transform: node.isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
        >
          <path d="M2 3l3 4 3-4H2z" />
        </svg>
      </button>

      {/* Bullet */}
      <button
        className="outline-node__bullet"
        onClick={() => onToggleComplete(node.id)}
        tabIndex={-1}
        aria-label="Toggle complete"
      >
        <span className="outline-node__bullet-dot" />
      </button>

      {/* Content input */}
      <input
        ref={inputRef}
        className="outline-node__input"
        value={node.content}
        placeholder="Type something…"
        onChange={e => onChange(node.id, e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => onFocus(node.id)}
      />

      {/* Child count badge when collapsed */}
      {node.isCollapsed && hasChildren && (
        <span className="outline-node__child-count">{node.children.length}</span>
      )}
    </div>
  )
}

// --- Main OutlineView ---
export default function OutlineView() {
  const [nodes, setNodes] = useState<OutlineNode[]>(initialOutline)
  const [focusedId, setFocusedId] = useState<string | null>(null)

  const flat = flattenVisible(nodes)

  const handleChange = useCallback((id: string, content: string) => {
    setNodes(prev => findAndUpdate(prev, id, n => ({ ...n, content })))
  }, [])

  const handleToggleCollapse = useCallback((id: string) => {
    setNodes(prev => findAndUpdate(prev, id, n => ({ ...n, isCollapsed: !n.isCollapsed })))
  }, [])

  const handleToggleComplete = useCallback((id: string) => {
    setNodes(prev => findAndUpdate(prev, id, n => ({ ...n, isCompleted: !n.isCompleted })))
  }, [])

  const handleEnter = useCallback((id: string) => {
    const newNode = createNode(generateId(), '')
    setNodes(prev => insertAfter(prev, id, newNode))
    setFocusedId(newNode.id)
  }, [])

  const handleDelete = useCallback((id: string) => {
    const flatIdx = flat.findIndex(f => f.node.id === id)
    const prevId = flatIdx > 0 ? flat[flatIdx - 1].node.id : null
    setNodes(prev => findAndDelete(prev, id))
    if (prevId) setFocusedId(prevId)
  }, [flat])

  // Tab: make node a child of previous sibling
  const handleIndent = useCallback((id: string) => {
    const flatIdx = flat.findIndex(f => f.node.id === id)
    if (flatIdx <= 0) return
    const prevNode = flat[flatIdx - 1].node
    const target = (nodes: OutlineNode[]) => {
      // Remove from current position
      let removed: OutlineNode | null = null
      const without = (ns: OutlineNode[]): OutlineNode[] =>
        ns.reduce<OutlineNode[]>((acc, n) => {
          if (n.id === id) { removed = n; return acc }
          return [...acc, { ...n, children: without(n.children) }]
        }, [])
      const pruned = without(nodes)
      if (!removed) return nodes
      // Append to prev sibling's children
      return findAndUpdate(pruned, prevNode.id, n => ({
        ...n,
        isCollapsed: false,
        children: [...n.children, removed!],
      }))
    }
    setNodes(prev => target(prev))
    setFocusedId(id)
  }, [flat, nodes])

  // Shift+Tab: move node up one level
  const handleOutdent = useCallback((id: string) => {
    // Find parent
    const findParent = (ns: OutlineNode[], _parentId: string | null): string | null => {
      for (const n of ns) {
        if (n.children.some(c => c.id === id)) return n.id
        const found = findParent(n.children, n.id)
        if (found) return found
      }
      return null
    }
    const parentId = findParent(nodes, null)
    if (!parentId) return

    let moved: OutlineNode | null = null
    const removeFromParent = (ns: OutlineNode[]): OutlineNode[] =>
      ns.map(n => {
        if (n.id === parentId) {
          moved = n.children.find(c => c.id === id) ?? null
          return { ...n, children: n.children.filter(c => c.id !== id) }
        }
        return { ...n, children: removeFromParent(n.children) }
      })

    const pruned = removeFromParent(nodes)
    if (!moved) return
    setNodes(insertAfter(pruned, parentId, moved))
    setFocusedId(id)
  }, [nodes])

  const handleArrowUp = useCallback((id: string) => {
    const idx = flat.findIndex(f => f.node.id === id)
    if (idx > 0) setFocusedId(flat[idx - 1].node.id)
  }, [flat])

  const handleArrowDown = useCallback((id: string) => {
    const idx = flat.findIndex(f => f.node.id === id)
    if (idx < flat.length - 1) setFocusedId(flat[idx + 1].node.id)
  }, [flat])

  return (
    <main className="outline-view">
      <div className="outline-view__inner">
        <div className="outline-view__header">
          <h1 className="outline-view__title">Outline</h1>
          <p className="outline-view__subtitle">Nested notes — press Enter to add, Tab to indent, Shift+Tab to outdent</p>
        </div>

        <div className="outline-view__body">
          {flat.map(({ node, depth }) => (
            <OutlineNodeRow
              key={node.id}
              node={node}
              depth={depth}
              isFocused={focusedId === node.id}
              hasChildren={node.children.length > 0}
              onFocus={setFocusedId}
              onChange={handleChange}
              onToggleCollapse={handleToggleCollapse}
              onToggleComplete={handleToggleComplete}
              onEnter={handleEnter}
              onDelete={handleDelete}
              onIndent={handleIndent}
              onOutdent={handleOutdent}
              onArrowUp={handleArrowUp}
              onArrowDown={handleArrowDown}
            />
          ))}

          {/* Add root node */}
          <button
            className="outline-view__add-root"
            onClick={() => {
              const n = createNode(generateId(), '')
              setNodes(prev => [...prev, n])
              setFocusedId(n.id)
            }}
          >
            <span className="outline-view__add-icon">+</span>
            Add item
          </button>
        </div>
      </div>
    </main>
  )
}
