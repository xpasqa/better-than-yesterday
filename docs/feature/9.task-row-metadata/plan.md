# Implementation Plan: TaskRow Metadata & Feature Parity

## Overview

Membawa semua real (store-backed) views ke paritas visual dan fungsional dengan
frontend mock. Dibagi 4 fase: P0 (metadata yang datanya sudah ada), P1 (core
missing features), P2 (polish), P3 (nice to have). Fase P0 dan P1 dieksekusi
dalam feature ini; P2 dan P3 dijadwalkan sebagai feature tersendiri.

## Architecture Decisions

- **TaskRow menerima `allNodes` prop** — untuk lookup nama project via `parentId`,
  bukan hook baru. Ini menghindari N+1 Dexie query per row.
- **NodeDetailModal pakai `createPortal`** — konsisten dengan pola `TaskDetailModal`.
- **`updateNode` di node-actions.ts** — patch LWW: read node saat ini, merge fields
  yang diubah, set `updatedAt = now()`, enqueue ke Dexie + outbox.
- **Label management** — modal kecil `CreateLabelModal` dipanggil dari NodeDetailModal,
  bukan halaman tersendiri. Consistent dengan `CreateProjectModal`.
- **Tidak ubah Node type** — semua field yang dibutuhkan sudah ada di `packages/core/src/node.ts`.

## Dependency Graph

```
node-actions.ts (updateNode)
    │
    ├── NodeDetailModal.tsx
    │       └── dipanggil dari TaskRow (klik content area)
    │
    └── CreateLabelModal.tsx
            └── dipanggil dari NodeDetailModal (tambah label)

TaskRow.tsx (due time + project name)
    └── menerima allNodes prop dari parent views
            └── TodayReal, InboxReal, UpcomingReal, ProjectReal
```

---

## Phase 1: P0 — Metadata yang datanya sudah ada

### Task 1: Due time di TaskRow meta row

**Description:** Tambahkan `dueTime` ke meta row TaskRow. Data sudah ada di
`node.dueTime` (format `HH:MM`), tinggal render setelah due date text.

**Acceptance criteria:**
- [ ] `node.dueTime` tampil di meta row setelah due date, format `HH:MM`
- [ ] Jika `dueDate` null tapi `dueTime` ada, tampil dueTime saja
- [ ] Jika keduanya null, meta row tidak render elemen waktu

**Verification:**
- [ ] `tsc --noEmit` bersih
- [ ] Manual: buat task dengan due time via quick-add `besok jam 9`, cek meta row

**Dependencies:** None

**Files:**
- `apps/web/src/components/TaskRow.tsx`

**Scope:** XS

---

### Task 2: Project name di Today/Inbox/Upcoming

**Description:** Tambahkan `allNodes` prop ke `TaskRow` dan tampilkan nama
project (`#ProjectName`) di meta row. Di `ProjectReal`, project name tidak
ditampilkan (redundan). Di Today/Inbox/Upcoming, lookup `node.parentId` dari
`allNodes` dan tampilkan nama project parent.

**Acceptance criteria:**
- [ ] TaskRow menerima `allNodes: Node[]` prop (optional, default `[]`)
- [ ] Di Today/Inbox/Upcoming: `#ProjectName` tampil di meta row jika node punya parent project
- [ ] Di ProjectReal: project name tidak tampil (prop tidak di-pass atau parentId === projectId)
- [ ] Inbox project tidak tampil sebagai project name (isInbox node diabaikan)

**Verification:**
- [ ] `tsc --noEmit` bersih
- [ ] Manual: buat task di project "Work" lalu cek Today view → tampil `#Work`

**Dependencies:** Task 1

**Files:**
- `apps/web/src/components/TaskRow.tsx`
- `apps/web/src/components/TodayReal.tsx`
- `apps/web/src/components/InboxReal.tsx`
- `apps/web/src/components/UpcomingReal.tsx`

**Scope:** S

---

### Checkpoint: Setelah Task 1-2
- [ ] `tsc --noEmit` bersih
- [ ] Build sukses
- [ ] Due time + project name tampil di browser

---

## Phase 2: P1 — Core missing features

### Task 3: `updateNode` di node-actions.ts

**Description:** Tambahkan `updateNode(id, patch, allNodes)` ke `node-actions.ts`.
Pattern identik dengan `enqueueNode` yang sudah ada: read node saat ini,
merge patch, set `updatedAt`, simpan ke Dexie + outbox, trigger sync.

**Acceptance criteria:**
- [ ] `updateNode(id: string, patch: Partial<Node>, allNodes: Node[]): Promise<void>` tersedia
- [ ] Node yang diupdate masuk ke outbox dengan `updatedAt` baru
- [ ] Field yang tidak di-patch tidak berubah

**Verification:**
- [ ] `tsc --noEmit` bersih
- [ ] Unit test: mock Dexie, verifikasi patch di-merge dengan benar

**Dependencies:** None (parallel dengan Task 1-2)

**Files:**
- `apps/web/src/store/node-actions.ts`

**Scope:** XS

---

### Task 4: NodeDetailModal — struktur dasar

**Description:** Buat `NodeDetailModal.tsx` dan `NodeDetailModal.css` dengan
struktur modal yang mirip `TaskDetailModal` (pakai `createPortal`). Fase ini:
tampilkan title (editable), note (editable textarea), tombol close. Simpan
perubahan via `updateNode` onBlur.

**Acceptance criteria:**
- [ ] Modal terbuka saat klik content area TaskRow
- [ ] Title editable (`input`), auto-focus saat buka
- [ ] Note editable (`textarea`)
- [ ] Close via `×` button, Escape, atau klik overlay
- [ ] Simpan title + note onBlur via `updateNode`
- [ ] Desktop: centered modal 800px max-width
- [ ] Mobile (≤767px): full-screen sheet

**Verification:**
- [ ] `tsc --noEmit` bersih
- [ ] Manual: klik task → modal terbuka, edit title → close → title tersimpan

**Dependencies:** Task 3

**Files:**
- `apps/web/src/components/NodeDetailModal.tsx` (baru)
- `apps/web/src/components/NodeDetailModal.css` (baru)
- `apps/web/src/components/TaskRow.tsx` (tambah onClick + onOpenNode prop)

**Scope:** M

---

### Task 5: NodeDetailModal — due date, priority, labels

**Description:** Tambahkan properties panel ke `NodeDetailModal`: due date
picker (pakai `react-day-picker` yang sudah ada), priority selector (4 level),
label selector (dari `useAllLabels()`). Simpan via `updateNode` per field.

**Acceptance criteria:**
- [ ] Due date picker tampil dan tersimpan ke `node.dueDate`
- [ ] Priority selector (P1/P2/P3/P4) tersimpan ke `node.priority`
- [ ] Label selector tampilkan semua label dari Dexie, toggle via klik
- [ ] Layout properties panel: kanan di desktop, bawah di mobile (ikuti `TaskDetailModal`)

**Verification:**
- [ ] `tsc --noEmit` bersih
- [ ] Manual: set due date → cek meta row TaskRow terupdate reaktif
- [ ] Manual: set priority → cek checkbox color berubah

**Dependencies:** Task 4

**Files:**
- `apps/web/src/components/NodeDetailModal.tsx`
- `apps/web/src/components/NodeDetailModal.css`

**Scope:** M

---

### Task 6: Wire NodeDetailModal ke App.tsx + real views

**Description:** Angkat state `openNodeId` ke `App.tsx` (atau ke masing-masing
real view). Pass `onOpenNode` callback ke TaskRow melalui real views. Render
`NodeDetailModal` di `App.tsx` (atau masing-masing view).

**Acceptance criteria:**
- [ ] `onOpenNode` prop tersedia di `TaskRow`
- [ ] Klik content area TaskRow di Today/Inbox/Upcoming/Project → modal terbuka
- [ ] Modal bisa ditutup dan dibuka ulang untuk task berbeda
- [ ] `allNodes` diteruskan ke modal untuk `updateNode`

**Verification:**
- [ ] `tsc --noEmit` bersih
- [ ] Manual: klik task di setiap view → modal terbuka dengan data benar

**Dependencies:** Task 4, 5

**Files:**
- `apps/web/src/App.tsx`
- `apps/web/src/components/TodayReal.tsx`
- `apps/web/src/components/InboxReal.tsx`
- `apps/web/src/components/UpcomingReal.tsx`
- `apps/web/src/components/ProjectReal.tsx`

**Scope:** M

---

### Checkpoint: Setelah Task 3-6
- [ ] `tsc --noEmit` bersih
- [ ] Build sukses
- [ ] Deploy ke production
- [ ] Manual: full flow — buat task, buka detail, edit semua field, verifikasi tersimpan

---

## Phase 3: P1 lanjutan — Label management

### Task 7: CreateLabelModal

**Description:** Buat `CreateLabelModal.tsx` + CSS — modal kecil dengan input
nama dan color picker (swatch 8 warna preset). Dipanggil dari NodeDetailModal
saat user klik "New label". Simpan via `createLabel` di `label-actions.ts`
(buat jika belum ada).

**Acceptance criteria:**
- [ ] Modal muncul dengan input nama + 8 color swatches
- [ ] Submit → label tersimpan di Dexie, muncul di label selector NodeDetailModal
- [ ] Cancel/Escape → modal tutup tanpa efek

**Verification:**
- [ ] `tsc --noEmit` bersih
- [ ] Manual: buat label baru dari NodeDetailModal, assign ke task

**Dependencies:** Task 5

**Files:**
- `apps/web/src/components/CreateLabelModal.tsx` (baru)
- `apps/web/src/components/CreateLabelModal.css` (baru)
- `apps/web/src/store/label-actions.ts` (baru atau update)
- `apps/web/src/components/NodeDetailModal.tsx`

**Scope:** M

---

### Checkpoint: Final P1
- [ ] `tsc --noEmit` bersih
- [ ] Build sukses
- [ ] Deploy ke production
- [ ] Manual: semua P1 acceptance criteria dari spec terpenuhi

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `react-day-picker` API berbeda dari yang dipakai di `TaskDetailModal` | Medium | Baca TaskDetailModal.tsx dulu, pakai API yang sama |
| `allNodes` prop di TaskRow menyebabkan re-render berlebih | Low | `allNodes` sudah live query dari Dexie, tidak ada overhead tambahan |
| `label-actions.ts` belum ada | Low | Cek dulu, buat jika perlu — pola sama dengan `project-actions.ts` |

## Open Questions

— Semua sudah dijawab di spec dengan asumsi eksplisit.
