import { useState } from 'react'
import { PencilSimpleIcon, TrashIcon, XIcon, CheckIcon } from '@phosphor-icons/react'
import { useAllTags } from '../store/use-nodes'
import { useAllNodes } from '../store/use-nodes'
import { updateTag, deleteTag } from '../store/tag-actions'
import type { Tag } from '@better/core/tag'
import './TagsView.css'

const COLOR_SWATCHES = [
  { label: 'Red', value: '#dc4c3e' },
  { label: 'Orange', value: '#eb8909' },
  { label: 'Yellow', value: '#f0c10c' },
  { label: 'Green', value: '#058527' },
  { label: 'Blue', value: '#246fe0' },
  { label: 'Purple', value: '#692ec2' },
  { label: 'Pink', value: '#e05d9a' },
  { label: 'Grey', value: '#808080' },
]

interface EditState {
  tagId: string
  name: string
  color: string
  error: string | null
  saving: boolean
}

interface DeleteConfirm {
  tag: Tag
  usageCount: number
}

export default function TagsView() {
  const tags = useAllTags()
  const nodes = useAllNodes()

  const [editState, setEditState] = useState<EditState | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Sort live tags by rank
  const sortedTags = [...tags].sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0))

  function usageCount(tagId: string): number {
    return nodes.filter((n) => n.tagIds.includes(tagId) && n.deletedAt === null).length
  }

  function startEdit(tag: Tag) {
    setEditState({ tagId: tag.id, name: tag.name, color: tag.color, error: null, saving: false })
  }

  function cancelEdit() {
    setEditState(null)
  }

  async function commitEdit() {
    if (!editState || editState.saving) return
    setEditState((s) => s && { ...s, saving: true, error: null })
    const result = await updateTag(editState.tagId, {
      name: editState.name,
      color: editState.color,
    })
    if (result.ok) {
      setEditState(null)
    } else {
      setEditState((s) => s && { ...s, saving: false, error: result.reason })
    }
  }

  function startDelete(tag: Tag) {
    setDeleteConfirm({ tag, usageCount: usageCount(tag.id) })
  }

  async function confirmDelete() {
    if (!deleteConfirm || deleting) return
    setDeleting(true)
    await deleteTag(deleteConfirm.tag.id)
    setDeleting(false)
    setDeleteConfirm(null)
  }

  return (
    <div className="tags-view">
      <div className="tags-view__header">
        <h1 className="tags-view__title">Tags</h1>
      </div>

      {sortedTags.length === 0 ? (
        <div className="tags-view__empty">
          <p className="tags-view__empty-text">No tags yet.</p>
          <p className="tags-view__empty-hint">
            Create tags from the task detail panel or by typing <code>$tagname</code> in Quick Add.
          </p>
        </div>
      ) : (
        <ul className="tags-view__list">
          {sortedTags.map((tag) => {
            const isEditing = editState?.tagId === tag.id
            const count = usageCount(tag.id)

            return (
              <li key={tag.id} className="tags-view__item">
                {isEditing && editState ? (
                  <div className="tags-view__edit-row">
                    {/* Color dot preview */}
                    <span
                      className="tags-view__dot"
                      style={{ background: editState.color }}
                      aria-hidden="true"
                    />

                    {/* Name input */}
                    <input
                      className={`tags-view__name-input${editState.error ? ' tags-view__name-input--error' : ''}`}
                      value={editState.name}
                      onChange={(e) => setEditState((s) => s && { ...s, name: e.target.value, error: null })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void commitEdit()
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      autoFocus
                      aria-label="Tag name"
                      placeholder="tag-name"
                    />

                    {/* Color swatches */}
                    <div className="tags-view__swatches" role="group" aria-label="Tag color">
                      {COLOR_SWATCHES.map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          className={`tags-view__swatch${editState.color === s.value ? ' tags-view__swatch--active' : ''}`}
                          style={{ background: s.value }}
                          aria-label={s.label}
                          onClick={() => setEditState((st) => st && { ...st, color: s.value })}
                        />
                      ))}
                    </div>

                    {/* Error message */}
                    {editState.error && (
                      <span className="tags-view__edit-error" role="alert">{editState.error}</span>
                    )}

                    {/* Save / cancel */}
                    <div className="tags-view__edit-actions">
                      <button
                        type="button"
                        className="tags-view__action-btn tags-view__action-btn--save"
                        onClick={() => void commitEdit()}
                        disabled={editState.saving || !editState.name.trim()}
                        aria-label="Save"
                      >
                        <CheckIcon size={16} />
                      </button>
                      <button
                        type="button"
                        className="tags-view__action-btn tags-view__action-btn--cancel"
                        onClick={cancelEdit}
                        aria-label="Cancel"
                      >
                        <XIcon size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="tags-view__display-row">
                    <span
                      className="tags-view__dot"
                      style={{ background: tag.color }}
                      aria-hidden="true"
                    />
                    <span className="tags-view__name">{tag.name}</span>
                    <span className="tags-view__count" aria-label={`Used in ${count} task${count !== 1 ? 's' : ''}`}>
                      {count}
                    </span>
                    <div className="tags-view__row-actions">
                      <button
                        type="button"
                        className="tags-view__action-btn"
                        onClick={() => startEdit(tag)}
                        aria-label={`Edit tag ${tag.name}`}
                      >
                        <PencilSimpleIcon size={16} />
                      </button>
                      <button
                        type="button"
                        className="tags-view__action-btn tags-view__action-btn--danger"
                        onClick={() => startDelete(tag)}
                        aria-label={`Delete tag ${tag.name}`}
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div
          className="tags-view__overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirm(null) }}
        >
          <div className="tags-view__confirm">
            <h2 id="delete-confirm-title" className="tags-view__confirm-title">Delete tag</h2>
            <p className="tags-view__confirm-body">
              Delete <strong>{deleteConfirm.tag.name}</strong>?
              {deleteConfirm.usageCount > 0 ? (
                <> This tag is used in <strong>{deleteConfirm.usageCount} task{deleteConfirm.usageCount !== 1 ? 's' : ''}</strong>. It will be removed from all of them.</>
              ) : (
                <> It is not used by any tasks.</>
              )}
            </p>
            <div className="tags-view__confirm-actions">
              <button
                type="button"
                className="tags-view__confirm-btn tags-view__confirm-btn--cancel"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tags-view__confirm-btn tags-view__confirm-btn--delete"
                onClick={() => void confirmDelete()}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
