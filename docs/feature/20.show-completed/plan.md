# Plan: Toggle tampilkan/sembunyikan task selesai

Dua blok. A core, B UI.

Dilacak di epic **[#30](https://github.com/xpasqa/better-than-yesterday/issues/30)**.

---

## A. Core — `views.ts`

- [ ] `isActiveItem(n, includeCompleted = false)` — parameter baru, default
      `false` supaya perilaku sekarang tidak berubah
- [ ] `today`, `upcoming`, `project`, `inbox` masing-masing menerima
      `includeCompleted?: boolean` dan meneruskannya
- [ ] `completed()` **tidak disentuh** — ia justru kebalikannya
- [ ] Tes: tiap fungsi dengan toggle mati (perilaku lama) dan nyala
- [ ] Tes: task terhapus tetap tidak muncul, meski toggle nyala
- [ ] **Verifikasi:** `npm test -w @better/core` hijau; `views.ts` tetap 100%
      branch coverage

## B. UI

- [ ] Hook `useShowCompleted()` di `apps/web/src/hooks/` — `[value, toggle]`,
      tersimpan di `localStorage`. Ikuti pola `useTheme.ts` yang sudah ada
      (`STORAGE_KEY`, baca saat inisialisasi, tulis saat berubah)
- [ ] Tombol di header `TodayReal`, `InboxReal`, `UpcomingReal`, `ProjectReal`
- [ ] Teruskan nilainya ke pemanggilan `computeToday`/`computeInbox`/dst
- [ ] `TaskRow` **tidak diubah** — `done` dan `.task-row--done` sudah ada
      (`TaskRow.css:81`), tinggal terpakai
- [ ] Kalau fitur 18 sudah mendarat, `AnytimeView`/`SomedayView` ikut
- [ ] **Verifikasi:** seluruh Success Criteria spec §7; `npm run verify` hijau
