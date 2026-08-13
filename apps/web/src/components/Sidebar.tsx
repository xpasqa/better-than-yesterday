import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
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
import NotificationPanel from './NotificationPanel'
import { fetchRecentSessions, type RecentSession } from '../api/agent-sessions'
import { db } from '../store/db'
import './Sidebar.css'

interface SidebarProps {
  activeView: ViewType
  collapsed: boolean
  /* Below 1024px the sidebar is an off-canvas drawer instead of a docked column */
  drawer?: boolean
  drawerOpen?: boolean
  /**
   * 'drawer' (default) slides in full-height from the left — tablet width.
   * 'popup' is a small rounded card anchored above BottomNav's More tab on
   * phone (34.sidebar-workspace follow-up): same content, no full-screen
   * takeover for what's fundamentally a secondary nav.
   */
  variant?: 'drawer' | 'popup'
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
  onToggleCollapse: () => void
  onLogout: () => void
  /** Opens the Agent view on a specific session (Recent Chats click) */
  onOpenChat?: (sessionId: string) => void
  /** Opens the centered quick-add task modal */
  onAddTask: () => void
}

const ChevronDown = ({ open }: { open: boolean }) => (
  <CaretDownIcon
    size={14}
    weight="bold"
    style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}
  />
)

/** A single project row, shared between Favorites and area groups — also used by ProjectListPanel. */
export function ProjectRow({
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
  activeView, collapsed, drawer = false, drawerOpen = false, variant = 'drawer',
  theme, onToggleTheme, realNodes = [], timezone = 'Asia/Jakarta',
  userName = 'Pasqa',
  onViewChange, onToggleCollapse, onLogout,
  onOpenChat, onAddTask,
}: SidebarProps) {
  // Workspace fold survives reload (34.sidebar-workspace/spec.md §3) — the
  // other section chevrons reset per visit, but Workspace is the one fold
  // that expresses a lasting preference ("I live in Todo, tuck the rest away").
  const [workspaceExpanded, setWorkspaceExpanded] = useState(
    () => localStorage.getItem('sidebar-workspace-expanded') !== 'false',
  )
  useEffect(() => {
    localStorage.setItem('sidebar-workspace-expanded', String(workspaceExpanded))
  }, [workspaceExpanded])
  const [chatsExpanded, setChatsExpanded] = useState(true)
  // Real agent sessions (34.sidebar-workspace/spec.md §4.2) — fetched once
  // per mount. Perfect freshness is not a sidebar's job; the list catches up
  // on the next visit/reload, and an empty list hides the section entirely.
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])
  useEffect(() => {
    let cancelled = false
    fetchRecentSessions()
      .then((sessions) => { if (!cancelled) setRecentSessions(sessions) })
      .catch(() => { /* not logged in / network — section simply stays hidden */ })
    return () => { cancelled = true }
  }, [])
  const profileRef = useRef<HTMLDivElement>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const bellRef = useRef<HTMLButtonElement>(null)
  const [bellOpen, setBellOpen] = useState(false)

  // Unread count — live query so the dot updates the moment sync lands.
  const unreadCount = useLiveQuery(
    () => db.notifications.filter((n) => n.readAt === null).count(),
    [],
    0,
  )

  // Close dropdown on outside click
  useEffect(() => {
    if (!profileOpen) return
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [profileOpen])

  const realTodayStr = todayInTimezone(timezone)
  const realToday = computeToday(realNodes, realTodayStr)
  const todayCount = realToday.overdue.length + realToday.today.length
  const inboxCount = computeInbox(realNodes).length

  const inboxNode = findInbox(realNodes)

  // The single "Projects" row's badge — every non-inbox project, however
  // deep in the Area tree. Per-project counts live in ProjectListPanel now.
  const projectCount = realNodes.filter(
    (n) => n.kind === 'project' && n.deletedAt === null && n.id !== inboxNode?.id,
  ).length

  if (collapsed) {
    return (
      <aside className="sidebar sidebar--collapsed">
        <button className="sidebar__collapse-btn" onClick={onToggleCollapse} title="Expand sidebar">
          <SidebarSimpleIcon size={20} />
        </button>
      </aside>
    )
  }

  const drawerVariantClass = variant === 'popup' ? 'sidebar--popup' : 'sidebar--drawer'
  const rootClass = [
    'sidebar',
    drawer ? drawerVariantClass : '',
    drawer && drawerOpen ? `${drawerVariantClass}-open` : '',
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
              <button
                ref={bellRef}
                className="sidebar__bell"
                title="Notifications"
                type="button"
                onClick={() => setBellOpen(o => !o)}
                aria-haspopup="true"
                aria-expanded={bellOpen}
              >
                <BellIcon size={19} />
                {unreadCount > 0 && <span className="sidebar__bell-dot" />}
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
            <button className="sidebar__add-task" type="button" onClick={onAddTask}>
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
              className={`sidebar__nav-item ${activeView === 'project' ? 'sidebar__nav-item--active' : ''}`}
              onClick={() => onViewChange('project')}
              type="button"
            >
              <span className="sidebar__nav-icon"><FolderIcon size={18} /></span>
              <span className="sidebar__nav-label">Projects</span>
              {projectCount > 0 && <span className="sidebar__nav-count">{projectCount}</span>}
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
        </ul>

        {/* Workspace — the side-by-side modules, quarantined below the Things
            skeleton (34.sidebar-workspace/spec.md §3). Tags lives here too:
            it's a filtering tool, not a daily place of work. */}
        <div className="sidebar__section">
          <div className="sidebar__section-header">
            <span className="sidebar__section-title">Workspace</span>
            <button
              className="sidebar__section-chevron"
              onClick={() => setWorkspaceExpanded(e => !e)}
              title={workspaceExpanded ? 'Collapse' : 'Expand'}
              type="button"
            >
              <ChevronDown open={workspaceExpanded} />
            </button>
          </div>
          {workspaceExpanded && (
            <ul className="sidebar__nav-list">
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
                  className={`sidebar__nav-item ${activeView === 'agent' ? 'sidebar__nav-item--active' : ''}`}
                  onClick={() => onViewChange('agent')}
                  type="button"
                >
                  <span className="sidebar__nav-icon"><SparkleIcon size={18} /></span>
                  <span className="sidebar__nav-label">Agent</span>
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
            </ul>
          )}
        </div>

        {/* Recent Chats — real agent sessions; hidden entirely when empty
            (an empty header is noisier than nothing, spec §3) */}
        {recentSessions.length > 0 && (
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
                {recentSessions.map(session => (
                  <li key={session.id}>
                    <button
                      className="sidebar__nav-item"
                      onClick={() => onOpenChat?.(session.id)}
                      type="button"
                    >
                      <span className="sidebar__nav-icon"><ChatCircleIcon size={18} /></span>
                      <span className="sidebar__nav-label">{session.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </nav>
      {bellOpen && createPortal(
        <NotificationPanel anchorRef={bellRef} onClose={() => setBellOpen(false)} />,
        document.body,
      )}
    </aside>
  )
}
