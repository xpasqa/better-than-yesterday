# Agent file panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a closable right-hand panel to the Agent chat that shows a folder
tree of files the (mock) agent creates during the conversation, with a
markdown viewer (Preview/Code, Copy, Download) for the selected file.

**Architecture:** Bottom-up, matching `docs/feature/1.mail-client/plan.md`'s
convention: data model and mock content first, then a static shell provable in
the browser, then the creation script that drives it from `AgentView`'s
existing send flow. `AgentChat` goes from a single column to a row (thread+
composer | panel); state stays local to `AgentView`, same as today.

**Tech Stack:** React 19 + TypeScript, existing Phosphor icon set, new
dependencies `react-markdown` + `remark-gfm` for rendering.

There is no test runner in this repo (no vitest/jest configured — `oxlint` and
`tsc -b` are the only automated checks; see `package.json`). Verification is
therefore: type-check clean, lint clean, and a browser round-trip per phase —
this mirrors how every prior feature in this repo (kanban, drag-and-drop, mail
client) was verified.

## Global Constraints

- No backend, no real LLM/filesystem — everything is mock/scripted, per
  `docs/feature/3.agent-file-panel/spec.md`.
- Visual language matches the rest of the app: same tokens
  (`src/styles/variables.css`), same 800px `--editor-max-width` chat column,
  same 0.1–0.18s transition timings.
- State for this feature lives entirely in `AgentView.tsx` — nothing lifted to
  `App.tsx` (matches every other view: Storage, Outline, Mail, Agent today).
- Copy and Download must be genuinely functional (Clipboard API, Blob
  download) — no backend needed for either.
- Feature docs for this work live under `docs/feature/3.agent-file-panel/`
  only (per this repo's `CLAUDE.md` convention).

---

## Phase 1 — Dependencies, types, and mock content

**Files:**
- Modify: `package.json` (add `react-markdown`, `remark-gfm`)
- Modify: `src/components/AgentView.tsx` (extend `ChatMessage` type)
- Create: `src/agent/mockFiles.ts`

**Interfaces produced (used by every later phase):**

```ts
// src/agent/mockFiles.ts
export interface AgentFile {
  path: string     // e.g. 'docs/riset-pasar.md' — flat, slash-separated
  content: string   // raw markdown source
}

export const MOCK_FILES: AgentFile[] = [ /* 5 entries, see Step 3 */ ]

// keyed by 1-based agent-reply index; value is the MOCK_FILES index to create
export const FILE_CREATION_SCHEDULE: Record<number, number> = {
  1: 0, // docs/riset-pasar.md
  2: 1, // docs/spec-fitur.md
  4: 2, // notes/rapat-senin.md
  5: 3, // notes/pertanyaan-terbuka.md
  7: 4, // README.md
}
```

```ts
// src/components/AgentView.tsx
export type ChatMessage =
  | { id: string; role: 'user' | 'agent'; kind: 'text'; content: string; time: string }
  | { id: string; role: 'agent'; kind: 'file'; path: string; time: string }
```

- [ ] **Step 1: Install dependencies**

```bash
npm install react-markdown remark-gfm
```

- [ ] **Step 2: Verify install**

Run: `node -e "require.resolve('react-markdown'); require.resolve('remark-gfm'); console.log('ok')"`
Expected: prints `ok`

- [ ] **Step 3: Create `src/agent/mockFiles.ts`**

```ts
export interface AgentFile {
  path: string
  content: string
}

export const MOCK_FILES: AgentFile[] = [
  {
    path: 'docs/riset-pasar.md',
    content: `# Riset Pasar

Ringkasan cepat dari tiga kompetitor utama sebelum kita masuk ke spek fitur.

## Kompetitor

| Produk | Harga/bulan | Kekuatan | Kelemahan |
| --- | --- | --- | --- |
| Nimbus | $12 | Onboarding cepat | Tidak ada mode offline |
| Ledger | $19 | Laporan detail | UI berat |
| Fenwick | $9 | Murah | Fitur terbatas |

## Temuan utama

- Semua kompetitor menagih per kursi, bukan per workspace.
- Tidak ada satu pun yang punya panel file di dalam chat.
- Harga median pasar ada di kisaran $12–15/bulan.

## Rekomendasi

Mulai di titik harga $12, dan jadikan panel file sebagai pembeda utama.
`,
  },
  {
    path: 'docs/spec-fitur.md',
    content: `# Spek Fitur: Panel File

## Masalah

Pengguna tidak bisa melihat apa yang dihasilkan agent tanpa berpindah tab.

## Solusi

Tambahkan panel di kanan chat yang menampilkan struktur folder dan isi file
yang dibuat selama percakapan.

## Kriteria selesai

1. File baru langsung muncul di tree begitu dibuat.
2. Markdown dirender, bukan teks mentah.
3. Bisa disalin dan diunduh tanpa backend.

\`\`\`ts
interface AgentFile {
  path: string
  content: string
}
\`\`\`
`,
  },
  {
    path: 'notes/rapat-senin.md',
    content: `# Catatan Rapat — Senin

## Hadir

- Tim produk
- Tim desain

## Poin pembahasan

- Panel kanan disepakati lebar 420px.
- Tree di atas, viewer di bawah, bukan sebaliknya.
- Semua orang setuju: jangan tambah dependency berat untuk markdown.

## Tindak lanjut

- [ ] Konfirmasi ikon folder/file final
- [ ] Review salinan copy tombol Download
`,
  },
  {
    path: 'notes/pertanyaan-terbuka.md',
    content: `# Pertanyaan Terbuka

Hal-hal yang belum diputuskan, dicatat supaya tidak hilang.

## Daftar

1. Apakah file lama perlu bisa diedit dari panel? — **Tidak, untuk versi ini.**
2. Apakah perlu search di dalam tree? — **Belum.**
3. Apakah state panel perlu bertahan lintas sesi? — **Tidak, reset di "New task".**

> Catatan: semua jawaban di atas diambil dari spec, bukan asumsi baru.
`,
  },
  {
    path: 'README.md',
    content: `# Ringkasan

Dokumen ini merangkum seluruh file yang dibuat selama sesi ini.

## Isi sesi

- Riset pasar singkat
- Spek fitur panel file
- Catatan rapat Senin
- Daftar pertanyaan terbuka yang sudah dijawab

## Cara pakai

Klik file mana pun di panel kanan untuk membukanya. Gunakan tombol
**Copy** atau **Download** di toolbar viewer untuk menyalin atau
mengunduh isinya.
`,
  },
]

// Keyed by 1-based agent-reply index; value is the MOCK_FILES index to create.
export const FILE_CREATION_SCHEDULE: Record<number, number> = {
  1: 0,
  2: 1,
  4: 2,
  5: 3,
  7: 4,
}
```

- [ ] **Step 4: Extend `ChatMessage` in `src/components/AgentView.tsx`**

Replace the existing interface:

```ts
export interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  time: string
}
```

with:

```ts
export type ChatMessage =
  | { id: string; role: 'user' | 'agent'; kind: 'text'; content: string; time: string }
  | { id: string; role: 'agent'; kind: 'file'; path: string; time: string }
```

This will break the existing `sendText` and `AgentChat` render — that's
expected and fixed in Phase 5/6. Don't fix those yet.

- [ ] **Step 5: Type-check to confirm the expected breakage**

Run: `npx tsc -b`
Expected: FAIL — errors in `AgentView.tsx` (`sendText` building `.content`-only
objects) and `AgentChat.tsx` (`m.content` access). This confirms the type is
wired in; later phases fix these call sites.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/agent/mockFiles.ts src/components/AgentView.tsx
git commit -m "Add mock file pool and file-aware ChatMessage type for Agent panel"
```

---

## Phase 2 — `AgentFileTree` (static, given a file list)

**Files:**
- Create: `src/components/AgentFileTree.tsx`
- Create: `src/components/AgentFileTree.css`

**Interfaces:**
- Consumes: `AgentFile` from `src/agent/mockFiles.ts` (Phase 1)
- Produces:

```ts
interface AgentFileTreeProps {
  files: AgentFile[]          // flat, creation order
  selectedPath: string | null
  unseenPaths: Set<string>    // paths to show a new-dot for
  onSelect: (path: string) => void
}
export default function AgentFileTree(props: AgentFileTreeProps): JSX.Element
```

This is the only component that turns the flat `files` array into a tree. It
builds the tree from scratch on every render (the file list is small; no
memoization needed).

- [ ] **Step 1: Write `AgentFileTree.tsx`**

```tsx
import { useState } from 'react'
import { CaretRightIcon, FileMdIcon, FolderIcon } from '@phosphor-icons/react'
import type { AgentFile } from '../agent/mockFiles'
import './AgentFileTree.css'

interface AgentFileTreeProps {
  files: AgentFile[]
  selectedPath: string | null
  unseenPaths: Set<string>
  onSelect: (path: string) => void
}

interface TreeFolder {
  kind: 'folder'
  name: string
  path: string
  children: TreeNode[]
}

interface TreeLeaf {
  kind: 'file'
  name: string
  path: string
}

type TreeNode = TreeFolder | TreeLeaf

function buildTree(files: AgentFile[]): TreeNode[] {
  const root: TreeFolder = { kind: 'folder', name: '', path: '', children: [] }

  for (const file of files) {
    const segments = file.path.split('/')
    let cursor = root
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]
      const path = segments.slice(0, i + 1).join('/')
      let next = cursor.children.find(
        (n): n is TreeFolder => n.kind === 'folder' && n.name === segment,
      )
      if (!next) {
        next = { kind: 'folder', name: segment, path, children: [] }
        cursor.children.push(next)
      }
      cursor = next
    }
    cursor.children.push({ kind: 'file', name: segments[segments.length - 1], path: file.path })
  }

  return root.children
}

function TreeNodeRow({
  node, depth, selectedPath, unseenPaths, onSelect,
}: {
  node: TreeNode
  depth: number
  selectedPath: string | null
  unseenPaths: Set<string>
  onSelect: (path: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  if (node.kind === 'folder') {
    return (
      <div className="agent-file-tree__branch">
        <button
          className="agent-file-tree__row agent-file-tree__row--folder"
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => setCollapsed(c => !c)}
          type="button"
        >
          <CaretRightIcon
            size={11}
            weight="bold"
            className={`agent-file-tree__caret ${collapsed ? '' : 'agent-file-tree__caret--open'}`}
          />
          <FolderIcon size={15} weight="fill" className="agent-file-tree__folder-icon" />
          <span className="agent-file-tree__name">{node.name}</span>
        </button>
        {!collapsed && node.children.map(child => (
          <TreeNodeRow
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            unseenPaths={unseenPaths}
            onSelect={onSelect}
          />
        ))}
      </div>
    )
  }

  const isSelected = node.path === selectedPath
  return (
    <button
      className={`agent-file-tree__row agent-file-tree__row--file ${isSelected ? 'agent-file-tree__row--selected' : ''}`}
      style={{ paddingLeft: 8 + depth * 14 + 15 }}
      onClick={() => onSelect(node.path)}
      type="button"
    >
      <FileMdIcon size={15} className="agent-file-tree__file-icon" />
      <span className="agent-file-tree__name">{node.name}</span>
      {unseenPaths.has(node.path) && <span className="agent-file-tree__dot" />}
    </button>
  )
}

export default function AgentFileTree({ files, selectedPath, unseenPaths, onSelect }: AgentFileTreeProps) {
  const tree = buildTree(files)

  if (files.length === 0) {
    return <p className="agent-file-tree__empty">No files yet</p>
  }

  return (
    <div className="agent-file-tree">
      {tree.map(node => (
        <TreeNodeRow
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          unseenPaths={unseenPaths}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Write `AgentFileTree.css`**

```css
.agent-file-tree {
  padding: 6px 0;
}

.agent-file-tree__empty {
  padding: 16px 12px;
  font-size: var(--font-size-normal);
  color: var(--text-tertiary);
}

.agent-file-tree__row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 5px 10px;
  font-size: var(--font-size-normal);
  color: var(--text-primary);
  text-align: left;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.1s;
}

.agent-file-tree__row:hover {
  background: var(--bg-hover);
}

.agent-file-tree__row--selected {
  background: var(--bg-selected);
  color: var(--brand-red-idle);
  font-weight: var(--font-weight-medium);
}

.agent-file-tree__caret {
  flex-shrink: 0;
  color: var(--text-tertiary);
  transition: transform 0.12s;
}

.agent-file-tree__caret--open {
  transform: rotate(90deg);
}

.agent-file-tree__folder-icon {
  flex-shrink: 0;
  color: var(--meta-blue);
}

.agent-file-tree__file-icon {
  flex-shrink: 0;
  color: var(--text-secondary);
}

.agent-file-tree__row--selected .agent-file-tree__file-icon {
  color: var(--brand-red-idle);
}

.agent-file-tree__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-file-tree__dot {
  width: 6px;
  height: 6px;
  margin-left: auto;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--brand-red-idle);
}
```

- [ ] **Step 3: Type-check the new files in isolation**

Run: `npx tsc -b --noEmit 2>&1 | grep AgentFileTree`
Expected: no output (no errors referencing `AgentFileTree.tsx`). Unrelated
pre-existing errors from Phase 1's intentional breakage are fine.

- [ ] **Step 4: Commit**

```bash
git add src/components/AgentFileTree.tsx src/components/AgentFileTree.css
git commit -m "Add AgentFileTree component"
```

---

## Phase 3 — `AgentFileViewer` (markdown rendering, Copy, Download)

**Files:**
- Create: `src/components/AgentFileViewer.tsx`
- Create: `src/components/AgentFileViewer.css`

**Interfaces:**
- Consumes: `AgentFile` from `src/agent/mockFiles.ts`
- Produces:

```ts
interface AgentFileViewerProps {
  file: AgentFile | null   // null => empty state
}
export default function AgentFileViewer(props: AgentFileViewerProps): JSX.Element
```

`file === null` happens right after the panel opens but before Phase 6 wires a
selection, and is also reachable if a future caller passes no selection — the
empty state must render correctly rather than crash.

- [ ] **Step 1: Write `AgentFileViewer.tsx`**

```tsx
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CheckIcon, CopyIcon, DownloadSimpleIcon } from '@phosphor-icons/react'
import type { AgentFile } from '../agent/mockFiles'
import './AgentFileViewer.css'

interface AgentFileViewerProps {
  file: AgentFile | null
}

type ViewMode = 'preview' | 'code'

export default function AgentFileViewer({ file }: AgentFileViewerProps) {
  const [mode, setMode] = useState<ViewMode>('preview')
  const [copied, setCopied] = useState(false)

  if (!file) {
    return (
      <div className="agent-file-viewer agent-file-viewer--empty">
        <p>Select a file to preview it</p>
      </div>
    )
  }

  const fileName = file.path.split('/').pop() ?? file.path

  const handleCopy = async () => {
    await navigator.clipboard.writeText(file.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleDownload = () => {
    const blob = new Blob([file.content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="agent-file-viewer">
      <div className="agent-file-viewer__toolbar">
        <span className="agent-file-viewer__name">{fileName}</span>
        <div className="agent-file-viewer__mode-toggle">
          <button
            className={`agent-file-viewer__mode-btn ${mode === 'preview' ? 'agent-file-viewer__mode-btn--active' : ''}`}
            onClick={() => setMode('preview')}
            type="button"
          >
            Preview
          </button>
          <button
            className={`agent-file-viewer__mode-btn ${mode === 'code' ? 'agent-file-viewer__mode-btn--active' : ''}`}
            onClick={() => setMode('code')}
            type="button"
          >
            Code
          </button>
        </div>
        <button className="agent-file-viewer__icon-btn" onClick={handleCopy} type="button" aria-label="Copy">
          {copied ? <CheckIcon size={14} weight="bold" /> : <CopyIcon size={14} />}
        </button>
        <button className="agent-file-viewer__icon-btn" onClick={handleDownload} type="button" aria-label="Download">
          <DownloadSimpleIcon size={14} />
        </button>
      </div>

      <div className="agent-file-viewer__body">
        {mode === 'preview' ? (
          <div className="agent-file-viewer__markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{file.content}</ReactMarkdown>
          </div>
        ) : (
          <pre className="agent-file-viewer__code">{file.content}</pre>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `AgentFileViewer.css`**

```css
.agent-file-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.agent-file-viewer--empty {
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-normal);
  color: var(--text-tertiary);
}

.agent-file-viewer__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 10px 12px;
  border-bottom: 1px solid var(--divider-primary);
}

.agent-file-viewer__name {
  font-size: var(--font-size-normal);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-file-viewer__mode-toggle {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  padding: 2px;
  border-radius: 6px;
  background: var(--bg-hover);
  flex-shrink: 0;
}

.agent-file-viewer__mode-btn {
  padding: 4px 8px;
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}

.agent-file-viewer__mode-btn--active {
  background: #fff;
  color: var(--text-primary);
  box-shadow: 0 1px 2px rgba(0,0,0,0.08);
}

.agent-file-viewer__icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  color: var(--text-secondary);
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}

.agent-file-viewer__icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.agent-file-viewer__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.agent-file-viewer__markdown {
  padding: 16px 18px;
  font-size: var(--font-size-normal);
  line-height: 1.6;
  color: var(--text-primary);
}

.agent-file-viewer__markdown h1 {
  font-size: var(--font-size-content-large);
  font-weight: var(--font-weight-strong);
  margin: 0 0 12px;
}

.agent-file-viewer__markdown h2 {
  font-size: var(--font-size-content);
  font-weight: var(--font-weight-strong);
  margin: 20px 0 8px;
}

.agent-file-viewer__markdown p {
  margin: 0 0 10px;
}

.agent-file-viewer__markdown ul,
.agent-file-viewer__markdown ol {
  margin: 0 0 10px;
  padding-left: 20px;
}

.agent-file-viewer__markdown li {
  margin-bottom: 4px;
}

.agent-file-viewer__markdown blockquote {
  margin: 0 0 10px;
  padding: 4px 12px;
  border-left: 3px solid var(--divider-tertiary);
  color: var(--text-secondary);
}

.agent-file-viewer__markdown code {
  font-family: ui-monospace, monospace;
  font-size: 0.9em;
  background: var(--bg-tertiary);
  padding: 1px 5px;
  border-radius: 4px;
}

.agent-file-viewer__markdown pre {
  margin: 0 0 12px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  overflow-x: auto;
}

.agent-file-viewer__markdown pre code {
  background: none;
  padding: 0;
}

.agent-file-viewer__markdown table {
  width: 100%;
  margin: 0 0 12px;
  border-collapse: collapse;
  font-size: var(--font-size-small);
}

.agent-file-viewer__markdown th,
.agent-file-viewer__markdown td {
  padding: 6px 10px;
  border: 1px solid var(--divider-primary);
  text-align: left;
}

.agent-file-viewer__markdown th {
  background: var(--bg-tertiary);
  font-weight: var(--font-weight-medium);
}

.agent-file-viewer__code {
  padding: 16px 18px;
  font-family: ui-monospace, monospace;
  font-size: var(--font-size-small);
  line-height: 1.6;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b --noEmit 2>&1 | grep AgentFileViewer`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/components/AgentFileViewer.tsx src/components/AgentFileViewer.css
git commit -m "Add AgentFileViewer component with Preview/Code, Copy, Download"
```

---

## Phase 4 — `AgentFilePanel` shell (tree + viewer + header, standalone)

**Files:**
- Create: `src/components/AgentFilePanel.tsx`
- Create: `src/components/AgentFilePanel.css`

**Interfaces:**
- Consumes: `AgentFileTree` (Phase 2), `AgentFileViewer` (Phase 3), `AgentFile`
- Produces:

```ts
interface AgentFilePanelProps {
  files: AgentFile[]
  selectedPath: string | null
  unseenPaths: Set<string>
  onSelect: (path: string) => void
  onClose: () => void
}
export default function AgentFilePanel(props: AgentFilePanelProps): JSX.Element
```

The panel itself has no open/closed concept — `AgentChat` (Phase 5) mounts or
unmounts it. This keeps the component simple: if it's rendered, it's open.

- [ ] **Step 1: Write `AgentFilePanel.tsx`**

```tsx
import { XIcon } from '@phosphor-icons/react'
import type { AgentFile } from '../agent/mockFiles'
import AgentFileTree from './AgentFileTree'
import AgentFileViewer from './AgentFileViewer'
import './AgentFilePanel.css'

interface AgentFilePanelProps {
  files: AgentFile[]
  selectedPath: string | null
  unseenPaths: Set<string>
  onSelect: (path: string) => void
  onClose: () => void
}

export default function AgentFilePanel({
  files, selectedPath, unseenPaths, onSelect, onClose,
}: AgentFilePanelProps) {
  const selectedFile = files.find(f => f.path === selectedPath) ?? null

  return (
    <aside className="agent-file-panel">
      <div className="agent-file-panel__header">
        <span className="agent-file-panel__title">Files</span>
        <span className="agent-file-panel__count">{files.length}</span>
        <button className="agent-file-panel__close" onClick={onClose} type="button" aria-label="Close file panel">
          <XIcon size={15} />
        </button>
      </div>

      <div className="agent-file-panel__tree">
        <AgentFileTree
          files={files}
          selectedPath={selectedPath}
          unseenPaths={unseenPaths}
          onSelect={onSelect}
        />
      </div>

      <div className="agent-file-panel__viewer">
        <AgentFileViewer file={selectedFile} />
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Write `AgentFilePanel.css`**

```css
.agent-file-panel {
  display: flex;
  flex-direction: column;
  width: 420px;
  flex-shrink: 0;
  height: 100vh;
  border-left: 1px solid var(--divider-primary);
  background: var(--bg-secondary);
}

.agent-file-panel__header {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 14px 12px;
  border-bottom: 1px solid var(--divider-primary);
}

.agent-file-panel__title {
  font-size: var(--font-size-content);
  font-weight: var(--font-weight-strong);
  color: var(--text-primary);
}

.agent-file-panel__count {
  font-size: var(--font-size-small);
  color: var(--text-tertiary);
}

.agent-file-panel__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-left: auto;
  color: var(--text-secondary);
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.1s;
}

.agent-file-panel__close:hover {
  background: var(--bg-hover);
}

.agent-file-panel__tree {
  flex-shrink: 0;
  max-height: 40%;
  overflow-y: auto;
  border-bottom: 1px solid var(--divider-primary);
}

.agent-file-panel__viewer {
  flex: 1;
  min-height: 0;
  background: #fff;
}
```

- [ ] **Step 3: Temporarily mount in `App.tsx` to verify visually (throwaway, reverted in Step 5)**

This component has no consumer yet (Phase 5 wires it into `AgentChat`). To
verify it renders correctly before wiring, temporarily render it standalone:
add `import AgentFilePanel from './components/AgentFilePanel'` and
`import { MOCK_FILES } from './agent/mockFiles'` at the top of `src/App.tsx`,
and temporarily render
`<AgentFilePanel files={MOCK_FILES} selectedPath={MOCK_FILES[0].path} unseenPaths={new Set()} onSelect={() => {}} onClose={() => {}} />`
right before the closing tag of `App.tsx`'s top-level returned JSX (it will
overlay on top of everything — that's fine, it's throwaway).

- [ ] **Step 4: Browser check**

Start the dev server and open the app. Confirm: tree shows `docs/` and
`notes/` folders (expandable) plus `README.md` at the root; clicking folders
collapses/expands; the first file's content renders as formatted markdown
(heading, table) in the viewer; toggling Code shows raw text; Copy and
Download both work (Download should save a `.md` file).

- [ ] **Step 5: Revert Step 3's throwaway edit**

```bash
git checkout -- src/App.tsx
```

(If `git status` shows `App.tsx` as unmodified already, this step is a no-op —
just confirm with `git status` before moving on.)

- [ ] **Step 6: Commit**

```bash
git add src/components/AgentFilePanel.tsx src/components/AgentFilePanel.css
git commit -m "Add AgentFilePanel shell composing tree and viewer"
```

---

## Phase 5 — Wire into `AgentChat` (row layout, file message cards)

**Files:**
- Modify: `src/components/AgentChat.tsx`
- Modify: `src/components/AgentChat.css`

**Interfaces:**
- Consumes: `ChatMessage` (Phase 1), `AgentFile` + `AgentFilePanel` (Phase 4)
- Produces:

```ts
interface AgentChatProps {
  messages: ChatMessage[]
  prompt: string
  onPromptChange: (value: string) => void
  onSend: () => void
  onBack: () => void
  files: AgentFile[]
  panelOpen: boolean
  selectedPath: string | null
  unseenPaths: Set<string>
  onSelectFile: (path: string) => void
  onOpenPanel: () => void
  onClosePanel: () => void
}
```

This is a superset of the current props — six new props for panel/file state,
all owned by `AgentView` (Phase 6).

- [ ] **Step 1: Rewrite `AgentChat.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { FileMdIcon, FolderOpenIcon, PaperPlaneTiltIcon, PlusIcon } from '@phosphor-icons/react'
import type { ChatMessage } from './AgentView'
import type { AgentFile } from '../agent/mockFiles'
import AgentFilePanel from './AgentFilePanel'
import './AgentChat.css'

interface AgentChatProps {
  messages: ChatMessage[]
  prompt: string
  onPromptChange: (value: string) => void
  onSend: () => void
  onBack: () => void
  files: AgentFile[]
  panelOpen: boolean
  selectedPath: string | null
  unseenPaths: Set<string>
  onSelectFile: (path: string) => void
  onOpenPanel: () => void
  onClosePanel: () => void
}

export default function AgentChat({
  messages, prompt, onPromptChange, onSend, onBack,
  files, panelOpen, selectedPath, unseenPaths, onSelectFile, onOpenPanel, onClosePanel,
}: AgentChatProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  return (
    <div className="agent-chat-row">
      <main className="agent-chat">
        <div className="agent-chat__thread">
          <div className="agent-chat__inner">
            <div className="agent-chat__header">
              <h1 className="agent-chat__title">Agent</h1>
              <div className="agent-chat__header-actions">
                {files.length > 0 && !panelOpen && (
                  <button className="agent-chat__files-btn" onClick={onOpenPanel} type="button">
                    <FolderOpenIcon size={14} />
                    {files.length} {files.length === 1 ? 'file' : 'files'}
                  </button>
                )}
                <button className="agent-chat__new" onClick={onBack} type="button">
                  <PlusIcon size={14} weight="bold" />
                  New task
                </button>
              </div>
            </div>

            {messages.map(m => {
              if (m.kind === 'file') {
                const fileName = m.path.split('/').pop() ?? m.path
                return (
                  <div key={m.id} className="agent-chat__turn">
                    <div className="agent-chat__turn-head">
                      <span className="agent-chat__who">Agent</span>
                      <span className="agent-chat__time">{m.time}</span>
                    </div>
                    <button
                      className="agent-chat__file-card"
                      onClick={() => { onSelectFile(m.path); onOpenPanel() }}
                      type="button"
                    >
                      <FileMdIcon size={20} className="agent-chat__file-card-icon" />
                      <div className="agent-chat__file-card-text">
                        <span className="agent-chat__file-card-name">{fileName}</span>
                        <span className="agent-chat__file-card-meta">Document · MD</span>
                      </div>
                    </button>
                  </div>
                )
              }
              return (
                <div key={m.id} className="agent-chat__turn">
                  <div className="agent-chat__turn-head">
                    <span className="agent-chat__who">{m.role === 'user' ? 'You' : 'Agent'}</span>
                    <span className="agent-chat__time">{m.time}</span>
                  </div>
                  <p className="agent-chat__text">{m.content}</p>
                </div>
              )
            })}
            <div ref={endRef} />
          </div>
        </div>

        <div className="agent-chat__composer">
          <div className="agent-chat__inner">
            <div className="agent-chat__input-bar">
              <textarea
                className="agent-chat__input"
                placeholder="Reply"
                value={prompt}
                onChange={e => onPromptChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() }
                }}
                rows={1}
              />
              <button
                className="agent-chat__send-btn"
                onClick={onSend}
                disabled={!prompt.trim()}
                aria-label="Send"
                type="button"
              >
                <PaperPlaneTiltIcon size={15} weight="fill" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {panelOpen && (
        <AgentFilePanel
          files={files}
          selectedPath={selectedPath}
          unseenPaths={unseenPaths}
          onSelect={onSelectFile}
          onClose={onClosePanel}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update `AgentChat.css`**

Change the root rule and add the row wrapper + file-card + files-button
styles. Replace:

```css
.agent-chat {
  flex: 1;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #fff;
}
```

with:

```css
.agent-chat-row {
  flex: 1;
  height: 100vh;
  overflow: hidden;
  display: flex;
}

.agent-chat {
  flex: 1;
  min-width: 0;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #fff;
}
```

Then append at the end of the file:

```css
.agent-chat__header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.agent-chat__files-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: var(--font-size-normal);
  color: var(--text-secondary);
  border: 1px solid var(--border-idle);
  border-radius: 6px;
  transition: background 0.1s, color 0.1s;
  cursor: pointer;
}

.agent-chat__files-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* New task now sits inside .agent-chat__header-actions, which owns the
   margin-left:auto that used to live on .agent-chat__new directly */
.agent-chat__header-actions .agent-chat__new {
  margin-left: 0;
}

.agent-chat__file-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border-idle);
  border-radius: 10px;
  background: var(--bg-secondary);
  transition: border-color 0.1s, background 0.1s;
  cursor: pointer;
  max-width: 320px;
}

.agent-chat__file-card:hover {
  border-color: var(--border-hover);
  background: var(--bg-hover);
}

.agent-chat__file-card-icon {
  flex-shrink: 0;
  color: var(--meta-blue);
}

.agent-chat__file-card-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}

.agent-chat__file-card-name {
  font-size: var(--font-size-normal);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.agent-chat__file-card-meta {
  font-size: var(--font-size-small);
  color: var(--text-tertiary);
}
```

Note: `.agent-chat__header .agent-chat__new` overriding `margin-left: auto`
must appear **after** the existing `.agent-chat__new` rule in the file (CSS
source order) — append it at the very end.

- [ ] **Step 3: Type-check**

Run: `npx tsc -b --noEmit 2>&1 | grep AgentChat`
Expected: no output referencing `AgentChat.tsx` itself. (It will still show
errors from `AgentView.tsx` not yet passing the new props — that's Phase 6.)

- [ ] **Step 4: Commit**

```bash
git add src/components/AgentChat.tsx src/components/AgentChat.css
git commit -m "Turn AgentChat into a row layout with file cards and panel toggle"
```

---

## Phase 6 — Wire state and the creation script into `AgentView`

**Files:**
- Modify: `src/components/AgentView.tsx`

This is where `files`, `selectedPath`, `panelOpen`, and `unseenPaths` state
lives, and where the file-creation schedule (Phase 1) turns into actual state
updates on each send.

- [ ] **Step 1: Rewrite the relevant parts of `AgentView.tsx`**

Replace the imports and the `AGENT_REPLY`/state/`sendText` section:

```tsx
import { useState } from 'react'
import { PaperPlaneTiltIcon } from '@phosphor-icons/react'
import AgentChat from './AgentChat'
import { FILE_CREATION_SCHEDULE, MOCK_FILES } from '../agent/mockFiles'
import type { AgentFile } from '../agent/mockFiles'
import './AgentView.css'

const USER_NAME = 'Pasqa'

export type ChatMessage =
  | { id: string; role: 'user' | 'agent'; kind: 'text'; content: string; time: string }
  | { id: string; role: 'agent'; kind: 'file'; path: string; time: string }

const AGENT_REPLY = 'This is a demo response — nothing here is wired to a real agent. '
  + 'In a working version, this is where an actual answer would go.'

const AGENT_REPLY_WITH_FILE = 'Here\'s what I put together — you can review it in the file panel.'

const EXAMPLES = [
  'Summarise what I finished this week',
  'What should I work on first today?',
  'Draft a reply to the latest client email',
  'Break the Q4 roadmap into tasks',
]
```

(`getGreeting`, `generateId`, `timeNow` are unchanged — leave them as-is.)

Replace the component body:

```tsx
export default function AgentView() {
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState<'chat' | 'cowork'>('chat')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [files, setFiles] = useState<AgentFile[]>([])
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [unseenPaths, setUnseenPaths] = useState<Set<string>>(new Set())
  const [replyCount, setReplyCount] = useState(0)

  const selectFile = (path: string) => {
    setSelectedPath(path)
    setUnseenPaths(prev => {
      if (!prev.has(path)) return prev
      const next = new Set(prev)
      next.delete(path)
      return next
    })
  }

  const sendText = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    const nextReplyIndex = replyCount + 1
    const fileToCreate = FILE_CREATION_SCHEDULE[nextReplyIndex]
    const newFile = fileToCreate !== undefined ? MOCK_FILES[fileToCreate] : null

    setMessages(prev => {
      const next: ChatMessage[] = [
        ...prev,
        { id: generateId(), role: 'user', kind: 'text', content: trimmed, time: timeNow() },
        {
          id: generateId(),
          role: 'agent',
          kind: 'text',
          content: newFile ? AGENT_REPLY_WITH_FILE : AGENT_REPLY,
          time: timeNow(),
        },
      ]
      if (newFile) {
        next.push({ id: generateId(), role: 'agent', kind: 'file', path: newFile.path, time: timeNow() })
      }
      return next
    })

    if (newFile) {
      const isFirstFile = files.length === 0
      setFiles(prev => [...prev, newFile])
      setUnseenPaths(prev => new Set(prev).add(newFile.path))
      if (isFirstFile) {
        setPanelOpen(true)
        selectFile(newFile.path)
      }
    }

    setReplyCount(nextReplyIndex)
    setPrompt('')
  }

  if (messages.length > 0) {
    return (
      <AgentChat
        messages={messages}
        prompt={prompt}
        onPromptChange={setPrompt}
        onSend={() => sendText(prompt)}
        onBack={() => {
          setMessages([])
          setPrompt('')
          setFiles([])
          setSelectedPath(null)
          setPanelOpen(false)
          setUnseenPaths(new Set())
          setReplyCount(0)
        }}
        files={files}
        panelOpen={panelOpen}
        selectedPath={selectedPath}
        unseenPaths={unseenPaths}
        onSelectFile={selectFile}
        onOpenPanel={() => setPanelOpen(true)}
        onClosePanel={() => setPanelOpen(false)}
      />
    )
  }

  return (
    <main className="agent-view">
      <div className="agent-view__inner">
        <div className="agent-view__header">
          <h1 className="agent-view__title">Agent</h1>
          <p className="agent-view__subtitle">{getGreeting()}</p>
        </div>

        <div className="agent-view__composer">
          <textarea
            className="agent-view__input"
            placeholder="Ask anything, or describe what you want done"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(prompt) }
            }}
            rows={2}
            autoFocus
          />
          <div className="agent-view__composer-actions">
            <div className="agent-view__mode-toggle">
              <button
                className={`agent-view__mode-btn ${mode === 'chat' ? 'agent-view__mode-btn--active' : ''}`}
                onClick={() => setMode('chat')}
                type="button"
              >
                Chat
              </button>
              <button
                className={`agent-view__mode-btn ${mode === 'cowork' ? 'agent-view__mode-btn--active' : ''}`}
                onClick={() => setMode('cowork')}
                type="button"
              >
                Cowork
              </button>
            </div>
            <button
              className="agent-view__send-btn"
              onClick={() => sendText(prompt)}
              disabled={!prompt.trim()}
              aria-label="Send"
              type="button"
            >
              <PaperPlaneTiltIcon size={15} weight="fill" />
            </button>
          </div>
        </div>

        <div className="agent-view__examples">
          <p className="agent-view__examples-label">Try asking</p>
          {EXAMPLES.map(example => (
            <button
              key={example}
              className="agent-view__example"
              onClick={() => sendText(example)}
              type="button"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
```

`getGreeting`, `generateId`, and `timeNow` stay exactly as they are today —
only the imports, type, constants, and component body change.

- [ ] **Step 2: Full type-check**

Run: `npx tsc -b`
Expected: PASS, no errors anywhere in the project.

- [ ] **Step 3: Lint**

Run: `npx oxlint src`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/AgentView.tsx
git commit -m "Wire file-creation schedule and panel state into AgentView"
```

---

## Phase 7 — Responsive overlay below 1100px

**Files:**
- Modify: `src/components/AgentFilePanel.css`

At narrow viewports the 800px chat column plus 420px panel don't fit
side-by-side. Below 1100px the panel becomes an overlay instead of an inline
column.

- [ ] **Step 1: Add the overlay media query to `AgentFilePanel.css`**

Append:

```css
@media (max-width: 1100px) {
  .agent-file-panel {
    position: fixed;
    top: 0;
    right: 0;
    z-index: 20;
    box-shadow: var(--shadow-raised-2);
  }
}
```

- [ ] **Step 2: Add a backdrop in `AgentChat.tsx`**

In the `panelOpen &&` block added in Phase 5, add a backdrop element rendered
alongside `AgentFilePanel`, only relevant below 1100px (it's visually inert
above that width via CSS):

```tsx
{panelOpen && (
  <>
    <div className="agent-chat__panel-backdrop" onClick={onClosePanel} />
    <AgentFilePanel
      files={files}
      selectedPath={selectedPath}
      unseenPaths={unseenPaths}
      onSelect={onSelectFile}
      onClose={onClosePanel}
    />
  </>
)}
```

- [ ] **Step 3: Style the backdrop in `AgentChat.css`**

Append:

```css
.agent-chat__panel-backdrop {
  display: none;
}

@media (max-width: 1100px) {
  .agent-chat__panel-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 19;
    background: rgba(0,0,0,0.2);
  }
}
```

- [ ] **Step 4: Browser check at narrow width**

Start the dev server, resize the browser (or use device toolbar) to 900px
wide, open the Agent chat, trigger the first file (send a message), confirm
the panel overlays on top with a dimmed backdrop and clicking the backdrop
closes it. Resize back above 1100px and confirm it returns to being an inline
column.

- [ ] **Step 5: Commit**

```bash
git add src/components/AgentFilePanel.css src/components/AgentChat.tsx src/components/AgentChat.css
git commit -m "Make the file panel an overlay below 1100px"
```

---

## Phase 8 — Full verification pass

- [ ] **Step 1: Clean type-check and lint**

Run: `npx tsc -b --force && npx oxlint src`
Expected: both clean.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Full browser walkthrough**

Start the dev server and, in the Agent view:
1. Send a message — confirm no file panel yet is wrong (reply #1 creates a
   file per the schedule, so the panel opens after the very first message).
2. Confirm the panel slides in, `docs/riset-pasar.md` is selected and rendered
   with its table visible.
3. Send a 2nd message — confirm `docs/spec-fitur.md` is created (tree shows a
   new-dot, selection stays on file 1).
4. Click the new file in the tree — confirm it opens, new-dot clears, content
   renders including its fenced code block.
5. Send a 3rd message (text-only, no file) — confirm no new tree entry.
6. Send a 4th and 5th message — confirm both `notes/rapat-senin.md` and
   `notes/pertanyaan-terbuka.md` appear, and the `notes/` folder groups both.
7. Click a file card inside the chat thread itself — confirm it opens the
   panel (if closed) and selects that file.
8. Close the panel with the `X` — confirm the "N files" button appears in the
   chat header; click it — confirm the panel reopens with the previous
   selection intact.
9. Toggle Code on the open file — confirm raw markdown source shows in
   monospace; toggle back to Preview.
10. Click Copy — confirm the icon swaps to a checkmark briefly; paste
    somewhere to confirm the clipboard actually has the markdown source.
11. Click Download — confirm a `.md` file is saved with the right filename.
12. Send a 6th and 7th message — confirm `README.md` is created on the 7th and
    no file is created on the 6th.
13. Click "New task" — confirm chat, files, tree, and panel all reset
    completely; sending a fresh message re-triggers file creation starting
    from reply #1 again.
14. Confirm no regressions to Sidebar navigation or to any other view (Storage,
    Outline, Mail, Board/List).

- [ ] **Step 4: Fix any issues found, re-run Steps 1–3 until clean**

---

## Commit

Each phase above ends with its own commit — no separate final commit needed
unless Phase 8 required additional fixes, in which case commit those as one
more `fix:`-style commit.
