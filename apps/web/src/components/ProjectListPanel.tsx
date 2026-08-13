// The secondary panel that opens when the main sidebar's single "Projects"
// row is clicked — same visual pattern as MailView's folder column
// (35.project-secondary-panel). Favorites + the Area→Project tree used to
// live inline in the main sidebar; they moved here so the primary nav stays
// six clean Things views.
import { useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { CaretDownIcon, FolderIcon, PencilSimpleIcon, PlusIcon, TrayIcon } from '@phosphor-icons/react'
import { project as computeProject } from '@better/core/views'
import type { Node as TaskNode } from '@better/core/node'
import { ProjectRow } from './Sidebar'
import './ProjectListPanel.css'

interface ProjectListPanelProps {
  realNodes: TaskNode[]
  activeProjectId: string | null
  onProjectChange: (id: string) => void
  onAddProject: (kind: 'project' | 'area') => void
  onEditNode?: (node: TaskNode) => void
  /** Hides the panel on compact widths once a project is open (spec: drill-down, like Mail on phone). */
  drillDownHidden?: boolean
}

const ChevronDown = ({ open }: { open: boolean }) => (
  <CaretDownIcon
    size={14}
    weight="bold"
    style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}
  />
)

export default function ProjectListPanel({
  realNodes, activeProjectId, onProjectChange, onAddProject, onEditNode, drillDownHidden = false,
}: ProjectListPanelProps) {
  const [favoritesExpanded, setFavoritesExpanded] = useState(true)
  const [projectsExpanded, setProjectsExpanded] = useState(true)
  const [areaExpanded, setAreaExpanded] = useState<Record<string, boolean>>({})
  const isAreaExpanded = (id: string) => areaExpanded[id] !== false

  const addTriggerRef = useRef<HTMLButtonElement>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [addMenuPos, setAddMenuPos] = useState<{ top: number; right: number } | null>(null)

  const inboxNode = realNodes.find((n) => n.isInbox)
  const allProjects = realNodes.filter(
    (n) => n.kind === 'project' && n.deletedAt === null && n.id !== inboxNode?.id,
  )
  const favoriteProjects = allProjects.filter((n) => n.isFavorite)
  const areas = realNodes
    .filter((n) => n.kind === 'area' && n.deletedAt === null)
    .sort((a, b) => (a.rank < b.rank ? -1 : 1))
  const projectsByArea = (areaId: string) =>
    allProjects.filter((n) => n.parentId === areaId).sort((a, b) => (a.rank < b.rank ? -1 : 1))
  const orphanProjects = allProjects
    .filter((n) => n.parentId === null)
    .sort((a, b) => (a.rank < b.rank ? -1 : 1))

  return (
    <aside className={`project-list-panel${drillDownHidden ? ' project-list-panel--drilldown-hidden' : ''}`}>
      {favoriteProjects.length > 0 && (
        <div className="sidebar__section">
          <div className="sidebar__section-header">
            <span className="sidebar__section-title">Favorites</span>
            <button
              className="sidebar__section-chevron"
              onClick={() => setFavoritesExpanded((e) => !e)}
              title={favoritesExpanded ? 'Collapse' : 'Expand'}
              type="button"
            >
              <ChevronDown open={favoritesExpanded} />
            </button>
          </div>
          {favoritesExpanded && (
            <ul className="sidebar__nav-list">
              {favoriteProjects.map((project) => (
                <ProjectRow
                  key={`fav-${project.id}`}
                  project={project}
                  isActive={activeProjectId === project.id}
                  allNodes={realNodes}
                  onProjectChange={onProjectChange}
                  onEditNode={onEditNode}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="sidebar__section">
        <div className="sidebar__section-header">
          <span className="sidebar__section-title">My Projects</span>
          <button
            ref={addTriggerRef}
            className="sidebar__section-add"
            title="Add project or area"
            type="button"
            onClick={() => {
              const rect = addTriggerRef.current?.getBoundingClientRect()
              if (rect) setAddMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
              setAddMenuOpen((o) => !o)
            }}
            aria-label="Add project or area"
            aria-haspopup="true"
            aria-expanded={addMenuOpen}
          >
            <PlusIcon size={16} weight="bold" />
          </button>
          {addMenuOpen && addMenuPos && createPortal(
            <div
              className="sidebar__profile-menu sidebar__add-menu"
              role="menu"
              style={{ position: 'fixed', top: addMenuPos.top, right: addMenuPos.right }}
              onMouseLeave={() => setAddMenuOpen(false)}
            >
              <button
                className="sidebar__profile-item"
                role="menuitem"
                type="button"
                onClick={() => { setAddMenuOpen(false); onAddProject('project') }}
              >
                <FolderIcon size={15} />
                New Project
              </button>
              <button
                className="sidebar__profile-item"
                role="menuitem"
                type="button"
                onClick={() => { setAddMenuOpen(false); onAddProject('area') }}
              >
                <TrayIcon size={15} />
                New Area
              </button>
            </div>,
            document.body,
          )}
          <button
            className="sidebar__section-chevron"
            onClick={() => setProjectsExpanded((e) => !e)}
            title={projectsExpanded ? 'Collapse' : 'Expand'}
            type="button"
          >
            <ChevronDown open={projectsExpanded} />
          </button>
        </div>
        {projectsExpanded && (
          <ul className="sidebar__nav-list">
            {areas.map((area) => {
              const children = projectsByArea(area.id)
              const expanded = isAreaExpanded(area.id)
              const areaCount = children.reduce((sum, p) => sum + computeProject(realNodes, p.id).length, 0)
              return (
                <li key={area.id}>
                  <div className="sidebar__area-row">
                    <button
                      className="sidebar__area-header"
                      type="button"
                      onClick={() => setAreaExpanded((s) => ({ ...s, [area.id]: !expanded }))}
                      aria-expanded={expanded}
                    >
                      <span className="sidebar__area-dot" style={{ '--area-dot-color': area.color ?? 'var(--text-secondary)' } as CSSProperties} />
                      <span className="sidebar__nav-label">{area.content}</span>
                      {areaCount > 0 && <span className="sidebar__nav-count">{areaCount}</span>}
                      <span className="sidebar__area-chevron">
                        <ChevronDown open={expanded} />
                      </span>
                    </button>
                    {onEditNode && (
                      <button
                        className="sidebar__row-edit"
                        type="button"
                        aria-label={`Edit ${area.content}`}
                        onClick={() => onEditNode(area)}
                      >
                        <PencilSimpleIcon size={13} />
                      </button>
                    )}
                  </div>
                  {expanded && children.length > 0 && (
                    <ul className="sidebar__nav-list">
                      {children.map((project) => (
                        <ProjectRow
                          key={project.id}
                          project={project}
                          isActive={activeProjectId === project.id}
                          allNodes={realNodes}
                          onProjectChange={onProjectChange}
                          onEditNode={onEditNode}
                          indented
                        />
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}

            {orphanProjects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                isActive={activeProjectId === project.id}
                allNodes={realNodes}
                onProjectChange={onProjectChange}
                onEditNode={onEditNode}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
