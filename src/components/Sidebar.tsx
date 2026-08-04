import { useState } from 'react'
import {
  BellIcon, CalendarBlankIcon, CalendarDotsIcon, CaretDownIcon, FolderIcon,
  ListBulletsIcon, MagnifyingGlassIcon, PlusIcon, SidebarSimpleIcon, SparkleIcon, SquaresFourIcon, TrayIcon,
} from '@phosphor-icons/react'
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

const ChevronDown = ({ open }: { open: boolean }) => (
  <CaretDownIcon
    size={14}
    weight="bold"
    style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}
  />
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
          <SidebarSimpleIcon size={20} />
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
          <span className="sidebar__workspace-chevron"><CaretDownIcon size={14} weight="bold" /></span>
        </button>
        <div className="sidebar__header-actions">
          <button className="sidebar__bell" title="Notifications" type="button">
            <BellIcon size={19} />
            <span className="sidebar__bell-dot" />
          </button>
          <button className="sidebar__collapse-btn" onClick={onToggleCollapse} title="Collapse sidebar">
            <SidebarSimpleIcon size={20} />
          </button>
        </div>
      </div>

      <nav className="sidebar__nav">
        {/* Primary navigation */}
        <ul className="sidebar__nav-list">
          <li>
            <button className="sidebar__add-task" type="button">
              <span className="sidebar__add-task-icon"><PlusIcon size={16} weight="bold" /></span>
              <span>Add task</span>
            </button>
          </li>
          <li>
            <button className="sidebar__nav-item" type="button">
              <span className="sidebar__nav-icon"><MagnifyingGlassIcon size={18} /></span>
              <span className="sidebar__nav-label">Search</span>
            </button>
          </li>
          <li>
            <button
              className={`sidebar__nav-item ${activeView === 'inbox' ? 'sidebar__nav-item--active' : ''}`}
              onClick={() => onViewChange('inbox')}
            >
              <span className="sidebar__nav-icon sidebar__nav-icon--inbox"><TrayIcon size={18} /></span>
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
                <CalendarBlankIcon size={18} />
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
              <span className="sidebar__nav-icon sidebar__nav-icon--upcoming"><CalendarDotsIcon size={18} /></span>
              <span className="sidebar__nav-label">Upcoming</span>
            </button>
          </li>
          <li>
            <button
              className={`sidebar__nav-item ${activeView === 'filters' ? 'sidebar__nav-item--active' : ''}`}
              onClick={() => onViewChange('filters')}
            >
              <span className="sidebar__nav-icon sidebar__nav-icon--filters"><SquaresFourIcon size={18} /></span>
              <span className="sidebar__nav-label">Filters & Labels</span>
            </button>
          </li>
          <li>
            <button
              className={`sidebar__nav-item ${activeView === 'storage' ? 'sidebar__nav-item--active' : ''}`}
              onClick={() => onViewChange('storage')}
              type="button"
            >
              <span className="sidebar__nav-icon"><FolderIcon size={18} /></span>
              <span className="sidebar__nav-label">Storage</span>
            </button>
          </li>
          <li>
            <button
              className={`sidebar__nav-item ${activeView === 'outline' ? 'sidebar__nav-item--active' : ''}`}
              onClick={() => onViewChange('outline')}
              type="button"
            >
              <span className="sidebar__nav-icon"><ListBulletsIcon size={18} /></span>
              <span className="sidebar__nav-label">Outline</span>
            </button>
          </li>
          <li>
            <button
              className={`sidebar__nav-item ${activeView === 'agent' ? 'sidebar__nav-item--active' : ''}`}
              onClick={() => onViewChange('agent')}
              type="button"
            >
              <span className="sidebar__nav-icon"><SparkleIcon size={18} /></span>
              <span className="sidebar__nav-label">Agent</span>
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
              <PlusIcon size={16} weight="bold" />
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
