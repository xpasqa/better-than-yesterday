import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  BellIcon, CalendarBlankIcon, CalendarDotsIcon, CaretDownIcon, ChatCircleIcon, CheckCircleIcon, EnvelopeSimpleIcon, FolderIcon,
  GearIcon, ListBulletsIcon, MagnifyingGlassIcon, PencilSimpleIcon, PlusIcon, SidebarSimpleIcon, SignOutIcon,
  SparkleIcon, StarIcon, TagIcon, TrayIcon, WalletIcon, XIcon,
} from '@phosphor-icons/react'
import { todayInTimezone } from '@better/core/date'
import { inbox as computeInbox, project as computeProject, today as computeToday } from '@better/core/views'
import { findInbox, type Node as TaskNode } from '@better/core/node'
import type { ViewType } from '../types'
import type { Theme } from '../hooks/useTheme'
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
  /**
   * The real (store-backed) tree, once one exists — counts and the project
   * list below add these in alongside the mock data rather than replacing
   * it, since only Today/Inbox/Upcoming/Project are migrated so far
   * (docs/feature/2.backend/1.todo/todo.md blocks C–J).
   */
  realNodes?: TaskNode[]
  timezone?: string
  userName?: string
  onViewChange: (view: ViewType) => void
  onProjectChange: (id: string) => void
  onToggleCollapse: () => void
  /** Opens the Create Project modal */
  onAddProject: (kind: 'project' | 'area') => void
  /** Opens the Agent Settings modal */
  onOpenSettings: () => void
  onLogout: () => void
  /** Opens the ProjectModal in edit mode for a given area or project node */
  onEditNode?: (node: TaskNode) => void
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

/** A single project row, shared between the Favorites section and area groups. */
function ProjectRow({
  project,
  isActive,
  allNodes,
  onProjectChange,
  onEditNode,
  indented = false,
}: {
  project: TaskNode
  isActive: boolean
  allNodes: TaskNode[]
  onProjectChange: (id: string) => void
  onEditNode?: (node: TaskNode) => void
  indented?: boolean
}) {
  const count = computeProject(allNodes, project.id).length
  return (
    <li>
      <div className={`sidebar__project-row${indented ? ' sidebar__project-row--indented' : ''}`}>
        <button
          className={`sidebar__nav-item sidebar__nav-item--project ${isActive ? 'sidebar__nav-item--active' : ''}`}
          onClick={() => onProjectChange(project.id)}
          type="button"
        >
          <span className="sidebar__project-hash" style={{ color: project.color ?? undefined }}>#</span>
          <span className="sidebar__nav-label">{project.content}</span>
          {count > 0 && <span className="sidebar__nav-count">{count}</span>}
        </button>
        {onEditNode && (
          <button
            className="sidebar__row-edit"
            type="button"
            aria-label={`Edit ${project.content}`}
            onClick={(e) => { e.stopPropagation(); onEditNode(project) }}
          >
            <PencilSimpleIcon size={13} />
          </button>
        )}
      </div>
    </li>
  )
}

export default function Sidebar({
  activeView, activeProjectId, collapsed, drawer = false, drawerOpen = false,
  theme, onToggleTheme, realNodes = [], timezone = 'Asia/Jakarta',
  userName = 'Pasqa',
  onViewChange, onProjectChange, onToggleCollapse, onAddProject, onOpenSettings, onLogout,
  onEditNode,
}: SidebarProps) {
  const [projectsExpanded, setProjectsExpanded] = useState(true)
  const [chatsExpanded, setChatsExpanded] = useState(true)
  const [favoritesExpanded, setFavoritesExpanded] = useState(true)
  const profileRef = useRef<HTMLDivElement>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  // Rendered via a portal (below) rather than inline: the "My Projects"
  // section sits inside a scrolling nav list with overflow-x: hidden, which
  // clips an inline absolutely-positioned dropdown instead of letting it
  // overflow — same reason NodeDetailModal's calendar dropdown is a portal.
  const addTriggerRef = useRef<HTMLButtonElement>(null)
  const addMenuPortalRef = useRef<HTMLDivElement>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [addMenuPos, setAddMenuPos] = useState<{ top: number; right: number } | null>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!profileOpen && !addMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
      const t = e.target as Node
      if (!addMenuPortalRef.current?.contains(t) && !addTriggerRef.current?.contains(t)) {
        setAddMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [profileOpen, addMenuOpen])

  const realTodayStr = todayInTimezone(timezone)
  const realToday = computeToday(realNodes, realTodayStr)
  const todayCount = realToday.overdue.length + realToday.today.length
  const inboxCount = computeInbox(realNodes).length

  const inboxNode = findInbox(realNodes)

  // All non-inbox, non-deleted projects
  const allProjects = realNodes.filter(
    (n) => n.kind === 'project' && n.deletedAt === null && n.id !== inboxNode?.id,
  )

  // Favorites section: projects with isFavorite (spec §4.4)
  const favoriteProjects = allProjects.filter((n) => n.isFavorite)

  // All non-deleted areas, sorted by rank
  const areas = realNodes
    .filter((n) => n.kind === 'area' && n.deletedAt === null)
    .sort((a, b) => (a.rank < b.rank ? -1 : 1))

  // Projects grouped:
  //   - under an area: projects with parentId === area.id
  //   - orphans: projects with parentId === null (no area)
  const projectsByArea = (areaId: string) =>
    allProjects.filter((n) => n.parentId === areaId).sort((a, b) => (a.rank < b.rank ? -1 : 1))

  const orphanProjects = allProjects
    .filter((n) => n.parentId === null)
    .sort((a, b) => (a.rank < b.rank ? -1 : 1))

  // Expanded state per area (default expanded)
  const [areaExpanded, setAreaExpanded] = useState<Record<string, boolean>>({})
  const isAreaExpanded = (id: string) => areaExpanded[id] !== false

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

  const initial = (userName.charAt(0) || 'P').toUpperCase()

  return (
    <aside className={rootClass}>
      <div className="sidebar__header">
        <div className="sidebar__profile-wrap" ref={profileRef}>
          <button
            className="sidebar__workspace"
            type="button"
            onClick={() => setProfileOpen(o => !o)}
            aria-haspopup="true"
            aria-expanded={profileOpen}
          >
            <div className="sidebar__avatar">{initial}</div>
            <span className="sidebar__workspace-name">{userName}</span>
            <span className="sidebar__workspace-chevron"><CaretDownIcon size={14} weight="bold" /></span>
          </button>
          {profileOpen && (
            <div className="sidebar__profile-menu" role="menu">
              <button
                className="sidebar__profile-item"
                role="menuitem"
                type="button"
                onClick={() => { setProfileOpen(false); onOpenSettings() }}
              >
                <GearIcon size={15} />
                Agent settings
              </button>
              <button
                className="sidebar__profile-item"
                role="menuitem"
                type="button"
                onClick={() => { setProfileOpen(false); onViewChange('settings') }}
              >
                <GearIcon size={15} />
                Settings
              </button>
              <div className="sidebar__profile-divider" />
              <button
                className="sidebar__profile-item sidebar__profile-item--danger"
                role="menuitem"
                type="button"
                onClick={() => { setProfileOpen(false); onLogout() }}
              >
                <SignOutIcon size={15} />
                Sign out
              </button>
            </div>
          )}
        </div>
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
            <button
              className={`sidebar__nav-item ${activeView === 'search' ? 'sidebar__nav-item--active' : ''}`}
              onClick={() => onViewChange('search')}
              type="button"
            >
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
              className={`sidebar__nav-item ${activeView === 'anytime' ? 'sidebar__nav-item--active' : ''}`}
              onClick={() => onViewChange('anytime')}
              type="button"
            >
              <span className="sidebar__nav-icon"><SparkleIcon size={18} /></span>
              <span className="sidebar__nav-label">Anytime</span>
            </button>
          </li>
          <li>
            <button
              className={`sidebar__nav-item ${activeView === 'someday' ? 'sidebar__nav-item--active' : ''}`}
              onClick={() => onViewChange('someday')}
              type="button"
            >
              <span className="sidebar__nav-icon"><StarIcon size={18} /></span>
              <span className="sidebar__nav-label">Someday</span>
            </button>
          </li>
          <li>
            <button
              className={`sidebar__nav-item ${activeView === 'logbook' ? 'sidebar__nav-item--active' : ''}`}
              onClick={() => onViewChange('logbook')}
              type="button"
            >
              <span className="sidebar__nav-icon"><CheckCircleIcon size={18} /></span>
              <span className="sidebar__nav-label">Logbook</span>
            </button>
          </li>
          <li>
            <button
              className={`sidebar__nav-item ${activeView === 'tags' ? 'sidebar__nav-item--active' : ''}`}
              onClick={() => onViewChange('tags')}
              type="button"
            >
              <span className="sidebar__nav-icon"><TagIcon size={18} /></span>
              <span className="sidebar__nav-label">Tags</span>
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
              className={`sidebar__nav-item ${activeView === 'finance' ? 'sidebar__nav-item--active' : ''}`}
              onClick={() => onViewChange('finance')}
              type="button"
            >
              <span className="sidebar__nav-icon"><WalletIcon size={18} /></span>
              <span className="sidebar__nav-label">Finance</span>
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

        {/* Favorites — only shown when there is at least one favourite project */}
        {favoriteProjects.length > 0 && (
          <div className="sidebar__section">
            <div className="sidebar__section-header">
              <span className="sidebar__section-icon"><StarIcon size={14} weight="fill" /></span>
              <span className="sidebar__section-title">Favorites</span>
              <button
                className="sidebar__section-chevron"
                onClick={() => setFavoritesExpanded(e => !e)}
                title={favoritesExpanded ? 'Collapse' : 'Expand'}
                type="button"
              >
                <ChevronDown open={favoritesExpanded} />
              </button>
            </div>
            {favoritesExpanded && (
              <ul className="sidebar__nav-list">
                {favoriteProjects.map(project => (
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

        {/* Projects — Area→Project hierarchy + orphan projects */}
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
                setAddMenuOpen(o => !o)
              }}
              aria-label="Add project or area"
              aria-haspopup="true"
              aria-expanded={addMenuOpen}
            >
              <PlusIcon size={16} weight="bold" />
            </button>
            {addMenuOpen && addMenuPos && createPortal(
              <div
                ref={addMenuPortalRef}
                className="sidebar__profile-menu sidebar__add-menu"
                role="menu"
                style={{ position: 'fixed', top: addMenuPos.top, right: addMenuPos.right }}
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
              onClick={() => setProjectsExpanded(e => !e)}
              title={projectsExpanded ? 'Collapse' : 'Expand'}
              type="button"
            >
              <ChevronDown open={projectsExpanded} />
            </button>
          </div>
          {projectsExpanded && (
            <ul className="sidebar__nav-list">
              {/* Areas with their child projects */}
              {areas.map(area => {
                const children = projectsByArea(area.id)
                const expanded = isAreaExpanded(area.id)
                // Badge: count of all tasks in the entire area subtree
                // computeProject is already subtree-wide, so sum across children
                const areaCount = children.reduce(
                  (sum, p) => sum + computeProject(realNodes, p.id).length,
                  0,
                )
                return (
                  <li key={area.id}>
                    {/* Area header row */}
                    <div className="sidebar__area-row">
                      <button
                        className="sidebar__area-header"
                        type="button"
                        onClick={() => setAreaExpanded(s => ({ ...s, [area.id]: !expanded }))}
                        aria-expanded={expanded}
                      >
                        <span
                          className="sidebar__area-dot"
                          style={{ background: area.color ?? 'var(--text-secondary)' }}
                        />
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
                    {/* Child projects — spec §4.4: favorites appear BOTH here AND in Favorites */}
                    {expanded && children.length > 0 && (
                      <ul className="sidebar__nav-list">
                        {children.map(project => (
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

              {/* Orphan projects (no area) — shown last, no section header */}
              {orphanProjects.map(project => (
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
