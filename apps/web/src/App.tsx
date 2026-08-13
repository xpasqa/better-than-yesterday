import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BellIcon, CaretLeftIcon, ListIcon } from '@phosphor-icons/react'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useTheme } from './hooks/useTheme'
import Sidebar from './components/Sidebar'
import ProjectListPanel from './components/ProjectListPanel'
import ThemeToggle from './components/ThemeToggle'
import OutlineView from './components/OutlineView'
import MailView from './components/MailView'
import StorageView from './components/StorageView'
import FinanceView from './components/finance/FinanceView'
import AgentView from './components/AgentView'
import Login from './components/Login'
import ProjectModal from './components/ProjectModal'
import type { ProjectModalKind } from './components/ProjectModal'
import NodeDetailModal from './components/NodeDetailModal'
import ShortcutsModal from './components/ShortcutsModal'
import UndoToast from './components/UndoToast'
import TodayReal from './components/TodayReal'
import InboxReal from './components/InboxReal'
import UpcomingReal from './components/UpcomingReal'
import AnytimeView from './components/AnytimeView'
import SomedayView from './components/SomedayView'
import LogbookView from './components/LogbookView'
import ProjectReal from './components/ProjectReal'
import SearchView from './components/SearchView'
import TagsView from './components/TagsView'
import SettingsView from './components/SettingsView'
import BottomNav from './components/BottomNav'
import QuickAddModal from './components/QuickAddModal'
import { pathForView, deriveViewFromPathname } from './routes'
import { fetchMe, logout, type AuthUser } from './store/auth-api'
import { clearLocalStore } from './store/db'
import { startSyncLoop } from './store/sync-client'
import { useAllNodes } from './store/use-nodes'
import type { Node } from '@better/core/node'
import './styles/variables.css'
import './styles/global.css'
import './App.css'

/**
 * Single-letter shortcuts must never fire while someone is typing, while a
 * modal owns the screen, or when a modifier makes the key belong to the
 * browser or the OS. Getting any of these wrong makes the app feel broken
 * rather than merely incomplete.
 */
function shouldIgnore(e: KeyboardEvent, modalOpen: boolean): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true
  if (modalOpen) return true
  const el = document.activeElement
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  )
}

function useAuthGate() {
  const [user, setUser] = useState<AuthUser | null | 'loading'>('loading')

  useEffect(() => {
    fetchMe()
      .then(setUser)
      .catch(() => setUser(null))
  }, [])

  useEffect(() => {
    if (user && user !== 'loading') {
      return startSyncLoop()
    }
  }, [user])

  const handleLoggedIn = (loggedInUser: AuthUser) => setUser(loggedInUser)
  const handleLogout = () => {
    void logout()
    void clearLocalStore()
    setUser(null)
  }
  const handleUserChange = (updated: AuthUser) => setUser(updated)

  return { user, handleLoggedIn, handleLogout, handleUserChange }
}

function App() {
  const { user, handleLoggedIn, handleLogout, handleUserChange } = useAuthGate()
  const navigate = useNavigate()
  const location = useLocation()
  const { view: activeView, projectId: activeProjectId, sub: activeSub } = deriveViewFromPathname(location.pathname)
  const realNodes = useAllNodes()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // ProjectModal state: null = closed, object = open
  const [projectModal, setProjectModal] = useState<{
    mode: 'create' | 'edit'
    kind: ProjectModalKind
    node?: Node
    defaultAreaId?: string | null
  } | null>(null)

  const [openNodeId, setOpenNodeId] = useState<string | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  // Pending "g" prefix for two-key nav shortcuts (g→i, g→t, g→u)
  const pendingGRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingG = useRef(false)

  useEffect(() => {
    const modalOpen = Boolean(projectModal) || Boolean(openNodeId) || showShortcuts || quickAddOpen

    const handler = (e: KeyboardEvent) => {
      if (shouldIgnore(e, modalOpen)) return

      // Two-key "g" prefix sequences
      if (pendingG.current) {
        pendingG.current = false
        if (pendingGRef.current) clearTimeout(pendingGRef.current)
        if (e.key === 'i') { navigate(pathForView('inbox')); return }
        if (e.key === 't') { navigate(pathForView('today')); return }
        if (e.key === 'u') { navigate(pathForView('upcoming')); return }
        return
      }

      switch (e.key) {
        case 'q':
        case 'a': {
          // preventDefault: this handler moves focus onto a freshly-opened
          // text input as a *result* of this very keystroke — without this,
          // the browser's own default handling for the same keydown types
          // the triggering letter into the input it just focused.
          e.preventDefault()
          // Focus the Quick Add input — aria-label is the stable selector
          // contract (AddTaskFormReal.tsx documents this dependency). The
          // input only exists once the view's own "+ Add task" toggle has
          // been clicked open, so click it first when the form is closed —
          // otherwise this shortcut silently did nothing on every view's
          // default (form-closed) state, which is the common case.
          const focusQuickAdd = () => {
            const input = document.querySelector<HTMLInputElement>('input[aria-label="Quick add a task"]')
            if (input) { input.focus(); input.select() }
          }
          if (document.querySelector('input[aria-label="Quick add a task"]')) {
            focusQuickAdd()
          } else {
            document.querySelector<HTMLButtonElement>('.real-view__add-task-btn')?.click()
            requestAnimationFrame(focusQuickAdd)
          }
          break
        }
        case '/':
          navigate(pathForView('search'))
          break
        case 'g':
          pendingG.current = true
          pendingGRef.current = setTimeout(() => { pendingG.current = false }, 1500)
          break
        case '?':
          setShowShortcuts(true)
          break
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [navigate, projectModal, openNodeId, showShortcuts, quickAddOpen])

  /*
   * Below 1024px the sidebar stops being a docked column and becomes an
   * off-canvas drawer, so it needs its own open/closed state — the desktop
   * collapse-to-rail state means nothing there. 1024px is iPad landscape,
   * which is wide enough to keep the full desktop layout.
   */
  const isCompact = useMediaQuery('(max-width: 1023px)')
  const isPhone = useMediaQuery('(max-width: 767px)')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { theme, toggleTheme } = useTheme()

  if (user === 'loading') {
    return <div className="app-loading">Loading…</div>
  }
  if (!user) {
    return <Login onLoggedIn={handleLoggedIn} />
  }

  return (
    <div className="app-shell">
      {isCompact && (
        <header className="app-topbar">
          {/* On phone, BottomNav handles primary nav — topbar only shows title area + actions */}
          {!isPhone && (
            <button
              className="app-topbar__btn"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              type="button"
            >
              <ListIcon size={21} />
            </button>
          )}
          {isPhone && (
            <button
              className="app-topbar__btn"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              type="button"
            >
              <ListIcon size={21} />
            </button>
          )}
          <div className="app-topbar__actions">
            <ThemeToggle theme={theme} onToggle={toggleTheme} size="large" />
            <button className="app-topbar__btn app-topbar__bell" aria-label="Notifications" type="button">
              <BellIcon size={20} />
              <span className="app-topbar__bell-dot" />
            </button>
          </div>
        </header>
      )}
      <div className="app-layout">
        <Sidebar
          activeView={activeView}
          collapsed={!isCompact && sidebarCollapsed}
          drawer={isCompact}
          drawerOpen={drawerOpen}
          variant={isPhone ? 'popup' : 'drawer'}
          theme={theme}
          onToggleTheme={toggleTheme}
          realNodes={realNodes}
          timezone={user.timezone}
          userName={user.name}
          onViewChange={(view) => { navigate(pathForView(view)); setDrawerOpen(false) }}
          onOpenChat={(sessionId) => { navigate(pathForView('agent', null, sessionId)); setDrawerOpen(false) }}
          onAddTask={() => { setQuickAddOpen(true); setDrawerOpen(false) }}
          onToggleCollapse={() => isCompact ? setDrawerOpen(false) : setSidebarCollapsed(c => !c)}
          onLogout={handleLogout}
        />
        {isCompact && drawerOpen && (
          <div
            className={`app-backdrop${isPhone ? ' app-backdrop--transparent' : ''}`}
            onClick={() => setDrawerOpen(false)}
          />
        )}
        {activeView === 'project' && (
          <ProjectListPanel
            realNodes={realNodes}
            activeProjectId={activeProjectId}
            onProjectChange={(id) => navigate(pathForView('project', id))}
            onAddProject={(kind) => setProjectModal({ mode: 'create', kind })}
            onEditNode={(node) => setProjectModal({
              mode: 'edit',
              kind: node.kind as ProjectModalKind,
              node,
            })}
            drillDownHidden={isCompact && Boolean(activeProjectId)}
          />
        )}
        {activeView === 'outline' ? (
          <OutlineView user={user} />
        ) : activeView === 'mail' ? (
          <MailView onOpenSettings={() => navigate(pathForView('settings'))} />
        ) : activeView === 'storage' ? (
          <StorageView />
        ) : activeView === 'finance' ? (
          <FinanceView
            sub={activeSub}
            timezone={user.timezone ?? 'Asia/Jakarta'}
            onSubChange={(sub) => navigate(pathForView('finance', null, sub))}
          />
        ) : activeView === 'agent' ? (
          <AgentView key={activeSub ?? 'new'} sessionId={activeSub} />
        ) : activeView === 'today' ? (
          <TodayReal user={user} onOpenNode={setOpenNodeId} />
        ) : activeView === 'inbox' ? (
          <InboxReal user={user} onOpenNode={setOpenNodeId} />
        ) : activeView === 'upcoming' ? (
          <UpcomingReal user={user} onOpenNode={setOpenNodeId} />
        ) : activeView === 'anytime' ? (
          <AnytimeView user={user} onOpenNode={setOpenNodeId} />
        ) : activeView === 'someday' ? (
          <SomedayView user={user} onOpenNode={setOpenNodeId} />
        ) : activeView === 'logbook' ? (
          <LogbookView />
        ) : activeView === 'project' && activeProjectId ? (
          <div className="project-content-shell">
            {isCompact && (
              <button
                className="project-content-shell__back"
                onClick={() => navigate(pathForView('project'))}
                type="button"
              >
                <CaretLeftIcon size={16} weight="bold" />
                Projects
              </button>
            )}
            <ProjectReal key={activeProjectId} user={user} projectId={activeProjectId} onOpenNode={setOpenNodeId} />
          </div>
        ) : activeView === 'project' ? (
          <div className="project-content-shell project-content-shell--empty">
            <p>Select a project</p>
          </div>
        ) : activeView === 'search' ? (
          <SearchView user={user} onOpenNode={setOpenNodeId} onOpenNote={() => navigate(pathForView('outline'))} />
        ) : activeView === 'tags' ? (
          <TagsView />
        ) : activeView === 'settings' ? (
          <SettingsView user={user} onUserChange={handleUserChange} />
        ) : null /* unreachable: routes.ts only ever derives 'project' alongside an id */}
      </div>
      {projectModal && (
        <ProjectModal
          mode={projectModal.mode}
          kind={projectModal.kind}
          node={projectModal.node}
          defaultAreaId={projectModal.defaultAreaId}
          onClose={() => setProjectModal(null)}
          onCreated={(id) => {
            setProjectModal(null)
            // Only navigate to project view for projects (areas have no task view)
            if (projectModal.kind === 'project') {
              navigate(pathForView('project', id))
            }
            setDrawerOpen(false)
          }}
        />
      )}
      {showShortcuts && (
        <ShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}
      {quickAddOpen && (
        <QuickAddModal timezone={user.timezone ?? 'Asia/Jakarta'} onClose={() => setQuickAddOpen(false)} />
      )}
      {openNodeId && (() => {
        const openNode = realNodes.find(n => n.id === openNodeId) ?? null
        return openNode ? (
          <NodeDetailModal node={openNode} onClose={() => setOpenNodeId(null)} timezone={user.timezone ?? 'Asia/Jakarta'} />
        ) : null
      })()}
      <BottomNav moreOpen={drawerOpen} onMorePress={() => setDrawerOpen(o => !o)} />
      <UndoToast />
    </div>
  )
}

export default App
