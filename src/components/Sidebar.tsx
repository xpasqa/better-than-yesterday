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

/* All nav glyphs are outlines, matching Todoist's stroked icon set */
const InboxIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path d="M4 5.5h16v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-9z" strokeLinejoin="round" />
    <path d="M4 13h4a4 4 0 0 0 8 0h4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/* Outline calendar — the date number is overlaid on top of it */
const TodayIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <line x1="3" y1="9.5" x2="21" y2="9.5" />
  </svg>
)

/* Calendar frame filled with a grid of dots */
const UpcomingIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <line x1="3" y1="9.5" x2="21" y2="9.5" />
    <g fill="currentColor" stroke="none">
      <circle cx="7.5" cy="13" r="1" />
      <circle cx="12" cy="13" r="1" />
      <circle cx="16.5" cy="13" r="1" />
      <circle cx="7.5" cy="17" r="1" />
      <circle cx="12" cy="17" r="1" />
      <circle cx="16.5" cy="17" r="1" />
    </g>
  </svg>
)

/* Four rounded squares, not a funnel */
const FiltersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" />
  </svg>
)

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <circle cx="10.5" cy="10.5" r="6.5" />
    <line x1="15.5" y1="15.5" x2="20.5" y2="20.5" strokeLinecap="round" />
  </svg>
)

/* Trend line inside a framed card */
const ReportingIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M6.5 14.5l3-3.5 2.5 2.5 2.5-4 3 3.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const ChevronDown = ({ open }: { open: boolean }) => (
  <svg
    width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}
  >
    <path d="M6 9.5l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const AddIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
  </svg>
)

/* Panel-toggle glyph, matching Todoist's sidebar control */
const CollapseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <line x1="10" y1="4" x2="10" y2="20" />
  </svg>
)

const BellIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const SmallChevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M6 9.5l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export default function Sidebar({
  activeView, activeProjectId, collapsed, tasks,
  onViewChange, onProjectChange, onToggleCollapse
}: SidebarProps) {
  const [projectsExpanded, setProjectsExpanded] = useState(true)

  const today = new Date().toISOString().split('T')[0]
  const todayCount = tasks.filter(t => !t.isCompleted && t.dueDate === today).length
  const inboxCount = tasks.filter(t => !t.isCompleted && t.projectId === 'inbox').length

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
        <button className="sidebar__workspace" type="button">
          <div className="sidebar__avatar">P</div>
          <span className="sidebar__workspace-name">Pasqa</span>
          <span className="sidebar__workspace-chevron"><SmallChevron /></span>
        </button>
        <div className="sidebar__header-actions">
          <button className="sidebar__bell" title="Notifications" type="button">
            <BellIcon />
            <span className="sidebar__bell-dot" />
          </button>
          <button className="sidebar__collapse-btn" onClick={onToggleCollapse} title="Collapse sidebar">
            <CollapseIcon />
          </button>
        </div>
      </div>

      <nav className="sidebar__nav">
        {/* Primary navigation */}
        <ul className="sidebar__nav-list">
          <li>
            <button className="sidebar__add-task" type="button">
              <span className="sidebar__add-task-icon"><AddIcon /></span>
              <span>Add task</span>
            </button>
          </li>
          <li>
            <button className="sidebar__nav-item" type="button">
              <span className="sidebar__nav-icon"><SearchIcon /></span>
              <span className="sidebar__nav-label">Search</span>
            </button>
          </li>
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
              <span className="sidebar__nav-icon sidebar__nav-icon--today">
                <TodayIcon />
                <span className="sidebar__nav-date">{new Date().getDate()}</span>
              </span>
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
          <li>
            <button className="sidebar__nav-item" type="button">
              <span className="sidebar__nav-icon"><ReportingIcon /></span>
              <span className="sidebar__nav-label">Reporting</span>
            </button>
          </li>
        </ul>

        {/* Projects */}
        <div className="sidebar__section">
          <div className="sidebar__section-header">
            <span className="sidebar__section-title">My Projects</span>
            <button
              className="sidebar__section-add"
              title="Add project"
              type="button"
            >
              <AddIcon />
            </button>
            <button
              className="sidebar__section-chevron"
              onClick={() => setProjectsExpanded(e => !e)}
              title={projectsExpanded ? 'Collapse' : 'Expand'}
              type="button"
            >
              <ChevronDown open={projectsExpanded} />
            </button>
          </div>
          {projectsExpanded && (
            <ul className="sidebar__nav-list">
              {allProjects.map(project => (
                <li key={project.id}>
                  <button
                    className={`sidebar__nav-item ${activeProjectId === project.id ? 'sidebar__nav-item--active' : ''}`}
                    onClick={() => onProjectChange(project.id)}
                  >
                    <span className="sidebar__project-hash" style={{ color: project.color }}>#</span>
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
