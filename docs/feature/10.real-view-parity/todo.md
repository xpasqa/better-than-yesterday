# Todo: Real View Parity

## Fase 1: UI

- [x] Fix TaskRow.css — tambah --task-row-bleed hover bleed
- [x] Buat AddTaskFormReal.tsx — identik AddTaskForm tapi pakai Node store
- [x] Update TodayReal.tsx — pakai AddTaskFormReal dengan "+ Add task" trigger
- [x] Update InboxReal.tsx — pakai AddTaskFormReal
- [x] Update UpcomingReal.tsx — pakai AddTaskFormReal
- [x] Update ProjectReal.tsx — pakai AddTaskFormReal

## Fase 2: Seed data

- [x] Buat scripts/seed-tasks.ts — idempotent, cover projects/labels/tasks

## Fase 3: Build + Deploy

- [x] tsc --noEmit bersih
- [x] vite build sukses
- [x] cp dist ke nginx + nginx -s reload

## Post-ship gap closure (2026-08-07)

- [x] Tambah "Edit task" di TaskRow dropdown — memanggil `onOpenNode(node)`, muncul di atas "Delete task"
- [x] Hapus dead code `.real-view__quick-add` dari RealView.css (hardcoded `#d1453b` ikut terhapus)
