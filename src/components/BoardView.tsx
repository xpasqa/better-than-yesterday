import { useRef, useState } from 'react'
import { DotsThreeIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react'
import type { Task, Section } from '../types'
import TaskCard from './TaskCard'
import AddTaskForm from './AddTaskForm'
import './BoardView.css'

interface BoardViewProps {
  projectId: string
  tasks: Task[]
  sections: Section[]
  onToggleComplete: (id: string) => void
  onOpenTask: (id: string) => void
  onAddTask: (task: Omit<Task, 'id' | 'createdAt' | 'order'>) => void
  onAddSection: (projectId: string, name: string, beforeSectionId?: string) => void
  onRenameSection: (sectionId: string, name: string) => void
  onDeleteSection: (sectionId: string) => void
}

type Grouping = 'section' | 'date'

interface Column {
  key: string
  name: string
  tasks: Task[]
  section?: Section
}

function buildDateColumns(tasks: Task[]): Column[] {
  const today = new Date().toISOString().split('T')[0]
  return [
    { key: 'overdue', name: 'Overdue', tasks: tasks.filter(t => t.dueDate && t.dueDate < today) },
    { key: 'today', name: 'Today', tasks: tasks.filter(t => t.dueDate === today) },
    { key: 'upcoming', name: 'Upcoming', tasks: tasks.filter(t => t.dueDate && t.dueDate > today) },
    { key: 'no-date', name: 'No date', tasks: tasks.filter(t => !t.dueDate) },
  ]
}

export default function BoardView({
  projectId, tasks, sections,
  onToggleComplete, onOpenTask, onAddTask, onAddSection, onRenameSection, onDeleteSection,
}: BoardViewProps) {
  const [grouping, setGrouping] = useState<Grouping>('section')

  const unsectioned = tasks.filter(t => !t.sectionId)
  const columns: Column[] = grouping === 'date'
    ? buildDateColumns(tasks)
    : [
        ...(unsectioned.length > 0
          ? [{ key: 'no-section', name: 'No Section', tasks: unsectioned }]
          : []),
        ...sections.map(section => ({
          key: section.id,
          name: section.name,
          tasks: tasks.filter(t => t.sectionId === section.id),
          section,
        })),
      ]

  return (
    <div className="board-view">
      <div className="board-view__toolbar">
        <div className="board-view__grouping-toggle">
          <button
            className={`board-view__grouping-btn ${grouping === 'section' ? 'board-view__grouping-btn--active' : ''}`}
            onClick={() => setGrouping('section')}
          >
            Section
          </button>
          <button
            className={`board-view__grouping-btn ${grouping === 'date' ? 'board-view__grouping-btn--active' : ''}`}
            onClick={() => setGrouping('date')}
          >
            Date
          </button>
        </div>
      </div>

      <div className="board-view__columns">
        {columns.map((col, i) => (
          <div className="board-view__column-slot" key={col.key}>
            <BoardColumn
              name={col.name}
              tasks={col.tasks}
              section={col.section}
              projectId={projectId}
              onToggleComplete={onToggleComplete}
              onOpenTask={onOpenTask}
              onAddTask={onAddTask}
              onRenameSection={onRenameSection}
              onDeleteSection={onDeleteSection}
            />
            {grouping === 'section' && (
              <SectionGap
                projectId={projectId}
                beforeSectionId={columns[i + 1]?.section?.id}
                onAdd={onAddSection}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function SectionGap({ projectId, beforeSectionId, onAdd }: {
  projectId: string
  beforeSectionId?: string
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
      <div className="board-gap board-gap--adding">
        <input
          ref={inputRef}
          className="board-gap__input"
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
    <button className="board-gap" onClick={start} aria-label="Add section here">
      <span className="board-gap__line" />
      <span className="board-gap__label">
        <PlusIcon size={13} weight="bold" />
        Add section
      </span>
    </button>
  )
}

function BoardColumn({
  name, tasks, section, projectId,
  onToggleComplete, onOpenTask, onAddTask, onRenameSection, onDeleteSection,
}: {
  name: string
  tasks: Task[]
  section?: Section
  projectId: string
  onToggleComplete: (id: string) => void
  onOpenTask: (id: string) => void
  onAddTask: (task: Omit<Task, 'id' | 'createdAt' | 'order'>) => void
  onRenameSection: (sectionId: string, name: string) => void
  onDeleteSection: (sectionId: string) => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState(name)
  const [adding, setAdding] = useState(false)

  const commitRename = () => {
    if (!section) return
    const trimmed = nameDraft.trim()
    if (trimmed && trimmed !== section.name) onRenameSection(section.id, trimmed)
    else setNameDraft(section.name)
    setRenaming(false)
  }

  return (
    <div className="board-column">
      <div className="board-column__header">
        {renaming ? (
          <input
            className="board-column__rename-input"
            value={nameDraft}
            autoFocus
            onChange={e => setNameDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commitRename() }
              if (e.key === 'Escape') { e.preventDefault(); setNameDraft(name); setRenaming(false) }
            }}
          />
        ) : (
          <span className="board-column__name">{name}</span>
        )}
        <span className="board-column__count">{tasks.length}</span>
        {section && (
          <div className="board-column__menu-wrapper" onMouseLeave={() => setShowMenu(false)}>
            <button
              className="board-column__menu-btn"
              onClick={() => setShowMenu(m => !m)}
              aria-label="Section options"
            >
              <DotsThreeIcon size={17} weight="bold" />
            </button>
            {showMenu && (
              <div className="board-column__dropdown">
                <button
                  className="board-column__dropdown-item"
                  onClick={() => { setRenaming(true); setShowMenu(false) }}
                >
                  <PencilSimpleIcon size={15} />
                  Rename
                </button>
                <button
                  className="board-column__dropdown-item board-column__dropdown-item--danger"
                  onClick={() => { onDeleteSection(section.id); setShowMenu(false) }}
                >
                  <TrashIcon size={15} />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="board-column__body">
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onToggleComplete={onToggleComplete}
            onOpenTask={onOpenTask}
          />
        ))}
      </div>

      {adding ? (
        <AddTaskForm
          defaultProjectId={projectId}
          defaultSectionId={section?.id}
          onAdd={(task) => { onAddTask(task); setAdding(false) }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button className="board-column__add-btn" onClick={() => setAdding(true)}>
          <PlusIcon size={14} weight="bold" />
          <span>Add task</span>
        </button>
      )}
    </div>
  )
}
