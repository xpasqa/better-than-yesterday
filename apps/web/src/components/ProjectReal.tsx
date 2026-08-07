import { useState } from 'react'
import { project as computeProject } from '@better/core/views'
import { CheckCircleIcon, PlusIcon } from '@phosphor-icons/react'
import { useAllLabels, useAllNodes } from '../store/use-nodes'
import type { AuthUser } from '../store/auth-api'
import TaskRow from './TaskRow'
import AddTaskFormReal from './AddTaskFormReal'
import SyncStatusBadge from './SyncStatusBadge'
import './RealView.css'

interface ProjectRealProps {
  user: AuthUser
  projectId: string
  onOpenNode?: (id: string) => void
}

function ProjectReal({ user, projectId, onOpenNode }: ProjectRealProps) {
  const nodes = useAllNodes()
  const labels = useAllLabels()
  const labelsById = new Map(labels.map((l) => [l.id, l]))
  const [addingTask, setAddingTask] = useState(false)

  const project = nodes.find((n) => n.id === projectId && n.kind === 'project')
  const items = project ? computeProject(nodes, projectId) : []

  return (
    <main className="real-view">
      <div className="real-view__inner">
        <div className="real-view__header">
          <h1>{project?.content ?? 'Project not found'}</h1>
          {project && (
            <p className="real-view__subtitle">
              <CheckCircleIcon size={14} />
              {items.length} {items.length === 1 ? 'task' : 'tasks'}
              <SyncStatusBadge />
            </p>
          )}
        </div>

        {project ? (
          <>
            {items.length > 0 && (
              <ul className="real-view__list">
                {items.map((n) => (
                  <TaskRow key={n.id} node={n} labelsById={labelsById} onOpenNode={onOpenNode ? (n) => onOpenNode(n.id) : undefined} />
                ))}
              </ul>
            )}

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
