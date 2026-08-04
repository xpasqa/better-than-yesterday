import { useState } from 'react'
import type { ViewType, Task } from '../types'
import { projects } from '../data/mockData'
import './Sidebar.css'

interface SidebarProps {
  activeView: ViewType
  activeProjectId: string | null
  collapsed: boolean
  tasks: Task[]
  onViewChange: (view: ViewType) => void
  onProjectChange: (id: string) => void
  onToggleCollapse: () => void
}

const InboxIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 3H5C3.9 3 3 3.9 3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 12h-4c0 1.66-1.34 3-3 3s-3-1.34-3-3H5V5h14v10z"/>
  </svg>
)

const TodayIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 3h-1V1h-2v2H8V1H6v2H5C3.9 3 3 3.9 3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
  </svg>
)

const UpcomingIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5C3.9 3 3 3.9 3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/>
  </svg>
)

const FiltersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M4.25 5.61C6.27 8.2 10 13 10 13v6c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-6s3.72-4.8 5.74-7.39A.998.998 0 0 0 18.95 4H5.04a1 1 0 0 0-.79 1.61z"/>
  </svg>
)

const ChevronDown = ({ open }: { open: boolean }) => (
  <svg
    width="16" height="16" viewBox="0 0 24 24" fill="currentColor"
    style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}
  >
    <path d="M7 10l5 5 5-5z"/>
  </svg>
)

const AddIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
  </svg>
)

const CollapseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/>
  </svg>
)

export default function Sidebar({
  activeView, activeProjectId, collapsed, tasks,
  onViewChange, onProjectChange, onToggleCollapse
}: SidebarProps) {
  const [projectsExpanded, setProjectsExpanded] = useState(true)
  const [favoritesExpanded, setFavoritesExpanded] = useState(true)

  const today = new Date().toISOString().split('T')[0]
  const todayCount = tasks.filter(t => !t.isCompleted && t.dueDate === today).length
  const inboxCount = tasks.filter(t => !t.isCompleted && t.projectId === 'inbox').length

  const favoriteProjects = projects.filter(p => p.isFavorite)
  const allProjects = projects.filter(p => p.id !== 'inbox')

  const getProjectTaskCount = (id: string) =>
    tasks.filter(t => !t.isCompleted && t.projectId === id).length

  if (collapsed) {
    return (
      <aside className="sidebar sidebar--collapsed">
        <button className="sidebar__collapse-btn" onClick={onToggleCollapse} title="Expand sidebar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
          </svg>
        </button>
      </aside>
    )
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <div className="sidebar__workspace">
          <div className="sidebar__avatar">P</div>
          <span className="sidebar__workspace-name">Pasqa's workspace</span>
        </div>
        <button className="sidebar__collapse-btn sidebar__collapse-btn--header" onClick={onToggleCollapse} title="Collapse sidebar">
          <CollapseIcon />
        </button>
      </div>

      <nav className="sidebar__nav">
        {/* Primary navigation */}
        <ul className="sidebar__nav-list">
          <li>
            <button
              className={`sidebar__nav-item ${activeView === 'inbox' ? 'sidebar__nav-item--active' : ''}`}
              onClick={() => onViewChange('inbox')}
            >
              <span className="sidebar__nav-icon sidebar__nav-icon--inbox"><InboxIcon /></span>
              <span className="sidebar__nav-label">Inbox</span>
              {inboxCount > 0 && <span className="sidebar__nav-count">{inboxCount}</span>}
            </button>
          </li>
          <li>
            <button
              className={`sidebar__nav-item ${activeView === 'today' ? 'sidebar__nav-item--active' : ''}`}
              onClick={() => onViewChange('today')}
            >
              <span className="sidebar__nav-icon sidebar__nav-icon--today"><TodayIcon /></span>
              <span className="sidebar__nav-label">Today</span>
              {todayCount > 0 && <span className="sidebar__nav-count">{todayCount}</span>}
            </button>
          </li>
          <li>
            <button
              className={`sidebar__nav-item ${activeView === 'upcoming' ? 'sidebar__nav-item--active' : ''}`}
              onClick={() => onViewChange('upcoming')}
            >
              <span className="sidebar__nav-icon sidebar__nav-icon--upcoming"><UpcomingIcon /></span>
              <span className="sidebar__nav-label">Upcoming</span>
            </button>
          </li>
          <li>
            <button
              className={`sidebar__nav-item ${activeView === 'filters' ? 'sidebar__nav-item--active' : ''}`}
              onClick={() => onViewChange('filters')}
            >
              <span className="sidebar__nav-icon sidebar__nav-icon--filters"><FiltersIcon /></span>
              <span className="sidebar__nav-label">Filters & Labels</span>
            </button>
          </li>
        </ul>

        {/* Favorites */}
        {favoriteProjects.length > 0 && (
          <div className="sidebar__section">
            <button
              className="sidebar__section-header"
              onClick={() => setFavoritesExpanded(e => !e)}
            >
              <ChevronDown open={favoritesExpanded} />
              <span>Favorites</span>
            </button>
            {favoritesExpanded && (
              <ul className="sidebar__nav-list">
                {favoriteProjects.map(project => (
                  <li key={project.id}>
                    <button
                      className={`sidebar__nav-item ${activeProjectId === project.id ? 'sidebar__nav-item--active' : ''}`}
                      onClick={() => onProjectChange(project.id)}
                    >
                      <span className="sidebar__project-dot" style={{ background: project.color }} />
                      <span className="sidebar__nav-label">{project.name}</span>
                      {getProjectTaskCount(project.id) > 0 && (
                        <span className="sidebar__nav-count">{getProjectTaskCount(project.id)}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Projects */}
        <div className="sidebar__section">
          <button
            className="sidebar__section-header"
            onClick={() => setProjectsExpanded(e => !e)}
          >
            <ChevronDown open={projectsExpanded} />
            <span>My Projects</span>
            <button
              className="sidebar__section-add"
              onClick={(e) => { e.stopPropagation() }}
              title="Add project"
            >
              <AddIcon />
            </button>
          </button>
          {projectsExpanded && (
            <ul className="sidebar__nav-list">
              {allProjects.map(project => (
                <li key={project.id}>
                  <button
                    className={`sidebar__nav-item ${activeProjectId === project.id ? 'sidebar__nav-item--active' : ''}`}
                    onClick={() => onProjectChange(project.id)}
                  >
                    <span className="sidebar__project-dot" style={{ background: project.color }} />
                    <span className="sidebar__nav-label">{project.name}</span>
                    {getProjectTaskCount(project.id) > 0 && (
                      <span className="sidebar__nav-count">{getProjectTaskCount(project.id)}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </nav>
    </aside>
  )
}
