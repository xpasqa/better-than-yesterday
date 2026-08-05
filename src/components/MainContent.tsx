import { Fragment, useRef, useState } from 'react'
import { CaretDownIcon, CheckCircleIcon, DotsThreeIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react'
import type { ViewType, Task, Section } from '../types'
import { projects } from '../data/mockData'
import TaskList from './TaskList'
import AddTaskForm from './AddTaskForm'
import ViewModeToggle from './ViewModeToggle'
import BoardView from './BoardView'
import './MainContent.css'

interface MainContentProps {
  activeView: ViewType
  activeProjectId: string | null
  tasks: Task[]
  sections: Section[]
  onToggleComplete: (id: string) => void
  onAddTask: (task: Omit<Task, 'id' | 'createdAt' | 'order'>) => void
  onDeleteTask: (id: string) => void
  onOpenTask: (id: string) => void
  onAddSection: (projectId: string, name: string, beforeSectionId?: string) => void
  onRenameSection: (sectionId: string, name: string) => void
  onDeleteSection: (sectionId: string) => void
}

function getViewTitle(view: ViewType, projectId: string | null): string {
  if (view === 'project' && projectId) {
    return projects.find(p => p.id === projectId)?.name ?? 'Project'
  }
  switch (view) {
    case 'inbox': return 'Inbox'
    case 'today': return 'Today'
    case 'upcoming': return 'Upcoming'
    case 'filters': return 'Filters & Labels'
    default: return 'Today'
  }
}

/* Todoist renders this as "4 Aug ‧ Today ‧ Tuesday" — U+2027 separators, not "·" */
function getTodayLabel(): string {
  const now = new Date()
  const day = now.getDate()
  const month = now.toLocaleDateString('en-US', { month: 'short' })
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' })
  return `${day} ${month} ‧ Today ‧ ${weekday}`
}

function filterTasks(tasks: Task[], view: ViewType, projectId: string | null): Task[] {
  const today = new Date().toISOString().split('T')[0]
  switch (view) {
    case 'inbox':
      return tasks.filter(t => t.projectId === 'inbox')
    case 'today':
      return tasks.filter(t => t.dueDate && t.dueDate <= today)
    case 'upcoming':
      return tasks.filter(t => !t.dueDate || t.dueDate > today)
    case 'project':
      return tasks.filter(t => t.projectId === projectId)
    default:
      return tasks
  }
}

export default function MainContent({
  activeView, activeProjectId, tasks, sections,
  onToggleComplete, onAddTask, onDeleteTask, onOpenTask,
  onAddSection, onRenameSection, onDeleteSection,
}: MainContentProps) {
  const [showAddTask, setShowAddTask] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list')

  const title = getViewTitle(activeView, activeProjectId)
  const today = new Date().toISOString().split('T')[0]
  const filteredTasks = filterTasks(tasks, activeView, activeProjectId)

  const overdueTasks = activeView === 'today'
    ? filteredTasks.filter(t => t.dueDate && t.dueDate < today && !t.isCompleted)
    : []
  const todayTasks = activeView === 'today'
    ? filteredTasks.filter(t => t.dueDate === today && !t.isCompleted)
    : filteredTasks.filter(t => !t.isCompleted)
  const completedTasks = filteredTasks.filter(t => t.isCompleted)
  const openTaskCount = overdueTasks.length + todayTasks.length

  const defaultProjectId = activeView === 'project' && activeProjectId
    ? activeProjectId
    : activeView === 'inbox' ? 'inbox' : 'personal'

  /*
   * Sections only make sense scoped to a single project — Today/Upcoming/
   * Filters mix tasks (and section names) from multiple projects, so they
   * stay flat/List-only, matching real Todoist's own Board view scoping.
   */
  const isProjectScoped = activeView === 'inbox' || activeView === 'project'
  const projectSections = isProjectScoped ? sections.filter(s => s.projectId === defaultProjectId) : []
  const hasSections = projectSections.length > 0
  const unsectionedTasks = todayTasks.filter(t => !t.sectionId)
  const isBoardMode = isProjectScoped && viewMode === 'board'

  return (
    <main className="main-content">
      <div className={`main-content__inner ${isBoardMode ? 'main-content__inner--board' : ''}`}>
        {/* Header */}
        <div className="main-content__header">
          <div className="main-content__header-row">
            <h1 className="main-content__title">{title}</h1>
            {isProjectScoped && <ViewModeToggle mode={viewMode} onChange={setViewMode} />}
          </div>
          <p className="main-content__subtitle">
            <CheckCircleIcon />
            {openTaskCount} {openTaskCount === 1 ? 'task' : 'tasks'}
          </p>
        </div>

        {isBoardMode ? (
          <BoardView
            projectId={defaultProjectId}
            tasks={filteredTasks.filter(t => !t.isCompleted)}
            sections={projectSections}
            onToggleComplete={onToggleComplete}
            onOpenTask={onOpenTask}
            onAddTask={onAddTask}
            onAddSection={onAddSection}
            onRenameSection={onRenameSection}
            onDeleteSection={onDeleteSection}
          />
        ) : (
          <>
            {/* Overdue section */}
            {overdueTasks.length > 0 && (
              <div className="main-content__section">
                <div className="main-content__section-header">
                  <span>Overdue</span>
                  <button className="main-content__reschedule-btn">Reschedule</button>
                </div>
                <TaskList
                  tasks={overdueTasks}
                  onToggleComplete={onToggleComplete}
                  onDeleteTask={onDeleteTask}
                  onOpenTask={onOpenTask}
                />
              </div>
            )}

            {/* Today / main tasks */}
            {activeView === 'today' && (
              <div className="main-content__section">
                <div className="main-content__section-header">
                  <span>{getTodayLabel()}</span>
                  <span className="main-content__section-count">{todayTasks.length}</span>
                </div>
                <TaskList
                  tasks={todayTasks}
                  onToggleComplete={onToggleComplete}
                  onDeleteTask={onDeleteTask}
                  onOpenTask={onOpenTask}
                />
              </div>
            )}

            {/* Inbox/project views with sections defined */}
            {isProjectScoped && hasSections && (
              <div className="main-content__section">
                {unsectionedTasks.length > 0 && (
                  <>
                    <div className="main-content__section-header main-content__section-header--plain">
                      <span>(No Section)</span>
                      <span className="main-content__section-count">{unsectionedTasks.length}</span>
                    </div>
                    <TaskList
                      tasks={unsectionedTasks}
                      onToggleComplete={onToggleComplete}
                      onDeleteTask={onDeleteTask}
                      onOpenTask={onOpenTask}
                    />
                  </>
                )}
                {projectSections.map((section, i) => (
                  <Fragment key={section.id}>
                    {(i > 0 || unsectionedTasks.length > 0) && (
                      <SectionGapRow
                        projectId={defaultProjectId}
                        beforeSectionId={section.id}
                        onAdd={onAddSection}
                      />
                    )}
                    <SectionGroup
                      section={section}
                      tasks={todayTasks.filter(t => t.sectionId === section.id)}
                      defaultProjectId={defaultProjectId}
                      onToggleComplete={onToggleComplete}
                      onDeleteTask={onDeleteTask}
                      onOpenTask={onOpenTask}
                      onAddTask={onAddTask}
                      onRename={name => onRenameSection(section.id, name)}
                      onDelete={() => onDeleteSection(section.id)}
                    />
                  </Fragment>
                ))}
                <AddSectionRow projectId={defaultProjectId} onAdd={onAddSection} />
              </div>
            )}

            {/* Views with no sections to group by (Upcoming, Filters, or a
                project/Inbox that hasn't created any sections yet) */}
            {activeView !== 'today' && !(isProjectScoped && hasSections) && (
              <div className="main-content__section">
                <TaskList
                  tasks={todayTasks}
                  onToggleComplete={onToggleComplete}
                  onDeleteTask={onDeleteTask}
                  onOpenTask={onOpenTask}
                />
                {isProjectScoped && (
                  <AddSectionRow projectId={defaultProjectId} onAdd={onAddSection} />
                )}
              </div>
            )}

            {/* Add task */}
            {showAddTask ? (
              <AddTaskForm
                defaultProjectId={defaultProjectId}
                defaultDueDate={activeView === 'today' ? today : undefined}
                onAdd={(task) => { onAddTask(task); setShowAddTask(false) }}
                onCancel={() => setShowAddTask(false)}
              />
            ) : (
              <button className="main-content__add-task-btn" onClick={() => setShowAddTask(true)}>
                <span className="main-content__add-task-icon">+</span>
                <span>Add task</span>
              </button>
            )}
          </>
        )}

        {/* Completed tasks */}
        {viewMode === 'list' && completedTasks.length > 0 && (
          <CompletedSection
            tasks={completedTasks}
            onToggleComplete={onToggleComplete}
            onDeleteTask={onDeleteTask}
            onOpenTask={onOpenTask}
          />
        )}
      </div>
    </main>
  )
}

function CompletedSection({ tasks, onToggleComplete, onDeleteTask, onOpenTask }: {
  tasks: Task[]
  onToggleComplete: (id: string) => void
  onDeleteTask: (id: string) => void
  onOpenTask: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="main-content__completed">
      <button
        className="main-content__completed-toggle"
        onClick={() => setExpanded(e => !e)}
      >
        <CaretDownIcon
          size={14}
          weight="bold"
          style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}
        />
        <span>Completed</span>
        <span className="main-content__section-count">{tasks.length}</span>
      </button>
      {expanded && (
        <TaskList
          tasks={tasks}
          onToggleComplete={onToggleComplete}
          onDeleteTask={onDeleteTask}
          onOpenTask={onOpenTask}
        />
      )}
    </div>
  )
}

/* One section's header + tasks + its own scoped "+ Add task". */
function SectionGroup({
  section, tasks, defaultProjectId,
  onToggleComplete, onDeleteTask, onOpenTask, onAddTask, onRename, onDelete,
}: {
  section: Section
  tasks: Task[]
  defaultProjectId: string
  onToggleComplete: (id: string) => void
  onDeleteTask: (id: string) => void
  onOpenTask: (id: string) => void
  onAddTask: (task: Omit<Task, 'id' | 'createdAt' | 'order'>) => void
  onRename: (name: string) => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [showMenu, setShowMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState(section.name)
  const [showAddTask, setShowAddTask] = useState(false)

  const commitRename = () => {
    const trimmed = nameDraft.trim()
    if (trimmed && trimmed !== section.name) onRename(trimmed)
    else setNameDraft(section.name)
    setRenaming(false)
  }

  return (
    <div className="main-content__section-group">
      <div className="main-content__section-header">
        <button
          className="main-content__section-collapse"
          onClick={() => setExpanded(e => !e)}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <CaretDownIcon
            size={14}
            weight="bold"
            style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}
          />
        </button>
        {renaming ? (
          <input
            className="main-content__section-rename-input"
            value={nameDraft}
            autoFocus
            onChange={e => setNameDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commitRename() }
              if (e.key === 'Escape') { e.preventDefault(); setNameDraft(section.name); setRenaming(false) }
            }}
          />
        ) : (
          <span>{section.name}</span>
        )}
        <span className="main-content__section-count">{tasks.length}</span>
        <div className="main-content__section-menu-wrapper" onMouseLeave={() => setShowMenu(false)}>
          <button
            className="main-content__section-menu-btn"
            onClick={() => setShowMenu(m => !m)}
            aria-label="Section options"
          >
            <DotsThreeIcon size={17} weight="bold" />
          </button>
          {showMenu && (
            <div className="main-content__section-dropdown">
              <button
                className="main-content__section-dropdown-item"
                onClick={() => { setRenaming(true); setShowMenu(false) }}
              >
                <PencilSimpleIcon size={15} />
                Rename
              </button>
              <button
                className="main-content__section-dropdown-item main-content__section-dropdown-item--danger"
                onClick={() => { onDelete(); setShowMenu(false) }}
              >
                <TrashIcon size={15} />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <>
          <TaskList
            tasks={tasks}
            onToggleComplete={onToggleComplete}
            onDeleteTask={onDeleteTask}
            onOpenTask={onOpenTask}
          />
          {showAddTask ? (
            <AddTaskForm
              defaultProjectId={defaultProjectId}
              defaultSectionId={section.id}
              onAdd={(task) => { onAddTask(task); setShowAddTask(false) }}
              onCancel={() => setShowAddTask(false)}
            />
          ) : (
            <button className="main-content__add-task-btn" onClick={() => setShowAddTask(true)}>
              <span className="main-content__add-task-icon">+</span>
              <span>Add task</span>
            </button>
          )}
        </>
      )}
    </div>
  )
}

/* Hover-revealed horizontal divider between two section groups, for inserting a new section at that exact position */
function SectionGapRow({ projectId, beforeSectionId, onAdd }: {
  projectId: string
  beforeSectionId: string
  onAdd: (projectId: string, name: string, beforeSectionId?: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const start = () => {
    setAdding(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const commit = () => {
    const trimmed = name.trim()
    if (trimmed) onAdd(projectId, trimmed, beforeSectionId)
    setName('')
    setAdding(false)
  }

  if (adding) {
    return (
      <div className="main-content__section-gap main-content__section-gap--adding">
        <input
          ref={inputRef}
          className="main-content__section-gap-input"
          placeholder="Section name"
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            if (e.key === 'Escape') { e.preventDefault(); setName(''); setAdding(false) }
          }}
        />
      </div>
    )
  }

  return (
    <button className="main-content__section-gap" onClick={start} aria-label="Add section here">
      <span className="main-content__section-gap-line" />
      <span className="main-content__section-gap-label">
        <PlusIcon size={13} weight="bold" />
        Add section
      </span>
      <span className="main-content__section-gap-line" />
    </button>
  )
}

function AddSectionRow({ projectId, onAdd }: { projectId: string; onAdd: (projectId: string, name: string) => void }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const start = () => {
    setAdding(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const commit = () => {
    const trimmed = name.trim()
    if (trimmed) onAdd(projectId, trimmed)
    setName('')
    setAdding(false)
  }

  if (!adding) {
    return (
      <button className="main-content__add-section-btn" onClick={start}>
        <PlusIcon size={14} weight="bold" />
        <span>Add section</span>
      </button>
    )
  }

  return (
    <input
      ref={inputRef}
      className="main-content__add-section-input"
      placeholder="Section name"
      value={name}
      onChange={e => setName(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); commit() }
        if (e.key === 'Escape') { e.preventDefault(); setName(''); setAdding(false) }
      }}
    />
  )
}
