# Todo: TaskRow Metadata & Feature Parity

## Phase 1: P0 — Metadata

- [x] **Task 1:** Tambah `dueTime` ke meta row TaskRow
  - File: `apps/web/src/components/TaskRow.tsx`

- [x] **Task 2:** Tambah `allNodes` prop + project name ke TaskRow, wire ke real views
  - Files: `TaskRow.tsx`, `TodayReal.tsx`, `InboxReal.tsx`, `UpcomingReal.tsx`

- [x] **Checkpoint P0:** `tsc --noEmit` bersih, build sukses, deploy, verifikasi manual

## Phase 2: P1 — Core missing features

- [x] **Task 3:** Tambah `updateNode` ke `node-actions.ts`
  - File: `apps/web/src/store/node-actions.ts`

- [x] **Task 4:** Buat `NodeDetailModal` — struktur dasar (title, note, close)
  - Files: `NodeDetailModal.tsx`, `NodeDetailModal.css`

- [x] **Task 5:** Tambah properties panel ke `NodeDetailModal` (due date, priority, labels)
  - Files: `NodeDetailModal.tsx`, `NodeDetailModal.css`

- [x] **Task 6:** Wire `NodeDetailModal` ke `App.tsx` + semua real views
  - Files: `App.tsx`, `TodayReal.tsx`, `InboxReal.tsx`, `UpcomingReal.tsx`, `ProjectReal.tsx`

- [x] **Checkpoint P1a:** `tsc --noEmit` bersih, build, deploy, verifikasi full flow

## Phase 3: P1 lanjutan — Label management

- [x] **Task 7:** Buat `CreateLabelModal` + `label-actions.ts`
  - Files: `CreateLabelModal.tsx`, `CreateLabelModal.css`, `label-actions.ts`, `NodeDetailModal.tsx`

- [x] **Checkpoint Final:** Build sukses, deploy ke production, semua P1 acceptance criteria terpenuhi

## Post-ship gap closure (2026-08-07)

- [x] **Gap:** "Edit task" di TaskRow dropdown — tambah `NotePencilIcon` + button yang memanggil `onOpenNode(node)`, muncul di atas "Delete task"
- [x] **Verified:** TaskRow content area onClick ke `onOpenNode` sudah ter-wire sejak implementasi awal

## P2 — Dijadwalkan sebagai feature terpisah
- [ ] Sections di ProjectReal (group tasks by section)
- [ ] QuickAddBar redesign (visual Todoist-style)

## P3 — Dijadwalkan sebagai feature terpisah
- [ ] Drag & drop reorder di real views
- [ ] Recurrence indicator di meta row
