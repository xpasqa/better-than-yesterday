import { useState } from 'react'
import Sidebar from './components/Sidebar'
import MainContent from './components/MainContent'
import type { ViewType } from './types'
import { tasks as initialTasks } from './data/mockData'
import type { Task } from './types'
import './styles/variables.css'
import './styles/global.css'
import './App.css'

function App() {
  const [activeView, setActiveView] = useState<ViewType>('today')
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

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
      <MainContent
        activeView={activeView}
        activeProjectId={activeProjectId}
        tasks={tasks}
        onToggleComplete={handleToggleComplete}
        onAddTask={handleAddTask}
        onDeleteTask={handleDeleteTask}
      />
    </div>
  )
}

export default App
