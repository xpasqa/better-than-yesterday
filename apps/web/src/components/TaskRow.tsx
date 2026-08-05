import { CheckCircleIcon, CircleIcon } from '@phosphor-icons/react'
import type { Node } from '@better/core/node'
import type { Label } from '@better/core/label'
import { toggleTaskComplete } from '../store/node-actions'
import './TaskRow.css'

interface TaskRowProps {
  node: Node
  labelsById: Map<string, Label>
}

/** Shared row for every real (store-backed) task view — Today, Inbox, Upcoming, Project. */
function TaskRow({ node, labelsById }: TaskRowProps) {
  const done = node.completedAt !== null
  return (
    <li className={`task-row${done ? ' task-row--done' : ''}`}>
      <button
        type="button"
        className="task-row__check"
        aria-label={done ? `Mark "${node.content}" not done` : `Mark "${node.content}" done`}
        onClick={() => void toggleTaskComplete(node)}
      >
        {done ? <CheckCircleIcon size={20} weight="fill" /> : <CircleIcon size={20} />}
      </button>
      <span className="task-row__content">{node.content}</span>
      {node.labelIds.map((id) => {
        const found = labelsById.get(id)
        return found ? (
          <span key={id} className="task-row__label">
            {found.name}
          </span>
        ) : null
      })}
      {node.dueTime && <span className="task-row__time">{node.dueTime}</span>}
      {node.priority && <span className={`task-row__priority task-row__priority--${node.priority}`} />}
    </li>
  )
}

export default TaskRow
