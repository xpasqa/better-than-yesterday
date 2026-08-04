import { useEffect, useRef, useState } from 'react'
import {
  DotsThreeIcon, FileDocIcon, FileIcon, FileImageIcon, FilePdfIcon, FileXlsIcon,
  FileZipIcon, FolderIcon, PencilSimpleIcon, TrashIcon,
} from '@phosphor-icons/react'
import type { StorageFileType } from '../types'
import './StorageItem.css'

interface StorageItemProps {
  kind: 'folder' | 'file'
  name: string
  meta: string
  fileType?: StorageFileType
  isRenaming: boolean
  onOpen?: () => void
  onStartRename: () => void
  onCommitRename: (newName: string) => void
  onCancelRename: () => void
  onDelete: () => void
}

const fileIconByType: Record<StorageFileType, { Icon: typeof FileIcon; color: string }> = {
  pdf: { Icon: FilePdfIcon, color: 'var(--priority-p1)' },
  image: { Icon: FileImageIcon, color: 'var(--meta-green)' },
  doc: { Icon: FileDocIcon, color: 'var(--meta-sky)' },
  sheet: { Icon: FileXlsIcon, color: 'var(--meta-olive)' },
  zip: { Icon: FileZipIcon, color: 'var(--text-secondary)' },
  other: { Icon: FileIcon, color: 'var(--text-tertiary)' },
}

export default function StorageItem({
  kind, name, meta, fileType, isRenaming,
  onOpen, onStartRename, onCommitRename, onCancelRename, onDelete,
}: StorageItemProps) {
  const [draft, setDraft] = useState(name)
  const [hovered, setHovered] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming) {
      setDraft(name)
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isRenaming, name])

  const commitRename = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== name) onCommitRename(trimmed)
    else onCancelRename()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commitRename() }
    if (e.key === 'Escape') { e.preventDefault(); onCancelRename() }
  }

  const { Icon, color } = kind === 'folder'
    ? { Icon: FolderIcon, color: 'var(--meta-blue)' }
    : fileIconByType[fileType ?? 'other']

  return (
    <li
      className="storage-item"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowMenu(false) }}
    >
      <span className="storage-item__icon" style={{ color }}>
        <Icon size={20} weight={kind === 'folder' ? 'fill' : 'regular'} />
      </span>

      <div
        className="storage-item__content"
        onClick={() => kind === 'folder' && !isRenaming && onOpen?.()}
      >
        {isRenaming ? (
          <input
            ref={inputRef}
            className="storage-item__rename-input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="storage-item__name">{name}</span>
        )}
      </div>

      <span className="storage-item__meta">{meta}</span>

      {/* Slot always occupies its width so hovering never shifts the meta column */}
      <div className="storage-item__actions">
        {hovered && !isRenaming && (
          <div className="storage-item__menu-wrapper">
            <button
              className="storage-item__action-btn"
              onClick={() => setShowMenu(m => !m)}
              aria-label="More options"
            >
              <DotsThreeIcon size={18} weight="bold" />
            </button>
            {showMenu && (
              <div className="storage-item__dropdown">
                <button
                  className="storage-item__dropdown-item"
                  onClick={() => { onStartRename(); setShowMenu(false) }}
                >
                  <PencilSimpleIcon size={16} />
                  Rename
                </button>
                <button
                  className="storage-item__dropdown-item storage-item__dropdown-item--danger"
                  onClick={() => { onDelete(); setShowMenu(false) }}
                >
                  <TrashIcon size={16} />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  )
}
