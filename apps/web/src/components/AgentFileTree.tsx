import { useState } from 'react'
import { CaretRightIcon, FileMdIcon, FolderIcon } from '@phosphor-icons/react'
import type { AgentFile } from '../agent/mockFiles'
import './AgentFileTree.css'

interface AgentFileTreeProps {
  files: AgentFile[]
  selectedPath: string | null
  unseenPaths: Set<string>
  onSelect: (path: string) => void
}

interface TreeFolder {
  kind: 'folder'
  name: string
  path: string
  children: TreeNode[]
}

interface TreeLeaf {
  kind: 'file'
  name: string
  path: string
}

type TreeNode = TreeFolder | TreeLeaf

function buildTree(files: AgentFile[]): TreeNode[] {
  const root: TreeFolder = { kind: 'folder', name: '', path: '', children: [] }

  for (const file of files) {
    const segments = file.path.split('/')
    let cursor = root
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]
      const path = segments.slice(0, i + 1).join('/')
      let next = cursor.children.find(
        (n): n is TreeFolder => n.kind === 'folder' && n.name === segment,
      )
      if (!next) {
        next = { kind: 'folder', name: segment, path, children: [] }
        cursor.children.push(next)
      }
      cursor = next
    }
    cursor.children.push({ kind: 'file', name: segments[segments.length - 1], path: file.path })
  }

  return root.children
}

function TreeNodeRow({
  node, depth, selectedPath, unseenPaths, onSelect,
}: {
  node: TreeNode
  depth: number
  selectedPath: string | null
  unseenPaths: Set<string>
  onSelect: (path: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  if (node.kind === 'folder') {
    return (
      <div className="agent-file-tree__branch">
        <button
          className="agent-file-tree__row agent-file-tree__row--folder"
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => setCollapsed(c => !c)}
          type="button"
        >
          <CaretRightIcon
            size={11}
            weight="bold"
            className={`agent-file-tree__caret ${collapsed ? '' : 'agent-file-tree__caret--open'}`}
          />
          <FolderIcon size={15} weight="fill" className="agent-file-tree__folder-icon" />
          <span className="agent-file-tree__name">{node.name}</span>
        </button>
        {!collapsed && node.children.map(child => (
          <TreeNodeRow
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            unseenPaths={unseenPaths}
            onSelect={onSelect}
          />
        ))}
      </div>
    )
  }

  const isSelected = node.path === selectedPath
  return (
    <button
      className={`agent-file-tree__row agent-file-tree__row--file ${isSelected ? 'agent-file-tree__row--selected' : ''}`}
      style={{ paddingLeft: 8 + depth * 14 + 15 }}
      onClick={() => onSelect(node.path)}
      type="button"
    >
      <FileMdIcon size={15} className="agent-file-tree__file-icon" />
      <span className="agent-file-tree__name">{node.name}</span>
      {unseenPaths.has(node.path) && <span className="agent-file-tree__dot" />}
    </button>
  )
}

export default function AgentFileTree({ files, selectedPath, unseenPaths, onSelect }: AgentFileTreeProps) {
  const tree = buildTree(files)

  if (files.length === 0) {
    return <p className="agent-file-tree__empty">No files yet</p>
  }

  return (
    <div className="agent-file-tree">
      {tree.map(node => (
        <TreeNodeRow
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          unseenPaths={unseenPaths}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
