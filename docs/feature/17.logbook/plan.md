# Plan: Logbook

Dua blok. A core (murni, tanpa UI), B view.

Dilacak di epic **[#47](https://github.com/xpasqa/better-than-yesterday/issues/47)**.

---

## A. Core — `packages/core/src/logbook.ts`

- [ ] `LogEntry` + `logbook(nodes, completions)` sesuai spec §6
- [ ] Task biasa: `kind==='item' && deletedAt===null && completedAt!==null`
- [ ] Occurrence: tiap baris `completion`, node-nya dicari dari `nodes`
- [ ] Baris `completion` yang node-nya tidak ada / sudah terhapus **dilewati**
- [ ] Urut `completedAt` menurun
- [ ] `packages/core/package.json` — tambah entri exports `./logbook`
      (**mudah terlewat**, pernah jadi bug di #23)
- [ ] Tes: task biasa saja; occurrence saja; campuran terurut benar; task
      recurring dicentang 3× → 3 entri; node terhapus → entri dilewati;
      daftar kosong → `[]`
- [ ] **Verifikasi:** `npm test -w @better/core` hijau, `logbook.ts` 100%
      branch coverage

## B. View — `LogbookView.tsx`

- [ ] `types/index.ts` — `'logbook'` masuk `ViewType`
- [ ] `routes.ts` — `'logbook'` masuk `PLAIN_VIEWS`
- [ ] `App.tsx` — cabang `activeView === 'logbook'`
- [ ] `Sidebar.tsx` — nav item Logbook
- [ ] `LogbookView.tsx` mengikuti bentuk `TodayReal.tsx`
- [ ] Perlu `useAllCompletions()` — hook baru di `store/use-nodes.ts`,
      polanya sama dengan `useAllNodes`/`useAllLabels` yang sudah ada
- [ ] Dikelompokkan per tanggal (occurrence pakai `occurredOn`, task biasa
      pakai tanggal dari `completedAt`)
- [ ] 50 entri awal, tombol "Muat lebih banyak" menambah 50
- [ ] Kondisi kosong yang mengarahkan
- [ ] **Verifikasi:** seluruh Success Criteria spec §7; `npm run verify` hijau
