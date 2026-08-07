import { useRef, useState } from 'react'
import { FolderPlusIcon } from '@phosphor-icons/react'
import type { StorageFile, StorageFolder } from '../types'
import { storageFiles, storageFolders } from '../data/storageData'
import StorageItem from './StorageItem'
import './StorageView.css'

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${units[unitIndex]}`
}

function formatModifiedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

/** A folder and every folder nested under it, including itself. */
function collectFolderAndDescendants(folders: StorageFolder[], id: string): string[] {
  const children = folders.filter(f => f.parentId === id)
  return [id, ...children.flatMap(c => collectFolderAndDescendants(folders, c.id))]
}

export default function StorageView() {
  const [folders, setFolders] = useState<StorageFolder[]>(storageFolders)
  const [files, setFiles] = useState<StorageFile[]>(storageFiles)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const newFolderInputRef = useRef<HTMLInputElement>(null)

  const trail: { id: string | null; name: string }[] = [{ id: null, name: 'Storage' }]
  let walkId = currentFolderId
  const upward: { id: string | null; name: string }[] = []
  while (walkId) {
    const folder = folders.find(f => f.id === walkId)
    if (!folder) break
    upward.unshift({ id: folder.id, name: folder.name })
    walkId = folder.parentId
  }
  trail.push(...upward)

  const childCount = (folderId: string) =>
    folders.filter(f => f.parentId === folderId).length + files.filter(f => f.parentId === folderId).length

  const currentFolders = folders
    .filter(f => f.parentId === currentFolderId)
    .sort((a, b) => a.name.localeCompare(b.name))
  const currentFiles = files
    .filter(f => f.parentId === currentFolderId)
    .sort((a, b) => a.name.localeCompare(b.name))
  const itemCount = currentFolders.length + currentFiles.length

  const handleDeleteFolder = (id: string) => {
    const idsToRemove = collectFolderAndDescendants(folders, id)
    setFolders(prev => prev.filter(f => !idsToRemove.includes(f.id)))
    setFiles(prev => prev.filter(f => !idsToRemove.includes(f.parentId ?? '')))
  }

  const handleDeleteFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const startCreatingFolder = () => {
    setIsCreatingFolder(true)
    setNewFolderName('')
    requestAnimationFrame(() => newFolderInputRef.current?.focus())
  }

  const commitNewFolder = () => {
    const trimmed = newFolderName.trim()
    if (trimmed) {
      setFolders(prev => [...prev, { id: generateId(), name: trimmed, parentId: currentFolderId }])
    }
    setIsCreatingFolder(false)
  }

  const handleNewFolderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commitNewFolder() }
    if (e.key === 'Escape') { e.preventDefault(); setIsCreatingFolder(false) }
  }

  return (
    <main className="storage-view">
      <div className="storage-view__inner">
        <div className="storage-view__header">
          <h1 className="storage-view__title">Storage</h1>
          <p className="storage-view__breadcrumb">
            {trail.map((seg, i) => (
              <span key={seg.id ?? 'root'} className="storage-view__crumb">
                <button
                  className="storage-view__crumb-btn"
                  onClick={() => setCurrentFolderId(seg.id)}
                  disabled={i === trail.length - 1}
                  type="button"
                >
                  {seg.name}
                </button>
                {i < trail.length - 1 && <span className="storage-view__crumb-sep">/</span>}
              </span>
            ))}
            <span className="storage-view__item-count">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
          </p>
        </div>

        <ul className="storage-view__list">
          {currentFolders.map(folder => (
            <StorageItem
              key={folder.id}
              kind="folder"
              name={folder.name}
              meta={`${childCount(folder.id)} ${childCount(folder.id) === 1 ? 'item' : 'items'}`}
              isRenaming={renamingId === folder.id}
              onOpen={() => setCurrentFolderId(folder.id)}
              onStartRename={() => setRenamingId(folder.id)}
              onCommitRename={(newName) => {
                setFolders(prev => prev.map(f => f.id === folder.id ? { ...f, name: newName } : f))
                setRenamingId(null)
              }}
              onCancelRename={() => setRenamingId(null)}
              onDelete={() => handleDeleteFolder(folder.id)}
            />
          ))}
          {currentFiles.map(file => (
            <StorageItem
              key={file.id}
              kind="file"
              name={file.name}
              meta={`${formatBytes(file.sizeBytes)} · ${formatModifiedDate(file.modifiedAt)}`}
              fileType={file.type}
              isRenaming={renamingId === file.id}
              onStartRename={() => setRenamingId(file.id)}
              onCommitRename={(newName) => {
                setFiles(prev => prev.map(f => f.id === file.id ? { ...f, name: newName } : f))
                setRenamingId(null)
              }}
              onCancelRename={() => setRenamingId(null)}
              onDelete={() => handleDeleteFile(file.id)}
            />
          ))}

          {currentFolders.length === 0 && currentFiles.length === 0 && !isCreatingFolder && (
            <li className="storage-view__empty">This folder is empty</li>
          )}

          {isCreatingFolder ? (
            <li className="storage-view__new-folder">
              <span className="storage-view__new-folder-icon">
                <FolderPlusIcon size={20} weight="fill" />
              </span>
              <input
                ref={newFolderInputRef}
                className="storage-view__new-folder-input"
                placeholder="Folder name"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={handleNewFolderKeyDown}
                onBlur={commitNewFolder}
              />
            </li>
          ) : (
            <button className="storage-view__add-folder-btn" onClick={startCreatingFolder} type="button">
              <span className="storage-view__add-folder-icon">+</span>
              New folder
            </button>
          )}
        </ul>
      </div>
    </main>
  )
}
