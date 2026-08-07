import { useEffect, useRef, useState } from 'react'
import { FolderPlusIcon } from '@phosphor-icons/react'
import type { StorageFile, StorageFolder, StorageFileType } from '../types'
import StorageItem from './StorageItem'
import './StorageView.css'

const API_BASE = '/api/storage'

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

function mimeToFileType(mimeType: string): StorageFileType {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'doc'
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'sheet'
  if (mimeType.includes('zip') || mimeType.includes('gzip')) return 'zip'
  return 'other'
}

/** A folder and every folder nested under it, including itself. */
function collectFolderAndDescendants(folders: StorageFolder[], id: string): string[] {
  const children = folders.filter(f => f.parentId === id)
  return [id, ...children.flatMap(c => collectFolderAndDescendants(folders, c.id))]
}

export default function StorageView() {
  const [folders, setFolders] = useState<StorageFolder[]>([])
  const [files, setFiles] = useState<StorageFile[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [loading, setLoading] = useState(true)
  const newFolderInputRef = useRef<HTMLInputElement>(null)

  // Fetch tree on mount
  useEffect(() => {
    void fetchTree()
  }, [])

  const fetchTree = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/tree?kind=personal`)
      if (!res.ok) throw new Error('Failed to fetch storage tree')
      const data = await res.json() as { folders: StorageFolder[]; files: StorageFile[] }
      setFolders(data.folders)
      setFiles(data.files)
    } catch (err) {
      console.error('Failed to fetch tree:', err)
    } finally {
      setLoading(false)
    }
  }

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
    folders.filter(f => f.parentId === folderId).length + files.filter(f => f.folderId === folderId).length

  const currentFolders = folders
    .filter(f => f.parentId === currentFolderId)
    .sort((a, b) => a.name.localeCompare(b.name))
  const currentFiles = files
    .filter(f => f.folderId === currentFolderId && f.status === 'ready')
    .sort((a, b) => a.name.localeCompare(b.name))
  const itemCount = currentFolders.length + currentFiles.length

  const handleDeleteFolder = async (id: string) => {
    const folder = folders.find(f => f.id === id)
    if (!folder) return
    const count = childCount(id)
    const confirmMsg = count > 0
      ? `Delete "${folder.name}" and ${count} ${count === 1 ? 'item' : 'items'} inside?`
      : `Delete "${folder.name}"?`
    if (!confirm(confirmMsg)) return

    try {
      const res = await fetch(`${API_BASE}/folders/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete folder')
      const idsToRemove = collectFolderAndDescendants(folders, id)
      setFolders(prev => prev.filter(f => !idsToRemove.includes(f.id)))
      setFiles(prev => prev.filter(f => !f.folderId || !idsToRemove.includes(f.folderId)))
    } catch (err) {
      console.error('Failed to delete folder:', err)
    }
  }

  const handleDeleteFile = async (id: string) => {
    const file = files.find(f => f.id === id)
    if (!file) return
    if (!confirm(`Delete "${file.name}"?`)) return

    try {
      const res = await fetch(`${API_BASE}/files/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete file')
      setFiles(prev => prev.filter(f => f.id !== id))
    } catch (err) {
      console.error('Failed to delete file:', err)
    }
  }

  const handleRenameFolder = async (id: string, newName: string) => {
    try {
      const res = await fetch(`${API_BASE}/folders/${id}/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
      if (!res.ok) throw new Error('Failed to rename folder')
      const { folder } = await res.json() as { folder: StorageFolder }
      setFolders(prev => prev.map(f => (f.id === id ? folder : f)))
      setRenamingId(null)
    } catch (err) {
      console.error('Failed to rename folder:', err)
    }
  }

  const handleRenameFile = async (id: string, newName: string) => {
    try {
      const res = await fetch(`${API_BASE}/files/${id}/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
      if (!res.ok) throw new Error('Failed to rename file')
      const { file } = await res.json() as { file: StorageFile }
      setFiles(prev => prev.map(f => (f.id === id ? file : f)))
      setRenamingId(null)
    } catch (err) {
      console.error('Failed to rename file:', err)
    }
  }

  const startCreatingFolder = () => {
    setIsCreatingFolder(true)
    setNewFolderName('')
    setTimeout(() => newFolderInputRef.current?.focus(), 0)
  }

  const commitNewFolder = async () => {
    const trimmed = newFolderName.trim()
    if (!trimmed) {
      setIsCreatingFolder(false)
      setNewFolderName('')
      return
    }

    try {
      const res = await fetch(`${API_BASE}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          areaKind: 'personal',
          parentId: currentFolderId,
          name: trimmed,
        }),
      })
      if (!res.ok) throw new Error('Failed to create folder')
      const { folder } = await res.json() as { folder: StorageFolder }
      setFolders(prev => [...prev, folder])
      setIsCreatingFolder(false)
      setNewFolderName('')
    } catch (err) {
      console.error('Failed to create folder:', err)
    }
  }

  const handleNewFolderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); void commitNewFolder() }
    if (e.key === 'Escape') { e.preventDefault(); setIsCreatingFolder(false); setNewFolderName('') }
  }

  const handleFileDownload = async (fileId: string, fileName: string) => {
    try {
      const res = await fetch(`${API_BASE}/files/${fileId}/download`)
      if (!res.ok) throw new Error('Failed to get download URL')
      const { url } = await res.json() as { url: string }
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
    } catch (err) {
      console.error('Failed to download file:', err)
    }
  }

  if (loading) {
    return (
      <main className="storage-view">
        <div className="storage-view__loading">Loading...</div>
      </main>
    )
  }

  return (
    <main className="storage-view">
      <div className="storage-view__container">
        <div className="storage-view__breadcrumbs">
          {trail.map((crumb, i) => (
            <button
              key={crumb.id ?? 'root'}
              className="storage-view__breadcrumb"
              onClick={() => setCurrentFolderId(crumb.id)}
              type="button"
            >
              {crumb.name}
              {i < trail.length - 1 && <span className="storage-view__breadcrumb-sep">/</span>}
            </button>
          ))}
        </div>

        <div className="storage-view__meta">{itemCount} {itemCount === 1 ? 'item' : 'items'}</div>

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
              onCommitRename={name => { void handleRenameFolder(folder.id, name) }}
              onCancelRename={() => setRenamingId(null)}
              onDelete={() => { void handleDeleteFolder(folder.id) }}
            />
          ))}

          {currentFiles.map(file => (
            <StorageItem
              key={file.id}
              kind="file"
              name={file.name}
              meta={`${formatBytes(file.sizeBytes)} · ${formatModifiedDate(file.updatedAt)}`}
              fileType={mimeToFileType(file.mimeType)}
              isRenaming={renamingId === file.id}
              onOpen={() => { void handleFileDownload(file.id, file.name) }}
              onStartRename={() => setRenamingId(file.id)}
              onCommitRename={name => { void handleRenameFile(file.id, name) }}
              onCancelRename={() => setRenamingId(null)}
              onDelete={() => { void handleDeleteFile(file.id) }}
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
                onBlur={() => { void commitNewFolder() }}
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
