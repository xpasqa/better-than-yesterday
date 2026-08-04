# Storage View — Design

## Context

The sidebar's "Reporting" nav item becomes "Storage": a Dropbox-style personal
file browser (folders you can navigate into, create, rename, delete; files
shown alongside them). This is a UI/UX demo, not real file storage — the
project is a client-only Vite + React SPA with no backend, and the user
confirmed mock data (matching how tasks/projects already work) is the right
scope for now, not real uploads or persistence. Visual language stays
identical to the rest of the Todoist clone (same tokens, same list-row
pattern) — only the browsing *behavior* is borrowed from Dropbox.

## Data model

```ts
interface StorageFolder {
  id: string
  name: string
  parentId: string | null // null = root
}

interface StorageFile {
  id: string
  name: string
  parentId: string | null
  type: 'pdf' | 'image' | 'doc' | 'sheet' | 'zip' | 'other'
  size: string       // display string, e.g. "2.4 MB"
  modifiedAt: string // display string, e.g. "Aug 2"
}
```

Flat arrays with `parentId`, not a nested tree — matches how `Task` already
references `projectId` elsewhere in the app, and avoids the recursive
find/update helpers the concurrently-built `OutlineView` needed for its
nested-node model. Folder contents = `filter(parentId === currentFolderId)`;
breadcrumb = walk the `parentId` chain upward from the current folder.

All state (`folders`, `files`, `currentFolderId`, in-progress rename/create
input) lives locally inside `StorageView` — nothing else in the app needs
storage data, matching the precedent `OutlineView` already set for
self-contained view state (not lifted into `App.tsx`).

## Files

- `src/data/storageData.ts` — mock root folders/files, a few levels deep so
  the breadcrumb has something to demonstrate.
- `src/components/StorageView.tsx` + `.css` — the view: header (title +
  clickable breadcrumb trail replacing the usual "N tasks" subtitle), the
  row list, and a "+ New folder" row at the bottom (same reveal-on-click
  pattern as "Add task").
- `src/components/StorageItem.tsx` + `.css` — one folder or file row,
  mirroring `TaskItem.tsx`: leading icon, name, right-aligned meta, and a
  hover-revealed `⋯` menu (reusing the `task-item__dropdown` visual pattern).

## Interactions

- Click a folder row → navigate into it (`setCurrentFolderId`).
- Click a file row → no-op (nothing to preview in a demo with no real files).
- Breadcrumb segments are clickable; the first segment ("Storage") returns
  to root.
- "+ New folder" reveals an inline text input at the bottom of the list
  (same UX as `AddTaskForm`'s title field appearing). Enter creates the
  folder under `currentFolderId`; Escape cancels.
- Row hover reveals a `⋯` button → dropdown with **Rename** and **Delete**,
  same visual/behavioral pattern as `TaskItem`'s dropdown.
  - Rename swaps the row's name for an inline text input; blur or Enter
    commits, Escape cancels.
  - Delete is immediate, no confirmation dialog — matches the existing
    task-delete convention in this app. Deleting a folder cascades: a small
    recursive helper collects all descendant folder ids first, then filters
    both arrays to drop everything in that set (plus the folder/file itself).
- Sort order within a folder: subfolders first, then files, alphabetical
  within each group.

## Visual conventions

- Flat list rows, not grid cards — every other list in this app (tasks,
  projects, outline nodes) is a row list; Storage stays consistent rather
  than introducing a new layout paradigm.
- Row typography matches `TaskItem`: name at 14px/`--text-primary`, same row
  height/hover fill/separator treatment (`--divider-primary`, the 8px hover
  bleed). Right-aligned meta differs by row type since `StorageFolder` has
  no size/date fields: folders show a computed item count ("N items"),
  files show `size · modifiedAt` — both at 12px/`--text-secondary`.
- Icons via Phosphor, consistent with the rest of the app: `FolderIcon` for
  folders, `FilePdfIcon` / `FileImageIcon` / a doc icon / a generic
  `FileIcon` fallback for files, colour-coded per type the way priority
  flags and project hashes already are.
- Header: `<h1>` always reads "Storage" (26px/700, matching every other
  view's title); the breadcrumb trail sits where the subtitle normally goes.

## Sidebar & routing

- Nav label "Reporting" → "Storage"; icon swaps from `ChartLineUpIcon` to
  `FolderIcon`. Same nav-item markup/active-state pattern already used for
  every other sidebar entry.
- `ViewType` gains `'storage'`.
- `App.tsx`'s conditional render gains a branch for `'storage'` alongside
  the existing `'outline'` branch, rendering `<StorageView />` instead of
  `<MainContent />`.

## Explicitly out of scope

Real file upload/content, persistence (localStorage/IndexedDB/backend),
grid/thumbnail view, search, drag-and-drop, file preview, and a storage-used
counter in the sidebar. All would be reasonable follow-ups but aren't needed
for this demo pass.
