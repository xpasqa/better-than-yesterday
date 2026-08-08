import { useState } from 'react'
import { board } from '@better/core/board'
import { SquaresFourIcon, ListBulletsIcon, CheckCircleIcon, EyeIcon, EyeSlashIcon, PlusIcon } from '@phosphor-icons/react'
import { useAllTags, useAllNodes } from '../store/use-nodes'
import type { AuthUser } from '../store/auth-api'
import { useShowCompleted } from '../hooks/useShowCompleted'
import TaskRow from './TaskRow'
import AddTaskFormReal from './AddTaskFormReal'
import SyncStatusBadge from './SyncStatusBadge'
import BoardView from './BoardView'
import './RealView.css'

interface ProjectRealProps {
  user: AuthUser
  projectId: string
  onOpenNode?: (id: string) => void
}

function ProjectReal({ user, projectId, onOpenNode }: ProjectRealProps) {
  const nodes = useAllNodes()
  const tags = useAllTags()
  const tagsById = new Map(tags.map((t) => [t.id, t]))
  const [addingTask, setAddingTask] = useState(false)
  const [showCompleted, toggleShowCompleted] = useShowCompleted()

  const storageKey = `bty.project-view.${projectId}`
  const [mode, setMode] = useState<'list' | 'board'>(
    () => (localStorage.getItem(storageKey) === 'board' ? 'board' : 'list'),
  )

  function chooseMode(next: 'list' | 'board') {
    setMode(next)
    localStorage.setItem(storageKey, next)
  }

  const project = nodes.find((n) => n.id === projectId && n.kind === 'project')
  const columns = project ? board(nodes, projectId) : []
  const taskCount = columns.reduce((sum, c) => sum + c.items.length, 0)

  return (
    <main className="real-view">
      <div className="real-view__inner">
        <div className="real-view__header">
          <h1>{project?.content ?? 'Project not found'}</h1>
          {project && (
            <p className="real-view__subtitle">
              <CheckCircleIcon size={14} />
              {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
              <SyncStatusBadge />
              {mode === 'list' && (
                <button
                  className="real-view__toggle-completed"
                  onClick={toggleShowCompleted}
                  type="button"
                  aria-pressed={showCompleted}
                  title={showCompleted ? 'Hide completed tasks' : 'Show completed tasks'}
                >
                  {showCompleted ? <EyeSlashIcon size={14} /> : <EyeIcon size={14} />}
                  {showCompleted ? 'Hide completed' : 'Show completed'}
                </button>
              )}
              <button
                className={`real-view__toggle-completed${mode === 'list' ? ' real-view__toggle-completed--active' : ''}`}
                type="button"
                onClick={() => chooseMode('list')}
                aria-pressed={mode === 'list'}
                title="List view"
              >
                <ListBulletsIcon size={14} />
              </button>
              <button
                className={`real-view__toggle-completed${mode === 'board' ? ' real-view__toggle-completed--active' : ''}`}
                type="button"
                onClick={() => chooseMode('board')}
                aria-pressed={mode === 'board'}
                title="Board view"
              >
                <SquaresFourIcon size={14} />
              </button>
            </p>
          )}
        </div>

        {project ? (
          mode === 'board' ? (
            <BoardView user={user} projectId={projectId} onOpenNode={onOpenNode} />
          ) : (
            <>
              {columns.map((col) => (
                <div key={col.section?.id ?? projectId} className="real-view__group">
                  {col.section && <h2 className="real-view__section-heading">{col.section.content}</h2>}
                  {col.items.length > 0 && (
                    <ul className="real-view__list">
                      {col.items.map((n) => (
                        <TaskRow key={n.id} node={n} tagsById={tagsById} onOpenNode={onOpenNode ? (n) => onOpenNode(n.id) : undefined} timezone={user.timezone ?? 'Asia/Jakarta'} />
                      ))}
                    </ul>
                  )}
                </div>
              ))}

              {addingTask ? (
                <AddTaskFormReal
                  timezone={user.timezone ?? 'Asia/Jakarta'}
                  defaultParentId={projectId}
                  onCancel={() => setAddingTask(false)}
                  onAdded={() => setAddingTask(false)}
                />
              ) : (
                <button className="real-view__add-task-btn" onClick={() => setAddingTask(true)} type="button">
                  <PlusIcon size={16} weight="bold" />
                  Add task
                </button>
              )}
            </>
          )
        ) : (
          <p className="real-view__empty">
            This project id isn't in your synced tree yet.
          </p>
        )}
      </div>
    </main>
  )
}

export default ProjectReal
