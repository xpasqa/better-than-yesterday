# Plan: Real View Parity

## Fase 1: TaskRow bleed + AddTaskFormReal

### Step 1 — Fix TaskRow.css hover bleed
Tambah `--task-row-bleed` pseudo-element ke `TaskRow.css` persis seperti `TaskItem.css`.

### Step 2 — Buat AddTaskFormReal.tsx
Komponen baru yang secara visual identik dengan `AddTaskForm.tsx` tapi:
- Menggunakan `Node` store (`createTaskFromQuickAdd`, `useAllNodes`)
- Menerima `defaultParentId?: string | null` dan `timezone: string`
- Setelah submit: task tersimpan ke Dexie + outbox, form collapse
- Project dropdown menggunakan `realNodes` (bukan mock `projects`)
- Priority chip: sets priority field eksplisit
- Due date chip: sets dueDate field eksplisit
- Description: sets `note` field

Catatan: `AddTaskForm.tsx` **tidak diubah** — tetap untuk MainContent mock.

### Step 3 — Update semua real views
Ganti `QuickAddBar` dengan `AddTaskFormReal` di:
- `TodayReal.tsx` — tambah "+ Add task" trigger, expand inline form
- `InboxReal.tsx` — sama
- `UpcomingReal.tsx` — sama  
- `ProjectReal.tsx` — sama

## Fase 2: Seed data

### Step 4 — Buat scripts/seed-tasks.ts
Script yang:
1. Connect ke Postgres via env `DATABASE_URL`
2. Lookup user `pasqa@xvntr.my.id`
3. Insert projects: Work (#dc4c3e), Personal (#058527), Shopping (#eb8909), Health (#692ec2)
4. Insert labels: email (#246fe0), call (#eb8909), important (#dc4c3e), waiting (#999)
5. Insert 8-10 tasks di berbagai projects dengan priority, due date, labels
6. Idempotent: skip jika sudah ada (check by content + userId)

### Step 5 — Jalankan seed script
```bash
DATABASE_URL=... tsx scripts/seed-tasks.ts
```

## Fase 3: Verify + Deploy
- tsc --noEmit
- vite build
- cp + nginx reload
