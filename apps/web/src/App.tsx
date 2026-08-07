import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BellIcon, ListIcon } from '@phosphor-icons/react'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useTheme } from './hooks/useTheme'
import Sidebar from './components/Sidebar'
import ThemeToggle from './components/ThemeToggle'
import MainContent from './components/MainContent'
import TaskDetailModal from './components/TaskDetailModal'
import OutlineView from './components/OutlineView'
import MailView from './components/MailView'
import StorageView from './components/StorageView'
import AgentView from './components/AgentView'
import Login from './components/Login'
import CreateProjectModal from './components/CreateProjectModal'
import NodeDetailModal from './components/NodeDetailModal'
import TodayReal from './components/TodayReal'
import InboxReal from './components/InboxReal'
import UpcomingReal from './components/UpcomingReal'
import ProjectReal from './components/ProjectReal'
import BottomNav from './components/BottomNav'
import { pathForView, deriveViewFromPathname } from './routes'
import type { Task, Section } from './types'
import { fetchMe, logout, type AuthUser } from './store/auth-api'
import { clearLocalStore } from './store/db'
import { startSyncLoop } from './store/sync-client'
import { useAllNodes } from './store/use-nodes'
import './styles/variables.css'
import './styles/global.css'
import './App.css'

/**
 * Real backend, real data — currently wired up for Today only. Every other
 * view (Inbox, Upcoming, Board, Outline, Mail, Storage, Agent) still runs on
 * the mock data below until docs/feature/2.backend/1.todo/todo.md blocks
 * C–J migrate them too. This is a deliberate, incremental slice: proving
 * the sync/auth/parser pipeline works end to end on one real view is worth
 * more right now than half-wiring twenty.
 */
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

  return { user, handleLoggedIn, handleLogout }
}

function App() {
  const { user, handleLoggedIn, handleLogout } = useAuthGate()
  const navigate = useNavigate()
  const location = useLocation()
  const { view: activeView, projectId: activeProjectId } = deriveViewFromPathname(location.pathname)
  const realNodes = useAllNodes()
  const [tasks, setTasks] = useState<Task[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [openNodeId, setOpenNodeId] = useState<string | null>(null)

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

  const handleToggleComplete = (taskId: string) => {
    setTasks(prev =>
      prev.map(t => t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t)
    )
  }

  const handleAddTask = (task: Omit<Task, 'id' | 'createdAt'>) => {
    const newTask: Task = {
      ...task,
      id: Date.now().toString(),
      createdAt: new Date().toISOString().split('T')[0],
    }
    setTasks(prev => [...prev, newTask])
  }

  const handleDeleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  const handleUpdateTask = (taskId: string, patch: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...patch } : t))
  }

  const handleAddSection = (projectId: string, name: string, beforeSectionId?: string) => {
    const newSection: Section = { id: Date.now().toString(), name, projectId }
    setSections(prev => {
      const index = beforeSectionId ? prev.findIndex(s => s.id === beforeSectionId) : -1
      if (index === -1) return [...prev, newSection]
      return [...prev.slice(0, index), newSection, ...prev.slice(index)]
    })
  }

  const handleRenameSection = (sectionId: string, name: string) => {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, name } : s))
  }

  const handleDeleteSection = (sectionId: string) => {
    setSections(prev => prev.filter(s => s.id !== sectionId))
    setTasks(prev => prev.map(t => t.sectionId === sectionId ? { ...t, sectionId: undefined } : t))
  }

  /*
   * Reorders only this project's own slots in the array — every other
   * project's sections keep their original position, since `sections` is
   * one flat array shared across all projects.
   */
  const handleReorderSections = (projectId: string, orderedSectionIds: string[]) => {
    setSections(prev => {
      const byId = new Map(prev.filter(s => s.projectId === projectId).map(s => [s.id, s]))
      let cursor = 0
      return prev.map(s => {
        if (s.projectId !== projectId) return s
        return byId.get(orderedSectionIds[cursor++])!
      })
    })
  }

  /*
   * sectionId has three meanings: omitted = don't touch it (flat/reorder-only
   * drags), null = clear it ("No Section"), a string = set it to that section.
   * beforeTaskId re-inserts immediately before that task's position in the
   * array (after the dragged task is removed); omitted appends to the end.
   */
  const handleMoveTask = (taskId: string, beforeTaskId?: string, sectionId?: string | null) => {
    setTasks(prev => {
      const task = prev.find(t => t.id === taskId)
      if (!task) return prev
      const rest = prev.filter(t => t.id !== taskId)
      const movedTask: Task = sectionId === undefined
        ? task
        : { ...task, sectionId: sectionId === null ? undefined : sectionId }

      const targetIndex = beforeTaskId ? rest.findIndex(t => t.id === beforeTaskId) : -1
      if (targetIndex === -1) return [...rest, movedTask]
      return [...rest.slice(0, targetIndex), movedTask, ...rest.slice(targetIndex)]
    })
  }

  const openTask = tasks.find(t => t.id === openTaskId) ?? null

  if (user === 'loading') {
    return <div className="app-loading">Loading…</div>
  }
  if (!user) {
    return <Login onLoggedIn={handleLoggedIn} />
  }

  return (
    <div className="app-shell">
      <button type="button" className="app-signout" onClick={handleLogout}>
        Sign out ({user.email})
      </button>
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
          activeProjectId={activeProjectId}
          collapsed={!isCompact && sidebarCollapsed}
          drawer={isCompact}
          drawerOpen={drawerOpen}
          theme={theme}
          onToggleTheme={toggleTheme}
          tasks={tasks}
          realNodes={realNodes}
          timezone={user.timezone}
          onViewChange={(view) => { navigate(pathForView(view)); setDrawerOpen(false) }}
          onProjectChange={(id) => { navigate(pathForView('project', id)); setDrawerOpen(false) }}
          onToggleCollapse={() => isCompact ? setDrawerOpen(false) : setSidebarCollapsed(c => !c)}
          onAddProject={() => setCreateProjectOpen(true)}
        />
        {isCompact && drawerOpen && (
          <div className="app-backdrop" onClick={() => setDrawerOpen(false)} />
        )}
        {activeView === 'outline' ? (
          <OutlineView user={user} />
        ) : activeView === 'mail' ? (
          <MailView />
        ) : activeView === 'storage' ? (
          <StorageView />
        ) : activeView === 'agent' ? (
          <AgentView />
        ) : activeView === 'today' ? (
          <TodayReal user={user} onOpenNode={setOpenNodeId} />
        ) : activeView === 'inbox' ? (
          <InboxReal user={user} onOpenNode={setOpenNodeId} />
        ) : activeView === 'upcoming' ? (
          <UpcomingReal user={user} onOpenNode={setOpenNodeId} />
        ) : activeView === 'project' && activeProjectId ? (
          <ProjectReal user={user} projectId={activeProjectId} onOpenNode={setOpenNodeId} />
        ) : (
          <MainContent
            activeView={activeView}
            activeProjectId={activeProjectId}
            tasks={tasks}
            sections={sections}
            onToggleComplete={handleToggleComplete}
            onAddTask={handleAddTask}
            onDeleteTask={handleDeleteTask}
            onOpenTask={setOpenTaskId}
            onAddSection={handleAddSection}
            onRenameSection={handleRenameSection}
            onDeleteSection={handleDeleteSection}
            onReorderSections={handleReorderSections}
            onMoveTask={handleMoveTask}
          />
        )}
      </div>
      {openTask && (
        <TaskDetailModal
          task={openTask}
          onClose={() => setOpenTaskId(null)}
          onToggleComplete={handleToggleComplete}
          onUpdateTask={handleUpdateTask}
        />
      )}
      {createProjectOpen && (
        <CreateProjectModal
          onClose={() => setCreateProjectOpen(false)}
          onCreated={(id) => {
            setCreateProjectOpen(false)
            navigate(pathForView('project', id))
            setDrawerOpen(false)
          }}
        />
      )}
      {openNodeId && (() => {
        const openNode = realNodes.find(n => n.id === openNodeId) ?? null
        return openNode ? (
          <NodeDetailModal node={openNode} onClose={() => setOpenNodeId(null)} />
        ) : null
      })()}
      <BottomNav onMorePress={() => setDrawerOpen(true)} />
    </div>
  )
}

export default App
