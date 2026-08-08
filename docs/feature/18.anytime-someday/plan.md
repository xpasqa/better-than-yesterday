# Plan: Anytime & Someday

Dua blok. A skema + core, B view.

Dilacak di epic **[#50](https://github.com/xpasqa/better-than-yesterday/issues/50)**.

---

## A. Skema & core

- [ ] Kolom `is_someday boolean not null default false` di tabel `node`
- [ ] `packages/core/src/node.ts` — field `isSomeday: boolean`
- [ ] `apps/api/src/modules/sync/dto.ts` — `isSomeday: z.boolean()` di `nodeDto`
- [ ] `modules/sync/routes.ts` — `toNodeRow`, `onConflictDoUpdate.set`, dan
      `nodeToDto` ikut membawa field baru (**tiga tempat**, mudah terlewat satu)
- [ ] Migrasi dijalankan di DB dev **dan** DB test
- [ ] `core/views.ts` — `anytime(nodes, todayStr)` dan `someday(nodes)`
- [ ] **`today()` dan `upcoming()` juga mengecualikan `isSomeday`** — kalau
      terlewat, task Someday bertanggal tetap menghantui Today, persis
      gangguan yang hendak dihindari
- [ ] Tes: anytime memuat tak-bertanggal + yang sudah tiba; anytime
      mengecualikan Someday dan tanggal masa depan; someday hanya yang
      ditandai; today/upcoming mengecualikan Someday
- [ ] **Verifikasi:** `npm run db:migrate` bersih; `npm test` hijau; fungsi
      baru 100% branch coverage

## B. View & UI

- [ ] `types/index.ts` — `'anytime'` dan `'someday'` masuk `ViewType`
- [ ] `routes.ts` — keduanya masuk `PLAIN_VIEWS`
- [ ] `App.tsx` — dua cabang baru
- [ ] `Sidebar.tsx` — dua nav item, urutan mengikuti Things:
      Inbox · Today · Upcoming · **Anytime** · **Someday**
- [ ] `AnytimeView.tsx` + `SomedayView.tsx` mengikuti bentuk `TodayReal.tsx`
- [ ] `NodeDetailModal` — toggle "Someday", memanggil `updateNode({ isSomeday })`
- [ ] Menandai Someday **tidak** menghapus `dueDate` — kalau nanti dibatalkan,
      tanggalnya masih ada
- [ ] **Verifikasi:** seluruh Success Criteria spec §8; `npm run verify` hijau
