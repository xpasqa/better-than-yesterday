import { project as computeProject } from '@better/core/views'
import { useAllLabels, useAllNodes } from '../store/use-nodes'
import type { AuthUser } from '../store/auth-api'
import TaskRow from './TaskRow'
import QuickAddBar from './QuickAddBar'
import SyncStatusBadge from './SyncStatusBadge'
import './RealView.css'

interface ProjectRealProps {
  user: AuthUser
  projectId: string
}

function ProjectReal({ user, projectId }: ProjectRealProps) {
  const nodes = useAllNodes()
  const labels = useAllLabels()
  const labelsById = new Map(labels.map((l) => [l.id, l]))
  const project = nodes.find((n) => n.id === projectId && n.kind === 'project')
  const items = project ? computeProject(nodes, projectId) : []

  return (
    <div className="real-view">
      <header className="real-view__header">
        <h1>{project?.content ?? 'Project not found'}</h1>
        <SyncStatusBadge />
      </header>

      {project ? (
        <>
          <QuickAddBar timezone={user.timezone ?? 'Asia/Jakarta'} defaultParentId={projectId} />
          {items.length === 0 ? (
            <p className="real-view__empty">No tasks in this project yet.</p>
          ) : (
            <ul className="real-view__list">
              {items.map((n) => (
                <TaskRow key={n.id} node={n} labelsById={labelsById} />
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="real-view__empty">
          This project id isn't in your synced tree — it may still be one of the sample projects that
          hasn't been migrated to a real project yet.
        </p>
      )}
    </div>
  )
}

export default ProjectReal
