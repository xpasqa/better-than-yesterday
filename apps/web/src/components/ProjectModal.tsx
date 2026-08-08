// ProjectModal: single component for create/edit × area/project.
// Area has no parent dropdown and no isFavorite field (spec §6.C).
// Color swatches copied from CreateTagModal.tsx (policy §1 — second use).
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { XIcon } from '@phosphor-icons/react'
import { useAllNodes } from '../store/use-nodes'
import {
  createArea,
  createProject,
  updateNodeMeta,
  deleteWithDescendants,
  countDescendants,
} from '../store/project-actions'
import type { Node } from '@better/core/node'
import './ProjectModal.css'

export type ProjectModalMode = 'create' | 'edit'
export type ProjectModalKind = 'area' | 'project'

interface ProjectModalProps {
  mode: ProjectModalMode
  kind: ProjectModalKind
  /** For edit mode: the node being edited */
  node?: Node
  /** For create mode with a pre-selected area */
  defaultAreaId?: string | null
  onClose: () => void
  onCreated?: (id: string) => void
}

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

export default function ProjectModal({
  mode,
  kind,
  node,
  defaultAreaId = null,
  onClose,
  onCreated,
}: ProjectModalProps) {
  const allNodes = useAllNodes()

  const [name, setName] = useState(mode === 'edit' ? (node?.content ?? '') : '')
  const [color, setColor] = useState<string | null>(
    mode === 'edit' ? (node?.color ?? null) : null,
  )
  const [areaId, setAreaId] = useState<string | null>(
    mode === 'edit' ? (node?.parentId ?? null) : (defaultAreaId ?? null),
  )
  const [isFavorite, setIsFavorite] = useState(
    mode === 'edit' ? (node?.isFavorite ?? false) : false,
  )
  const [submitting, setSubmitting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const areas = allNodes.filter((n) => n.kind === 'area' && n.deletedAt === null)

  const titleLabel = mode === 'create'
    ? (kind === 'area' ? 'Add area' : 'Add project')
    : (kind === 'area' ? 'Edit area' : 'Edit project')

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    try {
      if (mode === 'create') {
        let id: string | null
        if (kind === 'area') {
          id = await createArea(trimmed, color, [...allNodes])
        } else {
          id = await createProject(trimmed, color, areaId, [...allNodes])
        }
        if (id) { onCreated?.(id); onClose() }
      } else {
        // edit mode
        if (!node) return
        // Apply all patches — if isFavorite changed, include it
        const patch: Partial<Pick<Node, 'content' | 'color' | 'parentId' | 'isFavorite'>> = {
          content: trimmed,
          color,
          isFavorite,
        }
        if (kind === 'project') {
          patch.parentId = areaId
        }
        const ok = await updateNodeMeta(node.id, patch, [...allNodes])
        if (ok) onClose()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!node) return
    setSubmitting(true)
    try {
      await deleteWithDescendants(node.id, [...allNodes])
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); void handleSubmit() }
    if (e.key === 'Escape') onClose()
  }

  // Delete confirmation counts
  const counts = node ? countDescendants(node.id, allNodes) : { projects: 0, tasks: 0 }
  const deleteLabel = (() => {
    if (kind === 'area') {
      const parts: string[] = []
      if (counts.projects > 0) parts.push(`${counts.projects} project${counts.projects !== 1 ? 's' : ''}`)
      if (counts.tasks > 0) parts.push(`${counts.tasks} task${counts.tasks !== 1 ? 's' : ''}`)
      return parts.length > 0
        ? `Delete area and its ${parts.join(' and ')}?`
        : 'Delete this area?'
    }
    return counts.tasks > 0
      ? `Delete project and its ${counts.tasks} task${counts.tasks !== 1 ? 's' : ''}?`
      : 'Delete this project?'
  })()

  return createPortal(
    <div
      className="project-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={titleLabel}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="project-modal">
        <div className="project-modal__header">
          <span className="project-modal__title">{titleLabel}</span>
          <button className="project-modal__close" onClick={onClose} aria-label="Close" type="button">
            <XIcon size={18} />
          </button>
        </div>

        {showDeleteConfirm ? (
          <div className="project-modal__body">
            <p className="project-modal__confirm-text">{deleteLabel}</p>
            <div className="project-modal__footer">
              <button
                className="project-modal__btn project-modal__btn--cancel"
                onClick={() => setShowDeleteConfirm(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="project-modal__btn project-modal__btn--danger"
                onClick={() => void handleDelete()}
                disabled={submitting}
                type="button"
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="project-modal__body">
              <label className="project-modal__label" htmlFor="pm-name-input">Name</label>
              <input
                id="pm-name-input"
                ref={inputRef}
                className="project-modal__input"
                type="text"
                placeholder={kind === 'area' ? 'Area name' : 'Project name'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={200}
                autoComplete="off"
              />

              <label className="project-modal__label">Color</label>
              <div className="project-modal__swatches">
                {COLOR_SWATCHES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    className={`project-modal__swatch${color === s.value ? ' project-modal__swatch--active' : ''}`}
                    style={{ background: s.value }}
                    aria-label={s.label}
                    onClick={() => setColor(c => c === s.value ? null : s.value)}
                  />
                ))}
              </div>

              {/* Area dropdown — project only */}
              {kind === 'project' && (
                <>
                  <label className="project-modal__label" htmlFor="pm-area-select">Area</label>
                  <select
                    id="pm-area-select"
                    className="project-modal__select"
                    value={areaId ?? ''}
                    onChange={(e) => setAreaId(e.target.value || null)}
                  >
                    <option value="">No area</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>{a.content}</option>
                    ))}
                  </select>
                </>
              )}

              {/* Favorite toggle — project only (areas don't have isFavorite, spec §4.2) */}
              {kind === 'project' && (
                <label className="project-modal__checkbox-row">
                  <input
                    type="checkbox"
                    checked={isFavorite}
                    onChange={(e) => setIsFavorite(e.target.checked)}
                  />
                  <span>Add to Favorites</span>
                </label>
              )}
            </div>

            <div className="project-modal__footer">
              {mode === 'edit' && (
                <button
                  className="project-modal__btn project-modal__btn--danger-outline"
                  onClick={() => setShowDeleteConfirm(true)}
                  type="button"
                  style={{ marginRight: 'auto' }}
                >
                  Delete
                </button>
              )}
              <button
                className="project-modal__btn project-modal__btn--cancel"
                onClick={onClose}
                type="button"
              >
                Cancel
              </button>
              <button
                className="project-modal__btn project-modal__btn--submit"
                onClick={() => void handleSubmit()}
                disabled={!name.trim() || submitting}
                type="button"
              >
                {mode === 'create' ? 'Add' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
