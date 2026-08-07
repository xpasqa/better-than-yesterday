# Todo: TaskRow Metadata & Feature Parity

## Phase 1: P0 — Metadata

- [ ] **Task 1:** Tambah `dueTime` ke meta row TaskRow
  - File: `apps/web/src/components/TaskRow.tsx`

- [ ] **Task 2:** Tambah `allNodes` prop + project name ke TaskRow, wire ke real views
  - Files: `TaskRow.tsx`, `TodayReal.tsx`, `InboxReal.tsx`, `UpcomingReal.tsx`

- [ ] **Checkpoint P0:** `tsc --noEmit` bersih, build sukses, deploy, verifikasi manual

## Phase 2: P1 — Core missing features

- [ ] **Task 3:** Tambah `updateNode` ke `node-actions.ts`
  - File: `apps/web/src/store/node-actions.ts`

- [ ] **Task 4:** Buat `NodeDetailModal` — struktur dasar (title, note, close)
  - Files: `NodeDetailModal.tsx` (baru), `NodeDetailModal.css` (baru), `TaskRow.tsx`

- [ ] **Task 5:** Tambah properties panel ke `NodeDetailModal` (due date, priority, labels)
  - Files: `NodeDetailModal.tsx`, `NodeDetailModal.css`

- [ ] **Task 6:** Wire `NodeDetailModal` ke `App.tsx` + semua real views
  - Files: `App.tsx`, `TodayReal.tsx`, `InboxReal.tsx`, `UpcomingReal.tsx`, `ProjectReal.tsx`

- [ ] **Checkpoint P1a:** `tsc --noEmit` bersih, build, deploy, verifikasi full flow

## Phase 3: P1 lanjutan — Label management

- [ ] **Task 7:** Buat `CreateLabelModal` + `label-actions.ts`
  - Files: `CreateLabelModal.tsx` (baru), `CreateLabelModal.css` (baru), `label-actions.ts`, `NodeDetailModal.tsx`

- [ ] **Checkpoint Final:** Build sukses, deploy ke production, semua P1 acceptance criteria terpenuhi

## P2 — Dijadwalkan sebagai feature terpisah
- [ ] Sections di ProjectReal (group tasks by section)
- [ ] QuickAddBar redesign (visual Todoist-style)

## P3 — Dijadwalkan sebagai feature terpisah
- [ ] Drag & drop reorder di real views
- [ ] Recurrence indicator di meta row
