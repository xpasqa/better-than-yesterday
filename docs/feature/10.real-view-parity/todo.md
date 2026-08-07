# Todo: Real View Parity

## Fase 1: UI

- [ ] Fix TaskRow.css — tambah --task-row-bleed hover bleed
- [ ] Buat AddTaskFormReal.tsx — identik AddTaskForm tapi pakai Node store
- [ ] Update TodayReal.tsx — pakai AddTaskFormReal dengan "+ Add task" trigger
- [ ] Update InboxReal.tsx — pakai AddTaskFormReal
- [ ] Update UpcomingReal.tsx — pakai AddTaskFormReal
- [ ] Update ProjectReal.tsx — pakai AddTaskFormReal

## Fase 2: Seed data

- [ ] Buat scripts/seed-tasks.ts
- [ ] Jalankan seed script untuk pasqa@xvntr.my.id

## Fase 3: Build + Deploy

- [ ] tsc --noEmit bersih
- [ ] vite build sukses
- [ ] cp dist ke nginx + nginx -s reload
