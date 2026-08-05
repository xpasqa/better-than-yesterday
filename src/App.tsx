import { useState } from 'react'
import Sidebar from './components/Sidebar'
import MainContent from './components/MainContent'
import TaskDetailModal from './components/TaskDetailModal'
import OutlineView from './components/OutlineView'
import StorageView from './components/StorageView'
import AgentView from './components/AgentView'
import type { ViewType } from './types'
import { tasks as initialTasks, sections as initialSections } from './data/mockData'
import type { Task, Section } from './types'
import './styles/variables.css'
import './styles/global.css'
import './App.css'

function App() {
  const [activeView, setActiveView] = useState<ViewType>('today')
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [sections, setSections] = useState<Section[]>(initialSections)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)

  const handleToggleComplete = (taskId: string) => {
    setTasks(prev =>
      prev.map(t => t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t)
    )
  }

  const handleAddTask = (task: Omit<Task, 'id' | 'createdAt' | 'order'>) => {
    const newTask: Task = {
      ...task,
      id: Date.now().toString(),
      createdAt: new Date().toISOString().split('T')[0],
      order: tasks.length + 1,
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

  const openTask = tasks.find(t => t.id === openTaskId) ?? null

  return (
    <div className="app-layout">
      <Sidebar
        activeView={activeView}
        activeProjectId={activeProjectId}
        collapsed={sidebarCollapsed}
        tasks={tasks}
        onViewChange={(view) => { setActiveView(view); setActiveProjectId(null) }}
        onProjectChange={(id) => { setActiveProjectId(id); setActiveView('project') }}
        onToggleCollapse={() => setSidebarCollapsed(c => !c)}
      />
      {activeView === 'outline' ? (
        <OutlineView />
      ) : activeView === 'storage' ? (
        <StorageView />
      ) : activeView === 'agent' ? (
        <AgentView />
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
        />
      )}
      {openTask && (
        <TaskDetailModal
          task={openTask}
          onClose={() => setOpenTaskId(null)}
          onToggleComplete={handleToggleComplete}
          onUpdateTask={handleUpdateTask}
        />
      )}
    </div>
  )
}

export default App
