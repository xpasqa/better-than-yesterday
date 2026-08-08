import { CheckCircleIcon } from '@phosphor-icons/react'
import { toggleTaskComplete } from '../store/node-actions'
import type { Node } from '@better/core/node'
import type { Tag } from '@better/core/tag'

interface BoardCardProps {
  node: Node
  tagsById: Map<string, Tag>
  timezone: string
  onOpen?: (id: string) => void
}

function BoardCard({ node, tagsById, timezone, onOpen }: BoardCardProps) {
  return (
    <article
      className="board__card"
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', node.id)}
      onClick={() => onOpen?.(node.id)}
    >
      <button
        className={`board__card-check board__card-check--p${node.priority ?? 4}`}
        type="button"
        aria-label={`Complete ${node.content}`}
        onClick={(e) => { e.stopPropagation(); void toggleTaskComplete(node, timezone) }}
      >
        <CheckCircleIcon size={16} />
      </button>
      <span className="board__card-title">{node.content}</span>
      {node.dueDate && <span className="board__card-date">{node.dueDate}</span>}
      {node.tagIds.length > 0 && (
        <span className="board__card-tags">
          {node.tagIds.map((id) => tagsById.get(id)?.name).filter(Boolean).map((name) => (
            <span key={name} className="board__card-tag">{name}</span>
          ))}
        </span>
      )}
    </article>
  )
}

export default BoardCard
