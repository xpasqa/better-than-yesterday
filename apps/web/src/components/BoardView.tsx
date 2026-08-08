import { useState } from 'react'
import { board } from '@better/core/board'
import { DotsThreeIcon, PlusIcon } from '@phosphor-icons/react'
import { useAllTags, useAllNodes } from '../store/use-nodes'
import { createSection, deleteSection, updateNode } from '../store/node-actions'
import type { AuthUser } from '../store/auth-api'
import AddTaskFormReal from './AddTaskFormReal'
import BoardCard from './BoardCard'
import './BoardView.css'

interface BoardViewProps {
  user: AuthUser
  projectId: string
  onOpenNode?: (id: string) => void
}

function BoardView({ user, projectId, onOpenNode }: BoardViewProps) {
  const nodes = useAllNodes()
  const tags = useAllTags()
  const tagsById = new Map(tags.map((t) => [t.id, t]))
  const columns = board(nodes, projectId)

  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [addingSection, setAddingSection] = useState(false)
  const [sectionName, setSectionName] = useState('')
  const [dragOver, setDragOver] = useState<string | null>(null)

  // Dropping onto the implicit column means "no section" — the parent is the
  // project itself. That is why the drop target id is the project id, not a
  // sentinel: the value written is already the value we want.
  const targetIdOf = (col: (typeof columns)[number]) => col.section?.id ?? projectId

  async function handleDrop(event: React.DragEvent, targetId: string) {
    event.preventDefault()
    setDragOver(null)
    const itemId = event.dataTransfer.getData('text/plain')
    if (!itemId) return
    const item = nodes.find((n) => n.id === itemId)
    if (!item || item.parentId === targetId) return // same column: nothing to write
    await updateNode(itemId, { parentId: targetId })
  }

  async function submitSection() {
    const name = sectionName.trim()
    if (name) await createSection(projectId, name)
    setSectionName('')
    setAddingSection(false)
  }

  return (
    <div className="board">
      {columns.map((col) => {
        const targetId = targetIdOf(col)
        return (
          <section
            key={targetId}
            className={`board__column ${dragOver === targetId ? 'board__column--over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(targetId) }}
            onDragLeave={() => setDragOver((c) => (c === targetId ? null : c))}
            onDrop={(e) => void handleDrop(e, targetId)}
          >
            <header className="board__column-header">
              {col.section ? (
                <input
                  className="board__column-title"
                  defaultValue={col.section.content}
                  onBlur={(e) => {
                    const name = e.target.value.trim()
                    if (name && name !== col.section!.content) void updateNode(col.section!.id, { content: name })
                    else e.target.value = col.section!.content
                  }}
                />
              ) : (
                <span className="board__column-title board__column-title--implicit">No section</span>
              )}
              <span className="board__count">{col.items.length}</span>
              {col.section && (
                <button
                  className="board__column-menu"
                  type="button"
                  aria-label={`Delete section ${col.section.content}`}
                  onClick={() => void deleteSection(col.section!)}
                >
                  <DotsThreeIcon size={16} />
                </button>
              )}
            </header>

            <div className="board__cards">
              {col.items.map((item) => (
                <BoardCard
                  key={item.id}
                  node={item}
                  tagsById={tagsById}
                  timezone={user.timezone ?? 'Asia/Jakarta'}
                  onOpen={onOpenNode}
                />
              ))}
            </div>

            {addingTo === targetId ? (
              <AddTaskFormReal
                timezone={user.timezone ?? 'Asia/Jakarta'}
                defaultParentId={targetId}
                onCancel={() => setAddingTo(null)}
                onAdded={() => setAddingTo(null)}
              />
            ) : (
              <button className="board__add-card" type="button" onClick={() => setAddingTo(targetId)}>
                <PlusIcon size={14} weight="bold" /> Add task
              </button>
            )}
          </section>
        )
      })}

      <div className="board__column board__column--new">
        {addingSection ? (
          <input
            className="board__new-section-input"
            autoFocus
            value={sectionName}
            placeholder="Section name"
            onChange={(e) => setSectionName(e.target.value)}
            onBlur={() => void submitSection()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submitSection()
              if (e.key === 'Escape') { setSectionName(''); setAddingSection(false) }
            }}
          />
        ) : (
          <button className="board__add-section" type="button" onClick={() => setAddingSection(true)}>
            <PlusIcon size={14} weight="bold" /> Add section
          </button>
        )}
      </div>
    </div>
  )
}

export default BoardView
