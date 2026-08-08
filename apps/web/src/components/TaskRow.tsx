import { useState } from 'react'
import { ArrowsClockwiseIcon, CalendarBlankIcon, DotsThreeIcon, FlagIcon as PhFlagIcon, NotePencilIcon, TrashIcon } from '@phosphor-icons/react'
import type { Node } from '@better/core/node'
import type { Tag } from '@better/core/tag'
import { describeRecurrence } from '@better/core/recurrence'
import { toggleTaskComplete, deleteTask } from '../store/node-actions'
import { highlightTokens } from './highlightTokens'
import './TaskRow.css'

interface TaskRowProps {
  node: Node
  tagsById: Map<string, Tag>
  /** All nodes in the store — used to look up the parent project name. Omit in ProjectReal (redundant). */
  allNodes?: Node[]
  /** Called when the user clicks the content area to open the detail modal. */
  onOpenNode?: (node: Node) => void
  /** User's timezone — needed to catch an overdue recurring task up to "today" on completion (issue #26). */
  timezone: string
  /** When provided (e.g. from SearchView), matching substrings in title and note are wrapped in <mark>. */
  tokens?: string[]
}

const priorityColors: Record<number, string> = {
  1: 'var(--priority-p1)',
  2: 'var(--priority-p2)',
  3: 'var(--priority-p3)',
}

function formatDueDate(date: string): { text: string; overdue: boolean; isToday: boolean } {
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const overdue = date < today
  if (date === today) return { text: 'Today', overdue: false, isToday: true }
  if (date === tomorrow) return { text: 'Tomorrow', overdue: false, isToday: false }
  const d = new Date(date + 'T00:00:00')
  return {
    text: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    overdue,
    isToday: false,
  }
}

/** Shared row for every real (store-backed) task view — Today, Inbox, Upcoming, Project. */
function TaskRow({ node, tagsById, allNodes = [], onOpenNode, timezone, tokens }: TaskRowProps) {
  const [hovered, setHovered] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const done = node.completedAt !== null
  const dueInfo = node.dueDate ? formatDueDate(node.dueDate) : null
  const taskTags = node.tagIds.map(id => tagsById.get(id)).filter(Boolean) as Tag[]
  const priority = node.priority ?? 4

  // Project name — only shown when allNodes is passed (Today/Inbox/Upcoming, not ProjectReal)
  const parentProject = allNodes.length > 0 && node.parentId
    ? allNodes.find(n => n.id === node.parentId && n.kind === 'project' && !n.isInbox)
    : null

  return (
    <li
      className={[
        'task-row',
        done && 'task-row--done',
      ].filter(Boolean).join(' ')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowMenu(false) }}
    >
      {/* Checkbox */}
      <button
        type="button"
        className={`task-row__checkbox task-row__checkbox--p${priority}`}
        aria-label={done ? `Mark ${node.content} as incomplete` : `Mark ${node.content} as complete`}
        onClick={() => void toggleTaskComplete(node, timezone)}
      >
        {done && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div
        className="task-row__content"
        onClick={() => onOpenNode?.(node)}
        style={{ cursor: onOpenNode ? 'pointer' : 'default' }}
      >
        <p className="task-row__title">{tokens && tokens.length > 0 ? highlightTokens(node.content, tokens) : node.content}</p>
        {node.note && <p className="task-row__description">{tokens && tokens.length > 0 ? highlightTokens(node.note, tokens) : node.note}</p>}

        {/* Meta row */}
        {(dueInfo || node.dueTime || node.recurrence || taskTags.length > 0 || parentProject) && (
          <div className="task-row__meta">
            {dueInfo && (
              <span className={[
                'task-row__due',
                dueInfo.overdue && 'task-row__due--overdue',
                dueInfo.isToday && 'task-row__due--today',
              ].filter(Boolean).join(' ')}>
                <CalendarBlankIcon size={12} />
                {dueInfo.text}
                {node.dueTime && <span className="task-row__due-time">{node.dueTime}</span>}
              </span>
            )}
            {!dueInfo && node.dueTime && (
              <span className="task-row__due">
                <CalendarBlankIcon size={12} />
                <span className="task-row__due-time">{node.dueTime}</span>
              </span>
            )}
            {node.recurrence && (() => {
              const recLabel = describeRecurrence(node.recurrence)
              return recLabel ? (
                <span className="task-row__recurrence" title={recLabel}>
                  <ArrowsClockwiseIcon size={12} />
                  {recLabel}
                </span>
              ) : null
            })()}
            {taskTags.map(tag => (
              <span key={tag.id} className="task-row__tag" style={{ color: tag.color }}>
                ${tag.name}
              </span>
            ))}
            {parentProject && (
              <span className="task-row__project" style={{ color: parentProject.color ?? undefined }}>
                #{parentProject.content}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {hovered && (
        <div className="task-row__actions">
          {priority < 4 && (
            <span className="task-row__priority-flag">
              <PhFlagIcon size={12} weight="fill" color={priorityColors[priority]} />
            </span>
          )}
          <div className="task-row__menu-wrapper">
            <button
              type="button"
              className="task-row__action-btn"
              onClick={() => setShowMenu(m => !m)}
              aria-label="More options"
            >
              <DotsThreeIcon size={18} weight="bold" />
            </button>
            {showMenu && (
              <div className="task-row__dropdown">
                {onOpenNode && (
                  <button
                    type="button"
                    className="task-row__dropdown-item"
                    onClick={() => { onOpenNode(node); setShowMenu(false) }}
                  >
                    <NotePencilIcon size={16} />
                    Edit task
                  </button>
                )}
                <button
                  type="button"
                  className="task-row__dropdown-item task-row__dropdown-item--danger"
                  onClick={() => { void deleteTask(node); setShowMenu(false) }}
                >
                  <TrashIcon size={16} />
                  Delete task
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

export default TaskRow
