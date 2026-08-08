# Board (Kanban) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menampilkan project sebagai papan kanban dengan kolom = `kind='section'`, dan sekaligus memperkenalkan section sebagai konsep yang terlihat di UI untuk pertama kalinya.

**Architecture:** Satu fungsi murni `board()` di `packages/core` jadi sumber tunggal pengelompokan; store dapat dua fungsi baru (`createSection`, `deleteSection`); `BoardView` merender kolom dengan HTML5 drag native; `ProjectReal` dapat toggle list ↔ board dan heading section di list.

**Tech Stack:** TypeScript, React, Vitest, Dexie (IndexedDB), `packages/core` (fungsi murni).

## Global Constraints

- **Kolom SELALU `kind='section'`.** Tidak boleh ada menu grouping/sorting, tidak boleh ada kolom dari tanggal/prioritas/label. Dilarang [policy 3](../../policy/3-product-policy.md) §3. Ini bukan "belum" — jangan bangun jalannya sama sekali.
- Tipe di `apps/web/src/types/index.ts` adalah kontrak dan **tidak boleh diubah** agar cocok dengan backend (CLAUDE.md).
- `packages/core` haram punya I/O, `Date.now()`, atau state modul.
- Semua tulisan ke DB lewat `enqueue()`/`updateNode()` yang sudah ada — tidak ada jalur tulis baru, supaya `sanitizeNode` dan outbox tetap berlaku.
- **Tanpa dependensi baru.** Seret pakai HTML5 native (`draggable`, `onDragOver`, `onDrop`).
- Jangan bikin abstraksi sebelum pemakaian ketiga ([policy 1](../../policy/1-engineering-policy.md)) — rename section dan pindah kartu memanggil `updateNode` langsung, tanpa wrapper.
- `npm run verify` harus hijau; `board.ts` 100% branch coverage.
- Board di mobile **baca-saja**; HTML5 drag tidak jalan di layar sentuh. Ini keputusan, bukan bug.

---

### Task 1: `board()` di core

**Files:**
- Create: `packages/core/src/board.ts`
- Test: `packages/core/src/board.test.ts`

**Interfaces:**
- Consumes: `Node` dari `./node.ts`
- Produces: `BoardColumn { section: Node | null; items: Node[] }` dan `board(nodes: Node[], projectId: string): BoardColumn[]` — dipakai Task 3 dan Task 4

- [ ] **Step 1: Tulis tes yang gagal**

```ts
import { describe, expect, it } from 'vitest'
import { board } from './board.ts'
import type { Node } from './node.ts'

// Minimal factory — only the fields board() actually reads.
function n(over: Partial<Node> & Pick<Node, 'id' | 'kind'>): Node {
  return {
    parentId: null, rank: 'm', content: over.id, note: null, dueDate: null,
    dueTime: null, durationMin: null, recurrence: null, priority: null,
    labelIds: [], color: null, isFavorite: false, isInbox: false,
    collapsed: false, completedAt: null, deletedAt: null, userId: 'u',
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    seq: 0, ...over,
  } as Node
}

const P = n({ id: 'p', kind: 'project' })

describe('board', () => {
  it('returns [] for an unknown project', () => {
    expect(board([P], 'nope')).toEqual([])
  })

  it('puts section-less items in an implicit first column', () => {
    const a = n({ id: 'a', kind: 'item', parentId: 'p', rank: 'a' })
    const cols = board([P, a], 'p')
    expect(cols).toHaveLength(1)
    expect(cols[0]!.section).toBeNull()
    expect(cols[0]!.items.map(i => i.id)).toEqual(['a'])
  })

  it('hides the implicit column when every item has a section', () => {
    const s = n({ id: 's', kind: 'section', parentId: 'p', rank: 'm' })
    const a = n({ id: 'a', kind: 'item', parentId: 's', rank: 'a' })
    const cols = board([P, s, a], 'p')
    expect(cols).toHaveLength(1)
    expect(cols[0]!.section!.id).toBe('s')
  })

  it('orders sections by rank, implicit column always first', () => {
    const s1 = n({ id: 's1', kind: 'section', parentId: 'p', rank: 'z' })
    const s2 = n({ id: 's2', kind: 'section', parentId: 'p', rank: 'b' })
    const loose = n({ id: 'loose', kind: 'item', parentId: 'p', rank: 'a' })
    const cols = board([P, s1, s2, loose], 'p')
    expect(cols.map(c => c.section?.id ?? null)).toEqual([null, 's2', 's1'])
  })

  it('orders items within a column by rank', () => {
    const s = n({ id: 's', kind: 'section', parentId: 'p', rank: 'm' })
    const b = n({ id: 'b', kind: 'item', parentId: 's', rank: 'z' })
    const a = n({ id: 'a', kind: 'item', parentId: 's', rank: 'a' })
    expect(board([P, s, b, a], 'p')[0]!.items.map(i => i.id)).toEqual(['a', 'b'])
  })

  it('keeps an empty section as a visible column', () => {
    const s = n({ id: 's', kind: 'section', parentId: 'p', rank: 'm' })
    const cols = board([P, s], 'p')
    expect(cols).toHaveLength(1)
    expect(cols[0]!.items).toEqual([])
  })

  it('excludes completed and deleted items', () => {
    const done = n({ id: 'done', kind: 'item', parentId: 'p', rank: 'a', completedAt: '2026-01-02T00:00:00Z' })
    const gone = n({ id: 'gone', kind: 'item', parentId: 'p', rank: 'b', deletedAt: '2026-01-02T00:00:00Z' })
    const live = n({ id: 'live', kind: 'item', parentId: 'p', rank: 'c' })
    expect(board([P, done, gone, live], 'p')[0]!.items.map(i => i.id)).toEqual(['live'])
  })

  it('drops a deleted section AND does not leak its children into another column', () => {
    const s = n({ id: 's', kind: 'section', parentId: 'p', rank: 'm', deletedAt: '2026-01-02T00:00:00Z' })
    const orphan = n({ id: 'orphan', kind: 'item', parentId: 's', rank: 'a' })
    const loose = n({ id: 'loose', kind: 'item', parentId: 'p', rank: 'b' })
    const cols = board([P, s, orphan, loose], 'p')
    expect(cols).toHaveLength(1)
    expect(cols[0]!.section).toBeNull()
    expect(cols[0]!.items.map(i => i.id)).toEqual(['loose'])
  })

  it('does not show subtasks as cards', () => {
    const parent = n({ id: 'parent', kind: 'item', parentId: 'p', rank: 'a' })
    const sub = n({ id: 'sub', kind: 'item', parentId: 'parent', rank: 'a' })
    expect(board([P, parent, sub], 'p')[0]!.items.map(i => i.id)).toEqual(['parent'])
  })

  it('returns [] when the id names something that is not a project', () => {
    const s = n({ id: 's', kind: 'section', parentId: 'p', rank: 'm' })
    expect(board([P, s], 's')).toEqual([])
  })
})
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `npx vitest run packages/core/src/board.test.ts`
Expected: FAIL — `Cannot find module './board.ts'`

- [ ] **Step 3: Implementasi**

```ts
import type { Node } from './node.ts'

/** One kanban column. `section` is null for the implicit "no section" column. */
export interface BoardColumn {
  section: Node | null
  items: Node[]
}

const byRank = (a: Node, b: Node): number => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0)

function liveItemsOf(nodes: Node[], parentId: string): Node[] {
  return nodes
    .filter(
      (n) =>
        n.parentId === parentId &&
        n.kind === 'item' &&
        n.deletedAt === null &&
        n.completedAt === null,
    )
    .sort(byRank)
}

/**
 * A project's columns, ordered by section rank, with the implicit
 * "no section" column always first.
 *
 * Only DIRECT children appear as cards — subtasks live inside their parent
 * task (feature 14), not beside it on the board. That is also why this does
 * not reuse `views.ts`'s `project()`, which flattens the whole subtree.
 *
 * Completed items are excluded: the board is a working surface, and history
 * belongs to the Logbook (feature 17).
 */
export function board(nodes: Node[], projectId: string): BoardColumn[] {
  const project = nodes.find((n) => n.id === projectId && n.kind === 'project' && n.deletedAt === null)
  if (!project) return []

  const columns: BoardColumn[] = []

  // The implicit column is omitted when empty — a board that always opens
  // with a blank nameless column is noise.
  const loose = liveItemsOf(nodes, projectId)
  if (loose.length > 0) columns.push({ section: null, items: loose })

  const sections = nodes
    .filter((n) => n.parentId === projectId && n.kind === 'section' && n.deletedAt === null)
    .sort(byRank)

  for (const section of sections) {
    columns.push({ section, items: liveItemsOf(nodes, section.id) })
  }

  return columns
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `npx vitest run packages/core/src/board.test.ts`
Expected: PASS

- [ ] **Step 5: Ekspor & commit**

Tambahkan `board` ke barrel export `packages/core` bila file itu ada (cek `packages/core/package.json` `exports`; modul lain seperti `views` diekspor per-file, jadi kemungkinan besar tidak ada yang perlu diubah).

```bash
git add packages/core/src/board.ts packages/core/src/board.test.ts
git commit -m "feat(core): add board() to group a project's items by section"
```

---

### Task 2: `createSection` dan `deleteSection` di store

**Files:**
- Modify: `apps/web/src/store/node-actions.ts`

**Interfaces:**
- Consumes: `enqueue`, `db`, `uuidv7`, `between` — semuanya sudah ada di file itu
- Produces: `createSection(projectId: string, name: string): Promise<Node>`, `deleteSection(section: Node): Promise<void>` — dipakai Task 3

- [ ] **Step 1: Implementasi `createSection`**

Tambahkan setelah `createTaskFromQuickAdd`. Bentuk `Node`-nya menyalin yang di `createTaskFromQuickAdd` — sengaja ditulis penuh, bukan lewat helper, karena baru dua pemakai:

```ts
/**
 * A section is a column on the board and a heading in the list — the same
 * row either way. It carries none of an item's scheduling fields; the DB's
 * CHECK constraints reject a section that has them, and `sanitizeNode`
 * inside `enqueue` is the second line of defense.
 */
export async function createSection(projectId: string, name: string): Promise<Node> {
  const allNodes = await db.nodes.toArray()
  const siblings = allNodes.filter((n) => n.parentId === projectId && n.kind === 'section')
  const lastRank = siblings.length > 0 ? siblings.reduce((a, b) => (a.rank > b.rank ? a : b)).rank : null

  const now = new Date().toISOString()
  const node: Node = {
    id: uuidv7(),
    userId: '', // filled in by the server from the session
    parentId: projectId,
    kind: 'section',
    rank: between(lastRank, null),
    content: name,
    note: null,
    dueDate: null,
    dueTime: null,
    durationMin: null,
    recurrence: null,
    priority: null,
    labelIds: [],
    color: null,
    isFavorite: false,
    isInbox: false,
    collapsed: false,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    seq: 0,
  }

  await enqueue(node)
  return node
}
```

- [ ] **Step 2: Implementasi `deleteSection`**

```ts
/**
 * Deleting a section must never delete its tasks. The children are lifted to
 * the project, where they land in the board's implicit column — visible, not
 * lost.
 *
 * Both writes go in one Dexie transaction: a crash between them would leave
 * tasks parented to a soft-deleted section, and `board()` shows those in no
 * column at all.
 */
export async function deleteSection(section: Node): Promise<void> {
  const now = new Date().toISOString()
  const children = await db.nodes.where('parentId').equals(section.id).toArray()

  await db.transaction('rw', db.nodes, db.outbox, async () => {
    for (const child of children) {
      const moved = sanitizeNode({ ...child, parentId: section.parentId, updatedAt: now })
      await db.nodes.put(moved)
      await db.outbox.put({ key: `node:${moved.id}`, entityType: 'node', payload: moved })
    }
    const removed = sanitizeNode({ ...section, deletedAt: now, updatedAt: now })
    await db.nodes.put(removed)
    await db.outbox.put({ key: `node:${removed.id}`, entityType: 'node', payload: removed })
  })

  triggerSync()
}
```

> `enqueue()` tidak dipakai di sini karena ia membuka transaksinya sendiri
> per node, yang justru meniadakan jaminan atomik yang jadi alasan fungsi
> ini ada. Isinya disalin — `sanitizeNode` + `put` + `outbox.put` — supaya
> guard CHECK tetap berlaku.

Pastikan `sanitizeNode` sudah ada di daftar import dari `@better/core/node` (sudah, baris 8).

- [ ] **Step 3: Verifikasi**

Run: `npm run verify`
Expected: hijau (typecheck + lint + tes yang ada).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/store/node-actions.ts
git commit -m "feat(web): add createSection and deleteSection store actions"
```

---

### Task 3: `BoardView` dan toggle list ↔ board

**Files:**
- Create: `apps/web/src/components/BoardView.tsx`
- Create: `apps/web/src/components/BoardView.css`
- Modify: `apps/web/src/components/ProjectReal.tsx`

**Interfaces:**
- Consumes: `board`, `BoardColumn` (Task 1); `createSection`, `deleteSection` (Task 2); `updateNode` (sudah ada); `useAllNodes`, `useAllLabels`, `AddTaskFormReal`, `NodeDetailModal` (sudah ada)
- Produces: komponen `BoardView` dengan props `{ user: AuthUser; projectId: string; onOpenNode?: (id: string) => void }` — sama persis dengan `ProjectReal`, supaya `ProjectReal` bisa menukar keduanya tanpa memetakan props

- [ ] **Step 1: Tulis `BoardView.tsx`**

```tsx
import { useState } from 'react'
import { board } from '@better/core/board'
import { DotsThreeIcon, PlusIcon } from '@phosphor-icons/react'
import { useAllLabels, useAllNodes } from '../store/use-nodes'
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
  const labels = useAllLabels()
  const labelsById = new Map(labels.map((l) => [l.id, l]))
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
                  labelsById={labelsById}
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
```

- [ ] **Step 2: Tulis `BoardCard.tsx`**

Kartu sengaja komponen sendiri, bukan `TaskRow`. `TaskRow` dibentuk untuk baris selebar layar dan dipakai enam view lain; menambah cabang props ke sana demi kartu 280px membuat komponen yang paling banyak dipakai jadi lebih rumit untuk semua pemakainya.

```tsx
import { CheckCircleIcon } from '@phosphor-icons/react'
import { toggleTaskComplete } from '../store/node-actions'
import type { Node } from '@better/core/node'
import type { Label } from '@better/core/label'

interface BoardCardProps {
  node: Node
  labelsById: Map<string, Label>
  timezone: string
  onOpen?: (id: string) => void
}

function BoardCard({ node, labelsById, timezone, onOpen }: BoardCardProps) {
  return (
    <article
      className="board__card"
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', node.id)}
      onClick={() => onOpen?.(node.id)}
    >
      <button
        className={`board__card-check board__card-check--p${node.priority ?? 4}`}
        type="button"
        aria-label={`Complete ${node.content}`}
        onClick={(e) => { e.stopPropagation(); void toggleTaskComplete(node, timezone) }}
      >
        <CheckCircleIcon size={16} />
      </button>
      <span className="board__card-title">{node.content}</span>
      {node.dueDate && <span className="board__card-date">{node.dueDate}</span>}
      {node.labelIds.length > 0 && (
        <span className="board__card-tags">
          {node.labelIds.map((id) => labelsById.get(id)?.name).filter(Boolean).map((name) => (
            <span key={name} className="board__card-tag">{name}</span>
          ))}
        </span>
      )}
    </article>
  )
}

export default BoardCard
```

- [ ] **Step 3: Tulis `BoardView.css`**

Kolom mendatar dengan `overflow-x`, isi kolom `overflow-y`. Warna dari variabel tema yang sudah ada (`--bg-secondary`, `--text-primary`, `--border`, `--priority-p1`…`--priority-p3`) — jangan hardcode hex, dark mode akan rusak.

```css
.board { display: flex; gap: 12px; align-items: flex-start; overflow-x: auto; padding: 16px; height: 100%; }
.board__column { display: flex; flex-direction: column; flex: 0 0 280px; max-height: 100%; background: var(--bg-secondary); border-radius: 8px; padding: 8px; border: 1px solid transparent; }
.board__column--over { border-color: var(--priority-p2); }
.board__column-header { display: flex; align-items: center; gap: 6px; padding: 4px 6px 8px; }
.board__column-title { flex: 1; min-width: 0; background: none; border: none; font-weight: 600; color: var(--text-primary); }
.board__column-title--implicit { color: var(--text-tertiary); }
.board__count { color: var(--text-tertiary); font-size: 12px; }
.board__cards { display: flex; flex-direction: column; gap: 6px; overflow-y: auto; }
.board__card { display: flex; align-items: flex-start; gap: 6px; flex-wrap: wrap; background: var(--bg-primary); border: 1px solid var(--border); border-radius: 6px; padding: 8px; cursor: pointer; }
.board__card-title { flex: 1; min-width: 0; }
```

Sisanya (`--new`, tombol, chip) mengikuti `RealView.css`.

- [ ] **Step 4: Sambungkan toggle di `ProjectReal.tsx`**

Tambahkan state yang bertahan di `localStorage`, per project:

```tsx
const storageKey = `bty.project-view.${projectId}`
const [mode, setMode] = useState<'list' | 'board'>(
  () => (localStorage.getItem(storageKey) === 'board' ? 'board' : 'list'),
)

function chooseMode(next: 'list' | 'board') {
  setMode(next)
  localStorage.setItem(storageKey, next)
}
```

> `useState` dengan initializer fungsi, bukan `localStorage.getItem` langsung
> di badan komponen — kalau tidak, ia dibaca ulang tiap render.
>
> `projectId` ikut di key, jadi berpindah project **tidak** membawa
> pilihannya. `useState` initializer hanya jalan sekali per mount; kalau
> `ProjectReal` tidak di-remount saat `projectId` berubah, tambahkan
> `key={projectId}` di tempat ia dirender di `App.tsx`. Cek ini — jangan
> asumsikan.

Dua tombol ikon di `real-view__header`, lalu render bercabang:

```tsx
{mode === 'board'
  ? <BoardView user={user} projectId={projectId} onOpenNode={onOpenNode} />
  : (/* daftar list yang sudah ada */)}
```

- [ ] **Step 5: Verifikasi manual**

```bash
npm run verify
cd apps/web && /home/ubuntu/bty/app/node_modules/.bin/vite build
```

Lalu di browser: bikin section, seret kartu antar kolom, reload — kartu tetap di kolom barunya; hapus section — task-nya pindah ke kolom "No section", tidak hilang.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/BoardView.tsx apps/web/src/components/BoardCard.tsx apps/web/src/components/BoardView.css apps/web/src/components/ProjectReal.tsx
git commit -m "feat(web): kanban board view with section columns and drag-to-move"
```

---

### Task 4: Heading section di list view

**Files:**
- Modify: `apps/web/src/components/ProjectReal.tsx`

**Interfaces:**
- Consumes: `board` (Task 1)
- Produces: tidak ada API baru

- [ ] **Step 1: Ganti sumber daftar list**

List sekarang membaca `board()` yang sama dengan board view, bukan `project()`. Satu sumber, jadi dua tampilan tidak mungkin beda isi:

```tsx
const columns = board(nodes, projectId)
```

Render tiap kolom sebagai kelompok: kolom implisit tanpa heading (ia memang "tanpa section"), sisanya dengan heading nama section.

```tsx
{columns.map((col) => (
  <div key={col.section?.id ?? projectId} className="real-view__group">
    {col.section && <h2 className="real-view__section-heading">{col.section.content}</h2>}
    <ul className="real-view__list">
      {col.items.map((n) => (
        <TaskRow key={n.id} node={n} labelsById={labelsById}
          onOpenNode={onOpenNode ? (n) => onOpenNode(n.id) : undefined}
          timezone={user.timezone ?? 'Asia/Jakarta'} />
      ))}
    </ul>
  </div>
))}
```

> **Ini mengubah apa yang list tampilkan.** `project()` meratakan seluruh
> keturunan, jadi subtask muncul sebagai baris sendiri; `board()` hanya
> mengambil item tingkat atas. Setelah task ini, subtask **tidak lagi
> terlihat di project view** sampai [fitur 14](../14.task-subtask-view/spec.md)
> merendernya di dalam task induknya.
>
> Itu urutan yang benar dan disengaja — tapi kalau fitur 14 belum mendarat
> saat task ini dikerjakan, **berhenti dan tanyakan**: menghilangkan subtask
> dari satu-satunya tempat ia terlihat adalah regresi, bukan pembersihan.

- [ ] **Step 2: Perbarui penghitung header**

`items.length` sudah tidak ada. Ganti dengan jumlah lintas kolom:

```tsx
const taskCount = columns.reduce((sum, c) => sum + c.items.length, 0)
```

- [ ] **Step 3: Tambahkan gaya heading di `RealView.css`**

```css
.real-view__section-heading { font-size: 13px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; margin: 16px 0 4px; }
.real-view__group:first-child .real-view__section-heading { margin-top: 0; }
```

- [ ] **Step 4: Verifikasi**

Run: `npm run verify`
Lalu di browser: project dengan section menampilkan heading; task tanpa section tampil lebih dulu tanpa heading; jumlah di header cocok dengan total kartu di board.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ProjectReal.tsx apps/web/src/components/RealView.css
git commit -m "feat(web): show section headings in project list view"
```
