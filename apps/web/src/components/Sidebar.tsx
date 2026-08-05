import { useState } from 'react'
import {
  BellIcon, CalendarBlankIcon, CalendarDotsIcon, CaretDownIcon, ChatCircleIcon, EnvelopeSimpleIcon, FolderIcon,
  ListBulletsIcon, MagnifyingGlassIcon, PlusIcon, SidebarSimpleIcon, SparkleIcon, SquaresFourIcon, TrayIcon, XIcon,
} from '@phosphor-icons/react'
import { todayInTimezone } from '@better/core/date'
import { inbox as computeInbox, project as computeProject, today as computeToday } from '@better/core/views'
import { findInbox, type Node } from '@better/core/node'
import type { ViewType, Task } from '../types'
import type { Theme } from '../hooks/useTheme'
import { projects } from '../data/mockData'
import ThemeToggle from './ThemeToggle'
import './Sidebar.css'

interface SidebarProps {
  activeView: ViewType
  activeProjectId: string | null
  collapsed: boolean
  /* Below 1024px the sidebar is an off-canvas drawer instead of a docked column */
  drawer?: boolean
  drawerOpen?: boolean
  theme: Theme
  onToggleTheme: () => void
  tasks: Task[]
  /**
   * The real (store-backed) tree, once one exists — counts and the project
   * list below add these in alongside the mock data rather than replacing
   * it, since only Today/Inbox/Upcoming/Project are migrated so far
   * (docs/feature/2.backend/1.todo/todo.md blocks C–J).
   */
  realNodes?: Node[]
  timezone?: string
  onViewChange: (view: ViewType) => void
  onProjectChange: (id: string) => void
  onToggleCollapse: () => void
}

const recentChats = [
  'Dashboard panel overflow',
  'Refactor auth flow',
  'Generate a REST API',
  'Explain React hooks',
]

const ChevronDown = ({ open }: { open: boolean }) => (
  <CaretDownIcon
    size={14}
    weight="bold"
    style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}
  />
)

export default function Sidebar({
  activeView, activeProjectId, collapsed, drawer = false, drawerOpen = false,
  theme, onToggleTheme, tasks, realNodes = [], timezone = 'Asia/Jakarta',
  onViewChange, onProjectChange, onToggleCollapse
}: SidebarProps) {
  const [projectsExpanded, setProjectsExpanded] = useState(true)
  const [chatsExpanded, setChatsExpanded] = useState(true)

  const today = new Date().toISOString().split('T')[0]
  const realTodayStr = todayInTimezone(timezone)
  const realToday = computeToday(realNodes, realTodayStr)
  const todayCount =
    tasks.filter(t => !t.isCompleted && t.dueDate === today).length +
    realToday.overdue.length + realToday.today.length
  const inboxCount =
    tasks.filter(t => !t.isCompleted && t.projectId === 'inbox').length +
    computeInbox(realNodes).length

  const allProjects = projects.filter(p => p.id !== 'inbox')
  const realProjects = realNodes.filter(
    (n) => n.kind === 'project' && n.deletedAt === null && n.id !== findInbox(realNodes)?.id,
  )

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

  const rootClass = [
    'sidebar',
    drawer ? 'sidebar--drawer' : '',
    drawer && drawerOpen ? 'sidebar--drawer-open' : '',
  ].filter(Boolean).join(' ')

  return (
    <aside className={rootClass}>
      <div className="sidebar__header">
        <button className="sidebar__workspace" type="button">
          <div className="sidebar__avatar">P</div>
          <span className="sidebar__workspace-name">Pasqa</span>
          <span className="sidebar__workspace-chevron"><CaretDownIcon size={14} weight="bold" /></span>
        </button>
        <div className="sidebar__header-actions">
          {/* The drawer already has the top bar's controls above it — one set is enough */}
          {!drawer && (
            <>
              <ThemeToggle theme={theme} onToggle={onToggleTheme} />
              <button className="sidebar__bell" title="Notifications" type="button">
                <BellIcon size={19} />
                <span className="sidebar__bell-dot" />
              </button>
            </>
          )}
          <button
            className="sidebar__collapse-btn"
            onClick={onToggleCollapse}
            title={drawer ? 'Close menu' : 'Collapse sidebar'}
            type="button"
          >
            {drawer ? <XIcon size={19} /> : <SidebarSimpleIcon size={20} />}
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
              className={`sidebar__nav-item ${activeView === 'mail' ? 'sidebar__nav-item--active' : ''}`}
              onClick={() => onViewChange('mail')}
              type="button"
            >
              <span className="sidebar__nav-icon"><EnvelopeSimpleIcon size={18} /></span>
              <span className="sidebar__nav-label">Mail</span>
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
              {realProjects.map(project => (
                <li key={project.id}>
                  <button
                    className={`sidebar__nav-item ${activeProjectId === project.id ? 'sidebar__nav-item--active' : ''}`}
                    onClick={() => onProjectChange(project.id)}
                  >
                    <span className="sidebar__project-hash" style={{ color: project.color ?? undefined }}>#</span>
                    <span className="sidebar__nav-label">{project.content}</span>
                    {computeProject(realNodes, project.id).length > 0 && (
                      <span className="sidebar__nav-count">{computeProject(realNodes, project.id).length}</span>
                    )}
                  </button>
                </li>
              ))}
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

        {/* Recent Chats — mock list, mirrors the Agent page's conversation history */}
        <div className="sidebar__section">
          <div className="sidebar__section-header">
            <span className="sidebar__section-title">Recent Chats</span>
            <button
              className="sidebar__section-chevron"
              onClick={() => setChatsExpanded(e => !e)}
              title={chatsExpanded ? 'Collapse' : 'Expand'}
              type="button"
            >
              <ChevronDown open={chatsExpanded} />
            </button>
          </div>
          {chatsExpanded && (
            <ul className="sidebar__nav-list">
              {recentChats.map(title => (
                <li key={title}>
                  <button className="sidebar__nav-item" onClick={() => onViewChange('agent')} type="button">
                    <span className="sidebar__nav-icon"><ChatCircleIcon size={18} /></span>
                    <span className="sidebar__nav-label">{title}</span>
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
